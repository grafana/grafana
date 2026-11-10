package nats

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/url"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

const (
	routeAuthUser = "grafana"

	// routeCredentialKeySuffix names the route credential row in the peer
	// registry section. Peer rows are keyed "<cluster>/<server>"; this key has
	// no "/", so it can neither collide with a peer row nor fall in the
	// cluster's peer prefix range.
	routeCredentialKeySuffix = ".route-credential"

	loopbackListenAddress = "127.0.0.1"
	wildcardListenAddress = "0.0.0.0"
)

// errRouteCredentialUndecryptable marks a stored route credential that does
// not decrypt: it was written by another build, is corrupt, or was encrypted
// with keys or in a namespace this instance does not have.
var errRouteCredentialUndecryptable = errors.New("the stored nats route credential cannot be decrypted")

func routeCredentialKey(clusterName string) string {
	return clusterName + routeCredentialKeySuffix
}

// routeCipher encrypts the route credential with Secrets Manager, so the
// registry never holds it in plain text.
type routeCipher struct {
	encryption contracts.EncryptionManager
	// namespace owns the data keys. Secrets Manager has no cluster-wide
	// namespace, so the credential uses the namespace of the main org.
	namespace xkube.Namespace
}

// sealedRouteCredential is the stored form of the route credential.
type sealedRouteCredential struct {
	DataKeyID     string `json:"data_key_id"`
	EncryptedData []byte `json:"encrypted_data"`
}

func (c routeCipher) seal(ctx context.Context, password string) ([]byte, error) {
	payload, err := c.encryption.Encrypt(ctx, c.namespace, []byte(password), contracts.EncryptionOption{})
	if err != nil {
		return nil, fmt.Errorf("encrypt nats route credential: %w", err)
	}
	return json.Marshal(sealedRouteCredential{DataKeyID: payload.DataKeyID, EncryptedData: payload.EncryptedData})
}

// open decrypts a stored credential. Every failure, including a decryption
// error, is reported as undecryptable: Secrets Manager does not tell a missing
// or foreign key apart from a transient database error, and the caller keeps
// retrying either way.
func (c routeCipher) open(ctx context.Context, sealed []byte) (string, error) {
	var stored sealedRouteCredential
	if err := json.Unmarshal(sealed, &stored); err != nil || stored.DataKeyID == "" || len(stored.EncryptedData) == 0 {
		return "", errRouteCredentialUndecryptable
	}
	password, err := c.encryption.Decrypt(ctx, c.namespace, contracts.EncryptedPayload{
		DataKeyID:     stored.DataKeyID,
		EncryptedData: stored.EncryptedData,
	}, contracts.EncryptionOption{})
	if err != nil {
		return "", fmt.Errorf("%w: %w", errRouteCredentialUndecryptable, err)
	}
	if len(password) == 0 {
		return "", errRouteCredentialUndecryptable
	}
	return string(password), nil
}

// loadRouteCredentials returns the cluster route credential shared through
// the discovery registry, creating it on first use. A random value reveals
// nothing about any other secret even when it crosses the network in clear
// text.
func loadRouteCredentials(ctx context.Context, store kv.KV, cipher routeCipher, clusterName string) (*url.Userinfo, error) {
	key := routeCredentialKey(clusterName)
	password, err := readRouteCredential(ctx, store, cipher, key)
	if err == nil {
		return url.UserPassword(routeAuthUser, password), nil
	}
	if !errors.Is(err, kv.ErrNotFound) {
		return nil, err
	}

	// Deleting the row and restarting every instance rotates the credential:
	// the first instance to start creates a new one.
	created := randomRoutePassword()
	sealed, err := cipher.seal(ctx, created)
	if err != nil {
		return nil, err
	}
	// Create only commits when the key is absent (a primary key in SQL, a
	// conflict-checked transaction in Badger), so concurrent first startups
	// commit exactly one value. A losing create fails, for whatever reason the
	// store reports, after the winner committed, so the read-back adopts it.
	createErr := store.Batch(ctx, kv.NATSPeersSection, []kv.BatchOp{
		{Mode: kv.BatchOpCreate, Key: key, Value: sealed},
	})
	if createErr == nil {
		return url.UserPassword(routeAuthUser, created), nil
	}
	password, err = readRouteCredential(ctx, store, cipher, key)
	if err != nil {
		return nil, fmt.Errorf("create nats route credential: %w", errors.Join(createErr, err))
	}
	return url.UserPassword(routeAuthUser, password), nil
}

func randomRoutePassword() string {
	var b [32]byte
	// rand.Read never returns an error: it crashes the program rather than
	// return fewer or predictable bytes.
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}

func readRouteCredential(ctx context.Context, store kv.KV, cipher routeCipher, key string) (string, error) {
	r, err := store.Get(ctx, kv.NATSPeersSection, key)
	if err != nil {
		return "", err
	}
	defer func() { _ = r.Close() }()
	value, err := io.ReadAll(r)
	if err != nil {
		return "", err
	}
	return cipher.open(ctx, bytes.TrimSpace(value))
}

// autoListenAddress picks the cluster listen address when listen_address is
// unset. Only instances that share a MySQL or Postgres database can discover
// peers on other hosts, and the cluster port is only opened beyond loopback
// when routes authenticate.
func autoListenAddress(logger log.Logger, cfg setting.NATSSettings, dbDriver string, authenticated bool) string {
	sharedDB := dbDriver == migrator.MySQL || dbDriver == migrator.Postgres
	if !sharedDB || !cfg.DiscoveryEnabled {
		return loopbackListenAddress
	}
	if !authenticated {
		logger.Warn("nats cluster port bound to loopback because no route credential is available, so routes cannot be "+
			"authenticated; only instances on this host can cluster until a restart can read or create the credential, "+
			"or listen_address is set", "listen_address", loopbackListenAddress, "database", dbDriver)
		return loopbackListenAddress
	}
	logger.Info("nats cluster port bound to all interfaces so instances on other hosts sharing the database can cluster; "+
		"routes authenticate with a credential shared through the database", "listen_address", wildcardListenAddress, "database", dbDriver)
	return wildcardListenAddress
}

// warnExposedClusterPort warns when the cluster port listens beyond loopback
// without the protection the rest of the configuration assumes. Cluster TLS is
// always mutual, so it authenticates peers by itself.
func warnExposedClusterPort(logger log.Logger, cfg setting.NATSSettings, authenticated bool) {
	if cfg.ClusterTLS.Enabled() || isLoopbackHost(cfg.ListenAddress) {
		return
	}
	if authenticated {
		logger.Warn("nats cluster port listens beyond loopback without cluster TLS: route credentials cross the network "+
			"in clear text and can be replayed by anyone who can observe the traffic. Configure cluster TLS "+
			"(cluster_tls_cert_path, cluster_tls_key_path, cluster_tls_ca_path), or restrict the cluster port to the "+
			"Grafana instances, for example with firewall rules or a Kubernetes network policy", "listen_address", cfg.ListenAddress)
		return
	}
	logger.Warn("nats cluster port listens beyond loopback without route credentials or cluster TLS: it accepts routes "+
		"from any host that can reach it. Route credentials need peer discovery through a shared database; otherwise "+
		"configure cluster TLS, or restrict the cluster port to the Grafana instances", "listen_address", cfg.ListenAddress)
}

// isLoopbackHost reports whether addr only accepts connections from this host.
func isLoopbackHost(addr string) bool {
	host := bareHost(addr)
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// withRouteCredentials returns copies of routes carrying creds. The registry
// stores routes without credentials, so they are only added for the server.
func withRouteCredentials(routes []*url.URL, creds *url.Userinfo) []*url.URL {
	if creds == nil {
		return routes
	}
	out := make([]*url.URL, 0, len(routes))
	for _, r := range routes {
		u := *r
		u.User = creds
		out = append(out, &u)
	}
	return out
}

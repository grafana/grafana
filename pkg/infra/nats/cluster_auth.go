package nats

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"net/url"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	routeAuthUser = "grafana"

	// routeCredentialVersion is the only version of the route credential: it
	// is replaced by deleting it, never updated in place by this package.
	routeCredentialVersion = 1

	loopbackListenAddress = "127.0.0.1"
	wildcardListenAddress = "0.0.0.0"
)

// errRouteCredentialUndecryptable marks a stored route credential that does
// not decrypt: it is corrupt, or was encrypted with keys or in a namespace
// this instance does not have.
var errRouteCredentialUndecryptable = errors.New("the stored nats route credential cannot be decrypted")

// routeCredentialName names the route credential among the Secrets Manager
// encrypted values. A ":" is not valid in a Kubernetes name, so no SecureValue,
// whose encrypted values share the table, can take it, and the garbage
// collector, which only deletes the values of SecureValues, never touches it.
func routeCredentialName(clusterName string) string {
	return "nats:" + clusterName + ".route-credential"
}

// routeCredentialStore keeps the route credential as a Secrets Manager
// encrypted value, without a SecureValue, so it is never in plain text and
// consolidation re-encrypts it with every other secret when the encryption
// provider changes.
type routeCredentialStore struct {
	encryption contracts.EncryptionManager
	values     contracts.EncryptedValueStorage
	// namespace owns the value and its data keys. Secrets Manager has no
	// cluster-wide namespace, so the credential uses the main org's.
	namespace xkube.Namespace
}

// read returns the stored credential, or contracts.ErrEncryptedValueNotFound.
func (c routeCredentialStore) read(ctx context.Context, name string) (string, error) {
	stored, err := c.values.Get(ctx, c.namespace, name, routeCredentialVersion)
	if err != nil {
		return "", err
	}
	// Every decryption failure is reported as undecryptable: Secrets Manager
	// does not tell a missing or foreign key apart from a transient database
	// error, and the caller keeps retrying either way.
	password, err := c.encryption.Decrypt(ctx, c.namespace, stored.EncryptedPayload, contracts.EncryptionOption{})
	if err != nil {
		return "", fmt.Errorf("%w: %w", errRouteCredentialUndecryptable, err)
	}
	if len(password) == 0 {
		return "", errRouteCredentialUndecryptable
	}
	return string(password), nil
}

// loadRouteCredentials returns the cluster route credential shared through
// Secrets Manager, creating it on first use. A random value reveals nothing
// about any other secret even when it crosses the network in clear text.
func loadRouteCredentials(ctx context.Context, creds routeCredentialStore, clusterName string) (*url.Userinfo, error) {
	name := routeCredentialName(clusterName)
	password, err := creds.read(ctx, name)
	if err == nil {
		return url.UserPassword(routeAuthUser, password), nil
	}
	if !errors.Is(err, contracts.ErrEncryptedValueNotFound) {
		return nil, err
	}

	// Deleting the value and restarting every instance rotates the credential:
	// the first instance to start creates a new one.
	created := randomRoutePassword()
	payload, err := creds.encryption.Encrypt(ctx, creds.namespace, []byte(created), contracts.EncryptionOption{})
	if err != nil {
		return nil, fmt.Errorf("encrypt nats route credential: %w", err)
	}
	// Create only commits when the value is absent (namespace, name and
	// version are the primary key), so concurrent first startups commit
	// exactly one. A losing create fails, for whatever reason the store
	// reports, after the winner committed, so the read-back adopts it.
	_, createErr := creds.values.Create(ctx, creds.namespace, name, routeCredentialVersion, payload)
	if createErr == nil {
		return url.UserPassword(routeAuthUser, created), nil
	}
	password, err = creds.read(ctx, name)
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

// sharedDatabase reports whether dbDriver names a database that instances on
// other hosts can share, and so find each other through.
func sharedDatabase(dbDriver string) bool {
	return dbDriver == migrator.MySQL || dbDriver == migrator.Postgres
}

// autoListenAddress picks the cluster listen address when listen_address is
// unset. Only instances that share a MySQL or Postgres database can discover
// peers on other hosts.
func autoListenAddress(logger log.Logger, dbDriver string) string {
	if !sharedDatabase(dbDriver) {
		return loopbackListenAddress
	}
	logger.Info("nats cluster port bound to all interfaces so instances on other hosts sharing the database can cluster; "+
		"routes authenticate with a credential shared through the database", "listen_address", wildcardListenAddress, "database", dbDriver)
	return wildcardListenAddress
}

// warnExposedClusterPort warns when the cluster port listens beyond loopback
// without cluster TLS. Routes always authenticate, but the credential crosses
// the network in clear text. Cluster TLS is always mutual, so it authenticates
// peers by itself.
func warnExposedClusterPort(logger log.Logger, cfg setting.NATSSettings) {
	if cfg.ClusterTLS.Enabled() || isLoopbackHost(cfg.ListenAddress) {
		return
	}
	logger.Warn("nats cluster port listens beyond loopback without cluster TLS: route credentials cross the network "+
		"in clear text and can be replayed by anyone who can observe the traffic. Configure cluster TLS "+
		"(cluster_tls_cert_path, cluster_tls_key_path, cluster_tls_ca_path), or restrict the cluster port to the "+
		"Grafana instances, for example with firewall rules or a Kubernetes network policy", "listen_address", cfg.ListenAddress)
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

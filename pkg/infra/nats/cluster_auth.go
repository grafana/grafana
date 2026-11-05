package nats

import (
	"encoding/hex"
	"net"
	"net/url"

	"golang.org/x/crypto/argon2"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	// publishedSecretKey is the secret_key shipped in defaults.ini. Anyone can
	// derive route credentials from it, so it never authenticates routes.
	publishedSecretKey = "SW2YcwTIb9zpOOhoPsMm"

	// routeAuthPurpose separates the route credential from every other value
	// derived from secret_key, so it reveals nothing that is reused elsewhere.
	// It is also the argon2id salt: a per-instance salt would give every
	// instance a different password.
	routeAuthPurpose = "grafana-nats-cluster-route-auth-v1"
	routeAuthUser    = "grafana"

	// The route password crosses the network in clear text without cluster TLS,
	// so argon2id makes each secret_key guess against a sniffed password cost
	// 64 MiB and a fraction of a second. It is derived once at startup.
	routeKeyTime      = 3
	routeKeyMemoryKiB = 64 * 1024
	routeKeyThreads   = 4
	routeKeyLen       = 32

	loopbackListenAddress = "127.0.0.1"
	wildcardListenAddress = "0.0.0.0"
)

type argon2Cost struct {
	time      uint32
	memoryKiB uint32
	threads   uint8
}

// routeKeyCost is only lowered by tests, which start many servers.
var routeKeyCost = argon2Cost{time: routeKeyTime, memoryKiB: routeKeyMemoryKiB, threads: routeKeyThreads}

// routeCredentials derives the cluster route user and password from
// secret_key, which every HA instance must already share, so a host without it
// cannot join the mesh. It returns nil when secret_key is empty or the
// published default.
func routeCredentials(secretKey string) *url.Userinfo {
	if secretKey == "" || secretKey == publishedSecretKey {
		return nil
	}
	c := routeKeyCost
	key := argon2.IDKey([]byte(secretKey), []byte(routeAuthPurpose), c.time, c.memoryKiB, c.threads, routeKeyLen)
	return url.UserPassword(routeAuthUser, hex.EncodeToString(key))
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
		logger.Warn("nats cluster port bound to loopback because secret_key is empty or the published default, so routes "+
			"cannot be authenticated; only instances on this host can cluster. Set a non-default secret_key shared by "+
			"every instance, or set listen_address", "listen_address", loopbackListenAddress, "database", dbDriver)
		return loopbackListenAddress
	}
	logger.Info("nats cluster port bound to all interfaces so instances on other hosts sharing the database can cluster; "+
		"routes authenticate with a credential derived from secret_key", "listen_address", wildcardListenAddress, "database", dbDriver)
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
		"from any host that can reach it. Set a non-default secret_key shared by every instance, or configure cluster TLS",
		"listen_address", cfg.ListenAddress)
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

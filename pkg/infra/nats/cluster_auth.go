package nats

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/url"

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
	routeAuthPurpose = "grafana-nats-cluster-route-auth-v1"
	routeAuthUser    = "grafana"

	loopbackListenAddress = "127.0.0.1"
	wildcardListenAddress = "0.0.0.0"
)

// routeCredentials derives the cluster route user and password from
// secret_key, which every HA instance must already share, so a host without it
// cannot join the mesh. It returns nil when secret_key is empty or the
// published default.
func routeCredentials(secretKey string) *url.Userinfo {
	if secretKey == "" || secretKey == publishedSecretKey {
		return nil
	}
	mac := hmac.New(sha256.New, []byte(secretKey))
	mac.Write([]byte(routeAuthPurpose))
	return url.UserPassword(routeAuthUser, hex.EncodeToString(mac.Sum(nil)))
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

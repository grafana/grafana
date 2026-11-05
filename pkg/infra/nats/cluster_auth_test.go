package nats

import (
	"net/url"
	"testing"

	natsserver "github.com/nats-io/nats-server/v2/server"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

func TestRouteCredentials(t *testing.T) {
	t.Run("an empty or published secret_key yields no credentials", func(t *testing.T) {
		require.Nil(t, routeCredentials(""))
		require.Nil(t, routeCredentials(publishedSecretKey))
	})

	t.Run("instances sharing secret_key derive the same credentials", func(t *testing.T) {
		a := routeCredentials("test-secret-a")
		require.NotNil(t, a)
		require.Equal(t, a, routeCredentials("test-secret-a"))
		require.Equal(t, routeAuthUser, a.Username())

		pass, ok := a.Password()
		require.True(t, ok)
		require.Len(t, pass, 64)
		require.NotContains(t, pass, "test-secret-a")

		other, _ := routeCredentials("test-secret-b").Password()
		require.NotEqual(t, pass, other)
	})
}

func TestWarnExposedClusterPort(t *testing.T) {
	tlsCfg := setting.NATSClusterTLSSettings{CertPath: "/c", KeyPath: "/k", CAPath: "/ca"}
	cases := []struct {
		name          string
		listen        string
		tls           setting.NATSClusterTLSSettings
		authenticated bool
		want          string
	}{
		{name: "credentials in clear text on all interfaces", listen: "0.0.0.0", authenticated: true, want: "clear text"},
		{name: "credentials in clear text on a routable address", listen: "10.9.0.1", authenticated: true, want: "clear text"},
		{name: "no credentials on a routable address", listen: "10.9.0.1", want: "accepts routes from any host"},
		{name: "no credentials on ipv6 all interfaces", listen: "::", want: "accepts routes from any host"},
		{name: "cluster tls with credentials", listen: "0.0.0.0", tls: tlsCfg, authenticated: true},
		{name: "cluster tls without credentials", listen: "10.9.0.1", tls: tlsCfg},
		{name: "loopback without credentials", listen: "127.0.0.1"},
		{name: "ipv6 loopback without credentials", listen: "[::1]"},
		{name: "localhost without credentials", listen: "localhost"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			fake := &logtest.Fake{}
			warnExposedClusterPort(fake, setting.NATSSettings{ListenAddress: tc.listen, ClusterTLS: tc.tls}, tc.authenticated)
			if tc.want == "" {
				require.Zero(t, fake.WarnLogs.Calls)
				return
			}
			require.Equal(t, 1, fake.WarnLogs.Calls)
			require.Contains(t, fake.WarnLogs.Message, tc.want)
		})
	}
}

func TestAutoListenAddress(t *testing.T) {
	cases := []struct {
		name          string
		driver        string
		authenticated bool
		discovery     bool
		want          string
		info, warn    int
	}{
		{name: "mysql with a usable secret binds every interface", driver: migrator.MySQL, authenticated: true, discovery: true, want: wildcardListenAddress, info: 1},
		{name: "postgres with a usable secret binds every interface", driver: migrator.Postgres, authenticated: true, discovery: true, want: wildcardListenAddress, info: 1},
		{name: "mysql without a usable secret stays on loopback and warns", driver: migrator.MySQL, discovery: true, want: loopbackListenAddress, warn: 1},
		{name: "postgres without a usable secret stays on loopback and warns", driver: migrator.Postgres, discovery: true, want: loopbackListenAddress, warn: 1},
		{name: "sqlite stays on loopback", driver: migrator.SQLite, authenticated: true, discovery: true, want: loopbackListenAddress},
		{name: "no database stays on loopback", authenticated: true, discovery: true, want: loopbackListenAddress},
		{name: "disabled discovery stays on loopback", driver: migrator.Postgres, authenticated: true, want: loopbackListenAddress},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			fake := &logtest.Fake{}
			got := autoListenAddress(fake, setting.NATSSettings{DiscoveryEnabled: tc.discovery}, tc.driver, tc.authenticated)
			require.Equal(t, tc.want, got)
			require.Equal(t, tc.info, fake.InfoLogs.Calls)
			require.Equal(t, tc.warn, fake.WarnLogs.Calls)
		})
	}
}

func TestServerListenAddress(t *testing.T) {
	t.Run("an unset listen address without a shared database binds loopback", func(t *testing.T) {
		cfg := newEmbeddedTestCfg("", "")
		cfg.SecretKey = "test-secret-a"
		s, err := ProvideServer(cfg, nil, prometheus.NewRegistry())
		require.NoError(t, err)
		require.Equal(t, loopbackListenAddress, s.opts.Cluster.Host)
	})

	t.Run("an explicit listen address is used as is", func(t *testing.T) {
		cfg := newEmbeddedTestCfg("10.9.0.1", "")
		s, err := ProvideServer(cfg, nil, prometheus.NewRegistry())
		require.NoError(t, err)
		require.Equal(t, "10.9.0.1", s.opts.Cluster.Host)
	})

	t.Run("routes require credentials only with a usable secret_key", func(t *testing.T) {
		for secret, wantUser := range map[string]string{
			"test-secret-a":    routeAuthUser,
			publishedSecretKey: "",
			"":                 "",
		} {
			cfg := newEmbeddedTestCfg("127.0.0.1", "")
			cfg.SecretKey = secret
			s, err := ProvideServer(cfg, nil, prometheus.NewRegistry())
			require.NoError(t, err)
			require.Equal(t, wantUser, s.opts.Cluster.Username, "secret_key %q", secret)
		}
	})
}

func TestServerClusterRouteAuth(t *testing.T) {
	t.Run("instances sharing secret_key form a route without storing credentials", func(t *testing.T) {
		store := newSharedTestKV(t)
		a := startTestAuthServer(t, store, "test-secret-a", nil)
		b := startTestAuthServer(t, store, "test-secret-a", nil)

		requireDelivery(t, a, b)
		for _, s := range []*Server{a, b} {
			u, err := url.Parse(registeredRouteURL(t, s))
			require.NoError(t, err)
			require.Nil(t, u.User, "registry row carries credentials")
		}
	})

	t.Run("an instance with a different secret_key cannot join", func(t *testing.T) {
		store := newSharedTestKV(t)
		hookA, hookB := newLogHook(), newLogHook()
		startTestAuthServer(t, store, "test-secret-a", hookA)
		startTestAuthServer(t, store, "test-secret-b", hookB)

		// The dialer counts a route until the peer rejects its CONNECT, so the
		// proof is that each side rejects the route the other dials.
		hookA.waitForLog(t, "authentication error")
		hookB.waitForLog(t, "authentication error")
	})

	t.Run("an instance without credentials is rejected", func(t *testing.T) {
		hook := newLogHook()
		// No discovery: only the instance without credentials dials.
		a := startTestAuthServer(t, nil, "test-secret-a", hook)
		b := startTestAuthServer(t, nil, "", nil)

		require.NoError(t, b.setRoutes(natsserver.RoutesFromStr(routeURLForServer(a.cfg, a.server))))
		hook.waitForLog(t, "authentication error")
		// The accepting side checks credentials before it registers the route.
		require.Zero(t, numRoutes(a))
	})
}

func TestServerLoggerMasksRoutePassword(t *testing.T) {
	creds := routeCredentials("test-secret-a")
	pass, _ := creds.Password()
	hook := newLogHook()
	l := newServerLogger(hook, creds)

	route := &url.URL{Scheme: "nats", Host: "10.9.0.1:6222", User: creds}
	l.Errorf("Removed route %v", route)
	logged := hook.drain()
	require.Len(t, logged, 1)
	require.NotContains(t, logged[0], pass)
	require.Contains(t, logged[0], "10.9.0.1:6222")
}

// startTestAuthServer starts an embedded server on loopback with discovery
// through store, or without discovery for a nil store.
func startTestAuthServer(t *testing.T, store kv.KV, secretKey string, hook *logHook) *Server {
	t.Helper()
	cfg := newEmbeddedTestCfg("127.0.0.1", "")
	cfg.NATS.DiscoveryEnabled = store != nil
	cfg.SecretKey = secretKey
	s := newKVTestServer(t, cfg, store)
	if hook != nil {
		s.log = hook
	}
	startService(t, t.Context(), s)
	return s
}

package nats

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/url"
	"strings"
	"sync"
	"testing"

	natsserver "github.com/nats-io/nats-server/v2/server"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

func TestLoadRouteCredentials(t *testing.T) {
	t.Run("the first load creates a random credential and later loads reuse it", func(t *testing.T) {
		store := newSharedTestKV(t)
		first, err := loadRouteCredentials(t.Context(), store, discoveryClusterName)
		require.NoError(t, err)
		require.Equal(t, routeAuthUser, first.Username())
		pass, _ := first.Password()
		require.Len(t, pass, 64)
		require.Equal(t, pass, storedRouteCredential(t, store))

		again, err := loadRouteCredentials(t.Context(), store, discoveryClusterName)
		require.NoError(t, err)
		require.Equal(t, first, again)

		other, err := loadRouteCredentials(t.Context(), newSharedTestKV(t), discoveryClusterName)
		require.NoError(t, err)
		require.NotEqual(t, first, other)
	})

	t.Run("concurrent first loads converge on one credential", func(t *testing.T) {
		// No timers are involved: a barrier releases every load at once and
		// the WaitGroup waits for all of them.
		store := newSharedTestKV(t)
		const loaders = 16
		start := make(chan struct{})
		got := make([]string, loaders)
		errs := make([]error, loaders)
		var wg sync.WaitGroup
		for i := range loaders {
			wg.Go(func() {
				<-start
				creds, err := loadRouteCredentials(t.Context(), store, discoveryClusterName)
				errs[i] = err
				if err == nil {
					got[i], _ = creds.Password()
				}
			})
		}
		close(start)
		wg.Wait()

		require.NoError(t, errors.Join(errs...))
		want := storedRouteCredential(t, store)
		for _, pass := range got {
			require.Equal(t, want, pass)
		}
	})

	t.Run("a store failure returns an error", func(t *testing.T) {
		_, err := loadRouteCredentials(t.Context(), failingKV{}, discoveryClusterName)
		require.ErrorIs(t, err, errStoreDown)
	})

	t.Run("the credential row is not a peer", func(t *testing.T) {
		store := newSharedTestKV(t)
		_, err := loadRouteCredentials(t.Context(), store, discoveryClusterName)
		require.NoError(t, err)
		require.Empty(t, registeredPeers(t, store))
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
		{name: "mysql with a credential binds every interface", driver: migrator.MySQL, authenticated: true, discovery: true, want: wildcardListenAddress, info: 1},
		{name: "postgres with a credential binds every interface", driver: migrator.Postgres, authenticated: true, discovery: true, want: wildcardListenAddress, info: 1},
		{name: "mysql without a credential stays on loopback and warns", driver: migrator.MySQL, discovery: true, want: loopbackListenAddress, warn: 1},
		{name: "postgres without a credential stays on loopback and warns", driver: migrator.Postgres, discovery: true, want: loopbackListenAddress, warn: 1},
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
		s := newKVTestServer(t, newEmbeddedTestCfg("", ""), newSharedTestKV(t))
		require.Equal(t, loopbackListenAddress, s.opts.Cluster.Host)
		require.Equal(t, routeAuthUser, s.opts.Cluster.Username)
	})

	t.Run("an unset listen address on a shared database binds every interface", func(t *testing.T) {
		s, err := newServer(newEmbeddedTestCfg("", "").NATS, newSharedTestKV(t), migrator.Postgres, log.New("infra.nats.server"), prometheus.NewRegistry())
		require.NoError(t, err)
		require.Equal(t, wildcardListenAddress, s.opts.Cluster.Host)
		require.Equal(t, routeAuthUser, s.opts.Cluster.Username)
	})

	t.Run("a store failure falls back to loopback with a warning", func(t *testing.T) {
		hook := newLogHook()
		s, err := newServer(newEmbeddedTestCfg("", "").NATS, failingKV{}, migrator.Postgres, hook, prometheus.NewRegistry())
		require.NoError(t, err)
		require.Equal(t, loopbackListenAddress, s.opts.Cluster.Host)
		require.Empty(t, s.opts.Cluster.Username)
		hook.waitForLog(t, "warn: nats cluster routes are unauthenticated: failed to read or create the route credential")
	})

	t.Run("an explicit listen address is used as is", func(t *testing.T) {
		s := newKVTestServer(t, newEmbeddedTestCfg("10.9.0.1", ""), newSharedTestKV(t))
		require.Equal(t, "10.9.0.1", s.opts.Cluster.Host)
	})

	t.Run("routes require credentials only with discovery through a shared store", func(t *testing.T) {
		withDiscovery := newKVTestServer(t, newEmbeddedTestCfg("127.0.0.1", ""), newSharedTestKV(t))
		require.Equal(t, routeAuthUser, withDiscovery.opts.Cluster.Username)

		standalone := newKVTestServer(t, newEmbeddedTestCfg("127.0.0.1", ""), nil)
		require.Empty(t, standalone.opts.Cluster.Username)

		cfg := newEmbeddedTestCfg("127.0.0.1", "")
		cfg.NATS.DiscoveryEnabled = false
		noDiscovery := newKVTestServer(t, cfg, newSharedTestKV(t))
		require.Empty(t, noDiscovery.opts.Cluster.Username)
	})
}

func TestServerClusterRouteAuth(t *testing.T) {
	t.Run("instances on one store share the credential and form a route without exposing it", func(t *testing.T) {
		store := newSharedTestKV(t)
		logs := &recordingLogger{Logger: log.NewNopLogger()}
		a := startTestAuthServer(t, store, logs)
		b := startTestAuthServer(t, store, logs)

		require.Equal(t, a.routeAuth, b.routeAuth)
		requireDelivery(t, a, b)
		for _, s := range []*Server{a, b} {
			u, err := url.Parse(registeredRouteURL(t, s))
			require.NoError(t, err)
			require.Nil(t, u.User, "registry row carries credentials")
		}
		pass, _ := a.routeAuth.Password()
		logs.requireNotLogged(t, pass)
	})

	t.Run("an instance with a different credential cannot join", func(t *testing.T) {
		hookA, hookB := newLogHook(), newLogHook()
		// Separate stores give each instance its own credential, so each dials
		// the other explicitly.
		a := startTestAuthServer(t, newSharedTestKV(t), hookA)
		b := startTestAuthServer(t, newSharedTestKV(t), hookB)
		require.NotEqual(t, a.routeAuth, b.routeAuth)

		require.NoError(t, a.setRoutes(natsserver.RoutesFromStr(routeURLForServer(b.cfg, b.server))))
		require.NoError(t, b.setRoutes(natsserver.RoutesFromStr(routeURLForServer(a.cfg, a.server))))
		// The dialer counts a route until the peer rejects its CONNECT, so the
		// proof is that each side rejects the route the other dials.
		hookA.waitForLog(t, "authentication error")
		hookB.waitForLog(t, "authentication error")
	})

	t.Run("an instance without credentials is rejected", func(t *testing.T) {
		hook := newLogHook()
		a := startTestAuthServer(t, newSharedTestKV(t), hook)
		// Without a store b has no credential and no discovery.
		b := startTestAuthServer(t, nil, nil)
		require.Nil(t, b.routeAuth)

		require.NoError(t, b.setRoutes(natsserver.RoutesFromStr(routeURLForServer(a.cfg, a.server))))
		hook.waitForLog(t, "authentication error")
		// The accepting side checks credentials before it registers the route.
		require.Zero(t, numRoutes(a))
	})
}

func TestServerLoggerMasksRoutePassword(t *testing.T) {
	creds, err := loadRouteCredentials(t.Context(), newSharedTestKV(t), discoveryClusterName)
	require.NoError(t, err)
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
func startTestAuthServer(t *testing.T, store kv.KV, logger log.Logger) *Server {
	t.Helper()
	cfg := newEmbeddedTestCfg("127.0.0.1", "")
	cfg.NATS.DiscoveryEnabled = store != nil
	if logger == nil {
		logger = log.New("infra.nats.server")
	}
	s, err := newServer(cfg.NATS, store, "", logger, prometheus.NewRegistry())
	require.NoError(t, err)
	startService(t, t.Context(), s)
	return s
}

func storedRouteCredential(t *testing.T, store kv.KV) string {
	t.Helper()
	pass, err := readRouteCredential(t.Context(), store, routeCredentialKey(discoveryClusterName))
	require.NoError(t, err)
	return pass
}

var errStoreDown = errors.New("store down")

// failingKV fails every call loadRouteCredentials makes.
type failingKV struct{ kv.KV }

func (failingKV) Get(context.Context, string, string) (io.ReadCloser, error) {
	return nil, errStoreDown
}

func (failingKV) Batch(context.Context, string, []kv.BatchOp) error {
	return errStoreDown
}

// recordingLogger keeps every record with its key/value pairs, so a test can
// check that a value was never logged anywhere in a record.
type recordingLogger struct {
	log.Logger
	mu      sync.Mutex
	records []string
}

func (l *recordingLogger) record(msg string, ctx []any) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.records = append(l.records, fmt.Sprint(append([]any{msg}, ctx...)...))
}

func (l *recordingLogger) Debug(msg string, ctx ...any) { l.record(msg, ctx) }
func (l *recordingLogger) Info(msg string, ctx ...any)  { l.record(msg, ctx) }
func (l *recordingLogger) Warn(msg string, ctx ...any)  { l.record(msg, ctx) }
func (l *recordingLogger) Error(msg string, ctx ...any) { l.record(msg, ctx) }

func (l *recordingLogger) Log(keyvals ...any) error {
	l.record("", keyvals)
	return nil
}

func (l *recordingLogger) requireNotLogged(t *testing.T, value string) {
	t.Helper()
	l.mu.Lock()
	defer l.mu.Unlock()
	require.NotEmpty(t, l.records)
	for _, r := range l.records {
		require.False(t, strings.Contains(r, value), "logged %q", r)
	}
}

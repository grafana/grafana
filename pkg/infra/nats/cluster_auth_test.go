package nats

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/grafana/dskit/backoff"
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

func TestServerRouteCredentialStartup(t *testing.T) {
	for listen, want := range map[string]string{"": wildcardListenAddress, "10.9.0.1": "10.9.0.1"} {
		t.Run("a store failing at startup keeps the address "+strconv.Quote(want)+" behind a placeholder", func(t *testing.T) {
			hook := newLogHook()
			s, err := newServer(newEmbeddedTestCfg(listen, "").NATS, failingKV{}, migrator.Postgres, hook, prometheus.NewRegistry())
			require.NoError(t, err)

			require.Equal(t, want, s.opts.Cluster.Host)
			require.Nil(t, s.routeAuth)
			require.Equal(t, routeAuthUser, s.opts.Cluster.Username)
			require.Len(t, s.opts.Cluster.Password, 64)
			// The port is authenticated by the placeholder, so only the clear
			// text warning applies.
			msgs := hook.drain()
			require.Contains(t, msgs, "warn: nats cluster routes wait for the route credential; clustering starts once it can be read or created")
			for _, msg := range msgs {
				require.NotContains(t, msg, "accepts routes from any host")
			}
		})
	}

	t.Run("each process gets its own placeholder", func(t *testing.T) {
		a, err := newServer(newEmbeddedTestCfg("", "").NATS, failingKV{}, "", log.NewNopLogger(), prometheus.NewRegistry())
		require.NoError(t, err)
		b, err := newServer(newEmbeddedTestCfg("", "").NATS, failingKV{}, "", log.NewNopLogger(), prometheus.NewRegistry())
		require.NoError(t, err)
		require.NotEqual(t, a.opts.Cluster.Password, b.opts.Cluster.Password)
	})

	t.Run("the background retry loads the credential once the store recovers", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			// The first read fails at construction, three more in the retry.
			store := &flakyKV{failures: 4}
			s, err := newServer(newEmbeddedTestCfg("", "").NATS, store, "", log.NewNopLogger(), prometheus.NewRegistry())
			require.NoError(t, err)
			require.NotNil(t, s.routePlaceholder)

			creds := s.awaitRouteAuth(t.Context())
			require.NotNil(t, creds)
			pass, _ := creds.Password()
			require.Equal(t, string(store.value), pass)
			require.Equal(t, 5, store.gets)
		})
	})

	t.Run("the background retry stops with the server", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			s, err := newServer(newEmbeddedTestCfg("", "").NATS, failingKV{}, "", log.NewNopLogger(), prometheus.NewRegistry())
			require.NoError(t, err)
			ctx, cancel := context.WithCancel(t.Context())
			done := make(chan *url.Userinfo)
			go func() { done <- s.awaitRouteAuth(ctx) }()

			synctest.Wait()
			cancel()
			require.Nil(t, <-done)
		})
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

	t.Run("an instance that starts without the credential joins once the store recovers", func(t *testing.T) {
		shortenRouteCredentialBackoff(t)
		store := newSharedTestKV(t)
		a := startTestAuthServer(t, store, nil)
		waitForRegisteredPeers(t, store, a)
		hookB := newLogHook()
		logsB := &recordingLogger{Logger: hookB}
		storeB := newDownKV(store)
		// On macOS a wildcard and a loopback listener can bind the same port, so
		// a loopback dial to a wildcard listener may reach another test's server.
		// b binds loopback; TestServerRouteCredentialStartup covers other
		// addresses behind the placeholder.
		b, err := newServer(newEmbeddedTestCfg("127.0.0.1", "").NATS, storeB, "", logsB, prometheus.NewRegistry())
		require.NoError(t, err)
		startService(t, t.Context(), b)

		require.True(t, b.server.ClusterAddr().IP.IsLoopback(), "cluster port bound to %s", b.server.ClusterAddr())
		placeholder := clusterPassword(b)
		stored := storedRouteCredential(t, store)
		require.NotEqual(t, stored, placeholder)
		require.Equal(t, []peer{a.discovery.self}, registeredPeers(t, store), "b registered before it has the credential")

		// A peer holding the credential cannot route to b yet.
		require.NoError(t, a.setRoutes(natsserver.RoutesFromStr(routeURLForServer(b.cfg, b.server))))
		hookB.waitForLog(t, "authentication error")

		storeB.down.Store(false)
		hookB.waitForLog(t, "info: nats clustering enabled")
		// The explicit route can deliver before b's discovery registers it.
		waitForRegisteredPeers(t, store, a, b)
		requireDelivery(t, a, b)
		require.Equal(t, stored, clusterPassword(b))

		for _, s := range []*Server{a, b} {
			u, err := url.Parse(registeredRouteURL(t, s))
			require.NoError(t, err)
			require.Nil(t, u.User, "registry row carries credentials")
		}
		requireNotStored(t, store, placeholder)
		logsB.requireNotLogged(t, placeholder)
		logsB.requireNotLogged(t, stored)
	})

	t.Run("stopping while waiting for the credential exits cleanly", func(t *testing.T) {
		shortenRouteCredentialBackoff(t)
		hook := newLogHook()
		storeB := newDownKV(newSharedTestKV(t))
		s, err := newServer(newEmbeddedTestCfg("127.0.0.1", "").NATS, storeB, "", hook, prometheus.NewRegistry())
		require.NoError(t, err)
		ctx, cancel := context.WithTimeout(t.Context(), hangGuard)
		defer cancel()
		require.NoError(t, s.StartAsync(ctx))
		require.NoError(t, s.AwaitRunning(ctx))
		// Two attempts in the background prove the retry runs before the stop.
		storeB.waitForGets(t, 3)

		s.StopAsync()
		require.NoError(t, s.AwaitTerminated(ctx))
		for _, msg := range hook.drain() {
			require.NotContains(t, msg, "clustering enabled")
		}
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
	secrets := &routeSecrets{}
	secrets.add(creds)
	l := newServerLogger(hook, secrets)

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

// waitForRegisteredPeers waits until exactly the given servers are registered:
// discovery registers on its first tick, after the server is running.
func waitForRegisteredPeers(t *testing.T, store kv.KV, servers ...*Server) {
	t.Helper()
	want := make([]string, 0, len(servers))
	for _, s := range servers {
		s.mu.RLock()
		want = append(want, s.opts.ServerName)
		s.mu.RUnlock()
	}
	slices.Sort(want)
	guard := time.After(hangGuard)
	for {
		peers := registeredPeers(t, store)
		got := make([]string, 0, len(peers))
		for _, p := range peers {
			got = append(got, p.ServerName)
		}
		slices.Sort(got)
		if slices.Equal(got, want) {
			return
		}
		select {
		case <-guard:
			t.Fatalf("registered peers %v, want %v", got, want)
		case <-time.After(10 * time.Millisecond):
		}
	}
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

// flakyKV keeps the route credential in memory and fails its first reads.
type flakyKV struct {
	kv.KV
	failures int
	gets     int
	value    []byte
}

func (f *flakyKV) Get(context.Context, string, string) (io.ReadCloser, error) {
	f.gets++
	if f.gets <= f.failures {
		return nil, errStoreDown
	}
	if f.value == nil {
		return nil, kv.ErrNotFound
	}
	return io.NopCloser(bytes.NewReader(f.value)), nil
}

func (f *flakyKV) Batch(_ context.Context, _ string, ops []kv.BatchOp) error {
	f.value = ops[0].Value
	return nil
}

// switchableKV fails the route credential calls while down.
type switchableKV struct {
	kv.KV
	down atomic.Bool
	gets atomic.Int64
	got  chan struct{}
}

func newDownKV(store kv.KV) *switchableKV {
	s := &switchableKV{KV: store, got: make(chan struct{}, 64)}
	s.down.Store(true)
	return s
}

func (s *switchableKV) Get(ctx context.Context, section, key string) (io.ReadCloser, error) {
	s.gets.Add(1)
	select {
	case s.got <- struct{}{}:
	default:
	}
	if s.down.Load() {
		return nil, errStoreDown
	}
	return s.KV.Get(ctx, section, key)
}

func (s *switchableKV) Batch(ctx context.Context, section string, ops []kv.BatchOp) error {
	if s.down.Load() {
		return errStoreDown
	}
	return s.KV.Batch(ctx, section, ops)
}

// waitForGets blocks until the store has served n reads.
func (s *switchableKV) waitForGets(t *testing.T, n int64) {
	t.Helper()
	guard := time.After(hangGuard)
	for s.gets.Load() < n {
		select {
		case <-s.got:
		case <-guard:
			t.Fatalf("store served %d reads, want %d", s.gets.Load(), n)
		}
	}
}

func shortenRouteCredentialBackoff(t *testing.T) {
	saved := routeCredentialBackoff
	t.Cleanup(func() { routeCredentialBackoff = saved })
	routeCredentialBackoff = backoff.Config{MinBackoff: 10 * time.Millisecond, MaxBackoff: 50 * time.Millisecond}
}

// clusterPassword reads the password the cluster port currently requires.
func clusterPassword(s *Server) string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.opts.Cluster.Password
}

func requireNotStored(t *testing.T, store kv.KV, value string) {
	t.Helper()
	for key, err := range store.Keys(t.Context(), kv.NATSPeersSection, kv.ListOptions{}) {
		require.NoError(t, err)
		r, err := store.Get(t.Context(), kv.NATSPeersSection, key)
		require.NoError(t, err)
		data, err := io.ReadAll(r)
		require.NoError(t, err)
		require.NoError(t, r.Close())
		require.NotContains(t, string(data), value, "row %q", key)
	}
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

func (l *recordingLogger) Debug(msg string, ctx ...any) {
	l.record(msg, ctx)
	l.Logger.Debug(msg, ctx...)
}
func (l *recordingLogger) Info(msg string, ctx ...any) {
	l.record(msg, ctx)
	l.Logger.Info(msg, ctx...)
}
func (l *recordingLogger) Warn(msg string, ctx ...any) {
	l.record(msg, ctx)
	l.Logger.Warn(msg, ctx...)
}
func (l *recordingLogger) Error(msg string, ctx ...any) {
	l.record(msg, ctx)
	l.Logger.Error(msg, ctx...)
}

func (l *recordingLogger) Log(keyvals ...any) error {
	l.record("", keyvals)
	return l.Logger.Log(keyvals...)
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

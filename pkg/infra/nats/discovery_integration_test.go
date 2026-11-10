package nats

import (
	"context"
	"errors"
	"net/url"
	"sync"
	"testing"
	"time"

	badger "github.com/dgraph-io/badger/v4"
	natsserver "github.com/nats-io/nats-server/v2/server"
	"github.com/prometheus/client_golang/prometheus"
	promtestutil "github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestDiscoveryEmbeddedCluster starts two embedded servers sharing a KV-backed peer
// registry and asserts they self-assemble into a working cluster, exercising the real
// ProvideServer/dskit lifecycle end-to-end. Deliberately not named TestIntegration*:
// the registry is in-memory Badger, so the per-database matrix would only repeat it.
func TestDiscoveryEmbeddedCluster(t *testing.T) {
	t.Run("servers discover each other and form a cluster route", func(t *testing.T) {
		_, a, b, _, _ := startTwoNodeCluster(t)

		// Each node's discovery loop registers itself and reloads the other's route;
		// once solicited both servers report an active cluster peer.
		require.Eventually(t, func() bool {
			return numRoutes(a) >= 1 && numRoutes(b) >= 1
		}, 15*time.Second, 100*time.Millisecond, "embedded servers did not form a cluster route")
	})

	t.Run("a message published on one node reaches a subscriber on the peer", func(t *testing.T) {
		ctx, _, _, cfgA, cfgB := startTwoNodeCluster(t)

		// Publisher connects (in-process) to node A, subscriber to node B, so a
		// delivery proves interest and the message crossed the cluster route.
		pub := ProvidePublisher(ProvideNATSConfig(cfgA.cfg, cfgA.srv), prometheus.NewRegistry())
		sub := ProvideSubscriber(ProvideNATSConfig(cfgB.cfg, cfgB.srv), prometheus.NewRegistry())
		startService(t, ctx, pub)
		startService(t, ctx, sub)

		const subject = "grafana.integration.cluster"
		received := make(chan []byte, 1)
		_, err := sub.Subscribe(ctx, subject, func(_ string, data []byte) {
			select {
			case received <- data:
			default:
			}
		})
		require.NoError(t, err)

		// Retry until the route is up and interest has propagated cluster-wide.
		require.Eventually(t, func() bool {
			require.NoError(t, pub.Publish(ctx, subject, []byte("hello")))
			select {
			case got := <-received:
				require.Equal(t, []byte("hello"), got)
				return true
			case <-time.After(50 * time.Millisecond):
				return false
			}
		}, 15*time.Second, time.Millisecond, "message did not cross the cluster route")
	})
}

// TestDiscoveryDisabled asserts that discovery_enabled=false leaves a node
// standalone: no discovery loop is wired even with a KV present, so it never
// solicits peer routes.
func TestDiscoveryDisabled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	// Two nodes share a registry, but discovery is off, so neither should register
	// or dial the other.
	store := newSharedTestKV(t)
	a, _ := newTestDiscoveryServer(t, store, false)
	b, _ := newTestDiscoveryServer(t, store, false)
	startService(t, ctx, a)
	startService(t, ctx, b)

	require.False(t, hasDiscovery(a), "discovery loop should not be wired when disabled")
	require.False(t, hasDiscovery(b), "discovery loop should not be wired when disabled")

	// No discovery means no route reconciliation; give a tick's worth of time to
	// confirm the cluster stays empty rather than merely not-yet-formed.
	require.Never(t, func() bool {
		return numRoutes(a) > 0 || numRoutes(b) > 0
	}, time.Second, 100*time.Millisecond, "nodes formed a cluster route with discovery disabled")
}

// TestDiscoveryWakeOnLeave asserts that a node leaving gracefully makes its
// peers drop its route without waiting for their next tick. The interval is too
// long for a periodic tick to fire during the test, so after each loop's first
// tick only the wake can trigger a reload. Deliberately not named
// TestIntegration*: the registry is in-memory Badger.
func TestDiscoveryWakeOnLeave(t *testing.T) {
	store := newSharedTestKV(t)
	newCfg := func() *setting.Cfg {
		cfg := newEmbeddedTestCfg("127.0.0.1", "")
		cfg.NATS.DiscoveryInterval = time.Hour
		return cfg
	}
	a := startSteppedTestServer(t, newCfg(), store)
	b := startSteppedTestServer(t, newCfg(), store)
	c := startSteppedTestServer(t, newCfg(), store)

	// The first tick of each loop routes to everyone registered above.
	reloadsA := runWithReloads(t, a)
	reloadsB := runWithReloads(t, b)
	requireReload(t, reloadsA, routeSetOf(b, c))
	requireReload(t, reloadsB, routeSetOf(a, c))
	// c sends a single wake when it leaves, so a's and b's interest in the
	// wake subject must have reached c over its routes first.
	requireWakeInterest(t, c, 2)

	require.NoError(t, c.stopping(nil))

	requireReload(t, reloadsA, routeSetOf(b))
	requireReload(t, reloadsB, routeSetOf(a))
	require.Equal(t, 1.0, promtestutil.ToFloat64(a.metrics.discoveryWakesReceived))
	require.Equal(t, 1.0, promtestutil.ToFloat64(b.metrics.discoveryWakesReceived))
}

// TestIntegrationDiscoverySQL runs discovery against the nats_discovery_peers
// table of the database selected by GRAFANA_TEST_DB, wired through
// ProvideServer's SQL store as in production. The matrix covers the
// dialect-specific upsert, range scan and batch queries and the table's
// per-dialect key collation. The test drives every tick and the registry clock
// itself rather than using synctest: route reloads start nats-server goroutines
// that share its WaitGroup and do real network I/O, so they cannot run inside a
// bubble.
func TestIntegrationDiscoverySQL(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore := db.NewTestStore(t)
	deleteRouteCredential(t, sqlStore)
	now := time.Unix(1_000, 0)
	a := startSteppedSQLServer(t, sqlStore, &now)
	b := startSteppedSQLServer(t, sqlStore, &now)
	c := startSteppedSQLServer(t, sqlStore, &now)
	store := a.kv
	ttl := a.discovery.ttl
	tick := func(nodes ...*Server) {
		for _, n := range nodes {
			n.discovery.tick(t.Context())
		}
	}

	// Join: the first round registers everyone, the second routes to everyone.
	tick(a, b, c)
	now = now.Add(time.Second)
	tick(a, b, c)
	require.ElementsMatch(t, peersOf(a, b, c), registeredPeers(t, store))
	require.Equal(t, routeSetOf(b, c), a.discovery.routes)
	require.Equal(t, routeSetOf(a, c), b.discovery.routes)
	require.Equal(t, routeSetOf(a, b), c.discovery.routes)
	requireDelivery(t, a, c)

	// Graceful leave: the row goes at shutdown and survivors drop the route on
	// their next tick.
	require.NoError(t, b.stopping(nil))
	require.ElementsMatch(t, peersOf(a, c), registeredPeers(t, store))
	now = now.Add(time.Second)
	tick(a, c)
	require.Equal(t, routeSetOf(c), a.discovery.routes)
	require.Equal(t, routeSetOf(a), c.discovery.routes)

	// Hard kill: c stops heartbeating without deregistering, so its row and route
	// stay while its last heartbeat is within the TTL...
	c.shutdown()
	now = now.Add(ttl)
	tick(a)
	require.ElementsMatch(t, peersOf(a, c), registeredPeers(t, store))
	require.Equal(t, routeSetOf(c), a.discovery.routes)

	// ...and go on the first tick past it (heartbeats have one-second resolution).
	now = now.Add(time.Second)
	tick(a)
	require.ElementsMatch(t, peersOf(a), registeredPeers(t, store))
	require.Empty(t, a.discovery.routes)
}

// TestIntegrationServerAutoListenAddress checks the cluster port binds every
// interface only on a database instances on other hosts can share.
func TestIntegrationServerAutoListenAddress(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore := db.NewTestStore(t)
	deleteRouteCredential(t, sqlStore)
	s, err := ProvideServer(newEmbeddedTestCfg("", ""), sqlStore, testCipher(t).encryption, &contracts.SecretDBMigrated{}, prometheus.NewRegistry())
	require.NoError(t, err)
	require.NoError(t, s.starting(t.Context()))
	t.Cleanup(func() { _ = s.stopping(nil) })

	bound := s.server.ClusterAddr().IP
	switch driver := sqlStore.GetDialect().DriverName(); driver {
	case migrator.MySQL, migrator.Postgres:
		require.Equal(t, wildcardListenAddress, s.opts.Cluster.Host)
		// Go reports a dual-stack wildcard listener as "::".
		require.True(t, bound.IsUnspecified(), "cluster port bound to %s", bound)
	case migrator.SQLite:
		require.Equal(t, loopbackListenAddress, s.opts.Cluster.Host)
		require.True(t, bound.IsLoopback(), "cluster port bound to %s", bound)
	default:
		t.Fatalf("unexpected database %q", driver)
	}
	require.Equal(t, routeAuthUser, s.opts.Cluster.Username)
	stored, err := readRouteCredential(t.Context(), s.kv, s.cipher, routeCredentialKey(discoveryClusterName))
	require.NoError(t, err)
	require.Equal(t, stored, s.opts.Cluster.Password)
	requireNotStored(t, s.kv, stored)

	require.NotNil(t, s.discovery, "ProvideServer did not wire the SQL registry")
	s.discovery.tick(t.Context())
	u, err := url.Parse(registeredRouteURL(t, s))
	require.NoError(t, err)
	require.Nil(t, u.User, "registry row carries credentials")
}

// TestIntegrationRouteCredentialConcurrentCreate checks that instances starting
// together on one database adopt a single route credential.
func TestIntegrationRouteCredentialConcurrentCreate(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore := db.NewTestStore(t)
	store, err := kv.NewSQLKV(sqlStore.GetEngine().DB().DB, sqlStore.GetDialect().DriverName())
	require.NoError(t, err)
	deleteRouteCredential(t, sqlStore)
	enc := testCipher(t)

	const loaders = 8
	start := make(chan struct{})
	got := make([]string, loaders)
	errs := make([]error, loaders)
	var wg sync.WaitGroup
	for i := range loaders {
		wg.Go(func() {
			<-start
			creds, err := loadRouteCredentials(t.Context(), store, enc, discoveryClusterName)
			errs[i] = err
			if err == nil {
				got[i], _ = creds.Password()
			}
		})
	}
	close(start)
	wg.Wait()

	require.NoError(t, errors.Join(errs...))
	want, err := readRouteCredential(t.Context(), store, enc, routeCredentialKey(discoveryClusterName))
	require.NoError(t, err)
	for _, pass := range got {
		require.Equal(t, want, pass)
	}
}

// deleteRouteCredential removes the route credential from sqlStore before and
// after the test: test databases can outlive a test, and the data key that
// encrypted a leftover credential may not.
func deleteRouteCredential(t *testing.T, sqlStore db.DB) {
	t.Helper()
	store, err := kv.NewSQLKV(sqlStore.GetEngine().DB().DB, sqlStore.GetDialect().DriverName())
	require.NoError(t, err)
	key := routeCredentialKey(discoveryClusterName)
	require.NoError(t, store.Delete(t.Context(), kv.NATSPeersSection, key))
	t.Cleanup(func() { _ = store.Delete(context.Background(), kv.NATSPeersSection, key) })
}

// nodeCfg bundles a node's full Cfg with the Server it drives, so callers can
// wire a publisher/subscriber to that specific node.
type nodeCfg struct {
	cfg *setting.Cfg
	srv *Server
}

// startTwoNodeCluster boots two embedded servers sharing one in-memory peer
// registry and runs their discovery loops via the real dskit lifecycle. The
// returned context is cancelled at test end.
func startTwoNodeCluster(t *testing.T) (context.Context, *Server, *Server, nodeCfg, nodeCfg) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	store := newSharedTestKV(t)
	a, cfgA := newTestDiscoveryServer(t, store, true)
	b, cfgB := newTestDiscoveryServer(t, store, true)
	startService(t, ctx, a)
	startService(t, ctx, b)

	return ctx, a, b, nodeCfg{cfg: cfgA, srv: a}, nodeCfg{cfg: cfgB, srv: b}
}

// newTestDiscoveryServer builds a Server running a real embedded NATS server on
// OS-chosen ports, sharing the given KV-backed peer registry for auto-discovery.
func newTestDiscoveryServer(t *testing.T, store kv.KV, discoveryEnabled bool) (*Server, *setting.Cfg) {
	t.Helper()
	cfg := setting.NewCfg()
	cfg.NATS = setting.NATSSettings{
		Enabled:       true,
		Mode:          setting.NATSModeEmbedded,
		ListenAddress: "127.0.0.1",
		// RANDOM_PORT lets NATS pick free client/cluster ports so two servers
		// can run side by side; routeURLForServer reads the bound port back.
		ClientPort:        natsserver.RANDOM_PORT,
		ClusterPort:       natsserver.RANDOM_PORT,
		DiscoveryEnabled:  discoveryEnabled,
		DiscoveryInterval: 50 * time.Millisecond,
		DiscoveryTTL:      time.Minute,
	}
	// Both servers discover each other through the shared registry.
	s, err := newServer(cfg.NATS, store, testCipher(t), "", log.New("infra.nats.server"), prometheus.NewRegistry())
	require.NoError(t, err)
	return s, cfg
}

// newSharedTestKV returns an in-memory KV both servers register their peer rows
// in, standing in for the production DB-backed registry.
func newSharedTestKV(t *testing.T) kv.KV {
	t.Helper()
	db, err := badger.Open(badger.DefaultOptions("").WithInMemory(true).WithLogger(nil))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })
	return kv.NewBadgerKV(db)
}

// startSteppedSQLServer starts an embedded server whose registry
// ProvideServer builds on sqlStore, without running the discovery loop, and
// points the registry clock at now so the test steps discovery itself.
func startSteppedSQLServer(t *testing.T, sqlStore db.DB, now *time.Time) *Server {
	t.Helper()
	s, err := ProvideServer(newEmbeddedTestCfg("127.0.0.1", ""), sqlStore, testCipher(t).encryption, &contracts.SecretDBMigrated{}, prometheus.NewRegistry())
	require.NoError(t, err)
	require.NoError(t, s.starting(t.Context()))
	t.Cleanup(func() { _ = s.stopping(nil) })
	require.NotNil(t, s.discovery, "ProvideServer did not wire the SQL registry")
	registry, ok := s.discovery.registry.(*kvPeerStore)
	require.True(t, ok)
	registry.now = func() time.Time { return *now }
	return s
}

func peersOf(nodes ...*Server) []peer {
	peers := make([]peer, 0, len(nodes))
	for _, n := range nodes {
		peers = append(peers, n.discovery.self)
	}
	return peers
}

func routeSetOf(nodes ...*Server) map[string]struct{} {
	routes := make(map[string]struct{}, len(nodes))
	for _, n := range nodes {
		routes[n.discovery.self.RouteURL] = struct{}{}
	}
	return routes
}

// registeredPeers reads the registry rows without pruning, unlike listActive.
func registeredPeers(t *testing.T, store kv.KV) []peer {
	t.Helper()
	var peers []peer
	for rec, err := range newKVPeerStore(store, discoveryClusterName).records(t.Context()) {
		require.NoError(t, err)
		peers = append(peers, peer{ServerName: rec.ServerName, RouteURL: rec.RouteURL})
	}
	return peers
}

// hasDiscovery reports whether the discovery loop was wired, read under the lock
// startEmbeddedServer writes it with, keeping the -race build clean.
func hasDiscovery(s *Server) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.discovery != nil
}

// numRoutes reads the server's active cluster route count under the lock the
// discovery loop also holds, keeping the -race build clean.
func numRoutes(s *Server) int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.server == nil {
		return 0
	}
	return s.server.NumRoutes()
}

// runWithReloads runs s's discovery loop until the test ends and reports every
// route set it reloads, so a test can wait on reconciliation instead of polling.
func runWithReloads(t *testing.T, s *Server) <-chan map[string]struct{} {
	t.Helper()
	ctx, cancel := context.WithCancel(t.Context())
	reloads := make(chan map[string]struct{})
	reload := s.discovery.reload
	s.discovery.reload = func(routes []*url.URL) error {
		err := reload(routes)
		set := make(map[string]struct{}, len(routes))
		for _, u := range routes {
			set[u.String()] = struct{}{}
		}
		select {
		case reloads <- set:
		case <-ctx.Done():
		}
		return err
	}
	done := make(chan struct{})
	go func() {
		defer close(done)
		_ = s.discovery.run(ctx)
	}()
	t.Cleanup(func() {
		cancel()
		<-done
	})
	return reloads
}

// requireReload waits for the next route reload and checks its route set. The
// timer only guards against a hang; no assertion depends on it.
// requireWakeInterest waits until s sees the wake subscription of the given
// number of routed peers, besides its own.
func requireWakeInterest(t *testing.T, s *Server, peers int) {
	t.Helper()
	deadline := time.Now().Add(30 * time.Second)
	for s.server.GlobalAccount().Interest(discoveryWakeSubject) < peers+1 {
		if time.Now().After(deadline) {
			t.Fatalf("%s has wake interest from %d peers, want %d", s.opts.ServerName, s.server.GlobalAccount().Interest(discoveryWakeSubject)-1, peers)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func requireReload(t *testing.T, reloads <-chan map[string]struct{}, want map[string]struct{}) {
	t.Helper()
	select {
	case got := <-reloads:
		require.Equal(t, want, got)
	case <-time.After(30 * time.Second):
		t.Fatal("discovery did not reload its routes")
	}
}

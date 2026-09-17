package nats

import (
	"context"
	"testing"
	"time"

	badger "github.com/dgraph-io/badger/v4"
	natsserver "github.com/nats-io/nats-server/v2/server"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationDiscoveryEmbeddedCluster starts two embedded servers sharing a
// KV-backed peer registry and asserts they self-assemble into a working cluster,
// exercising the real ProvideServer/dskit lifecycle end-to-end.
func TestIntegrationDiscoveryEmbeddedCluster(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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

// TestIntegrationDiscoveryDisabled asserts that discovery_enabled=false leaves a
// node standalone: no discovery loop is wired even with a KV present, so it never
// solicits peer routes.
func TestIntegrationDiscoveryDisabled(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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
	s, err := ProvideServer(cfg, nil, prometheus.NewRegistry())
	require.NoError(t, err)
	// ProvideServer leaves kv nil without a sqlStore; inject the shared registry
	// so both servers discover each other through it.
	s.kv = store
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

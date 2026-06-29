package nats

import (
	"context"
	"encoding/json"
	"io"
	"testing"
	"time"

	badger "github.com/dgraph-io/badger/v4"
	natsserver "github.com/nats-io/nats-server/v2/server"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

func testKV(t *testing.T) kv.KV {
	t.Helper()
	opts := badger.DefaultOptions("").WithInMemory(true).WithLogger(nil)
	db, err := badger.Open(opts)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })
	return kv.NewBadgerKV(db)
}

// newDiscoveryService builds a Service wired only for the discovery path: a KV
// store and identity, no embedded server. serverName becomes the peer's NodeID.
func newDiscoveryService(t *testing.T, kvStore kv.KV, serverName string, ttl time.Duration) *Service {
	t.Helper()
	return &Service{
		cfg: setting.NATSSettings{
			Enabled:      true,
			Mode:         setting.NATSModeEmbedded,
			Discovery:    "auto",
			DiscoveryTTL: ttl,
		},
		log:     log.NewNopLogger(),
		metrics: newMetrics(prometheus.NewRegistry()),
		kv:      kvStore,
		opts:    &natsserver.Options{ServerName: serverName},
	}
}

// writePeer writes a peer record directly into the registry, bypassing register
// so the test controls UpdatedAt (time.Now is not injectable in production code).
func writePeer(t *testing.T, kvStore kv.KV, rec peerRecord) {
	t.Helper()
	data, err := json.Marshal(rec)
	require.NoError(t, err)
	w, err := kvStore.Save(context.Background(), kv.NATSPeersSection, rec.NodeID)
	require.NoError(t, err)
	_, err = w.Write(data)
	require.NoError(t, err)
	require.NoError(t, w.Close())
}

func peerKeys(t *testing.T, kvStore kv.KV) []string {
	t.Helper()
	var keys []string
	for key, err := range kvStore.Keys(context.Background(), kv.NATSPeersSection, kv.ListOptions{Sort: kv.SortOrderAsc}) {
		require.NoError(t, err)
		keys = append(keys, key)
	}
	return keys
}

func TestDiscovery_RegisterRoundTrip(t *testing.T) {
	ctx := context.Background()
	kvStore := testKV(t)

	a := newDiscoveryService(t, kvStore, "node-a", time.Minute)
	require.NoError(t, a.register(ctx, "nats://a:6222"))

	// A second node sees node-a's route.
	b := newDiscoveryService(t, kvStore, "node-b", time.Minute)
	routes, err := b.discoverRoutes(ctx, "nats://b:6222")
	require.NoError(t, err)
	require.Len(t, routes, 1)
	require.Equal(t, "nats://a:6222", routes[0].String())

	// The persisted record carries the registering node's identity.
	r, err := kvStore.Get(ctx, kv.NATSPeersSection, "node-a")
	require.NoError(t, err)
	data, err := io.ReadAll(r)
	require.NoError(t, err)
	require.NoError(t, r.Close())
	var rec peerRecord
	require.NoError(t, json.Unmarshal(data, &rec))
	require.Equal(t, "node-a", rec.NodeID)
	require.Equal(t, "nats://a:6222", rec.RouteURL)
}

func TestDiscovery_ExcludesSelf(t *testing.T) {
	ctx := context.Background()
	kvStore := testKV(t)

	s := newDiscoveryService(t, kvStore, "node-a", time.Minute)
	require.NoError(t, s.register(ctx, "nats://a:6222"))

	// Discovering with our own route URL must not return ourselves.
	routes, err := s.discoverRoutes(ctx, "nats://a:6222")
	require.NoError(t, err)
	require.Empty(t, routes)
}

func TestDiscovery_SkipsStalePeers(t *testing.T) {
	ctx := context.Background()
	kvStore := testKV(t)
	s := newDiscoveryService(t, kvStore, "node-a", time.Minute)

	writePeer(t, kvStore, peerRecord{NodeID: "fresh", RouteURL: "nats://fresh:6222", UpdatedAt: time.Now()})
	writePeer(t, kvStore, peerRecord{NodeID: "stale", RouteURL: "nats://stale:6222", UpdatedAt: time.Now().Add(-2 * time.Minute)})

	routes, err := s.discoverRoutes(ctx, "nats://a:6222")
	require.NoError(t, err)
	require.Len(t, routes, 1)
	require.Equal(t, "nats://fresh:6222", routes[0].String())
}

func TestDiscovery_Dedup(t *testing.T) {
	ctx := context.Background()
	kvStore := testKV(t)
	s := newDiscoveryService(t, kvStore, "node-a", time.Minute)

	writePeer(t, kvStore, peerRecord{NodeID: "x", RouteURL: "nats://dup:6222", UpdatedAt: time.Now()})
	writePeer(t, kvStore, peerRecord{NodeID: "y", RouteURL: "nats://dup:6222", UpdatedAt: time.Now()})

	routes, err := s.discoverRoutes(ctx, "nats://a:6222")
	require.NoError(t, err)
	require.Len(t, routes, 1)
	require.Equal(t, "nats://dup:6222", routes[0].String())
}

func TestDiscovery_SkipsEmptyRouteURL(t *testing.T) {
	ctx := context.Background()
	kvStore := testKV(t)
	s := newDiscoveryService(t, kvStore, "node-a", time.Minute)

	writePeer(t, kvStore, peerRecord{NodeID: "noroute", RouteURL: "", UpdatedAt: time.Now()})

	routes, err := s.discoverRoutes(ctx, "nats://a:6222")
	require.NoError(t, err)
	require.Empty(t, routes)
}

func TestDiscovery_CleanupStalePeers(t *testing.T) {
	ctx := context.Background()
	kvStore := testKV(t)
	s := newDiscoveryService(t, kvStore, "node-a", time.Minute)

	writePeer(t, kvStore, peerRecord{NodeID: "fresh", RouteURL: "nats://fresh:6222", UpdatedAt: time.Now()})
	writePeer(t, kvStore, peerRecord{NodeID: "stale", RouteURL: "nats://stale:6222", UpdatedAt: time.Now().Add(-2 * time.Minute)})

	require.NoError(t, s.cleanupStalePeers(ctx))
	require.Equal(t, []string{"fresh"}, peerKeys(t, kvStore))
}

func TestDiscovery_Unregister(t *testing.T) {
	ctx := context.Background()
	kvStore := testKV(t)
	s := newDiscoveryService(t, kvStore, "node-a", time.Minute)

	require.NoError(t, s.register(ctx, "nats://a:6222"))
	require.Equal(t, []string{"node-a"}, peerKeys(t, kvStore))

	require.NoError(t, s.unregister(ctx))
	require.Empty(t, peerKeys(t, kvStore))
}

func TestDiscovery_NilKV(t *testing.T) {
	s := newDiscoveryService(t, nil, "node-a", time.Minute)
	routes, err := s.discoverRoutes(context.Background(), "nats://a:6222")
	require.NoError(t, err)
	require.Nil(t, routes)
}

func TestDiscovery_LoopRegistersAndStops(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	kvStore := testKV(t)
	s := newDiscoveryService(t, kvStore, "node-a", time.Minute)
	s.cfg.DiscoveryInterval = 10 * time.Millisecond

	done := make(chan struct{})
	go func() {
		s.discoveryLoop(ctx, "nats://a:6222")
		close(done)
	}()

	// The loop registers self on entry, before the first tick.
	require.Eventually(t, func() bool {
		return len(peerKeys(t, kvStore)) == 1
	}, 2*time.Second, 10*time.Millisecond)

	cancel()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("discoveryLoop did not return after context cancellation")
	}
}

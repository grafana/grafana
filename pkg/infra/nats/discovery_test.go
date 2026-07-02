package nats

import (
	"context"
	"sync"
	"testing"
	"time"

	natsserver "github.com/nats-io/nats-server/v2/server"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
)

// fakeRegistry is an in-memory peerRegistry keyed by server name, with a
// settable clock so TTL behaviour is deterministic.
type fakeRegistry struct {
	mu   sync.Mutex
	now  time.Time
	rows map[string]struct {
		peer peer
		seen time.Time
	}
}

func newFakeRegistry() *fakeRegistry {
	return &fakeRegistry{
		now: time.Unix(1_000, 0),
		rows: map[string]struct {
			peer peer
			seen time.Time
		}{},
	}
}

func (f *fakeRegistry) upsert(_ context.Context, p peer) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.rows[p.ServerName] = struct {
		peer peer
		seen time.Time
	}{peer: p, seen: f.now}
	return nil
}

func (f *fakeRegistry) listActive(_ context.Context, ttl time.Duration) ([]peer, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	cutoff := f.now.Add(-ttl)
	var peers []peer
	for name, r := range f.rows {
		if r.seen.Before(cutoff) {
			delete(f.rows, name)
			continue
		}
		peers = append(peers, r.peer)
	}
	return peers, nil
}

func (f *fakeRegistry) remove(_ context.Context, serverName string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.rows, serverName)
	return nil
}

func (f *fakeRegistry) advance(d time.Duration) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.now = f.now.Add(d)
}

// newTestDiscovery builds a discovery against a clustered in-process server so
// applyRoutes exercises the real ReloadOptions route-solicitation path. Ports are
// OS-assigned (-1) to avoid collisions; the advertised peer routes are unreachable
// stubs, which NATS solicits asynchronously without failing the reload.
func newTestDiscovery(t *testing.T, reg peerRegistry, self peer) *discovery {
	t.Helper()
	opts := natsserver.Options{
		Host:            "127.0.0.1",
		Port:            -1,
		NoLog:           true,
		NoSigs:          true,
		JetStream:       false,
		NoSystemAccount: true,
		Cluster:         natsserver.ClusterOpts{Name: discoveryClusterName, Host: "127.0.0.1", Port: -1},
	}
	srv, err := natsserver.NewServer(&opts)
	require.NoError(t, err)
	go srv.Start()
	require.True(t, srv.ReadyForConnections(5*time.Second), "test nats server not ready")
	t.Cleanup(srv.Shutdown)
	return newDiscovery(log.NewNopLogger(), srv, reg, self, discoveryOptions{baseOpts: opts})
}

func TestDiscoveryReconcile(t *testing.T) {
	ctx := context.Background()

	t.Run("adds peer routes and skips self and empty routes", func(t *testing.T) {
		reg := newFakeRegistry()
		self := peer{ServerName: "self", RouteURL: "nats://10.0.0.1:6222"}
		require.NoError(t, reg.upsert(ctx, self))
		require.NoError(t, reg.upsert(ctx, peer{ServerName: "peer-a", RouteURL: "nats://10.0.0.2:6222"}))
		require.NoError(t, reg.upsert(ctx, peer{ServerName: "peer-b", RouteURL: "nats://10.0.0.3:6222"}))
		require.NoError(t, reg.upsert(ctx, peer{ServerName: "peer-empty", RouteURL: ""}))

		d := newTestDiscovery(t, reg, self)
		d.tick(ctx)

		require.Equal(t, map[string]struct{}{
			"nats://10.0.0.2:6222": {},
			"nats://10.0.0.3:6222": {},
		}, d.routes)
	})

	t.Run("drops a peer once its heartbeat ages past the ttl", func(t *testing.T) {
		reg := newFakeRegistry()
		self := peer{ServerName: "self", RouteURL: "nats://10.0.0.1:6222"}
		require.NoError(t, reg.upsert(ctx, self))
		require.NoError(t, reg.upsert(ctx, peer{ServerName: "peer-a", RouteURL: "nats://10.0.0.2:6222"}))

		d := newTestDiscovery(t, reg, self)
		d.tick(ctx)
		require.Contains(t, d.routes, "nats://10.0.0.2:6222")

		// peer-a stops heartbeating; self keeps ticking.
		reg.advance(d.ttl + time.Second)
		d.tick(ctx) // heartbeats self, prunes peer-a, reconciles

		require.Empty(t, d.routes)
		peers, err := reg.listActive(ctx, d.ttl)
		require.NoError(t, err)
		require.Len(t, peers, 1, "only self should remain after prune")
	})

	t.Run("deregister removes self", func(t *testing.T) {
		reg := newFakeRegistry()
		self := peer{ServerName: "self", RouteURL: "nats://10.0.0.1:6222"}
		d := newTestDiscovery(t, reg, self)
		require.NoError(t, reg.upsert(ctx, self))

		d.deregister(ctx)

		peers, err := reg.listActive(ctx, d.ttl)
		require.NoError(t, err)
		require.Empty(t, peers)
	})
}

func TestSameRouteSet(t *testing.T) {
	require.True(t, sameRouteSet(map[string]struct{}{"a": {}}, map[string]struct{}{"a": {}}))
	require.False(t, sameRouteSet(map[string]struct{}{"a": {}}, map[string]struct{}{"b": {}}))
	require.False(t, sameRouteSet(map[string]struct{}{"a": {}}, map[string]struct{}{"a": {}, "b": {}}))
}

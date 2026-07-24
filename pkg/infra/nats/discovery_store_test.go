package nats

import (
	"context"
	"testing"
	"time"

	badger "github.com/dgraph-io/badger/v4"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

// newTestKVStore builds a kvPeerStore over an in-memory KV with a settable clock
// so TTL behaviour is deterministic.
func newTestKVStore(t *testing.T, clusterName string, now *time.Time) *kvPeerStore {
	t.Helper()
	db, err := badger.Open(badger.DefaultOptions("").WithInMemory(true).WithLogger(nil))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	s := newKVPeerStore(kv.NewBadgerKV(db), clusterName)
	s.now = func() time.Time { return *now }
	return s
}

func TestKVPeerStore(t *testing.T) {
	ctx := context.Background()
	ttl := 30 * time.Second

	t.Run("upsert then listActive round-trips the route url", func(t *testing.T) {
		now := time.Unix(1_000, 0)
		s := newTestKVStore(t, "grafana", &now)

		require.NoError(t, s.upsert(ctx, peer{ServerName: "a", RouteURL: "nats://10.0.0.1:6222"}))
		require.NoError(t, s.upsert(ctx, peer{ServerName: "b", RouteURL: "nats://10.0.0.2:6222"}))

		peers, err := s.listActive(ctx, ttl)
		require.NoError(t, err)
		require.ElementsMatch(t, []peer{
			{ServerName: "a", RouteURL: "nats://10.0.0.1:6222"},
			{ServerName: "b", RouteURL: "nats://10.0.0.2:6222"},
		}, peers)
	})

	t.Run("only returns peers of the same cluster", func(t *testing.T) {
		now := time.Unix(1_000, 0)
		db, err := badger.Open(badger.DefaultOptions("").WithInMemory(true).WithLogger(nil))
		require.NoError(t, err)
		t.Cleanup(func() { require.NoError(t, db.Close()) })
		store := kv.NewBadgerKV(db)

		clock := func() time.Time { return now }
		a := &kvPeerStore{kv: store, clusterName: "cluster-a", now: clock}
		b := &kvPeerStore{kv: store, clusterName: "cluster-b", now: clock}

		require.NoError(t, a.upsert(ctx, peer{ServerName: "a1", RouteURL: "nats://10.0.0.1:6222"}))
		require.NoError(t, b.upsert(ctx, peer{ServerName: "b1", RouteURL: "nats://10.0.0.2:6222"}))

		peersA, err := a.listActive(ctx, ttl)
		require.NoError(t, err)
		require.Equal(t, []peer{{ServerName: "a1", RouteURL: "nats://10.0.0.1:6222"}}, peersA)

		peersB, err := b.listActive(ctx, ttl)
		require.NoError(t, err)
		require.Equal(t, []peer{{ServerName: "b1", RouteURL: "nats://10.0.0.2:6222"}}, peersB)
	})

	t.Run("excludes and prunes peers older than the ttl", func(t *testing.T) {
		now := time.Unix(1_000, 0)
		s := newTestKVStore(t, "grafana", &now)

		require.NoError(t, s.upsert(ctx, peer{ServerName: "stale", RouteURL: "nats://10.0.0.1:6222"}))
		now = now.Add(ttl + time.Second)
		require.NoError(t, s.upsert(ctx, peer{ServerName: "fresh", RouteURL: "nats://10.0.0.2:6222"}))

		// stale's heartbeat is now older than the ttl; only fresh is active, and
		// listActive prunes the stale row as a side effect.
		peers, err := s.listActive(ctx, ttl)
		require.NoError(t, err)
		require.Equal(t, []peer{{ServerName: "fresh", RouteURL: "nats://10.0.0.2:6222"}}, peers)

		_, err = s.kv.Get(ctx, kv.NATSPeersSection, s.peerKey("stale"))
		require.ErrorIs(t, err, kv.ErrNotFound)
		r, err := s.kv.Get(ctx, kv.NATSPeersSection, s.peerKey("fresh"))
		require.NoError(t, err)
		require.NoError(t, r.Close())
	})

	t.Run("remove deletes a single peer", func(t *testing.T) {
		now := time.Unix(1_000, 0)
		s := newTestKVStore(t, "grafana", &now)

		require.NoError(t, s.upsert(ctx, peer{ServerName: "a", RouteURL: "nats://10.0.0.1:6222"}))
		require.NoError(t, s.remove(ctx, "a"))

		peers, err := s.listActive(ctx, ttl)
		require.NoError(t, err)
		require.Empty(t, peers)
	})
}

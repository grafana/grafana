package nats

import (
	"context"
	"fmt"
	"testing"
	"time"

	badger "github.com/dgraph-io/badger/v4"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

type batchDeleteSpyKV struct {
	kv.KV
	sizes []int
}

func (s *batchDeleteSpyKV) BatchDelete(ctx context.Context, section string, keys []string) error {
	s.sizes = append(s.sizes, len(keys))
	return s.KV.BatchDelete(ctx, section, keys)
}

// newTestKVStore builds a kvPeerStore over an in-memory KV with a settable
// clock for the UpdatedAt it writes.
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

	t.Run("upsert then list round-trips the row", func(t *testing.T) {
		now := time.Unix(1_000, 0)
		s := newTestKVStore(t, "grafana", &now)

		require.NoError(t, s.upsert(ctx, peer{ServerName: "a", RouteURL: "nats://10.0.0.1:6222"}))
		now = now.Add(time.Second)
		require.NoError(t, s.upsert(ctx, peer{ServerName: "a", RouteURL: "nats://10.0.0.1:6222"}))

		records, err := s.list(ctx)
		require.NoError(t, err)
		require.Equal(t, []peerRecord{{ServerName: "a", RouteURL: "nats://10.0.0.1:6222", UpdatedAt: 1_001}}, records)
	})

	t.Run("only lists rows of the same cluster", func(t *testing.T) {
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

		require.Equal(t, []string{"a1"}, listedNames(t, a))
		require.Equal(t, []string{"b1"}, listedNames(t, b))
	})

	t.Run("list neither filters nor prunes old rows", func(t *testing.T) {
		now := time.Unix(1_000, 0)
		s := newTestKVStore(t, "grafana", &now)

		require.NoError(t, s.upsert(ctx, peer{ServerName: "old", RouteURL: "nats://10.0.0.1:6222"}))
		now = now.Add(24 * time.Hour)
		require.NoError(t, s.upsert(ctx, peer{ServerName: "new", RouteURL: "nats://10.0.0.2:6222"}))

		require.ElementsMatch(t, []string{"old", "new"}, listedNames(t, s))
		// The first list deleted nothing.
		require.ElementsMatch(t, []string{"old", "new"}, listedNames(t, s))
	})

	t.Run("prune deletes only the named rows", func(t *testing.T) {
		now := time.Unix(1_000, 0)
		s := newTestKVStore(t, "grafana", &now)

		for _, name := range []string{"a", "b", "c"} {
			require.NoError(t, s.upsert(ctx, peer{ServerName: name, RouteURL: "nats://10.0.0.1:6222"}))
		}
		require.NoError(t, s.prune(ctx, []string{"a", "c", "missing"}))

		require.Equal(t, []string{"b"}, listedNames(t, s))
	})

	t.Run("prunes in chunks under the batch limit", func(t *testing.T) {
		now := time.Unix(1_000, 0)
		db, err := badger.Open(badger.DefaultOptions("").WithInMemory(true).WithLogger(nil))
		require.NoError(t, err)
		t.Cleanup(func() { require.NoError(t, db.Close()) })

		spy := &batchDeleteSpyKV{KV: kv.NewBadgerKV(db)}
		s := newKVPeerStore(spy, "grafana")
		s.now = func() time.Time { return now }

		const staleCount = 2*maxPeerDeleteBatch + 1
		names := make([]string, 0, staleCount)
		for i := range staleCount {
			name := fmt.Sprintf("stale-%d", i)
			names = append(names, name)
			require.NoError(t, s.upsert(ctx, peer{ServerName: name, RouteURL: "nats://10.0.0.1:6222"}))
		}

		require.NoError(t, s.prune(ctx, names))
		require.Empty(t, listedNames(t, s))

		total := 0
		for _, n := range spy.sizes {
			require.LessOrEqual(t, n, maxPeerDeleteBatch)
			total += n
		}
		require.Equal(t, staleCount, total)
		require.Greater(t, len(spy.sizes), 1)
	})

	t.Run("remove deletes a single peer", func(t *testing.T) {
		now := time.Unix(1_000, 0)
		s := newTestKVStore(t, "grafana", &now)

		require.NoError(t, s.upsert(ctx, peer{ServerName: "a", RouteURL: "nats://10.0.0.1:6222"}))
		require.NoError(t, s.remove(ctx, "a"))

		require.Empty(t, listedNames(t, s))
	})
}

func listedNames(t *testing.T, s *kvPeerStore) []string {
	t.Helper()
	records, err := s.list(t.Context())
	require.NoError(t, err)
	names := make([]string, 0, len(records))
	for _, rec := range records {
		names = append(names, rec.ServerName)
	}
	return names
}

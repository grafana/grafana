package stats

import (
	"context"
	"testing"
	"time"

	badger "github.com/dgraph-io/badger/v4"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
)

func newTestKV(t *testing.T) kv.KV {
	t.Helper()
	opts := badger.DefaultOptions("").WithInMemory(true).WithLogger(nil)
	db, err := badger.Open(opts)
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })
	return kv.NewBadgerKV(db)
}

func newTestIngester(t *testing.T, store *Store) *Ingester {
	t.Helper()
	leases := lease.NewManager(store.kv, "test-holder", nil)
	return NewIngester(store, DefaultDeclarations(), leases, nil)
}

func TestRecordEventValidation(t *testing.T) {
	store := NewStore(newTestKV(t))
	ing := newTestIngester(t, store)

	// Untracked resource: silently dropped, no error.
	require.NoError(t, ing.RecordEvent("other.grafana.app", "things", "default", "x", "view", 1))

	// Invalid metric on a tracked resource.
	err := ing.RecordEvent(dashboardsGroup, dashboardsResource, "default", "x", "bogus", 1)
	require.ErrorIs(t, err, ErrInvalidMetric)

	// Valid.
	require.NoError(t, ing.RecordEvent(dashboardsGroup, dashboardsResource, "default", "x", "view", 1))
}

func TestIngestFlushAndRead(t *testing.T) {
	ctx := context.Background()
	store := NewStore(newTestKV(t))
	ing := newTestIngester(t, store)

	for i := 0; i < 5; i++ {
		require.NoError(t, ing.RecordEvent(dashboardsGroup, dashboardsResource, "default", "dash-a", "view", 1))
	}
	require.NoError(t, ing.RecordEvent(dashboardsGroup, dashboardsResource, "default", "dash-a", "query", 2))
	require.NoError(t, ing.RecordEvent(dashboardsGroup, dashboardsResource, "default", "dash-b", "view", 3))

	require.NoError(t, ing.Flush(ctx))

	o := objectRef{Group: dashboardsGroup, Resource: dashboardsResource, Namespace: "default", Name: "dash-a"}
	now, _ := store.kv.UnixTimestamp(ctx)
	daily, err := store.ReadDailyForObject(ctx, o)
	require.NoError(t, err)
	require.Equal(t, int64(5), daily[dayString(now)]["view"])
	require.Equal(t, int64(2), daily[dayString(now)]["query"])

	// Best-effort aggregates were bumped on flush.
	dashStats := NewKVDashboardStats(store)
	all, err := dashStats.GetStats(ctx, "default")
	require.NoError(t, err)
	require.Equal(t, int64(5), all["dash-a"]["view_last_7_days"])
	require.Equal(t, int64(5), all["dash-a"]["view_total"])
	require.Equal(t, int64(3), all["dash-b"]["view_last_1_days"])
}

func TestRecalcWindowsAndOverflow(t *testing.T) {
	ctx := context.Background()
	store := NewStore(newTestKV(t))
	decls := DefaultDeclarations()

	now := time.Date(2026, 6, 12, 12, 0, 0, 0, time.UTC).Unix()
	today := time.Unix(now, 0).UTC().Truncate(24 * time.Hour)

	o := objectRef{Group: dashboardsGroup, Resource: dashboardsResource, Namespace: "default", Name: "dash"}
	// today: 10, 3 days ago: 5, 10 days ago: 7, 40 days ago: 100 (should fold to overflow)
	require.NoError(t, store.SetDaily(ctx, o, today.Format(dayLayout), "view", 10))
	require.NoError(t, store.SetDaily(ctx, o, today.AddDate(0, 0, -3).Format(dayLayout), "view", 5))
	require.NoError(t, store.SetDaily(ctx, o, today.AddDate(0, 0, -10).Format(dayLayout), "view", 7))
	require.NoError(t, store.SetDaily(ctx, o, today.AddDate(0, 0, -40).Format(dayLayout), "view", 100))

	require.NoError(t, store.Recalc(ctx, decls, now))

	dashStats := NewKVDashboardStats(store)
	all, err := dashStats.GetStats(ctx, "default")
	require.NoError(t, err)
	st := all["dash"]
	require.Equal(t, int64(10), st["view_last_1_days"])  // today only
	require.Equal(t, int64(15), st["view_last_7_days"])  // today + 3 days ago
	require.Equal(t, int64(22), st["view_last_30_days"]) // + 10 days ago
	require.Equal(t, int64(122), st["view_total"])       // + overflow (40 days ago)

	// The expired bucket was folded into overflow and dropped.
	daily, err := store.ReadDailyForObject(ctx, o)
	require.NoError(t, err)
	require.Equal(t, int64(100), daily[overflowBucket]["view"])
	_, exists := daily[today.AddDate(0, 0, -40).Format(dayLayout)]
	require.False(t, exists)
}

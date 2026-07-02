package usagestats

import (
	"context"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func newTestIngester(t *testing.T, store *Store, now func() time.Time) (*Ingester, prometheus.Gatherer) {
	t.Helper()
	reg := prometheus.NewRegistry()
	ing := NewIngester(IngesterOptions{
		Store: store,
		Reg:   reg,
		Now:   now,
	})
	return ing, reg
}

func dashKey(name string) *resourcepb.ResourceKey {
	return &resourcepb.ResourceKey{
		Group:     dashboardsGroup,
		Resource:  dashboardsResource,
		Namespace: "default",
		Name:      name,
	}
}

func fixedNow(day string) func() time.Time {
	d, _ := parseDay(day)
	return func() time.Time { return d.Add(15 * time.Hour) }
}

func TestIngesterRecordEventValidation(t *testing.T) {
	forEachBackend(t, func(t *testing.T, store *Store) {
		ctx := context.Background()
		ing, reg := newTestIngester(t, store, fixedNow("2026-06-23"))

		// Untracked resource is silently dropped and counted.
		err := ing.RecordEvent(ctx, &resourcepb.ResourceKey{Group: "other.grafana.app", Resource: "things", Namespace: "default", Name: "x"},
			[]*resourcepb.ResourceEvent{{Metric: "views", Value: 1}})
		require.NoError(t, err)
		require.Equal(t, float64(1), testutil.ToFloat64(ing.metrics.droppedEvents.WithLabelValues(reasonUntrackedResource)))

		// Unknown metric is rejected.
		err = ing.RecordEvent(ctx, dashKey("a"), []*resourcepb.ResourceEvent{{Metric: "bogus", Value: 1}})
		require.ErrorIs(t, err, ErrInvalidEvent)
		require.Equal(t, float64(1), testutil.ToFloat64(ing.metrics.droppedEvents.WithLabelValues(reasonUnknownMetric)))

		// Negative value is rejected.
		err = ing.RecordEvent(ctx, dashKey("a"), []*resourcepb.ResourceEvent{{Metric: "views", Value: -1}})
		require.ErrorIs(t, err, ErrInvalidEvent)

		// A rejected request buffers nothing.
		require.Empty(t, ing.buffer)
		_ = reg
	})
}

func TestIngesterFlush(t *testing.T) {
	forEachBackend(t, func(t *testing.T, store *Store) {
		ctx := context.Background()
		const day = "2026-06-23"
		ing, _ := newTestIngester(t, store, fixedNow(day))

		require.NoError(t, ing.RecordEvent(ctx, dashKey("a"), []*resourcepb.ResourceEvent{
			{Metric: "views", Value: 2},
			{Metric: "queries", Value: 5},
		}))
		require.NoError(t, ing.RecordEvent(ctx, dashKey("a"), []*resourcepb.ResourceEvent{{Metric: "views", Value: 3}}))
		require.NoError(t, ing.RecordEvent(ctx, dashKey("b"), []*resourcepb.ResourceEvent{{Metric: "views", Value: 1}}))

		require.NoError(t, ing.flush(ctx))

		// Buffer is drained after a successful flush.
		require.Empty(t, ing.buffer)

		// Daily buckets reflect the accumulated counts.
		a := objectRefFromKey(dashKey("a"))
		daily, err := store.ReadDailyForObject(ctx, a)
		require.NoError(t, err)
		require.Equal(t, int64(5), daily[day]["views"])
		require.Equal(t, int64(5), daily[day]["queries"])

		// Aggregates are incremented for each window plus the total.
		agg, err := store.ScanAggregates(ctx, dashboardsGroup, dashboardsResource, "default")
		require.NoError(t, err)
		require.Equal(t, int64(5), agg["a"]["views_last_1_days"])
		require.Equal(t, int64(5), agg["a"]["views_last_7_days"])
		require.Equal(t, int64(5), agg["a"]["views_last_30_days"])
		require.Equal(t, int64(5), agg["a"]["views_total"])
		require.Equal(t, int64(5), agg["a"]["queries_total"])
		require.Equal(t, int64(1), agg["b"]["views_total"])

		// A second flush with no buffered data is a no-op.
		require.NoError(t, ing.flush(ctx))
	})
}

func TestIngesterFlushAccumulatesAcrossFlushes(t *testing.T) {
	forEachBackend(t, func(t *testing.T, store *Store) {
		ctx := context.Background()
		const day = "2026-06-23"
		ing, _ := newTestIngester(t, store, fixedNow(day))

		require.NoError(t, ing.RecordEvent(ctx, dashKey("a"), []*resourcepb.ResourceEvent{{Metric: "views", Value: 4}}))
		require.NoError(t, ing.flush(ctx))
		require.NoError(t, ing.RecordEvent(ctx, dashKey("a"), []*resourcepb.ResourceEvent{{Metric: "views", Value: 6}}))
		require.NoError(t, ing.flush(ctx))

		agg, err := store.ScanAggregates(ctx, dashboardsGroup, dashboardsResource, "default")
		require.NoError(t, err)
		require.Equal(t, int64(10), agg["a"]["views_total"])
	})
}

func TestIngesterBufferFull(t *testing.T) {
	forEachBackend(t, func(t *testing.T, store *Store) {
		ctx := context.Background()
		ing := NewIngester(IngesterOptions{
			Store:              store,
			Reg:                prometheus.NewRegistry(),
			Now:                fixedNow("2026-06-23"),
			MaxBufferedObjects: 1,
		})

		require.NoError(t, ing.RecordEvent(ctx, dashKey("a"), []*resourcepb.ResourceEvent{{Metric: "views", Value: 1}}))
		// Second distinct object exceeds the bound and is dropped.
		require.NoError(t, ing.RecordEvent(ctx, dashKey("b"), []*resourcepb.ResourceEvent{{Metric: "views", Value: 1}}))
		require.Len(t, ing.buffer, 1)
		require.Equal(t, float64(1), testutil.ToFloat64(ing.metrics.droppedEvents.WithLabelValues(reasonBufferFull)))

		// But existing objects can still accumulate.
		require.NoError(t, ing.RecordEvent(ctx, dashKey("a"), []*resourcepb.ResourceEvent{{Metric: "views", Value: 5}}))
		require.Equal(t, int64(6), ing.buffer[objectRefFromKey(dashKey("a"))]["views"])
	})
}

func TestIngesterGetResourceDailyStats(t *testing.T) {
	forEachBackend(t, func(t *testing.T, store *Store) {
		ctx := context.Background()
		const day = "2026-06-23"
		ing, _ := newTestIngester(t, store, fixedNow(day))
		o := objectRefFromKey(dashKey("a"))

		// Persisted history across several days plus an overflow bucket.
		require.NoError(t, store.IncrementDaily(ctx, o, "2026-06-20", map[string]int64{"views": 3}))
		require.NoError(t, store.IncrementDaily(ctx, o, "2026-06-22", map[string]int64{"views": 7, "queries": 1}))
		require.NoError(t, store.IncrementDaily(ctx, o, overflowBucket, map[string]int64{"views": 100}))

		// A recent event only surfaces once it has been flushed to the KV
		// store; buffered events are intentionally not read here.
		require.NoError(t, ing.RecordEvent(ctx, dashKey("a"), []*resourcepb.ResourceEvent{{Metric: "views", Value: 2}}))

		days, err := ing.GetResourceDailyStats(ctx, dashKey("a"), "", "")
		require.NoError(t, err)

		// Sorted ascending, overflow excluded, today absent (still buffered).
		require.Equal(t, []string{"2026-06-20", "2026-06-22"}, daysList(days))
		require.Equal(t, int64(3), metricsFor(days, "2026-06-20")["views"])
		require.Equal(t, int64(7), metricsFor(days, "2026-06-22")["views"])

		// After a flush, today's bucket becomes visible.
		require.NoError(t, ing.flush(ctx))
		days, err = ing.GetResourceDailyStats(ctx, dashKey("a"), "", "")
		require.NoError(t, err)
		require.Equal(t, []string{"2026-06-20", "2026-06-22", day}, daysList(days))
		require.Equal(t, int64(2), metricsFor(days, day)["views"])

		// Range filter restricts the result.
		days, err = ing.GetResourceDailyStats(ctx, dashKey("a"), "2026-06-21", "2026-06-22")
		require.NoError(t, err)
		require.Equal(t, []string{"2026-06-22"}, daysList(days))

		// Untracked resource returns nothing.
		days, err = ing.GetResourceDailyStats(ctx, &resourcepb.ResourceKey{Group: "x", Resource: "y", Namespace: "default", Name: "z"}, "", "")
		require.NoError(t, err)
		require.Nil(t, days)
	})
}

func TestIngesterFlushUnderLease(t *testing.T) {
	store := NewStore(newBadgerKV(t))
	ctx := context.Background()
	const day = "2026-06-23"

	mgr := lease.NewManager(newBadgerKV(t), "holder-a", nil,
		lease.WithInternalMinTTL(time.Second), lease.WithGarbageCollectionDisabled)
	t.Cleanup(mgr.Stop)

	ing := NewIngester(IngesterOptions{
		Store:  store,
		Leases: mgr,
		Reg:    prometheus.NewRegistry(),
		Now:    fixedNow(day),
	})

	require.NoError(t, ing.RecordEvent(ctx, dashKey("a"), []*resourcepb.ResourceEvent{{Metric: "views", Value: 9}}))
	require.NoError(t, ing.flush(ctx))

	agg, err := store.ScanAggregates(ctx, dashboardsGroup, dashboardsResource, "default")
	require.NoError(t, err)
	require.Equal(t, int64(9), agg["a"]["views_total"])
}

func TestIngesterStartStopFinalFlush(t *testing.T) {
	store := NewStore(newBadgerKV(t))
	ctx := context.Background()
	const day = "2026-06-23"

	ing := NewIngester(IngesterOptions{
		Store: store,
		Reg:   prometheus.NewRegistry(),
		Now:   fixedNow(day),
		// A long interval guarantees the periodic ticker never fires during the
		// test, so anything that reaches the store must have come from the
		// shutdown flush rather than a scheduled one.
		FlushInterval: time.Hour,
	})

	ing.Start(ctx)
	require.NoError(t, ing.RecordEvent(ctx, dashKey("a"), []*resourcepb.ResourceEvent{{Metric: "views", Value: 4}}))

	// Nothing has been persisted yet: the event is still buffered in memory.
	agg, err := store.ScanAggregates(ctx, dashboardsGroup, dashboardsResource, "default")
	require.NoError(t, err)
	require.Empty(t, agg)
	require.Len(t, ing.buffer, 1)

	// Stop triggers a best-effort final flush of the buffered event.
	ing.Stop()

	require.Empty(t, ing.buffer, "buffer should be drained by the shutdown flush")

	agg, err = store.ScanAggregates(ctx, dashboardsGroup, dashboardsResource, "default")
	require.NoError(t, err)
	require.Equal(t, int64(4), agg["a"]["views_total"])

	daily, err := store.ReadDailyForObject(ctx, objectRefFromKey(dashKey("a")))
	require.NoError(t, err)
	require.Equal(t, int64(4), daily[day]["views"])
}

func daysList(days []*resourcepb.DailyStat) []string {
	out := make([]string, 0, len(days))
	for _, d := range days {
		out = append(out, d.Day)
	}
	return out
}

func metricsFor(days []*resourcepb.DailyStat, day string) map[string]int64 {
	for _, d := range days {
		if d.Day == day {
			return d.Metrics
		}
	}
	return nil
}

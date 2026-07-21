package usagestats

import (
	"context"
	"errors"
	"iter"
	"sync/atomic"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func newTestLeases(t *testing.T) *lease.Manager {
	t.Helper()
	mgr := lease.NewManager(newBadgerKV(t), "test-holder", nil,
		lease.WithInternalMinTTL(time.Second), lease.WithGarbageCollectionDisabled)
	t.Cleanup(mgr.Stop)
	return mgr
}

func newTestIngester(t *testing.T, store *Store, now func() time.Time) (*Ingester, prometheus.Gatherer) {
	t.Helper()
	reg := prometheus.NewRegistry()
	ing, err := NewIngester(IngesterOptions{
		Store:  store,
		Leases: newTestLeases(t),
		Reg:    reg,
		Now:    now,
	})
	require.NoError(t, err)
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
		require.Equal(t, uint64(5), daily[day]["views"])
		require.Equal(t, uint64(5), daily[day]["queries"])

		// Aggregates are incremented for each window plus the total.
		agg, err := store.ScanAggregates(ctx, dashboardsGroup, dashboardsResource, "default")
		require.NoError(t, err)
		require.Equal(t, uint64(5), agg["a"]["views_last_1_days"])
		require.Equal(t, uint64(5), agg["a"]["views_last_7_days"])
		require.Equal(t, uint64(5), agg["a"]["views_last_30_days"])
		require.Equal(t, uint64(5), agg["a"]["views_total"])
		require.Equal(t, uint64(5), agg["a"]["queries_total"])
		require.Equal(t, uint64(1), agg["b"]["views_total"])

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
		require.Equal(t, uint64(10), agg["a"]["views_total"])
	})
}

// faultKV wraps a KV and fails Batch calls on a chosen section while the fault
// is armed, so tests can simulate a transient KV error mid-flush.
type faultKV struct {
	kv.KV
	failSection string
	fail        atomic.Bool
}

func (f *faultKV) Batch(ctx context.Context, section string, ops []kv.BatchOp) error {
	if f.fail.Load() && section == f.failSection {
		return errors.New("injected batch failure")
	}
	return f.KV.Batch(ctx, section, ops)
}

// TestIngesterFlushDailyFailureNoDoubleCount verifies that when the daily write
// fails, nothing is applied and the retry produces exactly-once counts.
func TestIngesterFlushDailyFailureNoDoubleCount(t *testing.T) {
	ctx := context.Background()
	const day = "2026-06-23"
	fkv := &faultKV{KV: newBadgerKV(t), failSection: dailySection}
	store := NewStore(fkv)
	ing, _ := newTestIngester(t, store, fixedNow(day))

	require.NoError(t, ing.RecordEvent(ctx, dashKey("a"), []*resourcepb.ResourceEvent{{Metric: "views", Value: 2}}))
	require.NoError(t, ing.RecordEvent(ctx, dashKey("b"), []*resourcepb.ResourceEvent{{Metric: "views", Value: 3}}))

	fkv.fail.Store(true)
	require.Error(t, ing.flush(ctx))

	// Nothing was persisted; everything is re-buffered for retry.
	daily, err := store.ReadDailyForObject(ctx, objectRefFromKey(dashKey("a")))
	require.NoError(t, err)
	require.Empty(t, daily)

	fkv.fail.Store(false)
	require.NoError(t, ing.flush(ctx))

	agg, err := store.ScanAggregates(ctx, dashboardsGroup, dashboardsResource, "default")
	require.NoError(t, err)
	for name, v := range map[string]uint64{"a": 2, "b": 3} {
		daily, err := store.ReadDailyForObject(ctx, objectRefFromKey(dashKey(name)))
		require.NoError(t, err)
		require.Equal(t, v, daily[day]["views"], "daily views for %q", name)
		require.Equal(t, v, agg[name]["views_last_1_days"], "views_last_1_days for %q", name)
		require.Equal(t, v, agg[name]["views_last_7_days"], "views_last_7_days for %q", name)
		require.Equal(t, v, agg[name]["views_total"], "views_total for %q", name)
	}
	require.Empty(t, ing.buffer)
}

// TestIngesterFlushAggregateFailureIsBestEffort verifies that when the daily
// write succeeds but the aggregate write fails, the daily buckets stay exact
// (never double-counted) and the aggregate is left for the reconciler rather
// than retried through the raw buffer.
func TestIngesterFlushAggregateFailureIsBestEffort(t *testing.T) {
	ctx := context.Background()
	const day = "2026-06-23"
	fkv := &faultKV{KV: newBadgerKV(t), failSection: aggregatesSection}
	store := NewStore(fkv)
	ing, _ := newTestIngester(t, store, fixedNow(day))

	require.NoError(t, ing.RecordEvent(ctx, dashKey("a"), []*resourcepb.ResourceEvent{{Metric: "views", Value: 2}}))
	require.NoError(t, ing.RecordEvent(ctx, dashKey("b"), []*resourcepb.ResourceEvent{{Metric: "views", Value: 3}}))

	// An aggregate write failure is best-effort: the flush itself succeeds,
	// nothing is re-buffered, and the failure is counted.
	fkv.fail.Store(true)
	require.NoError(t, ing.flush(ctx))
	require.Empty(t, ing.buffer)
	require.Equal(t, float64(2), testutil.ToFloat64(ing.metrics.aggregateWriteFailures))

	// A second flush must not re-apply anything (buffer is empty).
	fkv.fail.Store(false)
	require.NoError(t, ing.flush(ctx))

	// Daily buckets are exact and were written exactly once.
	for name, v := range map[string]uint64{"a": 2, "b": 3} {
		daily, err := store.ReadDailyForObject(ctx, objectRefFromKey(dashKey(name)))
		require.NoError(t, err)
		require.Equal(t, v, daily[day]["views"], "daily views for %q", name)
	}

	// Aggregates were not retried, so they stay under-counted until the
	// reconciler rebuilds them from the daily buckets.
	agg, err := store.ScanAggregates(ctx, dashboardsGroup, dashboardsResource, "default")
	require.NoError(t, err)
	require.Empty(t, agg)
}

func TestIngesterBufferFull(t *testing.T) {
	forEachBackend(t, func(t *testing.T, store *Store) {
		ctx := context.Background()
		ing, err := NewIngester(IngesterOptions{
			Store:              store,
			Leases:             newTestLeases(t),
			Reg:                prometheus.NewRegistry(),
			Now:                fixedNow("2026-06-23"),
			MaxBufferedObjects: 1,
		})
		require.NoError(t, err)

		require.NoError(t, ing.RecordEvent(ctx, dashKey("a"), []*resourcepb.ResourceEvent{{Metric: "views", Value: 1}}))
		// Second distinct object exceeds the bound and is dropped.
		require.NoError(t, ing.RecordEvent(ctx, dashKey("b"), []*resourcepb.ResourceEvent{{Metric: "views", Value: 1}}))
		require.Len(t, ing.buffer, 1)
		require.Equal(t, float64(1), testutil.ToFloat64(ing.metrics.droppedEvents.WithLabelValues(reasonBufferFull)))

		// But existing objects can still accumulate.
		require.NoError(t, ing.RecordEvent(ctx, dashKey("a"), []*resourcepb.ResourceEvent{{Metric: "views", Value: 5}}))
		require.Equal(t, uint64(6), ing.buffer[objectRefFromKey(dashKey("a"))]["views"])
	})
}

func TestIngesterMergeBackHonorsBufferCap(t *testing.T) {
	forEachBackend(t, func(t *testing.T, store *Store) {
		ing, err := NewIngester(IngesterOptions{
			Store:              store,
			Leases:             newTestLeases(t),
			Reg:                prometheus.NewRegistry(),
			Now:                fixedNow("2026-06-23"),
			MaxBufferedObjects: 1,
		})
		require.NoError(t, err)

		a := objectRefFromKey(dashKey("a"))
		b := objectRefFromKey(dashKey("b"))

		// A new object rebuffered into an empty buffer is accepted.
		ing.mergeBack(a, map[string]uint64{"views": 2})
		require.Len(t, ing.buffer, 1)

		// A second distinct object exceeds the cap and is dropped, with its
		// deltas counted as dropped events.
		ing.mergeBack(b, map[string]uint64{"views": 3, "queries": 1})
		require.Len(t, ing.buffer, 1)
		require.Equal(t, float64(4), testutil.ToFloat64(ing.metrics.droppedEvents.WithLabelValues(reasonBufferFull)))

		// Already-buffered objects can still accumulate even when full.
		ing.mergeBack(a, map[string]uint64{"views": 5})
		require.Equal(t, uint64(7), ing.buffer[a]["views"])
	})
}

func TestIngesterGetResourceDailyStats(t *testing.T) {
	forEachBackend(t, func(t *testing.T, store *Store) {
		ctx := context.Background()
		const day = "2026-06-23"
		ing, _ := newTestIngester(t, store, fixedNow(day))
		o := objectRefFromKey(dashKey("a"))

		// Persisted history across several days plus an overflow bucket.
		require.NoError(t, store.IncrementDaily(ctx, o, "2026-06-20", map[string]uint64{"views": 3}))
		require.NoError(t, store.IncrementDaily(ctx, o, "2026-06-22", map[string]uint64{"views": 7, "queries": 1}))
		require.NoError(t, store.IncrementDaily(ctx, o, overflowBucket, map[string]uint64{"views": 100}))

		// A recent event only surfaces once it has been flushed to the KV
		// store; buffered events are intentionally not read here.
		require.NoError(t, ing.RecordEvent(ctx, dashKey("a"), []*resourcepb.ResourceEvent{{Metric: "views", Value: 2}}))

		days, err := collectDailyStats(ing.GetResourceDailyStats(ctx, dashKey("a"), "", ""))
		require.NoError(t, err)

		// Sorted ascending, overflow excluded, today absent (still buffered).
		require.Equal(t, []string{"2026-06-20", "2026-06-22"}, daysList(days))
		require.Equal(t, uint64(3), metricsFor(days, "2026-06-20")["views"])
		require.Equal(t, uint64(7), metricsFor(days, "2026-06-22")["views"])

		// After a flush, today's bucket becomes visible.
		require.NoError(t, ing.flush(ctx))
		days, err = collectDailyStats(ing.GetResourceDailyStats(ctx, dashKey("a"), "", ""))
		require.NoError(t, err)
		require.Equal(t, []string{"2026-06-20", "2026-06-22", day}, daysList(days))
		require.Equal(t, uint64(2), metricsFor(days, day)["views"])

		// Range filter restricts the result.
		days, err = collectDailyStats(ing.GetResourceDailyStats(ctx, dashKey("a"), "2026-06-21", "2026-06-22"))
		require.NoError(t, err)
		require.Equal(t, []string{"2026-06-22"}, daysList(days))

		// Untracked resource returns nothing.
		days, err = collectDailyStats(ing.GetResourceDailyStats(ctx, &resourcepb.ResourceKey{Group: "x", Resource: "y", Namespace: "default", Name: "z"}, "", ""))
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

	ing, err := NewIngester(IngesterOptions{
		Store:  store,
		Leases: mgr,
		Reg:    prometheus.NewRegistry(),
		Now:    fixedNow(day),
	})
	require.NoError(t, err)

	require.NoError(t, ing.RecordEvent(ctx, dashKey("a"), []*resourcepb.ResourceEvent{{Metric: "views", Value: 9}}))
	require.NoError(t, ing.flush(ctx))

	agg, err := store.ScanAggregates(ctx, dashboardsGroup, dashboardsResource, "default")
	require.NoError(t, err)
	require.Equal(t, uint64(9), agg["a"]["views_total"])
}

func TestIngesterStartStopFinalFlush(t *testing.T) {
	store := NewStore(newBadgerKV(t))
	ctx := context.Background()
	const day = "2026-06-23"

	ing, err := NewIngester(IngesterOptions{
		Store:  store,
		Leases: newTestLeases(t),
		Reg:    prometheus.NewRegistry(),
		Now:    fixedNow(day),
		// A long interval guarantees the periodic ticker never fires during the
		// test, so anything that reaches the store must have come from the
		// shutdown flush rather than a scheduled one.
		FlushInterval: time.Hour,
	})
	require.NoError(t, err)

	require.NoError(t, services.StartAndAwaitRunning(ctx, ing))
	require.NoError(t, ing.RecordEvent(ctx, dashKey("a"), []*resourcepb.ResourceEvent{{Metric: "views", Value: 4}}))

	// Nothing has been persisted yet: the event is still buffered in memory.
	agg, err := store.ScanAggregates(ctx, dashboardsGroup, dashboardsResource, "default")
	require.NoError(t, err)
	require.Empty(t, agg)
	require.Len(t, ing.buffer, 1)

	// Stop triggers a best-effort final flush of the buffered event.
	require.NoError(t, services.StopAndAwaitTerminated(ctx, ing))

	require.Empty(t, ing.buffer, "buffer should be drained by the shutdown flush")

	agg, err = store.ScanAggregates(ctx, dashboardsGroup, dashboardsResource, "default")
	require.NoError(t, err)
	require.Equal(t, uint64(4), agg["a"]["views_total"])

	daily, err := store.ReadDailyForObject(ctx, objectRefFromKey(dashKey("a")))
	require.NoError(t, err)
	require.Equal(t, uint64(4), daily[day]["views"])
}

func collectDailyStats(seq iter.Seq2[*resourcepb.DailyStat, error]) ([]*resourcepb.DailyStat, error) {
	var out []*resourcepb.DailyStat
	for d, err := range seq {
		if err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, nil
}

func daysList(days []*resourcepb.DailyStat) []string {
	out := make([]string, 0, len(days))
	for _, d := range days {
		out = append(out, d.Day)
	}
	return out
}

func metricsFor(days []*resourcepb.DailyStat, day string) map[string]uint64 {
	for _, d := range days {
		if d.Day == day {
			return d.Metrics
		}
	}
	return nil
}

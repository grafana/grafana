package usagestats

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
)

func newTestReconciler(t *testing.T, store *Store, leases *lease.Manager, now func() time.Time) *Reconciler {
	t.Helper()
	if leases == nil {
		leases = newTestLeases(t)
	}
	r, err := NewReconciler(ReconcilerOptions{
		Store:  store,
		Leases: leases,
		Reg:    prometheus.NewRegistry(),
		Now:    now,
	})
	require.NoError(t, err)
	// Tests drive Reconcile directly; keep the service loop out of the way.
	r.startupJitter = disableStartupReconcile
	return r
}

// newTestAggregator builds an aggregator for the dashboards declaration
// (metrics views/queries/errors, windows 1/7/30) anchored at the given day.
func newTestAggregator(t *testing.T, today string) *aggregator {
	t.Helper()
	decl, ok := DefaultDeclarations().lookup(dashboardsGroup, dashboardsResource)
	require.True(t, ok)
	day, err := parseDay(today)
	require.NoError(t, err)
	return newAggregator(decl, day, log.NewNopLogger())
}

// dailyOf wraps daily buckets as they arrive from the store.
func dailyOf(daily map[string]map[string]uint64) ObjectDaily {
	return ObjectDaily{Ref: newTestObject("dash-a"), Daily: daily}
}

// dayOffset returns the YYYY-MM-DD bucket for `days` before the fixed "today".
func dayOffset(t *testing.T, today string, days int) string {
	t.Helper()
	base, err := parseDay(today)
	require.NoError(t, err)
	return base.AddDate(0, 0, -days).Format(dayLayout)
}

func TestComputeAggregates(t *testing.T) {
	daily := map[string]map[string]uint64{
		"2026-06-23":   {"views": 5, "queries": 2}, // today
		"2026-06-20":   {"views": 3},               // within 7d
		"2026-06-01":   {"views": 7},               // within 30d, outside 7d
		"2026-05-01":   {"views": 100},             // outside 30d window
		overflowBucket: {"views": 1000},            // folded history, total only
	}

	got := newTestAggregator(t, "2026-06-23").compute(dailyOf(daily))

	// views total = 5 + 3 + 7 + 100 + 1000
	require.Equal(t, uint64(1115), got["views_total"])
	require.Equal(t, uint64(5), got["views_last_1_days"])
	require.Equal(t, uint64(8), got["views_last_7_days"])   // 5 + 3
	require.Equal(t, uint64(15), got["views_last_30_days"]) // 5 + 3 + 7

	// queries only has a value today.
	require.Equal(t, uint64(2), got["queries_total"])
	require.Equal(t, uint64(2), got["queries_last_1_days"])
	require.Equal(t, uint64(2), got["queries_last_7_days"])
	require.Equal(t, uint64(2), got["queries_last_30_days"])

	// A metric with no data still emits zeroed fields so stale values reset.
	require.Equal(t, uint64(0), got["errors_total"])
	require.Equal(t, uint64(0), got["errors_last_7_days"])
}

func TestComputeAggregatesIgnoresFutureDays(t *testing.T) {
	got := newTestAggregator(t, "2026-06-23").compute(dailyOf(map[string]map[string]uint64{
		"2026-06-23": {"views": 5},
		"2026-06-25": {"views": 9}, // clock skew / future bucket
	}))
	// Future days contribute to total but never to a rolling window.
	require.Equal(t, uint64(14), got["views_total"])
	require.Equal(t, uint64(5), got["views_last_1_days"])
	require.Equal(t, uint64(5), got["views_last_30_days"])
}

// counts is indexed by day offset, so the edges of a window are exactly where an
// off-by-one would hide: last_N covers ages 0..N-1.
func TestComputeAggregatesWindowBoundaries(t *testing.T) {
	const today = "2026-06-23"
	daily := map[string]map[string]uint64{
		dayOffset(t, today, 6):           {"views": 1}, // last day inside 7d
		dayOffset(t, today, 7):           {"views": 2}, // first day outside 7d
		dayOffset(t, today, MaxWindow-1): {"views": 4}, // last day inside 30d
		dayOffset(t, today, MaxWindow):   {"views": 8}, // first day outside 30d
		dayOffset(t, today, MaxWindow+1): {"views": 16},
	}

	got := newTestAggregator(t, today).compute(dailyOf(daily))

	require.Equal(t, uint64(0), got["views_last_1_days"])
	require.Equal(t, uint64(1), got["views_last_7_days"])
	require.Equal(t, uint64(1+2+4), got["views_last_30_days"])
	require.Equal(t, uint64(1+2+4+8+16), got["views_total"])
}

// One aggregator serves a whole resource, so its scratch counters must not leak
// between objects.
func TestComputeAggregatesReusesScratchPerObject(t *testing.T) {
	const today = "2026-06-23"
	agg := newTestAggregator(t, today)

	first := agg.compute(dailyOf(map[string]map[string]uint64{
		today:          {"views": 5, "queries": 1},
		overflowBucket: {"views": 50},
	}))
	require.Equal(t, uint64(55), first["views_total"])
	require.Equal(t, uint64(5), first["views_last_1_days"])

	// A sparser object right after must not inherit anything from the first.
	second := agg.compute(dailyOf(map[string]map[string]uint64{
		dayOffset(t, today, 3): {"views": 2},
	}))
	require.Equal(t, uint64(2), second["views_total"])
	require.Equal(t, uint64(0), second["views_last_1_days"])
	require.Equal(t, uint64(2), second["views_last_7_days"])
	require.Equal(t, uint64(0), second["queries_total"])

	// An empty object comes out fully zeroed, which is what resets stale fields.
	third := agg.compute(dailyOf(map[string]map[string]uint64{}))
	for field, v := range third {
		require.Equal(t, uint64(0), v, "field %s should be zero", field)
	}
	require.Len(t, third, 12) // 3 metrics x (3 windows + total)
}

// A metric that was dropped from the declaration must not leak into any field.
func TestComputeAggregatesIgnoresUndeclaredMetrics(t *testing.T) {
	const today = "2026-06-23"
	got := newTestAggregator(t, today).compute(dailyOf(map[string]map[string]uint64{
		today: {"views": 3, "retired": 9},
	}))

	require.Equal(t, uint64(3), got["views_total"])
	require.NotContains(t, got, "retired_total")
	require.Len(t, got, 12)
}

func BenchmarkComputeAggregates(b *testing.B) {
	decl, _ := DefaultDeclarations().lookup(dashboardsGroup, dashboardsResource)
	today, _ := parseDay("2026-06-23")

	dense := map[string]map[string]uint64{overflowBucket: {"views": 1000}}
	for age := 0; age < MaxWindow; age++ {
		dense[today.AddDate(0, 0, -age).Format(dayLayout)] = map[string]uint64{
			"views": 10, "queries": 5, "errors": 1,
		}
	}
	sparse := map[string]map[string]uint64{
		today.Format(dayLayout):                   {"views": 1},
		today.AddDate(0, 0, -2).Format(dayLayout): {"views": 2},
	}

	for name, daily := range map[string]map[string]map[string]uint64{"dense": dense, "sparse": sparse} {
		b.Run(name, func(b *testing.B) {
			agg := newAggregator(decl, today, log.NewNopLogger())
			od := ObjectDaily{Ref: newTestObject("dash-a"), Daily: daily}
			b.ReportAllocs()
			b.ResetTimer()
			for i := 0; i < b.N; i++ {
				_ = agg.compute(od)
			}
		})
	}
}

func TestReconcilerRecomputesWindowsAfterRollover(t *testing.T) {
	forEachBackend(t, func(t *testing.T, store *Store) {
		ctx := context.Background()
		const today = "2026-06-23"
		o := newTestObject("dash-a")

		// Daily source of truth: one view today, one view 10 days ago.
		require.NoError(t, store.IncrementDaily(ctx, o, today, map[string]uint64{"views": 1}))
		require.NoError(t, store.IncrementDaily(ctx, o, dayOffset(t, today, 10), map[string]uint64{"views": 1}))

		// Simulate drifted aggregates left by incremental flush bumps: the
		// 10-day-old view is still counted in last_7_days.
		require.NoError(t, store.WriteAggregates(ctx, o, map[string]uint64{
			"views_last_1_days":  2,
			"views_last_7_days":  2,
			"views_last_30_days": 2,
			"views_total":        2,
		}))

		r := newTestReconciler(t, store, nil, fixedNow(today))
		require.NoError(t, r.Reconcile(ctx))

		all, err := store.ScanAggregates(ctx, dashboardsGroup, dashboardsResource, "default")
		require.NoError(t, err)
		got := all["dash-a"]
		require.Equal(t, uint64(1), got["views_last_1_days"])  // only today
		require.Equal(t, uint64(1), got["views_last_7_days"])  // the 10-day-old view dropped out
		require.Equal(t, uint64(2), got["views_last_30_days"]) // both still in 30d
		require.Equal(t, uint64(2), got["views_total"])
	})
}

// The day anchor is taken per cycle, so a process running for weeks keeps
// producing correct windows without a restart.
func TestReconcilerReanchorsEachCycle(t *testing.T) {
	forEachBackend(t, func(t *testing.T, store *Store) {
		ctx := context.Background()
		const firstDay = "2026-06-23"
		o := newTestObject("dash-a")
		require.NoError(t, store.IncrementDaily(ctx, o, firstDay, map[string]uint64{"views": 4}))

		day, err := parseDay(firstDay)
		require.NoError(t, err)
		now := day.Add(15 * time.Hour)
		r := newTestReconciler(t, store, nil, func() time.Time { return now })

		require.NoError(t, r.Reconcile(ctx))
		agg, err := store.ScanAggregates(ctx, dashboardsGroup, dashboardsResource, "default")
		require.NoError(t, err)
		require.Equal(t, uint64(4), agg["dash-a"]["views_last_1_days"])

		// Same process, no restart, eight days later: the bucket has aged out of
		// the 1 and 7 day windows but is still inside 30 days.
		now = now.AddDate(0, 0, 8)
		require.NoError(t, r.Reconcile(ctx))
		agg, err = store.ScanAggregates(ctx, dashboardsGroup, dashboardsResource, "default")
		require.NoError(t, err)
		require.Equal(t, uint64(0), agg["dash-a"]["views_last_1_days"])
		require.Equal(t, uint64(0), agg["dash-a"]["views_last_7_days"])
		require.Equal(t, uint64(4), agg["dash-a"]["views_last_30_days"])
		require.Equal(t, uint64(4), agg["dash-a"]["views_total"])

		// A year later it only survives in the total.
		now = now.AddDate(1, 0, 0)
		require.NoError(t, r.Reconcile(ctx))
		agg, err = store.ScanAggregates(ctx, dashboardsGroup, dashboardsResource, "default")
		require.NoError(t, err)
		require.Equal(t, uint64(0), agg["dash-a"]["views_last_30_days"])
		require.Equal(t, uint64(4), agg["dash-a"]["views_total"])
	})
}

func TestReconcilerAcrossNamespaces(t *testing.T) {
	forEachBackend(t, func(t *testing.T, store *Store) {
		ctx := context.Background()
		const today = "2026-06-23"

		a := objectRef{Group: dashboardsGroup, Resource: dashboardsResource, Namespace: "ns-a", Name: "dash-a"}
		b := objectRef{Group: dashboardsGroup, Resource: dashboardsResource, Namespace: "ns-b", Name: "dash-b"}
		require.NoError(t, store.IncrementDaily(ctx, a, today, map[string]uint64{"views": 3}))
		require.NoError(t, store.IncrementDaily(ctx, b, today, map[string]uint64{"queries": 4}))

		r := newTestReconciler(t, store, nil, fixedNow(today))
		require.NoError(t, r.Reconcile(ctx))

		aggA, err := store.ScanAggregates(ctx, dashboardsGroup, dashboardsResource, "ns-a")
		require.NoError(t, err)
		require.Equal(t, uint64(3), aggA["dash-a"]["views_total"])

		aggB, err := store.ScanAggregates(ctx, dashboardsGroup, dashboardsResource, "ns-b")
		require.NoError(t, err)
		require.Equal(t, uint64(4), aggB["dash-b"]["queries_total"])
	})
}

func TestReconcilerSkipsNamespaceWithHeldLease(t *testing.T) {
	// Badger-only: a single shared KV so the externally-held lease is visible
	// to the reconciler.
	kvStore := newBadgerKV(t)
	store := NewStore(kvStore)
	leases := lease.NewManager(kvStore, "test-holder", nil,
		lease.WithInternalMinTTL(time.Second), lease.WithGarbageCollectionDisabled)
	t.Cleanup(leases.Stop)

	ctx := context.Background()
	const today = "2026-06-23"
	heldObj := objectRef{Group: dashboardsGroup, Resource: dashboardsResource, Namespace: "held", Name: "dash-a"}
	freeObj := objectRef{Group: dashboardsGroup, Resource: dashboardsResource, Namespace: "free", Name: "dash-b"}
	require.NoError(t, store.IncrementDaily(ctx, heldObj, today, map[string]uint64{"views": 5}))
	require.NoError(t, store.IncrementDaily(ctx, freeObj, today, map[string]uint64{"views": 9}))

	// Hold one namespace's flush lease so the reconciler must skip it, while
	// leaving the other namespace's lease free.
	scope := groupResourceNamespaceRef{Group: dashboardsGroup, Resource: dashboardsResource, Namespace: "held"}
	held, err := leases.Acquire(ctx, scope.leaseName(), lease.WithTTL(flushLeaseTTL))
	require.NoError(t, err)

	r := newTestReconciler(t, store, leases, fixedNow(today))
	require.NoError(t, r.Reconcile(ctx))

	// The held namespace was skipped: no aggregates written.
	heldAgg, err := store.ScanAggregates(ctx, dashboardsGroup, dashboardsResource, "held")
	require.NoError(t, err)
	require.Empty(t, heldAgg)

	// A namespace whose lease is free is reconciled in the same cycle.
	freeAgg, err := store.ScanAggregates(ctx, dashboardsGroup, dashboardsResource, "free")
	require.NoError(t, err)
	require.Equal(t, uint64(9), freeAgg["dash-b"]["views_total"])

	// After releasing, a subsequent reconcile writes the held namespace too.
	require.NoError(t, leases.Release(ctx, held))
	require.NoError(t, r.Reconcile(ctx))
	heldAgg, err = store.ScanAggregates(ctx, dashboardsGroup, dashboardsResource, "held")
	require.NoError(t, err)
	require.Equal(t, uint64(5), heldAgg["dash-a"]["views_total"])
}

// The whole point of the job: an object with no activity inside any window has
// its stale window fields written back down to zero, while total is preserved.
func TestReconcilerZeroesWindowsWithNoRecentActivity(t *testing.T) {
	forEachBackend(t, func(t *testing.T, store *Store) {
		ctx := context.Background()
		const today = "2026-06-23"
		o := newTestObject("dash-a")

		require.NoError(t, store.IncrementDaily(ctx, o, dayOffset(t, today, 90), map[string]uint64{"views": 4}))
		require.NoError(t, store.WriteAggregates(ctx, o, map[string]uint64{
			"views_last_1_days":  4,
			"views_last_7_days":  4,
			"views_last_30_days": 4,
			"views_total":        4,
		}))

		r := newTestReconciler(t, store, nil, fixedNow(today))
		require.NoError(t, r.Reconcile(ctx))

		all, err := store.ScanAggregates(ctx, dashboardsGroup, dashboardsResource, "default")
		require.NoError(t, err)
		got := all["dash-a"]
		require.Equal(t, uint64(0), got["views_last_1_days"])
		require.Equal(t, uint64(0), got["views_last_7_days"])
		require.Equal(t, uint64(0), got["views_last_30_days"])
		require.Equal(t, uint64(4), got["views_total"])
	})
}

// On-prem instances restart often; waiting a full interval would leave windows
// stale for hours, so the service reconciles shortly after startup.
func TestReconcilerReconcilesOnStartup(t *testing.T) {
	store := NewStore(newBadgerKV(t))
	ctx := context.Background()
	const today = "2026-06-23"
	o := newTestObject("dash-a")
	require.NoError(t, store.IncrementDaily(ctx, o, today, map[string]uint64{"views": 7}))

	r := newTestReconciler(t, store, nil, fixedNow(today))
	// No jitter, and an interval long enough that only the startup pass can run.
	r.startupJitter = 0
	r.interval = time.Hour

	require.NoError(t, services.StartAndAwaitRunning(ctx, r))
	t.Cleanup(func() { require.NoError(t, services.StopAndAwaitTerminated(context.Background(), r)) })

	require.Eventually(t, func() bool {
		agg, err := store.ScanAggregates(ctx, dashboardsGroup, dashboardsResource, "default")
		require.NoError(t, err)
		return agg["dash-a"]["views_total"] == 7
	}, 5*time.Second, 10*time.Millisecond)
}

func TestReconcilerStopsOnCancelledContext(t *testing.T) {
	store := NewStore(newBadgerKV(t))
	ctx, cancel := context.WithCancel(context.Background())
	const today = "2026-06-23"
	require.NoError(t, store.IncrementDaily(ctx, newTestObject("dash-a"), today, map[string]uint64{"views": 1}))

	r := newTestReconciler(t, store, nil, fixedNow(today))
	cancel()
	require.ErrorIs(t, r.Reconcile(ctx), context.Canceled)
}

func TestComputeAggregatesSkipsUnparseableDays(t *testing.T) {
	got := newTestAggregator(t, "2026-06-23").compute(dailyOf(map[string]map[string]uint64{
		"2026-06-23": {"views": 5},
		"not-a-day":  {"views": 7},
	}))

	// The bad bucket still counts toward total, but can't be placed in a window.
	require.Equal(t, uint64(12), got["views_total"])
	require.Equal(t, uint64(5), got["views_last_30_days"])
}

// failingBatchKV fails Batch writes for keys of one namespace, leaving reads and
// every other namespace intact.
type failingBatchKV struct {
	kv.KV
	failNamespace string
}

func (f *failingBatchKV) Batch(ctx context.Context, section string, ops []kv.BatchOp) error {
	for _, op := range ops {
		if strings.Contains(op.Key, "/"+f.failNamespace+"/") {
			return errors.New("boom")
		}
	}
	return f.KV.Batch(ctx, section, ops)
}

func TestReconcilerCountsFailuresPerNamespace(t *testing.T) {
	kvStore := newBadgerKV(t)
	ctx := context.Background()
	const today = "2026-06-23"

	seed := NewStore(kvStore)
	bad := objectRef{Group: dashboardsGroup, Resource: dashboardsResource, Namespace: "ns-bad", Name: "dash-a"}
	good := objectRef{Group: dashboardsGroup, Resource: dashboardsResource, Namespace: "ns-good", Name: "dash-b"}
	require.NoError(t, seed.IncrementDaily(ctx, bad, today, map[string]uint64{"views": 1}))
	require.NoError(t, seed.IncrementDaily(ctx, good, today, map[string]uint64{"views": 2}))

	store := NewStore(&failingBatchKV{KV: kvStore, failNamespace: "ns-bad"})
	r := newTestReconciler(t, store, nil, fixedNow(today))

	require.Error(t, r.Reconcile(ctx))

	// One namespace failed, not the whole cycle.
	require.Equal(t, 1.0, testutil.ToFloat64(r.metrics.namespaceFailures))
	// A failing namespace doesn't stop the others.
	agg, err := seed.ScanAggregates(ctx, dashboardsGroup, dashboardsResource, "ns-good")
	require.NoError(t, err)
	require.Equal(t, uint64(2), agg["dash-b"]["views_total"])
	// The cycle did not complete cleanly, so freshness is not advertised.
	require.Zero(t, testutil.ToFloat64(r.metrics.lastSuccess))

	// A clean cycle records freshness without touching the failure counter.
	clean := newTestReconciler(t, seed, nil, fixedNow(today))
	require.NoError(t, clean.Reconcile(ctx))
	require.Zero(t, testutil.ToFloat64(clean.metrics.namespaceFailures))
	require.NotZero(t, testutil.ToFloat64(clean.metrics.lastSuccess))
}

func TestNewReconcilerRequiresLeaseManager(t *testing.T) {
	_, err := NewReconciler(ReconcilerOptions{Store: NewStore(newBadgerKV(t))})
	require.Error(t, err)
}

func TestNewReconcilerRequiresStore(t *testing.T) {
	_, err := NewReconciler(ReconcilerOptions{Leases: newTestLeases(t)})
	require.Error(t, err)
}

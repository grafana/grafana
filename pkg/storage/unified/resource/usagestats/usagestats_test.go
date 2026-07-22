package usagestats

import (
	"context"
	"fmt"
	"testing"
	"time"

	badger "github.com/dgraph-io/badger/v4"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func newBadgerKV(t *testing.T) kv.KV {
	t.Helper()
	opts := badger.DefaultOptions("").WithInMemory(true).WithLogger(nil)
	db, err := badger.Open(opts)
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })
	return kv.NewBadgerKV(db)
}

func newSQLKV(t *testing.T) kv.KV {
	t.Helper()
	dbstore := db.InitTestDB(t)
	eDB, err := dbimpl.ProvideResourceDB(dbstore, setting.NewCfg(), nil)
	require.NoError(t, err)
	dbConn, err := eDB.Init(t.Context())
	require.NoError(t, err)
	store, err := kv.NewSQLKV(dbConn.SqlDB(), dbConn.DriverName())
	require.NoError(t, err)
	return store
}

// forEachBackend runs fn against every KV backend the Store supports, so the
// CRUD behavior is verified identically on badger and sqlkv.
func forEachBackend(t *testing.T, fn func(t *testing.T, store *Store)) {
	t.Helper()
	backends := map[string]func(*testing.T) kv.KV{
		"badger": newBadgerKV,
		"sqlkv":  newSQLKV,
	}
	for name, newKV := range backends {
		t.Run(name, func(t *testing.T) {
			fn(t, NewStore(newKV(t)))
		})
	}
}

func newTestObject(name string) objectRef {
	return objectRef{
		Group:     dashboardsGroup,
		Resource:  dashboardsResource,
		Namespace: "default",
		Name:      name,
	}
}

func TestDeclarations(t *testing.T) {
	decls := DefaultDeclarations()

	decl, ok := decls.Lookup(dashboardsGroup, dashboardsResource)
	require.True(t, ok)
	require.Equal(t, "dashboard.grafana.app/dashboards", decl.GroupResource())
	require.Equal(t, []int{1, 7, 30}, decl.Windows)

	require.True(t, decl.HasMetric("views"))
	require.True(t, decl.HasMetric("queries"))
	require.True(t, decl.HasMetric("errors"))
	require.False(t, decl.HasMetric("bogus"))

	_, ok = decls.Lookup("other.grafana.app", "things")
	require.False(t, ok)
}

func TestDeclarationsValidate(t *testing.T) {
	require.NoError(t, DefaultDeclarations().Validate())

	// A resource declaring more metrics than fit in one daily batch cannot
	// flush and must be rejected at startup.
	tooMany := make([]string, kv.MaxBatchOps+1)
	for i := range tooMany {
		tooMany[i] = fmt.Sprintf("metric-%d", i)
	}
	decls := &Declarations{byGR: map[string]StatsDeclaration{}}
	decls.add(StatsDeclaration{Group: "g.grafana.app", Resource: "things", Metrics: tooMany, Windows: []int{1}})
	require.ErrorContains(t, decls.Validate(), "exceeding the max batch size")
}

func TestDeclarationFieldNames(t *testing.T) {
	require.Equal(t, "views_last_1_days", aggregateField("views", 1))
	require.Equal(t, "views_last_7_days", aggregateField("views", 7))
	require.Equal(t, "queries_last_30_days", aggregateField("queries", 30))
	require.Equal(t, "views_total", totalField("views"))
}

func TestKeyHelpers(t *testing.T) {
	o := newTestObject("dash-a")

	dk := dailyKey(o, "2026-06-23", "views")
	require.Equal(t, "dashboard.grafana.app/dashboards/default/dash-a/2026-06-23/views", dk)
	pd, err := parseDailyKey(dk)
	require.NoError(t, err)
	require.Equal(t, o, pd.objectRef)
	require.Equal(t, "2026-06-23", pd.Day)
	require.Equal(t, "views", pd.Metric)

	ak := aggregateKey(o, "views_total")
	require.Equal(t, "dashboard.grafana.app/dashboards/default/dash-a/views_total", ak)
	pa, err := parseAggregateKey(ak)
	require.NoError(t, err)
	require.Equal(t, o, pa.objectRef)
	require.Equal(t, "views_total", pa.Field)

	_, err = parseDailyKey("too/few/parts")
	require.Error(t, err)
	_, err = parseAggregateKey("too/few")
	require.Error(t, err)
}

func TestDayHelpers(t *testing.T) {
	// Days are bucketed in the server's local timezone, so build the
	// timestamp in the same location the code under test formats with.
	ts := time.Date(2026, 6, 23, 15, 4, 5, 0, time.Local).Unix()
	require.Equal(t, "2026-06-23", dayString(ts))

	d, err := parseDay("2026-06-23")
	require.NoError(t, err)
	require.Equal(t, time.Date(2026, 6, 23, 0, 0, 0, 0, time.UTC), d)
}

func TestStoreIncrementDaily(t *testing.T) {
	forEachBackend(t, func(t *testing.T, store *Store) {
		ctx := context.Background()
		o := newTestObject("dash-a")
		const day = "2026-06-23"

		require.NoError(t, store.IncrementDaily(ctx, o, day, map[string]uint64{"views": 3, "queries": 1}))

		// A second increment accumulates onto the existing bucket.
		require.NoError(t, store.IncrementDaily(ctx, o, day, map[string]uint64{"views": 2}))

		// Zero deltas are skipped.
		require.NoError(t, store.IncrementDaily(ctx, o, day, map[string]uint64{"errors": 0}))

		daily, err := store.ReadDailyForObject(ctx, o)
		require.NoError(t, err)
		require.Equal(t, uint64(5), daily[day]["views"])
		require.Equal(t, uint64(1), daily[day]["queries"])
		_, hasErrors := daily[day]["errors"]
		require.False(t, hasErrors)
	})
}

func TestStoreReadDailyRange(t *testing.T) {
	forEachBackend(t, func(t *testing.T, store *Store) {
		ctx := context.Background()
		o := newTestObject("dash-a")

		require.NoError(t, store.IncrementDaily(ctx, o, "2026-06-20", map[string]uint64{"views": 3}))
		require.NoError(t, store.IncrementDaily(ctx, o, "2026-06-22", map[string]uint64{"views": 7, "queries": 1}))
		require.NoError(t, store.IncrementDaily(ctx, o, "2026-06-24", map[string]uint64{"views": 2}))
		require.NoError(t, store.IncrementDaily(ctx, o, overflowBucket, map[string]uint64{"views": 100}))

		collect := func(from, to string) []DailyBucket {
			var got []DailyBucket
			for b, err := range store.ReadDailyRange(ctx, o, from, to) {
				require.NoError(t, err)
				got = append(got, b)
			}
			return got
		}

		// Streamed ascending, overflow excluded, all metrics per day present.
		full := collect("", "")
		require.Equal(t, []string{"2026-06-20", "2026-06-22", "2026-06-24"}, bucketDays(full))
		require.Equal(t, uint64(3), full[0].Metrics["views"])
		require.Equal(t, uint64(7), full[1].Metrics["views"])
		require.Equal(t, uint64(1), full[1].Metrics["queries"])
		require.Equal(t, uint64(2), full[2].Metrics["views"])

		// Inclusive range bounds.
		require.Equal(t, []string{"2026-06-22", "2026-06-24"}, bucketDays(collect("2026-06-22", "")))
		require.Equal(t, []string{"2026-06-20", "2026-06-22"}, bucketDays(collect("", "2026-06-22")))
		require.Equal(t, []string{"2026-06-22"}, bucketDays(collect("2026-06-21", "2026-06-23")))

		// Empty result for a range with no data.
		require.Empty(t, collect("2027-01-01", "2027-12-31"))

		// Early consumer termination stops iteration.
		var seen int
		for range store.ReadDailyRange(ctx, o, "", "") {
			seen++
			break
		}
		require.Equal(t, 1, seen)
	})
}

func TestStoreReadDailyRangeBatching(t *testing.T) {
	forEachBackend(t, func(t *testing.T, store *Store) {
		ctx := context.Background()
		o := newTestObject("dash-a")

		// Enough days that the 3-metric keys span several BatchGet chunks and
		// individual days straddle chunk boundaries (3 does not divide 50).
		const days = 40
		want := make(map[string]uint64, days)
		for i := 0; i < days; i++ {
			day := fmt.Sprintf("2026-06-%02d", i+1)
			views := uint64(i + 1)
			require.NoError(t, store.IncrementDaily(ctx, o, day, map[string]uint64{
				"views":   views,
				"queries": views * 2,
				"errors":  0, // zero deltas are skipped, so this key won't exist
			}))
			want[day] = views
		}

		var got []DailyBucket
		for b, err := range store.ReadDailyRange(ctx, o, "", "") {
			require.NoError(t, err)
			got = append(got, b)
		}

		require.Len(t, got, days)
		for i, b := range got {
			require.Equal(t, fmt.Sprintf("2026-06-%02d", i+1), b.Day, "days must stream in ascending order")
			require.Equal(t, want[b.Day], b.Metrics["views"])
			require.Equal(t, want[b.Day]*2, b.Metrics["queries"])
			require.Len(t, b.Metrics, 2, "each day carries exactly its non-zero metrics, even across batch boundaries")
		}
	})
}

func bucketDays(buckets []DailyBucket) []string {
	out := make([]string, 0, len(buckets))
	for _, b := range buckets {
		out = append(out, b.Day)
	}
	return out
}

func TestStoreFoldIntoOverflow(t *testing.T) {
	forEachBackend(t, func(t *testing.T, store *Store) {
		ctx := context.Background()
		o := newTestObject("dash-a")

		// Pre-existing overflow plus two expiring days.
		require.NoError(t, store.IncrementDaily(ctx, o, overflowBucket, map[string]uint64{"views": 100}))
		require.NoError(t, store.IncrementDaily(ctx, o, "2026-05-01", map[string]uint64{"views": 5}))
		require.NoError(t, store.IncrementDaily(ctx, o, "2026-05-02", map[string]uint64{"views": 7, "queries": 2}))
		// A current bucket that must be left untouched.
		require.NoError(t, store.IncrementDaily(ctx, o, "2026-06-23", map[string]uint64{"views": 9}))

		expired := map[string]map[string]uint64{
			"2026-05-01": {"views": 5},
			"2026-05-02": {"views": 7, "queries": 2},
		}
		require.NoError(t, store.FoldIntoOverflow(ctx, o, expired))

		daily, err := store.ReadDailyForObject(ctx, o)
		require.NoError(t, err)

		// Overflow accumulated the expired values.
		require.Equal(t, uint64(112), daily[overflowBucket]["views"])
		require.Equal(t, uint64(2), daily[overflowBucket]["queries"])
		// Expired buckets were deleted.
		_, ok := daily["2026-05-01"]
		require.False(t, ok)
		_, ok = daily["2026-05-02"]
		require.False(t, ok)
		// The current bucket is untouched.
		require.Equal(t, uint64(9), daily["2026-06-23"]["views"])

		// No-op on empty input.
		require.NoError(t, store.FoldIntoOverflow(ctx, o, nil))
	})
}

func TestStoreFoldIntoOverflowChunking(t *testing.T) {
	forEachBackend(t, func(t *testing.T, store *Store) {
		ctx := context.Background()
		o := newTestObject("dash-a")

		// More expiring days than MaxBatchOps so the fold (deletes + the
		// overflow put) spans multiple batches.
		n := kv.MaxBatchOps*2 + 3
		expired := make(map[string]map[string]uint64, n)
		var want uint64
		for i := 0; i < n; i++ {
			day := fmt.Sprintf("2026-01-%03d", i)
			require.NoError(t, store.IncrementDaily(ctx, o, day, map[string]uint64{"views": uint64(i + 1)}))
			expired[day] = map[string]uint64{"views": uint64(i + 1)}
			want += uint64(i + 1)
		}
		// A current bucket that must be left untouched.
		require.NoError(t, store.IncrementDaily(ctx, o, "2026-06-23", map[string]uint64{"views": 9}))

		require.NoError(t, store.FoldIntoOverflow(ctx, o, expired))

		daily, err := store.ReadDailyForObject(ctx, o)
		require.NoError(t, err)

		// Overflow accumulated every expired value.
		require.Equal(t, want, daily[overflowBucket]["views"])
		// All expired buckets were deleted.
		for day := range expired {
			_, ok := daily[day]
			require.False(t, ok)
		}
		// The current bucket is untouched.
		require.Equal(t, uint64(9), daily["2026-06-23"]["views"])
	})
}

func TestStoreReadDailyIsolatesObjects(t *testing.T) {
	forEachBackend(t, func(t *testing.T, store *Store) {
		ctx := context.Background()
		a := newTestObject("dash-a")
		b := newTestObject("dash-b")

		require.NoError(t, store.IncrementDaily(ctx, a, "2026-06-23", map[string]uint64{"views": 5}))
		require.NoError(t, store.IncrementDaily(ctx, b, "2026-06-23", map[string]uint64{"views": 99}))

		daily, err := store.ReadDailyForObject(ctx, a)
		require.NoError(t, err)
		require.Equal(t, uint64(5), daily["2026-06-23"]["views"])
		require.Len(t, daily, 1)
	})
}

func TestStoreAggregates(t *testing.T) {
	forEachBackend(t, func(t *testing.T, store *Store) {
		ctx := context.Background()
		a := newTestObject("dash-a")
		b := newTestObject("dash-b")

		require.NoError(t, store.WriteAggregates(ctx, a, map[string]uint64{
			"views_last_1_days": 1,
			"views_last_7_days": 10,
			"views_total":       42,
		}))
		require.NoError(t, store.WriteAggregates(ctx, b, map[string]uint64{
			"views_total": 7,
		}))

		all, err := store.ScanAggregates(ctx, dashboardsGroup, dashboardsResource, "default")
		require.NoError(t, err)
		require.Equal(t, uint64(1), all["dash-a"]["views_last_1_days"])
		require.Equal(t, uint64(10), all["dash-a"]["views_last_7_days"])
		require.Equal(t, uint64(42), all["dash-a"]["views_total"])
		require.Equal(t, uint64(7), all["dash-b"]["views_total"])

		// Overwriting updates the existing field.
		require.NoError(t, store.WriteAggregates(ctx, b, map[string]uint64{"views_total": 8}))
		all, err = store.ScanAggregates(ctx, dashboardsGroup, dashboardsResource, "default")
		require.NoError(t, err)
		require.Equal(t, uint64(8), all["dash-b"]["views_total"])

		// A different namespace is isolated.
		all, err = store.ScanAggregates(ctx, dashboardsGroup, dashboardsResource, "other")
		require.NoError(t, err)
		require.Empty(t, all)
	})
}

func TestStoreWriteAggregatesChunking(t *testing.T) {
	forEachBackend(t, func(t *testing.T, store *Store) {
		ctx := context.Background()
		o := newTestObject("dash-a")

		// More fields than MaxBatchOps so the write spans multiple batches.
		n := kv.MaxBatchOps*2 + 3
		fields := make(map[string]uint64, n)
		for i := 0; i < n; i++ {
			fields[fmt.Sprintf("field_%03d", i)] = uint64(i)
		}
		require.NoError(t, store.WriteAggregates(ctx, o, fields))

		all, err := store.ScanAggregates(ctx, dashboardsGroup, dashboardsResource, "default")
		require.NoError(t, err)
		require.Len(t, all["dash-a"], n)
		for i := 0; i < n; i++ {
			require.Equal(t, uint64(i), all["dash-a"][fmt.Sprintf("field_%03d", i)])
		}
	})
}

func TestStoreListObjects(t *testing.T) {
	forEachBackend(t, func(t *testing.T, store *Store) {
		ctx := context.Background()
		a := newTestObject("dash-a")
		b := newTestObject("dash-b")

		require.NoError(t, store.IncrementDaily(ctx, a, "2026-06-22", map[string]uint64{"views": 1}))
		require.NoError(t, store.IncrementDaily(ctx, a, "2026-06-23", map[string]uint64{"views": 1}))
		require.NoError(t, store.IncrementDaily(ctx, b, "2026-06-23", map[string]uint64{"queries": 1}))

		objs, err := store.listObjects(ctx, dashboardsGroup, dashboardsResource, "default")
		require.NoError(t, err)
		require.Len(t, objs, 2)

		names := map[string]bool{}
		for _, o := range objs {
			names[o.Name] = true
		}
		require.True(t, names["dash-a"])
		require.True(t, names["dash-b"])
	})
}

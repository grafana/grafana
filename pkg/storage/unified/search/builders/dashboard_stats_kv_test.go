package builders

// Unit tests for KVDashboardStats and OssDashboardStats.
//
// All tests use an in-memory BadgerDB-backed ResourceKVStore so they run
// without any external dependencies or feature-toggle wiring.

import (
	"context"
	"fmt"
	"io"
	"iter"
	"sync/atomic"
	"testing"

	badger "github.com/dgraph-io/badger/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

// ─── helpers ─────────────────────────────────────────────────────────────────

func newTestKVDashboardStats(t *testing.T) (*KVDashboardStats, *kv.ResourceKVStore) {
	t.Helper()
	opts := badger.DefaultOptions("").WithInMemory(true).WithLogger(nil)
	db, err := badger.Open(opts)
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })
	store := kv.NewResourceKVStore(kv.NewBadgerKV(db))
	return NewKVDashboardStats(store), store
}

// putStatsEntry stores a raw JSON doc under the usageinsights.grafana.app/stats
// key for the given dashboard name in the given namespace.
func putStatsEntry(t *testing.T, store *kv.ResourceKVStore, namespace, dashName string, raw []byte) {
	t.Helper()
	p := kv.ResourceParent{
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
		Namespace: namespace,
		Name:      dashName,
	}
	require.NoError(t, store.Save(context.Background(), p, kvStatsOwner, kvStatsKey, raw, "test"))
}

// ─── NewKVDashboardStats ─────────────────────────────────────────────────────

func TestNewKVDashboardStats_NilStore_ReturnsNil(t *testing.T) {
	t.Parallel()
	assert.Nil(t, NewKVDashboardStats(nil))
}

func TestNewKVDashboardStats_NonNilStore_ReturnsInstance(t *testing.T) {
	t.Parallel()
	stats, _ := newTestKVDashboardStats(t)
	assert.NotNil(t, stats)
}

// ─── KVDashboardStats.GetStats ───────────────────────────────────────────────

func TestKVDashboardStats_GetStats_Empty_ReturnsEmptyMap(t *testing.T) {
	t.Parallel()
	stats, _ := newTestKVDashboardStats(t)
	got, err := stats.GetStats(context.Background(), "stacks-1")
	require.NoError(t, err)
	assert.Empty(t, got)
}

func TestKVDashboardStats_GetStats_SingleDashboard_ExtractsViewsTotal(t *testing.T) {
	t.Parallel()
	s, store := newTestKVDashboardStats(t)
	const ns = "stacks-1"
	putStatsEntry(t, store, ns, "dash-a", []byte(`{"views_total":42}`))

	got, err := s.GetStats(context.Background(), ns)
	require.NoError(t, err)
	require.Contains(t, got, "dash-a")
	assert.Equal(t, int64(42), got["dash-a"][DASHBOARD_VIEWS_TOTAL])
}

func TestKVDashboardStats_GetStats_AllNumericFields_ExtractedCorrectly(t *testing.T) {
	t.Parallel()
	s, store := newTestKVDashboardStats(t)
	const ns = "stacks-1"
	doc := `{
		"views_total":100,"views_today":10,"views_last_1_days":20,"views_last_7_days":30,"views_last_30_days":40,
		"queries_total":50,"queries_today":5,"queries_last_1_days":6,"queries_last_7_days":7,"queries_last_30_days":8,
		"errors_total":1,"errors_today":0,"errors_last_1_days":2,"errors_last_7_days":3,"errors_last_30_days":4
	}`
	putStatsEntry(t, store, ns, "dash-b", []byte(doc))

	got, err := s.GetStats(context.Background(), ns)
	require.NoError(t, err)
	fields := got["dash-b"]
	assert.Equal(t, int64(100), fields[DASHBOARD_VIEWS_TOTAL])
	assert.Equal(t, int64(10), fields[DASHBOARD_VIEWS_TODAY])
	assert.Equal(t, int64(20), fields[DASHBOARD_VIEWS_LAST_1_DAYS])
	assert.Equal(t, int64(30), fields[DASHBOARD_VIEWS_LAST_7_DAYS])
	assert.Equal(t, int64(40), fields[DASHBOARD_VIEWS_LAST_30_DAYS])
	assert.Equal(t, int64(50), fields[DASHBOARD_QUERIES_TOTAL])
	assert.Equal(t, int64(5), fields[DASHBOARD_QUERIES_TODAY])
	assert.Equal(t, int64(6), fields[DASHBOARD_QUERIES_LAST_1_DAYS])
	assert.Equal(t, int64(7), fields[DASHBOARD_QUERIES_LAST_7_DAYS])
	assert.Equal(t, int64(8), fields[DASHBOARD_QUERIES_LAST_30_DAYS])
	assert.Equal(t, int64(1), fields[DASHBOARD_ERRORS_TOTAL])
	assert.Equal(t, int64(0), fields[DASHBOARD_ERRORS_TODAY])
	assert.Equal(t, int64(2), fields[DASHBOARD_ERRORS_LAST_1_DAYS])
	assert.Equal(t, int64(3), fields[DASHBOARD_ERRORS_LAST_7_DAYS])
	assert.Equal(t, int64(4), fields[DASHBOARD_ERRORS_LAST_30_DAYS])
}

func TestKVDashboardStats_GetStats_MultipleDashboards(t *testing.T) {
	t.Parallel()
	s, store := newTestKVDashboardStats(t)
	const ns = "stacks-2"
	putStatsEntry(t, store, ns, "dash-x", []byte(`{"views_total":100}`))
	putStatsEntry(t, store, ns, "dash-y", []byte(`{"views_total":200}`))
	putStatsEntry(t, store, ns, "dash-z", []byte(`{"views_total":300}`))

	got, err := s.GetStats(context.Background(), ns)
	require.NoError(t, err)
	assert.Len(t, got, 3)
	assert.Equal(t, int64(100), got["dash-x"][DASHBOARD_VIEWS_TOTAL])
	assert.Equal(t, int64(200), got["dash-y"][DASHBOARD_VIEWS_TOTAL])
	assert.Equal(t, int64(300), got["dash-z"][DASHBOARD_VIEWS_TOTAL])
}

func TestKVDashboardStats_GetStats_IgnoresWrongOwner(t *testing.T) {
	t.Parallel()
	s, store := newTestKVDashboardStats(t)
	const ns = "stacks-3"
	// Entry under a different owner — must be ignored.
	p := kv.ResourceParent{
		Group: "dashboard.grafana.app", Resource: "dashboards",
		Namespace: ns, Name: "dash-c",
	}
	require.NoError(t, store.Save(context.Background(), p,
		"other-owner.grafana.app", kvStatsKey, []byte(`{"views_total":99}`), "test"))

	got, err := s.GetStats(context.Background(), ns)
	require.NoError(t, err)
	assert.Empty(t, got, "entries under a different owner must be ignored")
}

func TestKVDashboardStats_GetStats_IgnoresWrongKey(t *testing.T) {
	t.Parallel()
	s, store := newTestKVDashboardStats(t)
	const ns = "stacks-4"
	// Entry with a different key under the correct owner — must be ignored.
	p := kv.ResourceParent{
		Group: "dashboard.grafana.app", Resource: "dashboards",
		Namespace: ns, Name: "dash-d",
	}
	require.NoError(t, store.Save(context.Background(), p,
		kvStatsOwner, "not-stats", []byte(`{"views_total":99}`), "test"))

	got, err := s.GetStats(context.Background(), ns)
	require.NoError(t, err)
	assert.Empty(t, got, "entries with a key other than 'stats' must be ignored")
}

// TestKVDashboardStats_GetStats_NonObjectJSON_SkippedNoError verifies that a
// stored value that is valid JSON but not a JSON object (e.g. an array) is
// silently skipped and does not produce an error.
//
// Store.Save validates that the stored bytes are syntactically valid JSON
// (via json.RawMessage inside the envelope), so truly malformed bytes cannot
// be saved. However, valid-JSON non-objects CAN be saved and must be handled
// gracefully.
func TestKVDashboardStats_GetStats_NonObjectJSON_SkippedNoError(t *testing.T) {
	t.Parallel()
	s, store := newTestKVDashboardStats(t)
	const ns = "stacks-5"
	// A JSON array is valid JSON but cannot be unmarshalled into
	// map[string]interface{} the way GetStats expects.
	putStatsEntry(t, store, ns, "dash-arr", []byte(`[1,2,3]`))
	// A valid entry in the same namespace must still be returned.
	putStatsEntry(t, store, ns, "dash-ok", []byte(`{"views_total":7}`))

	got, err := s.GetStats(context.Background(), ns)
	require.NoError(t, err, "non-object JSON must not return an error")
	assert.NotContains(t, got, "dash-arr", "non-object JSON entry must be absent")
	assert.Contains(t, got, "dash-ok")
	assert.Equal(t, int64(7), got["dash-ok"][DASHBOARD_VIEWS_TOTAL])
}

func TestKVDashboardStats_GetStats_NonNumericFieldValue_FieldAbsent(t *testing.T) {
	t.Parallel()
	s, store := newTestKVDashboardStats(t)
	const ns = "stacks-6"
	// views_total is a string, not a number — must be silently omitted.
	putStatsEntry(t, store, ns, "dash-str", []byte(`{"views_total":"not-a-number","views_today":5}`))

	got, err := s.GetStats(context.Background(), ns)
	require.NoError(t, err, "non-numeric field must not return an error")
	require.Contains(t, got, "dash-str")
	assert.NotContains(t, got["dash-str"], DASHBOARD_VIEWS_TOTAL,
		"non-numeric views_total must be absent")
	assert.Equal(t, int64(5), got["dash-str"][DASHBOARD_VIEWS_TODAY])
}

func TestKVDashboardStats_GetStats_MissingField_FieldAbsent(t *testing.T) {
	t.Parallel()
	s, store := newTestKVDashboardStats(t)
	const ns = "stacks-7"
	// Only views_total is present; all other fields are absent.
	putStatsEntry(t, store, ns, "dash-sparse", []byte(`{"views_total":1}`))

	got, err := s.GetStats(context.Background(), ns)
	require.NoError(t, err)
	fields := got["dash-sparse"]
	require.NotNil(t, fields)
	assert.Contains(t, fields, DASHBOARD_VIEWS_TOTAL)
	assert.NotContains(t, fields, DASHBOARD_QUERIES_TOTAL,
		"absent field must not be present in the result map")
}

func TestKVDashboardStats_GetStats_EmptyJsonObject_EntryAbsent(t *testing.T) {
	t.Parallel()
	s, store := newTestKVDashboardStats(t)
	const ns = "stacks-8"
	// An empty document has no numeric fields — the entry should be absent.
	putStatsEntry(t, store, ns, "dash-empty", []byte(`{}`))

	got, err := s.GetStats(context.Background(), ns)
	require.NoError(t, err)
	assert.Empty(t, got, "document with no numeric fields must not appear in result")
}

func TestKVDashboardStats_GetStats_NamespaceIsolation(t *testing.T) {
	t.Parallel()
	s, store := newTestKVDashboardStats(t)
	putStatsEntry(t, store, "ns-a", "dash-a", []byte(`{"views_total":10}`))
	putStatsEntry(t, store, "ns-b", "dash-b", []byte(`{"views_total":20}`))

	gotA, err := s.GetStats(context.Background(), "ns-a")
	require.NoError(t, err)
	assert.Contains(t, gotA, "dash-a")
	assert.NotContains(t, gotA, "dash-b", "ns-b entry must not appear for ns-a")

	gotB, err := s.GetStats(context.Background(), "ns-b")
	require.NoError(t, err)
	assert.Contains(t, gotB, "dash-b")
	assert.NotContains(t, gotB, "dash-a", "ns-a entry must not appear for ns-b")
}

func TestKVDashboardStats_GetStats_Float64CoercedToInt64(t *testing.T) {
	t.Parallel()
	// JSON numbers are float64 when decoded into interface{}.
	// extractKVStatsFields must coerce them to int64.
	s, store := newTestKVDashboardStats(t)
	const ns = "stacks-9"
	putStatsEntry(t, store, ns, "dash-float", []byte(`{"views_total":1234.9}`))

	got, err := s.GetStats(context.Background(), ns)
	require.NoError(t, err)
	// int64(1234.9) truncates to 1234.
	assert.Equal(t, int64(1234), got["dash-float"][DASHBOARD_VIEWS_TOTAL])
}

// ─── KVDashboardStats.GetDashboardStats ──────────────────────────────────────

func TestKVDashboardStats_GetDashboardStats_ReturnsOneEntry(t *testing.T) {
	t.Parallel()
	s, store := newTestKVDashboardStats(t)
	const ns = "stacks-10"
	putStatsEntry(t, store, ns, "dash-one", []byte(`{"views_total":55}`))
	putStatsEntry(t, store, ns, "dash-two", []byte(`{"views_total":66}`))

	got, err := s.GetDashboardStats(context.Background(), ns, "dash-one")
	require.NoError(t, err)
	assert.Equal(t, int64(55), got[DASHBOARD_VIEWS_TOTAL])
}

func TestKVDashboardStats_GetDashboardStats_MissingName_ReturnsNil(t *testing.T) {
	t.Parallel()
	s, store := newTestKVDashboardStats(t)
	const ns = "stacks-11"
	putStatsEntry(t, store, ns, "dash-exists", []byte(`{"views_total":1}`))

	got, err := s.GetDashboardStats(context.Background(), ns, "does-not-exist")
	require.NoError(t, err)
	assert.Nil(t, got)
}

// countingKV wraps a real kv.KV and counts calls per method, so a test can
// assert GetDashboardStats issues a point read (Get) and never a namespace
// scan (Keys + BatchGet, per ResourceKVStore.ScanNamespace).
type countingKV struct {
	kv.KV
	getCalls   atomic.Int32
	keysCalls  atomic.Int32
	batchCalls atomic.Int32
}

func (c *countingKV) Get(ctx context.Context, section, key string) (io.ReadCloser, error) {
	c.getCalls.Add(1)
	return c.KV.Get(ctx, section, key)
}

func (c *countingKV) Keys(ctx context.Context, section string, opt kv.ListOptions) iter.Seq2[string, error] {
	c.keysCalls.Add(1)
	return c.KV.Keys(ctx, section, opt)
}

func (c *countingKV) BatchGet(ctx context.Context, section string, keys []string) iter.Seq2[kv.KeyValue, error] {
	c.batchCalls.Add(1)
	return c.KV.BatchGet(ctx, section, keys)
}

// TestKVDashboardStats_GetDashboardStats_PointRead_DoesNotScanNamespace
// verifies GetDashboardStats reads exactly the one (name, owner, key) entry
// it needs instead of scanning every entry in the namespace. The
// backfiller calls this once per dashboard (backfill/backfiller.go), so a
// namespace scan per call would be O(namespace size) instead of O(1).
func TestKVDashboardStats_GetDashboardStats_PointRead_DoesNotScanNamespace(t *testing.T) {
	t.Parallel()
	opts := badger.DefaultOptions("").WithInMemory(true).WithLogger(nil)
	db, err := badger.Open(opts)
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	counting := &countingKV{KV: kv.NewBadgerKV(db)}
	store := kv.NewResourceKVStore(counting)
	s := NewKVDashboardStats(store)

	const ns = "stacks-point-read"
	// Many other dashboards in the same namespace: a namespace scan would
	// touch all of them, a point read must not.
	for i := 0; i < 50; i++ {
		putStatsEntry(t, store, ns, fmt.Sprintf("other-dash-%d", i), []byte(`{"views_total":1}`))
	}
	putStatsEntry(t, store, ns, "target-dash", []byte(`{"views_total":42}`))

	counting.getCalls.Store(0)
	counting.keysCalls.Store(0)
	counting.batchCalls.Store(0)

	got, err := s.GetDashboardStats(context.Background(), ns, "target-dash")
	require.NoError(t, err)
	assert.Equal(t, int64(42), got[DASHBOARD_VIEWS_TOTAL])

	assert.Equal(t, int32(1), counting.getCalls.Load(), "must issue exactly one point Get")
	assert.Zero(t, counting.keysCalls.Load(), "must not scan namespace keys")
	assert.Zero(t, counting.batchCalls.Load(), "must not batch-get scan results")
}

// ─── extractKVStatsFields ────────────────────────────────────────────────────

func TestExtractKVStatsFields_AllKnownFields(t *testing.T) {
	t.Parallel()
	doc := map[string]interface{}{
		DASHBOARD_VIEWS_TOTAL:          float64(1),
		DASHBOARD_VIEWS_TODAY:          float64(2),
		DASHBOARD_VIEWS_LAST_1_DAYS:    float64(3),
		DASHBOARD_VIEWS_LAST_7_DAYS:    float64(4),
		DASHBOARD_VIEWS_LAST_30_DAYS:   float64(5),
		DASHBOARD_QUERIES_TOTAL:        float64(6),
		DASHBOARD_QUERIES_TODAY:        float64(7),
		DASHBOARD_QUERIES_LAST_1_DAYS:  float64(8),
		DASHBOARD_QUERIES_LAST_7_DAYS:  float64(9),
		DASHBOARD_QUERIES_LAST_30_DAYS: float64(10),
		DASHBOARD_ERRORS_TOTAL:         float64(11),
		DASHBOARD_ERRORS_TODAY:         float64(12),
		DASHBOARD_ERRORS_LAST_1_DAYS:   float64(13),
		DASHBOARD_ERRORS_LAST_7_DAYS:   float64(14),
		DASHBOARD_ERRORS_LAST_30_DAYS:  float64(15),
	}
	got := extractKVStatsFields(doc)
	assert.Len(t, got, len(kvStatsFields))
	for i, name := range kvStatsFields {
		assert.Equal(t, int64(i+1), got[name], "field %s", name)
	}
}

func TestExtractKVStatsFields_UnknownFieldsIgnored(t *testing.T) {
	t.Parallel()
	doc := map[string]interface{}{
		"views_total":      float64(42),
		"unknown_field":    float64(99),
		"also_not_a_field": "hello",
	}
	got := extractKVStatsFields(doc)
	assert.Len(t, got, 1)
	assert.Equal(t, int64(42), got[DASHBOARD_VIEWS_TOTAL])
}

func TestExtractKVStatsFields_EmptyDoc_ReturnsNil(t *testing.T) {
	t.Parallel()
	got := extractKVStatsFields(map[string]interface{}{})
	assert.Nil(t, got)
}

func TestExtractKVStatsFields_StringValue_FieldOmitted(t *testing.T) {
	t.Parallel()
	doc := map[string]interface{}{
		DASHBOARD_VIEWS_TOTAL: "not-a-number",
	}
	got := extractKVStatsFields(doc)
	assert.Nil(t, got)
}

func TestExtractKVStatsFields_NilValue_FieldOmitted(t *testing.T) {
	t.Parallel()
	doc := map[string]interface{}{
		DASHBOARD_VIEWS_TOTAL: nil,
	}
	got := extractKVStatsFields(doc)
	assert.Nil(t, got)
}

func TestExtractKVStatsFields_Int64Value_Accepted(t *testing.T) {
	t.Parallel()
	doc := map[string]interface{}{
		DASHBOARD_VIEWS_TOTAL: int64(7),
	}
	got := extractKVStatsFields(doc)
	assert.Equal(t, int64(7), got[DASHBOARD_VIEWS_TOTAL])
}

// ─── OssDashboardStats ───────────────────────────────────────────────────────

func TestOssDashboardStats_NilStore_GetStats_ReturnsNilNoError(t *testing.T) {
	t.Parallel()
	s := ProvideDashboardStats(nil)
	got, err := s.GetStats(context.Background(), "stacks-1")
	require.NoError(t, err)
	assert.Nil(t, got, "nil store (toggle off) must return nil stats")
}

func TestOssDashboardStats_NilStore_GetDashboardStats_ReturnsNilNoError(t *testing.T) {
	t.Parallel()
	s := ProvideDashboardStats(nil)
	got, err := s.GetDashboardStats(context.Background(), "stacks-1", "some-dash")
	require.NoError(t, err)
	assert.Nil(t, got, "nil store (toggle off) must return nil stats")
}

func TestOssDashboardStats_WithStore_DelegatesToKV(t *testing.T) {
	t.Parallel()
	opts := badger.DefaultOptions("").WithInMemory(true).WithLogger(nil)
	db, err := badger.Open(opts)
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })
	store := kv.NewResourceKVStore(kv.NewBadgerKV(db))

	const ns = "stacks-oss"
	p := kv.ResourceParent{
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
		Namespace: ns,
		Name:      "dash-oss",
	}
	require.NoError(t, store.Save(context.Background(), p,
		kvStatsOwner, kvStatsKey, []byte(`{"views_total":88}`), "test"))

	s := ProvideDashboardStats(store)
	got, err := s.GetStats(context.Background(), ns)
	require.NoError(t, err)
	require.Contains(t, got, "dash-oss")
	assert.Equal(t, int64(88), got["dash-oss"][DASHBOARD_VIEWS_TOTAL])
}

func TestOssDashboardStats_WithStore_GetDashboardStats_DelegatesToKV(t *testing.T) {
	t.Parallel()
	opts := badger.DefaultOptions("").WithInMemory(true).WithLogger(nil)
	db, err := badger.Open(opts)
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })
	store := kv.NewResourceKVStore(kv.NewBadgerKV(db))

	const ns = "stacks-oss2"
	p := kv.ResourceParent{
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
		Namespace: ns,
		Name:      "dash-single",
	}
	require.NoError(t, store.Save(context.Background(), p,
		kvStatsOwner, kvStatsKey, []byte(`{"views_total":123}`), "test"))

	s := ProvideDashboardStats(store)
	got, err := s.GetDashboardStats(context.Background(), ns, "dash-single")
	require.NoError(t, err)
	assert.Equal(t, int64(123), got[DASHBOARD_VIEWS_TOTAL])
}

// ─── Table-driven: edge cases for a mix of valid and invalid entries ──────────

func TestKVDashboardStats_GetStats_MixedValidity(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name         string
		dashName     string
		rawJSON      string
		expectField  string
		expectValue  int64
		expectAbsent bool
	}{
		{
			name:        "valid entry with views_total",
			dashName:    "valid",
			rawJSON:     `{"views_total":10}`,
			expectField: DASHBOARD_VIEWS_TOTAL,
			expectValue: 10,
		},
		{
			// A JSON array is valid JSON but not a JSON object; GetStats cannot
			// unmarshal it into map[string]interface{} and must skip it.
			name:         "non-object JSON (array) — entry absent",
			dashName:     "arr-json",
			rawJSON:      `[1,2,3]`,
			expectAbsent: true,
		},
		{
			name:         "empty object — entry absent",
			dashName:     "empty-obj",
			rawJSON:      `{}`,
			expectAbsent: true,
		},
	}

	s, store := newTestKVDashboardStats(t)
	ns := fmt.Sprintf("mixed-%d", len(cases))

	for _, tc := range cases {
		putStatsEntry(t, store, ns, tc.dashName, []byte(tc.rawJSON))
	}

	got, err := s.GetStats(context.Background(), ns)
	require.NoError(t, err)

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if tc.expectAbsent {
				assert.NotContains(t, got, tc.dashName)
				return
			}
			require.Contains(t, got, tc.dashName)
			assert.Equal(t, tc.expectValue, got[tc.dashName][tc.expectField])
		})
	}
}

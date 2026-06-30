package sql

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	sqldb "github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	unitest "github.com/grafana/grafana/pkg/storage/unified/testing"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// chunkedCommit records a single observed bulk commit, captured via the
// backend's bulkCommitObserver hook.
type chunkedCommit struct {
	phase string
	bytes int64
}

// commitRecorder is a concurrency-safe collector of observed commits.
type commitRecorder struct {
	mu      sync.Mutex
	commits []chunkedCommit
}

func (r *commitRecorder) observe(phase string, bytes int64) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.commits = append(r.commits, chunkedCommit{phase: phase, bytes: bytes})
}

func (r *commitRecorder) snapshot() []chunkedCommit {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]chunkedCommit, len(r.commits))
	copy(out, r.commits)
	return out
}

func (r *commitRecorder) byPhase(phase string) []chunkedCommit {
	var out []chunkedCommit
	for _, c := range r.snapshot() {
		if c.phase == phase {
			out = append(out, c)
		}
	}
	return out
}

// chunkedTestValue builds a padded object value for name at the given version,
// large enough that a tiny per-chunk budget forces multiple history chunks.
func chunkedTestValue(name string, version, padBytes int) []byte {
	pad := strings.Repeat("x", padBytes)
	return []byte(fmt.Sprintf(
		`{"apiVersion":"shorturl.grafana.app/v1beta1","kind":"ShortURL","metadata":{"name":%q,"namespace":"default"},"spec":{"path":"d/%s-v%d","pad":%q}}`,
		name, name, version, pad))
}

// buildMultiVersionBulk emits `versions` ADDED/MODIFIED events per name (plus a
// final DELETE for names in deleteLatest), each padded to exceed a tiny budget.
// It returns the requests and a map of name -> expected latest non-deleted value
// (nil when the latest version is a delete, so the name must be absent after backfill).
func buildMultiVersionBulk(names []string, versions, padBytes int, deleteLatest map[string]bool) ([]*resourcepb.BulkRequest, map[string][]byte) {
	var reqs []*resourcepb.BulkRequest
	expected := map[string][]byte{}
	for _, name := range names {
		var lastValue []byte
		for v := 0; v < versions; v++ {
			action := resourcepb.BulkRequest_MODIFIED
			if v == 0 {
				action = resourcepb.BulkRequest_ADDED
			}
			val := chunkedTestValue(name, v, padBytes)
			reqs = append(reqs, newSQLBulkRequest(name, action, val))
			lastValue = val
		}
		if deleteLatest[name] {
			// The delete carries the same value but is the latest version.
			reqs = append(reqs, newSQLBulkRequest(name, resourcepb.BulkRequest_DELETED, chunkedTestValue(name, versions, padBytes)))
			expected[name] = nil
		} else {
			expected[name] = lastValue
		}
	}
	return reqs, expected
}

// chunkedTestWhere builds the collection WHERE clause with the dialect's
// argument placeholders (postgres needs $N, not ?) and quotes the reserved
// `group` column. Args order: namespace, group, resource.
func chunkedTestWhere(t *testing.T, b *backend) string {
	t.Helper()
	groupCol, err := b.dialect.Ident("group")
	require.NoError(t, err)
	return fmt.Sprintf("namespace = %s AND %s = %s AND resource = %s",
		b.dialect.ArgPlaceholder(1), groupCol, b.dialect.ArgPlaceholder(2), b.dialect.ArgPlaceholder(3))
}

// readResourceTable returns name -> value for every resource-table row in the
// collection.
func readResourceTable(t *testing.T, ctx context.Context, b *backend, sdb sqldb.DB, key *resourcepb.ResourceKey) map[string]string {
	t.Helper()
	q := "SELECT name, value FROM resource WHERE " + chunkedTestWhere(t, b)
	rows, err := sdb.QueryContext(ctx, q, key.Namespace, key.Group, key.Resource)
	require.NoError(t, err)
	defer func() { _ = rows.Close() }()
	out := map[string]string{}
	for rows.Next() {
		var name string
		var value []byte // bytea on postgres; can't scan into string
		require.NoError(t, rows.Scan(&name, &value))
		out[name] = string(value)
	}
	require.NoError(t, rows.Err())
	return out
}

// countTableRows returns the number of rows for the collection in the named
// table (resource or resource_history).
func countTableRows(t *testing.T, ctx context.Context, b *backend, sdb sqldb.DB, table string, key *resourcepb.ResourceKey) int {
	t.Helper()
	q := fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE %s", table, chunkedTestWhere(t, b))
	row := sdb.QueryRowContext(ctx, q, key.Namespace, key.Group, key.Resource)
	var n int
	require.NoError(t, row.Scan(&n))
	return n
}

// countLastImportRows returns the number of resource_last_import_time rows for
// the collection.
func countLastImportRows(t *testing.T, ctx context.Context, b *backend, sdb sqldb.DB, key *resourcepb.ResourceKey) int {
	t.Helper()
	q := "SELECT COUNT(*) FROM resource_last_import_time WHERE " + chunkedTestWhere(t, b)
	row := sdb.QueryRowContext(ctx, q, key.Namespace, key.Group, key.Resource)
	var n int
	require.NoError(t, row.Scan(&n))
	return n
}

// chunkedTestKey returns the collection key the chunked tests operate on. It
// MUST match the namespace/group/resource hardcoded in newSQLBulkRequest, or the
// table reads (filtered by this key) would silently return 0 rows.
func chunkedTestKey() *resourcepb.ResourceKey {
	return &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "shorturl.grafana.app",
		Resource:  "shorturls",
	}
}

// chunkedBudget is the tiny per-chunk byte budget that forces multi-version,
// padded inputs to commit across multiple chunks.
const chunkedBudget = 64 * 1024

// chunkBudgetTolerance is the slack allowed above the budget: the chunker commits
// once bytes REACH the budget, so the last Add can overshoot by one batch (~10 KiB
// per object here). 32 KiB covers that while still catching a runaway chunk.
const chunkBudgetTolerance = 32 * 1024

// TestIntegrationBulkChunkedCorrectnessAndBudget runs a multi-version import via
// the chunked path with a tiny budget and asserts: a clean response, a resource
// table holding the latest non-deleted version per name (matching a non-chunked
// run), and >1 commit per phase with no commit exceeding budget. Non-sqlite only
// (run with GRAFANA_TEST_DB=mysql or postgres).
func TestIntegrationBulkChunkedCorrectnessAndBudget(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	if db.IsTestDbSQLite() {
		t.Skip("chunked path is non-sqlite only; run with GRAFANA_TEST_DB=mysql or postgres")
	}
	t.Cleanup(db.CleanupTestDB)

	ctx := testutil.NewTestContext(t, time.Now().Add(2*time.Minute))
	key := chunkedTestKey()

	// 12 names x 3 versions x ~10 KiB = ~360 KiB history, far over the 64 KiB
	// budget, so the history phase chunks. Two names end with a DELETE; the 10
	// survivors add ~100 KiB to the backfill, also over budget, so it splits into
	// multiple ranges. This exercises chunking in BOTH phases.
	names := []string{
		"item-a", "item-b", "item-c", "item-d", "item-e", "item-f",
		"item-g", "item-h", "item-i", "item-j", "item-k", "item-l",
	}
	deleteLatest := map[string]bool{"item-c": true, "item-j": true}
	reqs, expected := buildMultiVersionBulk(names, 3, 10*1024, deleteLatest)

	rec := &commitRecorder{}
	b, sdb := newChunkedTestBackend(t, chunkedBudget, rec.observe)

	rsp := b.ProcessBulk(ctx, resource.BulkSettings{Collection: []*resourcepb.ResourceKey{key}}, unitest.ToBulkIterator(reqs))
	require.Nil(t, rsp.Error)
	require.Equal(t, int64(len(reqs)), rsp.Processed)
	require.Len(t, rsp.Summary, 1)
	require.Equal(t, int64(0), rsp.Summary[0].PreviousHistory, "first run wipes an empty collection")
	require.Equal(t, int64(0), rsp.Summary[0].PreviousCount)

	// Read the chunked result BEFORE creating the non-chunked sibling below:
	// newTestBackend re-inits and truncates the shared process-global test DB,
	// so reading afterwards would see an empty table.
	got := readResourceTable(t, ctx, b, sdb, key)
	expectNames := map[string]string{}
	for name, val := range expected {
		if val != nil {
			expectNames[name] = string(val)
		}
	}
	require.Equal(t, expectNames, got, "chunked resource table must equal latest non-deleted per name")

	// Chunking must have actually happened in BOTH phases: more than one history
	// commit and more than one backfill range.
	history := rec.byPhase("history")
	backfill := rec.byPhase("backfill")
	require.Greater(t, len(history), 1, "expected >1 history commit (history chunking must have happened): %#v", rec.snapshot())
	require.Greater(t, len(backfill), 1, "expected >1 backfill range (backfill chunking must have happened): %#v", rec.snapshot())

	// No observed commit may exceed the budget beyond the documented tolerance.
	for _, c := range rec.snapshot() {
		require.LessOrEqualf(t, c.bytes, int64(chunkedBudget)+chunkBudgetTolerance,
			"commit in phase %q exceeded budget+tolerance: %d bytes", c.phase, c.bytes)
	}

	t.Logf("observed %d history commits and %d backfill ranges", len(history), len(backfill))
	for _, c := range rec.snapshot() {
		t.Logf("commit phase=%s bytes=%d", c.phase, c.bytes)
	}

	// Idempotency: a second identical import must wipe the first run's rows
	// (reporting their counts) and reproduce the same end state. Runs before the
	// non-chunked sibling below, which truncates the shared test DB.
	t.Run("idempotent re-run", func(t *testing.T) {
		firstHistoryCount := countTableRows(t, ctx, b, sdb, "resource_history", key)
		firstResourceCount := countTableRows(t, ctx, b, sdb, "resource", key)
		require.Equal(t, int64(len(reqs)), int64(firstHistoryCount), "all events land in history")

		rsp2 := b.ProcessBulk(ctx, resource.BulkSettings{Collection: []*resourcepb.ResourceKey{key}}, unitest.ToBulkIterator(reqs))
		require.Nil(t, rsp2.Error)
		require.Len(t, rsp2.Summary, 1)
		require.Equal(t, int64(firstHistoryCount), rsp2.Summary[0].PreviousHistory, "second wipe sees first run's history rows")
		require.Equal(t, int64(firstResourceCount), rsp2.Summary[0].PreviousCount, "second wipe sees first run's resource rows")
		require.Equal(t, got, readResourceTable(t, ctx, b, sdb, key), "end state identical after re-run")
	})

	// Same input through a non-chunked backend must produce identical resource
	// rows. Truncates the shared test DB, so it runs after the idempotency subtest.
	nonChunked, nsdb := newTestBackend(t, GarbageCollectionConfig{})
	nb := nonChunked.(*backend)
	require.False(t, nb.migrationChunkedWrites)
	rspNC := nb.ProcessBulk(ctx, resource.BulkSettings{Collection: []*resourcepb.ResourceKey{key}}, unitest.ToBulkIterator(reqs))
	require.Nil(t, rspNC.Error)
	nonChunkedGot := readResourceTable(t, ctx, nb, nsdb, key)
	require.Equal(t, nonChunkedGot, got, "chunked and non-chunked final resource rows must match")
}

// killAfterKBatchIterator is a batch iterator that signals RollbackRequested
// after k batches, simulating a mid-stream kill (which the chunked path treats
// as a hard error).
type killAfterKBatchIterator struct {
	items []*resourcepb.BulkRequest
	k     int
	idx   int // number of NextBatch calls so far
}

func (it *killAfterKBatchIterator) NextBatch() bool {
	if it.idx >= len(it.items) {
		return false
	}
	it.idx++
	return true
}

func (it *killAfterKBatchIterator) Batch() []*resourcepb.BulkRequest {
	return []*resourcepb.BulkRequest{it.items[it.idx-1]}
}

func (it *killAfterKBatchIterator) RollbackRequested() bool {
	return it.idx > it.k
}

// Next and Request only satisfy the non-batch BulkRequestIterator interface; the
// chunked path uses NextBatch/Batch/RollbackRequested, so these are unreachable.
func (it *killAfterKBatchIterator) Next() bool                       { return it.NextBatch() }
func (it *killAfterKBatchIterator) Request() *resourcepb.BulkRequest { return it.Batch()[0] }

// TestIntegrationBulkChunkedKillMidMigrationThenRestart checks cleanup and
// restart recovery: a run killed mid-history returns a hard error, leaves the
// resource table / last-import untouched, and its cleanup re-wipes the partial
// history committed by earlier chunks. A clean re-run then lands the correct end
// state. Non-sqlite only.
func TestIntegrationBulkChunkedKillMidMigrationThenRestart(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	if db.IsTestDbSQLite() {
		t.Skip("chunked path is non-sqlite only; run with GRAFANA_TEST_DB=mysql or postgres")
	}
	t.Cleanup(db.CleanupTestDB)

	ctx := testutil.NewTestContext(t, time.Now().Add(2*time.Minute))
	key := chunkedTestKey()

	names := []string{"item-a", "item-b", "item-c", "item-d", "item-e", "item-f"}
	reqs, expected := buildMultiVersionBulk(names, 3, 4*1024, nil)

	// 8 KiB budget: ~4 KiB batches commit a chunk every ~2 batches, so earlier
	// chunks commit before the kill - the partial garbage the cleanup must wipe.
	const killBudget = 8 * 1024
	b, sdb := newChunkedTestBackend(t, killBudget, nil)

	// Kill after 8 batches: several chunks have committed by then, so partial
	// history rows exist when the hard error is raised.
	killed := &killAfterKBatchIterator{items: reqs, k: 8}
	rsp := b.ProcessBulk(ctx, resource.BulkSettings{Collection: []*resourcepb.ResourceKey{key}}, killed)
	require.NotNil(t, rsp.Error, "killed migration must return a hard error")
	require.Contains(t, rsp.Error.Message, "rollback requested")

	// The resource table and last-import time must NOT have been touched: those
	// phases run only after a clean history phase.
	require.Equal(t, 0, countTableRows(t, ctx, b, sdb, "resource", key), "resource table must be untouched after a killed run")
	require.Equal(t, 0, countLastImportRows(t, ctx, b, sdb, key), "last-import must not be set after a killed run")
	// Earlier chunks committed partial history rows, but the failed run's cleanup
	// re-wipes the collection with the chunked deleter, so no partial garbage is
	// left behind.
	require.Equal(t, 0, countTableRows(t, ctx, b, sdb, "resource_history", key), "cleanup must wipe partial history committed by earlier chunks")

	// Now run a full clean import: the phase-1 wipe must remove the partial
	// garbage and the end state must be correct.
	rsp2 := b.ProcessBulk(ctx, resource.BulkSettings{Collection: []*resourcepb.ResourceKey{key}}, unitest.ToBulkIterator(reqs))
	require.Nil(t, rsp2.Error)
	require.Equal(t, int64(len(reqs)), rsp2.Processed)

	got := readResourceTable(t, ctx, b, sdb, key)
	expectNames := map[string]string{}
	for name, val := range expected {
		if val != nil {
			expectNames[name] = string(val)
		}
	}
	require.Equal(t, expectNames, got, "clean re-run must produce the correct end state")
	// History now holds exactly the clean run's events (partial garbage wiped).
	require.Equal(t, len(reqs), countTableRows(t, ctx, b, sdb, "resource_history", key), "partial garbage must be wiped, only clean run remains")
	require.Equal(t, 1, countLastImportRows(t, ctx, b, sdb, key), "last-import set after clean run")
}

// TestIntegrationBulkChunkedSQLiteRegression verifies that with
// MigrationChunkedWrites=true on sqlite, the chunked path is NOT taken: the
// observer never fires and the normal path still produces the correct result.
func TestIntegrationBulkChunkedSQLiteRegression(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	if !db.IsTestDbSQLite() {
		t.Skip("regression guard only meaningful on sqlite; run with default test DB")
	}
	t.Cleanup(db.CleanupTestDB)

	ctx := testutil.NewTestContext(t, time.Now().Add(1*time.Minute))
	key := chunkedTestKey()

	names := []string{"item-a", "item-b", "item-c"}
	reqs, expected := buildMultiVersionBulk(names, 3, 1024, map[string]bool{"item-b": true})

	rec := &commitRecorder{}
	b, sdb := newChunkedTestBackend(t, chunkedBudget, rec.observe)
	require.Equal(t, "sqlite", b.dialect.DialectName())
	require.True(t, b.migrationChunkedWrites, "chunked writes are enabled on the backend")

	rsp := b.ProcessBulk(ctx, resource.BulkSettings{Collection: []*resourcepb.ResourceKey{key}}, unitest.ToBulkIterator(reqs))
	require.Nil(t, rsp.Error)
	require.Equal(t, int64(len(reqs)), rsp.Processed)

	// The chunked path must NOT have been taken on sqlite.
	require.Empty(t, rec.snapshot(), "chunked observer must never fire on sqlite")

	// The normal path still produces the correct result.
	got := readResourceTable(t, ctx, b, sdb, key)
	expectNames := map[string]string{}
	for name, val := range expected {
		if val != nil {
			expectNames[name] = string(val)
		}
	}
	require.Equal(t, expectNames, got)
}

// newChunkedTestBackend builds a backend (like newTestBackend) with chunked writes
// enabled, the given per-chunk byte budget, and observer installed as bulkCommitObserver
// so tests can record every committed chunk.
func newChunkedTestBackend(t *testing.T, chunkBytes int64, observer func(phase string, bytes int64)) (*backend, sqldb.DB) {
	dbstore := db.InitTestDB(t)
	eDB, err := dbimpl.ProvideResourceDB(dbstore, setting.NewCfg(), nil)
	require.NoError(t, err)
	require.NotNil(t, eDB)

	be, err := NewBackend(BackendOptions{
		DBProvider:             eDB,
		IsHA:                   false,
		DisablePruner:          db.IsTestDbSQLite(),
		LastImportTimeMaxAge:   24 * time.Hour,
		MigrationChunkedWrites: true,
		MigrationChunkMaxBytes: chunkBytes,
	})
	require.NoError(t, err)
	require.NotNil(t, be)

	ctx := testutil.NewTestContext(t, time.Now().Add(1*time.Minute))
	svc, ok := be.(services.Service)
	require.True(t, ok)
	require.NoError(t, services.StartAndAwaitRunning(ctx, svc))

	sqlDB, err := eDB.Init(testutil.NewTestContext(t, time.Now().Add(1*time.Minute)))
	require.NoError(t, err)

	bk := be.(*backend)
	bk.bulkCommitObserver = observer
	return bk, sqlDB
}

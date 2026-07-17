package sql

import (
	"math/rand"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	unitest "github.com/grafana/grafana/pkg/storage/unified/testing"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestAnalyzeResourceHistoryForBackfill(t *testing.T) {
	t.Run("postgres above threshold issues ANALYZE", func(t *testing.T) {
		b, ctx := setupBackendTest(t)
		b.dialect = sqltemplate.PostgreSQL
		b.SQLMock.ExpectExec(`ANALYZE`).WillReturnResult(sqlmock.NewResult(0, 0))

		require.NoError(t, b.analyzeResourceHistoryForBackfill(ctx, b.db, analyzeResourceHistoryRowThreshold))
		require.NoError(t, b.SQLMock.ExpectationsWereMet())
	})

	t.Run("failed ANALYZE returns the error", func(t *testing.T) {
		b, ctx := setupBackendTest(t)
		b.dialect = sqltemplate.PostgreSQL
		b.SQLMock.ExpectExec(`ANALYZE`).WillReturnError(errTest)

		require.ErrorIs(t, b.analyzeResourceHistoryForBackfill(ctx, b.db, analyzeResourceHistoryRowThreshold), errTest)
		require.NoError(t, b.SQLMock.ExpectationsWereMet())
	})

	t.Run("postgres below threshold skips ANALYZE", func(t *testing.T) {
		b, ctx := setupBackendTest(t)
		b.dialect = sqltemplate.PostgreSQL

		require.NoError(t, b.analyzeResourceHistoryForBackfill(ctx, b.db, analyzeResourceHistoryRowThreshold-1))
		require.NoError(t, b.SQLMock.ExpectationsWereMet())
	})

	t.Run("non-postgres skips ANALYZE", func(t *testing.T) {
		b, ctx := setupBackendTest(t)
		b.dialect = sqltemplate.SQLite

		require.NoError(t, b.analyzeResourceHistoryForBackfill(ctx, b.db, analyzeResourceHistoryRowThreshold*10))
		require.NoError(t, b.SQLMock.ExpectationsWereMet())
	})
}

func TestBackendInsertHistoryBatch(t *testing.T) {
	b, ctx := setupBackendTest(t)

	b.SQLMock.ExpectExec("insert into resource_history values").
		WillReturnResult(sqlmock.NewResult(0, 2))

	rsp := &resourcepb.BulkResponse{}
	_, err := b.insertHistoryBatch(ctx, b.db, []*resourcepb.BulkRequest{
		newSQLBulkRequest("item-1", resourcepb.BulkRequest_ADDED, []byte(`{"apiVersion":"shorturl.grafana.app/v1beta1","kind":"ShortURL","metadata":{"name":"item-1","namespace":"default"},"spec":{"path":"d/test"}}`)),
		newSQLBulkRequest("item-2", resourcepb.BulkRequest_UNKNOWN, []byte(`{"apiVersion":"shorturl.grafana.app/v1beta1","kind":"ShortURL","metadata":{"name":"item-2","namespace":"default"},"spec":{"path":"d/test"}}`)),
		newSQLBulkRequest("item-3", resourcepb.BulkRequest_ADDED, []byte(`{"apiVersion":"shorturl.grafana.app/v1beta1","kind":"ShortURL","metadata":{"name":"item-3","namespace":"default"},"spec":{"path":"d/test"}}`)),
	}, newBulkRV(), rsp, nil)
	require.NoError(t, err)
	require.Equal(t, int64(3), rsp.Processed)
	require.Len(t, rsp.Rejected, 1)
	require.Equal(t, "item-2", rsp.Rejected[0].Key.Name)
	require.Equal(t, resourcepb.BulkRequest_UNKNOWN, rsp.Rejected[0].Action)
	require.NoError(t, b.SQLMock.ExpectationsWereMet())
}

func TestDeleteCollectionChunked(t *testing.T) {
	key := &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "shorturl.grafana.app",
		Resource:  "shorturls",
	}

	t.Run("splits deletes into byte-budgeted sub-batches per table", func(t *testing.T) {
		b, ctx := setupBackendTest(t)
		b.dialect = sqltemplate.MySQL
		// Budget fits two 100-byte rows (200) but not three (300), forcing the
		// three candidates into two sub-batches.
		b.migrationChunkMaxBytes = 250

		candidateCols := []string{"guid", "size"}

		// History table: 3 candidates -> 2 delete sub-batches, then empty. The
		// WithArgs assertions lock the exact grouping (h1+h2, then h3) so a
		// mis-grouping such as 1+2 vs 2+1 is caught. Args are ns, group,
		// resource, then the guids of the sub-batch in order.
		b.SQLMock.ExpectQuery("SELECT .* OCTET_LENGTH .* FROM resource_history").
			WillReturnRows(sqlmock.NewRows(candidateCols).
				AddRow("h1", int64(100)).
				AddRow("h2", int64(100)).
				AddRow("h3", int64(100)))
		b.SQLMock.ExpectExec("DELETE FROM resource_history").
			WithArgs(key.Namespace, key.Group, key.Resource, "h1", "h2").
			WillReturnResult(sqlmock.NewResult(0, 2))
		b.SQLMock.ExpectExec("DELETE FROM resource_history").
			WithArgs(key.Namespace, key.Group, key.Resource, "h3").
			WillReturnResult(sqlmock.NewResult(0, 1))
		b.SQLMock.ExpectQuery("SELECT .* OCTET_LENGTH .* FROM resource_history").
			WillReturnRows(sqlmock.NewRows(candidateCols))

		// Resource table: 3 candidates -> 2 delete sub-batches, then empty.
		b.SQLMock.ExpectQuery("SELECT .* OCTET_LENGTH .* FROM resource").
			WillReturnRows(sqlmock.NewRows(candidateCols).
				AddRow("r1", int64(100)).
				AddRow("r2", int64(100)).
				AddRow("r3", int64(100)))
		b.SQLMock.ExpectExec("DELETE FROM resource").
			WillReturnResult(sqlmock.NewResult(0, 2))
		b.SQLMock.ExpectExec("DELETE FROM resource").
			WillReturnResult(sqlmock.NewResult(0, 1))
		b.SQLMock.ExpectQuery("SELECT .* OCTET_LENGTH .* FROM resource").
			WillReturnRows(sqlmock.NewRows(candidateCols))

		summary, err := b.deleteCollectionChunked(ctx, key)
		require.NoError(t, err)
		require.Equal(t, int64(3), summary.PreviousHistory)
		require.Equal(t, int64(3), summary.PreviousCount)
		require.Equal(t, key.Namespace, summary.Namespace)
		require.Equal(t, key.Group, summary.Group)
		require.Equal(t, key.Resource, summary.Resource)
		require.NoError(t, b.SQLMock.ExpectationsWereMet())
	})

	t.Run("empty collection issues no deletes", func(t *testing.T) {
		b, ctx := setupBackendTest(t)
		b.dialect = sqltemplate.MySQL
		b.migrationChunkMaxBytes = 17000

		candidateCols := []string{"guid", "size"}
		b.SQLMock.ExpectQuery("SELECT .* OCTET_LENGTH .* FROM resource_history").
			WillReturnRows(sqlmock.NewRows(candidateCols))
		b.SQLMock.ExpectQuery("SELECT .* OCTET_LENGTH .* FROM resource").
			WillReturnRows(sqlmock.NewRows(candidateCols))

		summary, err := b.deleteCollectionChunked(ctx, key)
		require.NoError(t, err)
		require.Equal(t, int64(0), summary.PreviousHistory)
		require.Equal(t, int64(0), summary.PreviousCount)
		require.NoError(t, b.SQLMock.ExpectationsWereMet())
	})

	t.Run("oversize single row gets its own delete", func(t *testing.T) {
		b, ctx := setupBackendTest(t)
		b.dialect = sqltemplate.MySQL
		// Tiny budget: the lone candidate's size alone exceeds it, so it must
		// still be deleted on its own rather than being dropped or hanging.
		b.migrationChunkMaxBytes = 10

		candidateCols := []string{"guid", "size"}

		b.SQLMock.ExpectQuery("SELECT .* OCTET_LENGTH .* FROM resource_history").
			WillReturnRows(sqlmock.NewRows(candidateCols).
				AddRow("big", int64(1<<20)))
		b.SQLMock.ExpectExec("DELETE FROM resource_history").
			WithArgs(key.Namespace, key.Group, key.Resource, "big").
			WillReturnResult(sqlmock.NewResult(0, 1))
		b.SQLMock.ExpectQuery("SELECT .* OCTET_LENGTH .* FROM resource_history").
			WillReturnRows(sqlmock.NewRows(candidateCols))

		b.SQLMock.ExpectQuery("SELECT .* OCTET_LENGTH .* FROM resource").
			WillReturnRows(sqlmock.NewRows(candidateCols))

		summary, err := b.deleteCollectionChunked(ctx, key)
		require.NoError(t, err)
		require.Equal(t, int64(1), summary.PreviousHistory)
		require.Equal(t, int64(0), summary.PreviousCount)
		require.NoError(t, b.SQLMock.ExpectationsWereMet())
	})
}

func TestTxChunker(t *testing.T) {
	// Commit-boundary cases: drive Adds, then assert the number of committed
	// transactions (Begin/Commit pairs) and how many fired onCommit. onCommit
	// fires per commit that held work; the trailing empty Flush commit does not.
	for _, tc := range []struct {
		name         string
		budget       int64
		maxRows      int
		adds         []int64 // bytes per Add, one row each
		wantTxns     int     // Begin/Commit pairs
		wantOnCommit int
	}{
		{"no crossing", 1000, txChunkerMaxRows, []int64{100, 200}, 1, 1},
		{"one byte crossing", 100, txChunkerMaxRows, []int64{60, 60}, 2, 1},
		{"n byte crossings", 100, txChunkerMaxRows, []int64{100, 100, 100, 100}, 5, 4},
		{"forced row commit", 1 << 40, 2, []int64{1, 1, 1}, 2, 2},
	} {
		t.Run(tc.name, func(t *testing.T) {
			b, ctx := setupBackendTest(t)
			for i := 0; i < tc.wantTxns; i++ {
				b.SQLMock.ExpectBegin()
				b.SQLMock.ExpectCommit()
			}
			var onCommit int
			c, err := newTxChunker(ctx, b.db, ReadCommitted, tc.budget, tc.maxRows, func(int64) { onCommit++ })
			require.NoError(t, err)
			for _, n := range tc.adds {
				require.NoError(t, c.add(n, 1))
			}
			require.NoError(t, c.commit())
			require.Equal(t, tc.wantOnCommit, onCommit)
			require.NoError(t, b.SQLMock.ExpectationsWereMet())
		})
	}

	t.Run("abort after partial: one Begin, one Rollback, no Commit", func(t *testing.T) {
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.SQLMock.ExpectRollback()

		c, err := newTxChunker(ctx, b.db, ReadCommitted, 1000, txChunkerMaxRows, nil)
		require.NoError(t, err)
		require.NoError(t, c.add(100, 1))
		require.NoError(t, c.abort())

		require.NoError(t, b.SQLMock.ExpectationsWereMet())
	})

	t.Run("commit error surfaces and does not reopen", func(t *testing.T) {
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.SQLMock.ExpectCommit().WillReturnError(errTest)

		c, err := newTxChunker(ctx, b.db, ReadCommitted, 1000, txChunkerMaxRows, nil)
		require.NoError(t, err)
		// Flush triggers the failing commit; the error must surface and no new
		// tx is begun.
		require.ErrorIs(t, c.commit(), errTest)
		require.NoError(t, b.SQLMock.ExpectationsWereMet())
	})

	t.Run("zero budget falls back to default", func(t *testing.T) {
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.SQLMock.ExpectCommit()

		c, err := newTxChunker(ctx, b.db, ReadCommitted, 0, txChunkerMaxRows, nil)
		require.NoError(t, err)
		require.Equal(t, int64(defaultChunkBudget), c.budget)
		require.NoError(t, c.commit())
		require.NoError(t, b.SQLMock.ExpectationsWereMet())
	})
}

// fakeBatchIterator is a minimal BulkRequestBatchIterator for driving
// processBulkChunked's phase-2 loop in unit tests.
type fakeBatchIterator struct {
	batches  [][]*resourcepb.BulkRequest
	rollback []bool
	idx      int
}

func (f *fakeBatchIterator) NextBatch() bool {
	f.idx++
	return f.idx <= len(f.batches)
}

func (f *fakeBatchIterator) Batch() []*resourcepb.BulkRequest {
	return f.batches[f.idx-1]
}

func (f *fakeBatchIterator) RollbackRequested() bool {
	if f.idx-1 < len(f.rollback) {
		return f.rollback[f.idx-1]
	}
	return false
}

// Next and Request satisfy BulkRequestIterator so the value can be passed to
// processBulkChunked, which type-asserts it back to BulkRequestBatchIterator.
func (f *fakeBatchIterator) Next() bool                       { return f.NextBatch() }
func (f *fakeBatchIterator) Request() *resourcepb.BulkRequest { return nil }

func TestProcessBulkChunkedRollbackRequested(t *testing.T) {
	b, ctx := setupBackendTest(t)
	b.dialect = sqltemplate.MySQL
	b.migrationChunkedWrites = true
	b.migrationChunkMaxBytes = 1 << 20

	key := &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "shorturl.grafana.app",
		Resource:  "shorturls",
	}

	// Phase 1 wipe: both tables report no candidates, so no deletes are issued.
	candidateCols := []string{"guid", "size"}
	b.SQLMock.ExpectQuery("SELECT .* OCTET_LENGTH .* FROM resource_history").
		WillReturnRows(sqlmock.NewRows(candidateCols))
	b.SQLMock.ExpectQuery("SELECT .* OCTET_LENGTH .* FROM resource").
		WillReturnRows(sqlmock.NewRows(candidateCols))

	// Phase 2: the chunker begins a tx, the first batch signals rollback, and
	// the open chunk is rolled back before the hard error is returned.
	b.SQLMock.ExpectBegin()
	b.SQLMock.ExpectRollback()

	iter := &fakeBatchIterator{
		batches:  [][]*resourcepb.BulkRequest{{newSQLBulkRequest("item-1", resourcepb.BulkRequest_ADDED, nil)}},
		rollback: []bool{true},
	}

	rsp := b.processBulkChunked(ctx, resource.BulkSettings{Collection: []*resourcepb.ResourceKey{key}}, iter)
	require.NotNil(t, rsp.Error)
	require.Contains(t, rsp.Error.Message, "rollback requested")
	require.NoError(t, b.SQLMock.ExpectationsWereMet())
}

func TestBulkHistoryInsertRowLimit(t *testing.T) {
	require.Equal(t, bulkHistoryInsertSQLiteMaxRows, bulkHistoryInsertRowLimit("sqlite"))
	require.Equal(t, bulkHistoryInsertDefaultMaxRows, bulkHistoryInsertRowLimit("mysql"))
	require.Equal(t, bulkHistoryInsertDefaultMaxRows, bulkHistoryInsertRowLimit("postgres"))
}

func TestPlanNameRanges(t *testing.T) {
	// uniform size helper.
	const sz = int64(10)
	sizeOf := func(string) int64 { return sz }

	// Half-open coverage: ranges are (startName, endName], "" meaning unbounded.
	for _, tc := range []struct {
		name   string
		names  []string
		budget int64
		want   []nameRange
	}{
		{"empty yields one unbounded range", nil, 100, []nameRange{{"", "", 0}}},
		{"single name fits", []string{"a"}, 100, []nameRange{{"", "", 10}}},
		{"multiple names fit one range", []string{"a", "b", "c"}, 100, []nameRange{{"", "", 30}}},
		{"sum equals budget stays in one range", []string{"a", "b", "c"}, 30, []nameRange{{"", "", 30}}},
		{"crossing budget splits half-open", []string{"a", "b", "c", "d"}, 20, []nameRange{{"", "b", 20}, {"b", "", 20}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, planNameRanges(tc.names, sizeOf, tc.budget))
		})
	}

	t.Run("coverage: every name maps to exactly one range, no gaps", func(t *testing.T) {
		rng := rand.New(rand.NewSource(1))
		// Names in sorted order (DB collation order is mimicked by sorted
		// fixed-width strings, which matches Go byte order here).
		const n = 500
		names := make([]string, n)
		sizes := make(map[string]int64, n)
		for i := 0; i < n; i++ {
			names[i] = fmtName(i)
			// inject occasional objects larger than budget to exercise the tail.
			s := int64(rng.Intn(50) + 1)
			if rng.Intn(50) == 0 {
				s = 10000
			}
			sizes[names[i]] = s
		}
		sizeFn := func(name string) int64 { return sizes[name] }

		ranges := planNameRanges(names, sizeFn, 200)
		require.NotEmpty(t, ranges)
		require.Equal(t, "", ranges[len(ranges)-1].endName, "final range must be unbounded above")

		for _, name := range names {
			matched := 0
			for _, r := range ranges {
				inLower := r.startName == "" || name > r.startName
				inUpper := r.endName == "" || name <= r.endName
				if inLower && inUpper {
					matched++
				}
			}
			require.Equalf(t, 1, matched, "name %q must map to exactly one range, matched %d", name, matched)
		}
	})
}

// fmtName returns a fixed-width zero-padded name so byte order matches numeric
// order, used by the coverage test.
func fmtName(i int) string {
	const digits = "0123456789"
	b := []byte{'0', '0', '0', '0'}
	for p := 3; p >= 0 && i > 0; p-- {
		b[p] = digits[i%10]
		i /= 10
	}
	return "n-" + string(b)
}

func TestBackendInsertHistoryBatchSizeTracking(t *testing.T) {
	t.Run("records max-RV size per name", func(t *testing.T) {
		b, ctx := setupBackendTest(t)
		b.SQLMock.ExpectExec("insert into resource_history values").
			WillReturnResult(sqlmock.NewResult(0, 2))

		colSizes := map[string]backfillSizes{}
		rsp := &resourcepb.BulkResponse{}
		// Two versions of the same name (valid unstructured JSON so they aren't
		// rejected); the higher-RV row's size must win. large is padded larger.
		small := chunkedTestValue("item-1", 0, 0)
		large := chunkedTestValue("item-1", 1, 100)
		_, err := b.insertHistoryBatch(ctx, b.db, []*resourcepb.BulkRequest{
			newSQLBulkRequest("item-1", resourcepb.BulkRequest_ADDED, small),
			newSQLBulkRequest("item-1", resourcepb.BulkRequest_MODIFIED, large),
		}, newBulkRV(), rsp, colSizes)
		require.NoError(t, err)
		require.NoError(t, b.SQLMock.ExpectationsWereMet())

		nsgr := resource.NSGR(&resourcepb.ResourceKey{Namespace: "default", Group: "shorturl.grafana.app", Resource: "shorturls"})
		sizes := colSizes[nsgr]
		require.NotNil(t, sizes)
		row := sizes["item-1"]
		require.NotNil(t, row)
		require.False(t, row.deleted)
		require.Equal(t, len(large), row.size, "max-RV row size must win")
	})

	t.Run("deleted latest version marks name deleted", func(t *testing.T) {
		b, ctx := setupBackendTest(t)
		b.SQLMock.ExpectExec("insert into resource_history values").
			WillReturnResult(sqlmock.NewResult(0, 2))

		colSizes := map[string]backfillSizes{}
		rsp := &resourcepb.BulkResponse{}
		payload := chunkedTestValue("item-2", 0, 0)
		_, err := b.insertHistoryBatch(ctx, b.db, []*resourcepb.BulkRequest{
			newSQLBulkRequest("item-2", resourcepb.BulkRequest_ADDED, payload),
			newSQLBulkRequest("item-2", resourcepb.BulkRequest_DELETED, payload),
		}, newBulkRV(), rsp, colSizes)
		require.NoError(t, err)
		require.NoError(t, b.SQLMock.ExpectationsWereMet())

		nsgr := resource.NSGR(&resourcepb.ResourceKey{Namespace: "default", Group: "shorturl.grafana.app", Resource: "shorturls"})
		row := colSizes[nsgr]["item-2"]
		require.NotNil(t, row)
		require.True(t, row.deleted, "name whose latest version is a delete must be marked deleted")
	})
}

func newSQLBulkRequest(name string, action resourcepb.BulkRequest_Action, value []byte) *resourcepb.BulkRequest {
	return &resourcepb.BulkRequest{
		Key: &resourcepb.ResourceKey{
			Namespace: "default",
			Group:     "shorturl.grafana.app",
			Resource:  "shorturls",
			Name:      name,
		},
		Action: action,
		Value:  value,
	}
}

// TestIntegrationBulkProcessAnalyzesResourceHistory exercises the bulk migration path,
// including the ANALYZE that runs before the resource backfill. The row threshold is
// lowered so the path is hit with a handful of rows instead of the production default.
func TestIntegrationBulkProcessAnalyzesResourceHistory(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	t.Cleanup(db.CleanupTestDB)

	ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))

	storageBackend, _ := newTestBackend(t, GarbageCollectionConfig{})
	b := storageBackend.(*backend)
	b.analyzeBulkRowThreshold = 1 // trigger ANALYZE with a small load

	key := &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "shorturl.grafana.app",
		Resource:  "shorturls",
	}
	iter := unitest.ToBulkIterator([]*resourcepb.BulkRequest{
		newSQLBulkRequest("item-1", resourcepb.BulkRequest_ADDED, []byte(`{"apiVersion":"shorturl.grafana.app/v1beta1","kind":"ShortURL","metadata":{"name":"item-1","namespace":"default"},"spec":{"path":"d/a"}}`)),
		newSQLBulkRequest("item-2", resourcepb.BulkRequest_ADDED, []byte(`{"apiVersion":"shorturl.grafana.app/v1beta1","kind":"ShortURL","metadata":{"name":"item-2","namespace":"default"},"spec":{"path":"d/b"}}`)),
		newSQLBulkRequest("item-3", resourcepb.BulkRequest_ADDED, []byte(`{"apiVersion":"shorturl.grafana.app/v1beta1","kind":"ShortURL","metadata":{"name":"item-3","namespace":"default"},"spec":{"path":"d/c"}}`)),
	})

	resp := b.ProcessBulk(ctx, resource.BulkSettings{
		Collection: []*resourcepb.ResourceKey{key},
	}, iter)
	require.Nil(t, resp.Error)
	require.Equal(t, int64(3), resp.Processed)

	// The backfill must have populated the resource table from history.
	server, err := resource.NewResourceServer(resource.ResourceServerOptions{Backend: storageBackend})
	require.NoError(t, err)
	listResp, err := server.List(ctx, &resourcepb.ListRequest{
		Source:  resourcepb.ListRequest_STORE,
		Options: &resourcepb.ListOptions{Key: key},
	})
	require.NoError(t, err)
	require.Nil(t, listResp.Error)
	require.Len(t, listResp.Items, 3)

	// On Postgres the ANALYZE must have refreshed statistics: a freshly created table
	// reports reltuples=0/-1, so a positive estimate proves the ANALYZE ran.
	if b.dialect.DialectName() == "postgres" {
		var reltuples float64
		row := b.db.QueryRowContext(ctx, `SELECT reltuples FROM pg_class WHERE relname = 'resource_history'`)
		require.NoError(t, row.Scan(&reltuples))
		require.Greater(t, reltuples, float64(0))
	}
}

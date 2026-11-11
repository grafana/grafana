package sql

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"math/rand"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	sqldb "github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
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
			c, err := newTxChunker(ctx, b.db, ReadCommitted, tc.budget, tc.maxRows, func(int64) { onCommit++ }, nil)
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

		c, err := newTxChunker(ctx, b.db, ReadCommitted, 1000, txChunkerMaxRows, nil, nil)
		require.NoError(t, err)
		require.NoError(t, c.add(100, 1))
		require.NoError(t, c.abort())

		require.NoError(t, b.SQLMock.ExpectationsWereMet())
	})

	t.Run("commit error surfaces and does not reopen", func(t *testing.T) {
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.SQLMock.ExpectCommit().WillReturnError(errTest)

		c, err := newTxChunker(ctx, b.db, ReadCommitted, 1000, txChunkerMaxRows, nil, nil)
		require.NoError(t, err)
		// Flush triggers the failing commit; the error must surface and no new
		// tx is begun.
		require.ErrorIs(t, c.commit(), errTest)
		require.NoError(t, b.SQLMock.ExpectationsWereMet())
	})

	t.Run("migration statement timeout is set first in every postgres transaction", func(t *testing.T) {
		b, ctx := setupBackendTest(t)
		b.dialect = sqltemplate.PostgreSQL
		b.migrationStatementTimeout = 15 * time.Minute
		for range 2 {
			b.SQLMock.ExpectBegin()
			b.SQLMock.ExpectExec("SET LOCAL statement_timeout = 900000").WillReturnResult(sqlmock.NewResult(0, 0))
			b.SQLMock.ExpectCommit()
		}

		c, err := newTxChunker(ctx, b.db, ReadCommitted, 100, txChunkerMaxRows, nil, b.setMigrationStatementTimeout)
		require.NoError(t, err)
		require.NoError(t, c.add(100, 1))
		require.NoError(t, c.commit())
		require.NoError(t, b.SQLMock.ExpectationsWereMet())
	})

	t.Run("migration statement timeout is a no-op when unset or not postgres", func(t *testing.T) {
		for _, tc := range []struct {
			name    string
			dialect sqltemplate.Dialect
			timeout time.Duration
		}{
			{"unset", sqltemplate.PostgreSQL, 0},
			{"mysql", sqltemplate.MySQL, time.Minute},
		} {
			t.Run(tc.name, func(t *testing.T) {
				b, ctx := setupBackendTest(t)
				b.dialect = tc.dialect
				b.migrationStatementTimeout = tc.timeout
				b.SQLMock.ExpectBegin()
				b.SQLMock.ExpectCommit()

				c, err := newTxChunker(ctx, b.db, ReadCommitted, 100, txChunkerMaxRows, nil, b.setMigrationStatementTimeout)
				require.NoError(t, err)
				require.NoError(t, c.commit())
				require.NoError(t, b.SQLMock.ExpectationsWereMet())
			})
		}
	})

	t.Run("onBegin error rolls back and surfaces", func(t *testing.T) {
		b, ctx := setupBackendTest(t)
		b.SQLMock.ExpectBegin()
		b.SQLMock.ExpectRollback()

		_, err := newTxChunker(ctx, b.db, ReadCommitted, 100, txChunkerMaxRows, nil, func(context.Context, sqldb.Tx) error { return errTest })
		require.ErrorIs(t, err, errTest)
		require.NoError(t, b.SQLMock.ExpectationsWereMet())
	})

	t.Run("zero budget falls back to default", func(t *testing.T) {
		b, ctx := setupBackendTest(t)

		b.SQLMock.ExpectBegin()
		b.SQLMock.ExpectCommit()

		c, err := newTxChunker(ctx, b.db, ReadCommitted, 0, txChunkerMaxRows, nil, nil)
		require.NoError(t, err)
		require.Equal(t, int64(defaultChunkBudget), c.budget)
		require.NoError(t, c.commit())
		require.NoError(t, b.SQLMock.ExpectationsWereMet())
	})
}

func TestChunkedBackfillStatementTimeout(t *testing.T) {
	key := &resourcepb.ResourceKey{Namespace: "default", Group: "dashboard.grafana.app", Resource: "dashboards"}
	sizes := backfillSizes{"a": {rv: 1, size: 10}, "b": {rv: 2, size: 10}}

	t.Run("postgres override wraps each backfill statement in its own transaction", func(t *testing.T) {
		b, ctx := setupBackendTest(t)
		b.dialect = sqltemplate.PostgreSQL
		b.migrationStatementTimeout = 15 * time.Minute

		b.SQLMock.ExpectBegin()
		b.SQLMock.ExpectExec("SET LOCAL statement_timeout = 900000").WillReturnResult(sqlmock.NewResult(0, 0))
		b.SQLMock.ExpectQuery("SELECT DISTINCT").WillReturnRows(sqlmock.NewRows([]string{"name"}).AddRow("a").AddRow("b"))
		b.SQLMock.ExpectCommit()
		for range 2 {
			b.SQLMock.ExpectBegin()
			b.SQLMock.ExpectExec("SET LOCAL statement_timeout = 900000").WillReturnResult(sqlmock.NewResult(0, 0))
			b.SQLMock.ExpectExec("INSERT INTO resource").WillReturnResult(sqlmock.NewResult(0, 1))
			b.SQLMock.ExpectCommit()
		}

		require.NoError(t, b.backfillCollection(ctx, b.execMigration, key, sizes, 10, nil))
		require.NoError(t, b.SQLMock.ExpectationsWereMet())
	})

	t.Run("without an override the statements autocommit as before", func(t *testing.T) {
		b, ctx := setupBackendTest(t)
		b.dialect = sqltemplate.PostgreSQL

		b.SQLMock.ExpectQuery("SELECT DISTINCT").WillReturnRows(sqlmock.NewRows([]string{"name"}).AddRow("a").AddRow("b"))
		b.SQLMock.ExpectExec("INSERT INTO resource").WillReturnResult(sqlmock.NewResult(0, 1))
		b.SQLMock.ExpectExec("INSERT INTO resource").WillReturnResult(sqlmock.NewResult(0, 1))

		require.NoError(t, b.backfillCollection(ctx, b.execMigration, key, sizes, 10, nil))
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

func (f *fakeBatchIterator) NextBatch(ctx context.Context) bool {
	if ctx.Err() != nil {
		return false
	}
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
func (f *fakeBatchIterator) Next() bool {
	return f.NextBatch(context.Background())
}
func (f *fakeBatchIterator) Request() *resourcepb.BulkRequest { return nil }

func TestSingleRequestBatchIteratorCancellation(t *testing.T) {
	req := newSQLBulkRequest("item-1", resourcepb.BulkRequest_ADDED, nil)
	batchIter := &singleRequestBatchIterator{iter: unitest.ToBulkIterator([]*resourcepb.BulkRequest{req})}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()

	require.False(t, batchIter.NextBatch(ctx))
	require.True(t, batchIter.NextBatch(t.Context()))
	require.Equal(t, []*resourcepb.BulkRequest{req}, batchIter.Batch())
}

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

	rsp, err := b.processBulkChunked(ctx, resource.BulkSettings{Collection: []*resourcepb.ResourceKey{key}}, iter)
	require.ErrorContains(t, err, "rollback requested")
	require.Nil(t, rsp)
	require.NoError(t, b.SQLMock.ExpectationsWereMet())
}

func TestProcessBulkReturnsTransactionError(t *testing.T) {
	b, ctx := setupBackendTest(t)
	want := errors.New("begin failed")
	b.SQLMock.ExpectBegin().WillReturnError(want)

	rsp, err := b.processBulk(ctx, resource.BulkSettings{}, unitest.ToBulkIterator(nil))
	require.ErrorIs(t, err, want)
	require.Nil(t, rsp)
	require.NoError(t, b.SQLMock.ExpectationsWereMet())
}

// A failure while staging the parquet buffer must fail the bulk call before
// the collection is cleared, rather than importing the truncated buffer.
func TestProcessBulkParquetBufferWriteErrorKeepsCollection(t *testing.T) {
	if !db.IsTestDbSQLite() {
		t.Skip("the parquet buffer is only used with SQLite")
	}
	ctx := t.Context()
	eDB, err := dbimpl.ProvideResourceDB(db.NewTestStore(t), setting.NewCfg(), nil)
	require.NoError(t, err)
	storageBackend, err := NewBackend(BackendOptions{
		DBProvider:             eDB,
		DisablePruner:          true,
		MigrationParquetBuffer: true,
		TmpDir:                 t.TempDir(),
	})
	require.NoError(t, err)
	b := storageBackend.(*backend)
	require.Equal(t, "sqlite", b.dialect.DialectName())
	svc := storageBackend.(services.Service)
	require.NoError(t, services.StartAndAwaitRunning(ctx, svc))
	t.Cleanup(func() { require.NoError(t, services.StopAndAwaitTerminated(context.Background(), svc)) })

	key := &resourcepb.ResourceKey{Namespace: "default", Group: "shorturl.grafana.app", Resource: "shorturls"}
	settings := resource.BulkSettings{Collection: []*resourcepb.ResourceKey{key}}
	value := func(name string) []byte {
		return []byte(`{"apiVersion":"shorturl.grafana.app/v1beta1","kind":"ShortURL","metadata":{"name":"` + name + `","namespace":"default"},"spec":{"path":"d/test"}}`)
	}

	rsp, err := b.ProcessBulk(ctx, settings, unitest.ToBulkIterator([]*resourcepb.BulkRequest{
		newSQLBulkRequest("item-1", resourcepb.BulkRequest_ADDED, value("item-1")),
		newSQLBulkRequest("item-2", resourcepb.BulkRequest_ADDED, value("item-2")),
	}))
	require.NoError(t, err)
	require.EqualValues(t, 2, rsp.Processed)

	rsp, err = b.ProcessBulk(ctx, settings, unitest.ToBulkIterator([]*resourcepb.BulkRequest{
		newSQLBulkRequest("item-3", resourcepb.BulkRequest_ADDED, value("item-3")),
		newSQLBulkRequest("bad", resourcepb.BulkRequest_ADDED, []byte("{not json")),
	}))
	require.Error(t, err)
	require.Nil(t, rsp)

	server, err := resource.NewResourceServer(resource.ResourceServerOptions{Backend: storageBackend})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, server.Stop(context.Background())) })
	list, err := server.List(authlib.WithAuthInfo(ctx, testBulkBlobRequester()), &resourcepb.ListRequest{
		Source:  resourcepb.ListRequest_STORE,
		Options: &resourcepb.ListOptions{Key: key},
	})
	require.NoError(t, err)
	require.Len(t, list.Items, 2)
	names := make([]string, 0, len(list.Items))
	for _, item := range list.Items {
		var obj struct {
			Metadata struct {
				Name string `json:"name"`
			} `json:"metadata"`
		}
		require.NoError(t, json.Unmarshal(item.Value, &obj))
		names = append(names, obj.Metadata.Name)
		require.NotEqual(t, "item-3", obj.Metadata.Name)
		require.JSONEq(t, string(value(obj.Metadata.Name)), string(item.Value))
	}
	require.ElementsMatch(t, []string{"item-1", "item-2"}, names)

	// The failed staging call must also release the collection's bulk lock.
	rsp, err = b.ProcessBulk(ctx, settings, unitest.ToBulkIterator([]*resourcepb.BulkRequest{
		newSQLBulkRequest("item-3", resourcepb.BulkRequest_ADDED, value("item-3")),
	}))
	require.NoError(t, err)
	require.EqualValues(t, 1, rsp.Processed)
}

func TestProcessBulkRollsBackSQLFailures(t *testing.T) {
	if !db.IsTestDbSQLite() {
		t.Skip("rollback assertions use an isolated SQLite database")
	}
	for _, failCommit := range []bool{false, true} {
		name := "second insert"
		if failCommit {
			name = "commit"
		}
		t.Run(name, func(t *testing.T) {
			ctx := t.Context()
			eDB, err := dbimpl.ProvideResourceDB(db.NewTestStore(t), setting.NewCfg(), nil)
			require.NoError(t, err)
			storageBackend, err := NewBackend(BackendOptions{DBProvider: eDB, DisablePruner: true})
			require.NoError(t, err)
			b := storageBackend.(*backend)
			svc := storageBackend.(services.Service)
			require.NoError(t, services.StartAndAwaitRunning(ctx, svc))
			t.Cleanup(func() { require.NoError(t, services.StopAndAwaitTerminated(context.Background(), svc)) })

			request := func(name string) *resourcepb.BulkRequest {
				return newSQLBulkRequest(name, resourcepb.BulkRequest_ADDED, []byte(`{"apiVersion":"shorturl.grafana.app/v1beta1","kind":"ShortURL","metadata":{"name":"`+name+`","namespace":"default"},"spec":{"path":"d/test"}}`))
			}
			original := request("original")
			settings := resource.BulkSettings{Collection: []*resourcepb.ResourceKey{original.Key}}
			_, err = b.ProcessBulk(ctx, settings, unitest.ToBulkIterator([]*resourcepb.BulkRequest{original}))
			require.NoError(t, err)

			want := errors.New("SQL bulk failure")
			fault := &bulkFailureTx{err: want, failCommit: failCommit}
			originalDB := b.db
			b.db = &bulkFailureDB{DB: originalDB, fault: fault}
			t.Cleanup(func() { b.db = originalDB })
			rsp, err := b.ProcessBulk(ctx, settings, &fakeBatchIterator{batches: [][]*resourcepb.BulkRequest{
				{request("item-1")}, {request("item-2")},
			}})
			require.ErrorIs(t, err, want)
			require.Nil(t, rsp)
			if failCommit {
				require.Equal(t, 2, fault.successfulInserts)
				require.True(t, fault.commitAttempted)
			} else {
				require.Equal(t, 1, fault.successfulInserts)
			}
			// Check real persisted rows, not only a mocked Rollback call.
			for _, table := range []string{"resource", "resource_history"} {
				rows, err := originalDB.QueryContext(ctx, "SELECT name, value FROM "+table+" WHERE namespace = ?", original.Key.Namespace)
				require.NoError(t, err)
				defer func() { require.NoError(t, rows.Close()) }()
				require.True(t, rows.Next())
				var name string
				var value []byte
				require.NoError(t, rows.Scan(&name, &value))
				require.Equal(t, "original", name)
				require.JSONEq(t, string(original.Value), string(value))
				require.False(t, rows.Next())
				require.NoError(t, rows.Err())
			}
		})
	}
}

type bulkFailureDB struct {
	sqldb.DB
	fault *bulkFailureTx
}

func (d *bulkFailureDB) WithTx(ctx context.Context, opts *sql.TxOptions, fn sqldb.TxFunc) error {
	return sqldb.NewWithTxFunc(func(ctx context.Context, opts *sql.TxOptions) (sqldb.Tx, error) {
		tx, err := d.DB.BeginTx(ctx, opts)
		if err != nil {
			return nil, err
		}
		d.fault.Tx = tx
		return d.fault, nil
	}).WithTx(ctx, opts, fn)
}

type bulkFailureTx struct {
	sqldb.Tx
	err               error
	failCommit        bool
	successfulInserts int
	commitAttempted   bool
}

func (t *bulkFailureTx) ExecContext(ctx context.Context, query string, args ...any) (sqldb.Result, error) {
	words := strings.Fields(strings.ToLower(query))
	isInsert := len(words) > 2 && words[0] == "insert" && words[1] == "into" && strings.Trim(words[2], "\"`") == "resource_history"
	if isInsert && !t.failCommit && t.successfulInserts == 1 {
		return nil, t.err
	}
	result, err := t.Tx.ExecContext(ctx, query, args...)
	if isInsert && err == nil {
		t.successfulInserts++
	}
	return result, err
}

func (t *bulkFailureTx) Commit() error {
	t.commitAttempted = true
	if t.failCommit {
		// Model a commit failure that aborts the underlying transaction.
		if err := t.Rollback(); err != nil {
			return err
		}
		return t.err
	}
	return t.Tx.Commit()
}

func TestBulkRVUsesDeletionTime(t *testing.T) {
	now := time.Now()
	obj := &metav1.ObjectMeta{Annotations: map[string]string{
		utils.AnnoKeyUpdatedTimestamp: now.Add(-2 * 365 * 24 * time.Hour).UTC().Format(time.RFC3339),
	}}
	deletedAt := metav1.NewTime(now.Add(-24 * time.Hour))
	obj.SetDeletionTimestamp(&deletedAt)

	rv := newBulkRV().next(obj)
	// RVs are microseconds, bucketed to 10s with a counter in the low digits
	require.InDelta(t, deletedAt.UnixMicro(), rv, float64(20*time.Second/time.Microsecond))
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
			require.Equal(t, tc.want, planNameRanges(tc.names, sizeOf, tc.budget, 0))
		})
	}

	t.Run("names that cost no bytes still split at the name limit", func(t *testing.T) {
		deleted := func(string) int64 { return 0 }
		got := planNameRanges([]string{"a", "b", "c", "d", "e"}, deleted, 100, 2)
		require.Equal(t, []nameRange{{"", "b", 0}, {"b", "d", 0}, {"d", "", 0}}, got)
	})

	t.Run("the name limit and the byte budget both close a range", func(t *testing.T) {
		got := planNameRanges([]string{"a", "b", "c", "d"}, sizeOf, 25, 3)
		require.Equal(t, []nameRange{{"", "b", 20}, {"b", "", 20}}, got)
		got = planNameRanges([]string{"a", "b", "c", "d"}, sizeOf, 1000, 3)
		require.Equal(t, []nameRange{{"", "c", 30}, {"c", "", 10}}, got)
	})

	t.Run("coverage: every name maps to exactly one range, no gaps", func(t *testing.T) {
		rng := rand.New(rand.NewSource(1))
		// Names in sorted order (DB collation order is mimicked by sorted
		// fixed-width strings, which matches Go byte order here).
		const n = 500
		names := make([]string, n)
		sizes := make(map[string]int64, n)
		for i := range n {
			names[i] = fmtName(i)
			// inject occasional objects larger than budget to exercise the tail.
			s := int64(rng.Intn(50) + 1)
			if rng.Intn(50) == 0 {
				s = 10000
			}
			sizes[names[i]] = s
		}
		sizeFn := func(name string) int64 { return sizes[name] }

		ranges := planNameRanges(names, sizeFn, 200, 0)
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

	resp, err := b.ProcessBulk(ctx, resource.BulkSettings{
		Collection: []*resourcepb.ResourceKey{key},
	}, iter)
	require.NoError(t, err)
	require.Equal(t, int64(3), resp.Processed)

	// The backfill must have populated the resource table from history.
	server, err := resource.NewResourceServer(resource.ResourceServerOptions{Backend: storageBackend})
	require.NoError(t, err)
	listResp, err := server.List(ctx, &resourcepb.ListRequest{
		Source:  resourcepb.ListRequest_STORE,
		Options: &resourcepb.ListOptions{Key: key},
	})
	require.NoError(t, err)
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

package sql

import (
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
	err := b.insertHistoryBatch(ctx, b.db, []*resourcepb.BulkRequest{
		newSQLBulkRequest("item-1", resourcepb.BulkRequest_ADDED, []byte(`{"apiVersion":"shorturl.grafana.app/v1beta1","kind":"ShortURL","metadata":{"name":"item-1","namespace":"default"},"spec":{"path":"d/test"}}`)),
		newSQLBulkRequest("item-2", resourcepb.BulkRequest_UNKNOWN, []byte(`{"apiVersion":"shorturl.grafana.app/v1beta1","kind":"ShortURL","metadata":{"name":"item-2","namespace":"default"},"spec":{"path":"d/test"}}`)),
		newSQLBulkRequest("item-3", resourcepb.BulkRequest_ADDED, []byte(`{"apiVersion":"shorturl.grafana.app/v1beta1","kind":"ShortURL","metadata":{"name":"item-3","namespace":"default"},"spec":{"path":"d/test"}}`)),
	}, newBulkRV(), rsp)
	require.NoError(t, err)
	require.Equal(t, int64(3), rsp.Processed)
	require.Len(t, rsp.Rejected, 1)
	require.Equal(t, "item-2", rsp.Rejected[0].Key.Name)
	require.Equal(t, resourcepb.BulkRequest_UNKNOWN, rsp.Rejected[0].Action)
	require.NoError(t, b.SQLMock.ExpectationsWereMet())
}

func TestBulkHistoryInsertRowLimit(t *testing.T) {
	require.Equal(t, bulkHistoryInsertSQLiteMaxRows, bulkHistoryInsertRowLimit("sqlite"))
	require.Equal(t, bulkHistoryInsertDefaultMaxRows, bulkHistoryInsertRowLimit("mysql"))
	require.Equal(t, bulkHistoryInsertDefaultMaxRows, bulkHistoryInsertRowLimit("postgres"))
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

package vector

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/util/xorm"
)

const testModel = "test-model"
const testResource = "dashboards"

var testSubtree = subtreeName(testResource)

// To run: start the pgvector devenv (localhost:5433) and
//
//	PGVECTOR_TEST_DB="host=localhost port=5433 dbname=grafana_vectors user=grafana password=password sslmode=disable" \
//	  go test -run TestIntegration ./pkg/storage/unified/search/vector/... -v -count=1
func setupIntegrationTest(t *testing.T) (VectorBackend, *xorm.Engine, context.Context) {
	t.Helper()
	testutil.SkipIntegrationTestInShortMode(t)

	connStr := os.Getenv("PGVECTOR_TEST_DB")
	if connStr == "" {
		t.Skip("PGVECTOR_TEST_DB not set, skipping pgvector integration test")
	}

	ctx := context.Background()

	engine, err := xorm.NewEngine("postgres", connStr)
	require.NoError(t, err)
	t.Cleanup(func() {
		if err := engine.Close(); err != nil {
			t.Logf("closing xorm engine: %v", err)
		}
	})

	cfg := setting.NewCfg()
	err = MigrateVectorStore(ctx, engine, cfg)
	require.NoError(t, err)

	database := dbimpl.NewDB(engine.DB().DB, engine.Dialect().DriverName())
	// interval=0 keeps Run idle; promotion tests call Promote(ctx) directly.
	backend := NewPgvectorBackend(database, 1000, 0)

	cleanIntegrationState(t, engine)

	return backend, engine, ctx
}

// cleanIntegrationState drops any `integration-test*` partial indexes, clears
// rows, and resets the checkpoint.
func cleanIntegrationState(t *testing.T, engine *xorm.Engine) {
	t.Helper()
	ctx := context.Background()

	indexPrefix := fmt.Sprintf("%s_integration_test", testResource)
	rows, err := engine.DB().QueryContext(ctx, `
		SELECT c.relname FROM pg_class c
		JOIN pg_index i ON i.indexrelid = c.oid
		JOIN pg_class t ON t.oid = i.indrelid
		WHERE t.relname = $1 AND c.relkind = 'i' AND c.relname LIKE $2`,
		testSubtree, indexPrefix+"%")
	require.NoError(t, err)
	var indexes []string
	for rows.Next() {
		var n string
		require.NoError(t, rows.Scan(&n))
		indexes = append(indexes, n)
	}
	_ = rows.Close()

	for _, idx := range indexes {
		_, _ = engine.DB().ExecContext(ctx, fmt.Sprintf(`DROP INDEX IF EXISTS %s`, idx))
	}

	_, _ = engine.DB().ExecContext(ctx,
		fmt.Sprintf(`DELETE FROM %s WHERE namespace LIKE 'integration-test%%'`, testSubtree))
	_, _ = engine.DB().ExecContext(ctx,
		`DELETE FROM vector_promoted WHERE namespace LIKE 'integration-test%'`)
	_, _ = engine.DB().ExecContext(ctx,
		`UPDATE vector_latest_rv SET latest_rv = 0 WHERE id = 1`)
}

func TestIntegrationVectorUpsertAndSearch(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)

	vectors := []Vector{
		{
			Namespace: "integration-test", Resource: testResource, UID: "dash-1", Title: "CPU Dashboard", Subresource: "panel/1",
			ResourceVersion: 10, Folder: "folder-a",
			Content:   "CPU usage over time for production servers",
			Metadata:  json.RawMessage(`{"datasource_uids":["prom-1"],"query_languages":["promql"]}`),
			Embedding: makeEmbedding(0.9, 0.1), Model: testModel,
		},
		{
			Namespace: "integration-test", Resource: testResource, UID: "dash-1", Title: "CPU Dashboard", Subresource: "panel/2",
			ResourceVersion: 10, Folder: "folder-a",
			Content:   "Memory usage alerts dashboard",
			Metadata:  json.RawMessage(`{"datasource_uids":["prom-1"],"query_languages":["promql"]}`),
			Embedding: makeEmbedding(0.1, 0.9), Model: testModel,
		},
		{
			Namespace: "integration-test", Resource: testResource, UID: "dash-2", Title: "Logs Dashboard", Subresource: "panel/1",
			ResourceVersion: 20, Folder: "folder-b",
			Content:   "Log volume by service",
			Metadata:  json.RawMessage(`{"datasource_uids":["loki-1"],"query_languages":["logql"]}`),
			Embedding: makeEmbedding(0.5, 0.5), Model: testModel,
		},
	}

	require.NoError(t, backend.Upsert(ctx, vectors))

	results, err := backend.Search(ctx, "integration-test", testModel, testResource, makeEmbedding(0.85, 0.15), 10)
	require.NoError(t, err)
	require.GreaterOrEqual(t, len(results), 3)
	assert.Equal(t, "dash-1", results[0].UID)
	assert.Equal(t, "CPU Dashboard", results[0].Title)
	assert.Equal(t, "panel/1", results[0].Subresource)

	results, err = backend.Search(ctx, "integration-test", testModel, testResource, makeEmbedding(0.5, 0.5), 10,
		SearchFilter{Field: "uid", Values: []string{"dash-2"}})
	require.NoError(t, err)
	require.Len(t, results, 1)
	assert.Equal(t, "dash-2", results[0].UID)

	results, err = backend.Search(ctx, "integration-test", testModel, testResource, makeEmbedding(0.5, 0.5), 10,
		SearchFilter{Field: "folder", Values: []string{"folder-a"}})
	require.NoError(t, err)
	require.Len(t, results, 2)

	results, err = backend.Search(ctx, "integration-test", testModel, testResource, makeEmbedding(0.5, 0.5), 10,
		SearchFilter{Field: "query_languages", Values: []string{"logql"}})
	require.NoError(t, err)
	require.Len(t, results, 1)
	assert.Equal(t, "dash-2", results[0].UID)
}

func TestIntegrationVectorDeleteSubresources(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)

	err := backend.Upsert(ctx, []Vector{
		{Namespace: "integration-test", Resource: testResource, UID: "dash", Title: "Dash", Subresource: "panel/1",
			ResourceVersion: 10, Content: "panel one", Metadata: json.RawMessage(`{}`),
			Embedding: makeEmbedding(0.5, 0.5), Model: testModel},
		{Namespace: "integration-test", Resource: testResource, UID: "dash", Title: "Dash", Subresource: "panel/2",
			ResourceVersion: 10, Content: "panel two", Metadata: json.RawMessage(`{}`),
			Embedding: makeEmbedding(0.5, 0.5), Model: testModel},
		{Namespace: "integration-test", Resource: testResource, UID: "dash", Title: "Dash", Subresource: "panel/3",
			ResourceVersion: 10, Content: "panel three", Metadata: json.RawMessage(`{}`),
			Embedding: makeEmbedding(0.5, 0.5), Model: testModel},
	})
	require.NoError(t, err)

	stored, err := backend.GetSubresourceContent(ctx, "integration-test", testModel, testResource, "dash")
	require.NoError(t, err)
	require.Len(t, stored, 3)

	current := map[string]string{"panel/1": "panel one"}
	var toDelete []string
	for sub := range stored {
		if _, ok := current[sub]; !ok {
			toDelete = append(toDelete, sub)
		}
	}
	require.ElementsMatch(t, []string{"panel/2", "panel/3"}, toDelete)

	err = backend.DeleteSubresources(ctx, "integration-test", testModel, testResource, "dash", toDelete)
	require.NoError(t, err)

	results, err := backend.Search(ctx, "integration-test", testModel, testResource, makeEmbedding(0.5, 0.5), 10)
	require.NoError(t, err)
	require.Len(t, results, 1)
	assert.Equal(t, "panel/1", results[0].Subresource)

	err = backend.Delete(ctx, "integration-test", testModel, testResource, "dash")
	require.NoError(t, err)
}

func TestIntegrationVectorGetLatestRV(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)

	rv, err := backend.GetLatestRV(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(0), rv)

	err = backend.Upsert(ctx, []Vector{
		{Namespace: "integration-test", Resource: testResource, UID: "rv-test", Title: "RV Test", Subresource: "x",
			ResourceVersion: 42, Content: "test content", Metadata: json.RawMessage(`{}`),
			Embedding: makeEmbedding(0.5, 0.5), Model: testModel},
	})
	require.NoError(t, err)

	rv, err = backend.GetLatestRV(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(42), rv)
}

func TestIntegrationPromoterPromotesLargeTenant(t *testing.T) {
	backend, engine, ctx := setupIntegrationTest(t)

	const ns = "integration-test-big"
	const threshold = 50
	const nRows = threshold + 10

	vectors := make([]Vector, 0, nRows)
	for i := 0; i < nRows; i++ {
		vectors = append(vectors, Vector{
			Namespace: ns, Resource: testResource, UID: "dash", Title: "Dash", Subresource: fmt.Sprintf("panel/%d", i),
			ResourceVersion: int64(i + 1), Content: fmt.Sprintf("content %d", i),
			Metadata: json.RawMessage(`{}`), Embedding: makeEmbedding(0.5, 0.5), Model: testModel,
		})
	}
	require.NoError(t, backend.Upsert(ctx, vectors))

	idxName := partialHNSWName(testResource, ns)
	require.False(t, indexExists(t, engine, idxName))
	require.Equal(t, nRows, countRowsIn(t, engine, testSubtree, ns))

	database := dbimpl.NewDB(engine.DB().DB, engine.Dialect().DriverName())
	promoter := NewPromoter(database, threshold, 0)
	require.NoError(t, promoter.Promote(ctx))

	require.True(t, indexExists(t, engine, idxName))
	require.Equal(t, nRows, countRowsIn(t, engine, testSubtree, ns))

	results, err := backend.Search(ctx, ns, testModel, testResource, makeEmbedding(0.5, 0.5), 5)
	require.NoError(t, err)
	assert.Len(t, results, 5)
}

func TestIntegrationPromoterSkipsSmallTenant(t *testing.T) {
	backend, engine, ctx := setupIntegrationTest(t)

	const ns = "integration-test-small"
	require.NoError(t, backend.Upsert(ctx, []Vector{
		{Namespace: ns, Resource: testResource, UID: "dash", Title: "Dash", Subresource: "panel/1",
			ResourceVersion: 1, Content: "only row", Metadata: json.RawMessage(`{}`),
			Embedding: makeEmbedding(0.1, 0.1), Model: testModel},
	}))

	database := dbimpl.NewDB(engine.DB().DB, engine.Dialect().DriverName())
	promoter := NewPromoter(database, 100, 0)
	require.NoError(t, promoter.Promote(ctx))

	idxName := partialHNSWName(testResource, ns)
	require.False(t, indexExists(t, engine, idxName),
		"small tenant should not be promoted")
}

func indexExists(t *testing.T, engine *xorm.Engine, idxName string) bool {
	t.Helper()
	var exists bool
	err := engine.DB().QueryRowContext(context.Background(), `
		SELECT EXISTS (
			SELECT 1 FROM pg_class c
			JOIN pg_index i ON i.indexrelid = c.oid
			WHERE c.relname = $1 AND c.relkind = 'i' AND i.indisvalid
		)`, idxName).Scan(&exists)
	require.NoError(t, err)
	return exists
}

func countRowsIn(t *testing.T, engine *xorm.Engine, table, ns string) int {
	t.Helper()
	var n int
	require.NoError(t, engine.DB().QueryRowContext(context.Background(),
		fmt.Sprintf(`SELECT COUNT(*) FROM %s WHERE namespace = $1`, table), ns).Scan(&n))
	return n
}

// makeEmbedding builds a 1024-dim halfvec with the first two values set.
func makeEmbedding(a, b float32) []float32 {
	e := make([]float32, 1024)
	e[0] = a
	e[1] = b
	return e
}

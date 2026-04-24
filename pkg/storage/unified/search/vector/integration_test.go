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

const testCollectionID = "dashboard.grafana.app/dashboards"
const testModel = "test-model"
const testParent = "dashboard_embeddings"

// To run these tests, start the pgvector devenv block (already running
// locally on port 5433) and set the env var:
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
	backend := NewPgvectorBackend(database)

	cleanIntegrationState(t, engine)

	return backend, engine, ctx
}

// cleanIntegrationState detaches and drops any integration-test-* partitions,
// wipes DEFAULT rows, and resets the global checkpoint.
func cleanIntegrationState(t *testing.T, engine *xorm.Engine) {
	t.Helper()
	ctx := context.Background()

	// List child partitions whose name starts with the integration-test prefix.
	rows, err := engine.DB().QueryContext(ctx, `
		SELECT c.relname FROM pg_inherits i
		JOIN pg_class c ON c.oid = i.inhrelid
		JOIN pg_class p ON p.oid = i.inhparent
		WHERE p.relname = $1 AND c.relname LIKE 'dashboard_embeddings_integration_test%'`,
		testParent)
	require.NoError(t, err)
	var parts []string
	for rows.Next() {
		var n string
		require.NoError(t, rows.Scan(&n))
		parts = append(parts, n)
	}
	_ = rows.Close()

	for _, p := range parts {
		// DETACH first so DROP doesn't touch parent metadata under SHARE lock.
		_, _ = engine.DB().ExecContext(ctx,
			fmt.Sprintf(`ALTER TABLE %s DETACH PARTITION %s`, testParent, p))
		_, _ = engine.DB().ExecContext(ctx, fmt.Sprintf(`DROP TABLE IF EXISTS %s`, p))
	}

	_, _ = engine.DB().ExecContext(ctx,
		`DELETE FROM dashboard_embeddings_default WHERE namespace LIKE 'integration-test%'`)
	_, _ = engine.DB().ExecContext(ctx,
		`DELETE FROM vector_promoted WHERE namespace LIKE 'integration-test%'`)
	_, _ = engine.DB().ExecContext(ctx,
		`UPDATE vector_latest_rv SET latest_rv = 0 WHERE id = 1`)
}

func TestIntegrationVectorUpsertAndSearch(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)

	vectors := []Vector{
		{
			Namespace: "integration-test", CollectionID: testCollectionID, Name: "dash-1", Subresource: "panel/1",
			ResourceVersion: 10, Folder: "folder-a",
			Content:   "CPU usage over time for production servers",
			Metadata:  json.RawMessage(`{"datasource_uids":["prom-1"],"query_languages":["promql"]}`),
			Embedding: makeEmbedding(0.9, 0.1), Model: testModel,
		},
		{
			Namespace: "integration-test", CollectionID: testCollectionID, Name: "dash-1", Subresource: "panel/2",
			ResourceVersion: 10, Folder: "folder-a",
			Content:   "Memory usage alerts dashboard",
			Metadata:  json.RawMessage(`{"datasource_uids":["prom-1"],"query_languages":["promql"]}`),
			Embedding: makeEmbedding(0.1, 0.9), Model: testModel,
		},
		{
			Namespace: "integration-test", CollectionID: testCollectionID, Name: "dash-2", Subresource: "panel/1",
			ResourceVersion: 20, Folder: "folder-b",
			Content:   "Log volume by service",
			Metadata:  json.RawMessage(`{"datasource_uids":["loki-1"],"query_languages":["logql"]}`),
			Embedding: makeEmbedding(0.5, 0.5), Model: testModel,
		},
	}

	require.NoError(t, backend.Upsert(ctx, vectors))

	results, err := backend.Search(ctx, "integration-test", testModel, testCollectionID, makeEmbedding(0.85, 0.15), 10)
	require.NoError(t, err)
	require.GreaterOrEqual(t, len(results), 3)
	assert.Equal(t, "dash-1", results[0].Name)
	assert.Equal(t, "panel/1", results[0].Subresource)

	results, err = backend.Search(ctx, "integration-test", testModel, testCollectionID, makeEmbedding(0.5, 0.5), 10,
		SearchFilter{Field: "name", Values: []string{"dash-2"}})
	require.NoError(t, err)
	require.Len(t, results, 1)
	assert.Equal(t, "dash-2", results[0].Name)

	results, err = backend.Search(ctx, "integration-test", testModel, testCollectionID, makeEmbedding(0.5, 0.5), 10,
		SearchFilter{Field: "folder", Values: []string{"folder-a"}})
	require.NoError(t, err)
	require.Len(t, results, 2)

	results, err = backend.Search(ctx, "integration-test", testModel, testCollectionID, makeEmbedding(0.5, 0.5), 10,
		SearchFilter{Field: "query_languages", Values: []string{"logql"}})
	require.NoError(t, err)
	require.Len(t, results, 1)
	assert.Equal(t, "dash-2", results[0].Name)
}

func TestIntegrationVectorDeleteSubresources(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)

	err := backend.Upsert(ctx, []Vector{
		{Namespace: "integration-test", CollectionID: testCollectionID, Name: "dash", Subresource: "panel/1",
			ResourceVersion: 10, Content: "panel one", Metadata: json.RawMessage(`{}`),
			Embedding: makeEmbedding(0.5, 0.5), Model: testModel},
		{Namespace: "integration-test", CollectionID: testCollectionID, Name: "dash", Subresource: "panel/2",
			ResourceVersion: 10, Content: "panel two", Metadata: json.RawMessage(`{}`),
			Embedding: makeEmbedding(0.5, 0.5), Model: testModel},
		{Namespace: "integration-test", CollectionID: testCollectionID, Name: "dash", Subresource: "panel/3",
			ResourceVersion: 10, Content: "panel three", Metadata: json.RawMessage(`{}`),
			Embedding: makeEmbedding(0.5, 0.5), Model: testModel},
	})
	require.NoError(t, err)

	stored, err := backend.GetCurrentContent(ctx, "integration-test", testModel, testCollectionID, "dash")
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

	err = backend.DeleteSubresources(ctx, "integration-test", testModel, testCollectionID, "dash", toDelete)
	require.NoError(t, err)

	results, err := backend.Search(ctx, "integration-test", testModel, testCollectionID, makeEmbedding(0.5, 0.5), 10)
	require.NoError(t, err)
	require.Len(t, results, 1)
	assert.Equal(t, "panel/1", results[0].Subresource)

	err = backend.Delete(ctx, "integration-test", testModel, testCollectionID, "dash")
	require.NoError(t, err)
}

func TestIntegrationVectorGetLatestRV(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)

	rv, err := backend.GetLatestRV(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(0), rv)

	err = backend.Upsert(ctx, []Vector{
		{Namespace: "integration-test", CollectionID: testCollectionID, Name: "rv-test", Subresource: "x",
			ResourceVersion: 42, Content: "test content", Metadata: json.RawMessage(`{}`),
			Embedding: makeEmbedding(0.5, 0.5), Model: testModel},
	})
	require.NoError(t, err)

	rv, err = backend.GetLatestRV(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(42), rv)
}

func TestIntegrationSweeperPromotesLargeTenant(t *testing.T) {
	// Seed a namespace past the threshold → sweeper attaches a dedicated
	// partition with its own HNSW.
	backend, engine, ctx := setupIntegrationTest(t)

	const ns = "integration-test-big"
	const threshold = 50
	const nRows = threshold + 10

	vectors := make([]Vector, 0, nRows)
	for i := 0; i < nRows; i++ {
		vectors = append(vectors, Vector{
			Namespace: ns, CollectionID: testCollectionID, Name: "dash", Subresource: fmt.Sprintf("panel/%d", i),
			ResourceVersion: int64(i + 1), Content: fmt.Sprintf("content %d", i),
			Metadata: json.RawMessage(`{}`), Embedding: makeEmbedding(0.5, 0.5), Model: testModel,
		})
	}
	require.NoError(t, backend.Upsert(ctx, vectors))

	// Before sweep: rows live in DEFAULT, no dedicated partition.
	partName := partitionName(testParent, ns)
	require.False(t, partitionAttached(t, engine, testParent, partName))
	require.Equal(t, nRows, countRowsIn(t, engine, testParent+"_default", ns))

	database := dbimpl.NewDB(engine.DB().DB, engine.Dialect().DriverName())
	sweeper := NewSweeper(database, threshold, 0 /* interval=0 disables Run; Sweep runs inline */)
	require.NoError(t, sweeper.Sweep(ctx))

	// After sweep: dedicated partition attached, DEFAULT is empty for ns.
	require.True(t, partitionAttached(t, engine, testParent, partName))
	require.Equal(t, 0, countRowsIn(t, engine, testParent+"_default", ns))
	require.Equal(t, nRows, countRowsIn(t, engine, partName, ns))

	// Search still returns the tenant's data (now via the partition's HNSW).
	results, err := backend.Search(ctx, ns, testModel, testCollectionID, makeEmbedding(0.5, 0.5), 5)
	require.NoError(t, err)
	assert.Len(t, results, 5)
}

func TestIntegrationSweeperSkipsSmallTenant(t *testing.T) {
	backend, engine, ctx := setupIntegrationTest(t)

	const ns = "integration-test-small"
	require.NoError(t, backend.Upsert(ctx, []Vector{
		{Namespace: ns, CollectionID: testCollectionID, Name: "dash", Subresource: "panel/1",
			ResourceVersion: 1, Content: "only row", Metadata: json.RawMessage(`{}`),
			Embedding: makeEmbedding(0.1, 0.1), Model: testModel},
	}))

	database := dbimpl.NewDB(engine.DB().DB, engine.Dialect().DriverName())
	sweeper := NewSweeper(database, 100, 0)
	require.NoError(t, sweeper.Sweep(ctx))

	partName := partitionName(testParent, ns)
	require.False(t, partitionAttached(t, engine, testParent, partName),
		"small tenant should not be promoted")
}

func partitionAttached(t *testing.T, engine *xorm.Engine, parent, partition string) bool {
	t.Helper()
	var exists bool
	err := engine.DB().QueryRowContext(context.Background(), `
		SELECT EXISTS (
			SELECT 1 FROM pg_inherits i
			JOIN pg_class c ON c.oid = i.inhrelid
			JOIN pg_class p ON p.oid = i.inhparent
			WHERE p.relname = $1 AND c.relname = $2
		)`, parent, partition).Scan(&exists)
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

// makeEmbedding creates a 1024-dim embedding with the first two values set
// and the rest zero. 1024 matches GA's halfvec(1024).
func makeEmbedding(a, b float32) []float32 {
	e := make([]float32, 1024)
	e[0] = a
	e[1] = b
	return e
}

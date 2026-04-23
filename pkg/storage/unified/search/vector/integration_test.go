package vector

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/util/xorm"
)

const testCollectionID = "dashboard.grafana.app/dashboards"

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

	// Clean up any leftover test data from prior runs. Iterate every collection
	// for the integration-test namespace and drop its vec_<id> table, plus the
	// catalog rows. Ignore errors for rows that don't exist yet.
	rows, err := engine.DB().QueryContext(ctx, `SELECT id FROM vector_collections WHERE namespace = 'integration-test'`)
	if err == nil {
		var ids []int64
		for rows.Next() {
			var id int64
			if err := rows.Scan(&id); err == nil {
				ids = append(ids, id)
			}
		}
		_ = rows.Close()
		for _, id := range ids {
			_, _ = engine.DB().ExecContext(ctx, fmt.Sprintf(`DROP TABLE IF EXISTS vec_%d`, id))
		}
		_, _ = engine.DB().ExecContext(ctx, `DELETE FROM vector_collections WHERE namespace = 'integration-test'`)
	}
	// Reset the global checkpoint so monotonic state from prior tests doesn't
	// leak into the assertions that expect a specific RV.
	_, _ = engine.DB().ExecContext(ctx, `UPDATE vector_latest_rv SET latest_rv = 0 WHERE id = 1`)

	return backend, engine, ctx
}

func TestIntegrationVectorUpsertAndSearch(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)

	vectors := []Vector{
		{
			Namespace:       "integration-test",
			CollectionID:    testCollectionID,
			Name:            "dash-1",
			Subresource:     "panel/1",
			ResourceVersion: 10,
			Folder:          "folder-a",
			Content:         "CPU usage over time for production servers",
			Metadata:        json.RawMessage(`{"datasource_uids":["prom-1"],"query_languages":["promql"]}`),
			Embedding:       makeEmbedding(0.9, 0.1),
			Model:           "test-model",
		},
		{
			Namespace:       "integration-test",
			CollectionID:    testCollectionID,
			Name:            "dash-1",
			Subresource:     "panel/2",
			ResourceVersion: 10,
			Folder:          "folder-a",
			Content:         "Memory usage alerts dashboard",
			Metadata:        json.RawMessage(`{"datasource_uids":["prom-1"],"query_languages":["promql"]}`),
			Embedding:       makeEmbedding(0.1, 0.9),
			Model:           "test-model",
		},
		{
			Namespace:       "integration-test",
			CollectionID:    testCollectionID,
			Name:            "dash-2",
			Subresource:     "panel/1",
			ResourceVersion: 20,
			Folder:          "folder-b",
			Content:         "Log volume by service",
			Metadata:        json.RawMessage(`{"datasource_uids":["loki-1"],"query_languages":["logql"]}`),
			Embedding:       makeEmbedding(0.5, 0.5),
			Model:           "test-model",
		},
	}

	// Upsert
	err := backend.Upsert(ctx, vectors)
	require.NoError(t, err)

	// Search -- query close to first vector
	results, err := backend.Search(ctx, "integration-test", "test-model", testCollectionID,
		makeEmbedding(0.85, 0.15), 10)
	require.NoError(t, err)
	require.GreaterOrEqual(t, len(results), 3)
	assert.Equal(t, "dash-1", results[0].Name)
	assert.Equal(t, "panel/1", results[0].Subresource)

	// Search with name filter
	results, err = backend.Search(ctx, "integration-test", "test-model", testCollectionID,
		makeEmbedding(0.5, 0.5), 10,
		SearchFilter{Field: "name", Values: []string{"dash-2"}})
	require.NoError(t, err)
	require.Len(t, results, 1)
	assert.Equal(t, "dash-2", results[0].Name)

	// Search with folder filter
	results, err = backend.Search(ctx, "integration-test", "test-model", testCollectionID,
		makeEmbedding(0.5, 0.5), 10,
		SearchFilter{Field: "folder", Values: []string{"folder-a"}})
	require.NoError(t, err)
	require.Len(t, results, 2)

	// Search with metadata filter
	results, err = backend.Search(ctx, "integration-test", "test-model", testCollectionID,
		makeEmbedding(0.5, 0.5), 10,
		SearchFilter{Field: "query_languages", Values: []string{"logql"}})
	require.NoError(t, err)
	require.Len(t, results, 1)
	assert.Equal(t, "dash-2", results[0].Name)

	// Cleanup
	err = backend.Delete(ctx, "integration-test", "test-model", testCollectionID, "dash-1")
	require.NoError(t, err)
	err = backend.Delete(ctx, "integration-test", "test-model", testCollectionID, "dash-2")
	require.NoError(t, err)
}

func TestIntegrationVectorGetLatestRV(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)

	// No collections yet -> 0.
	rv, err := backend.GetLatestRV(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(0), rv)

	err = backend.Upsert(ctx, []Vector{
		{
			Namespace:       "integration-test",
			CollectionID:    testCollectionID,
			Name:            "rv-test",
			Subresource:     "panel/1",
			ResourceVersion: 42,
			Content:         "test content",
			Metadata:        json.RawMessage(`{}`),
			Embedding:       makeEmbedding(0.5, 0.5),
			Model:           "test-model",
		},
	})
	require.NoError(t, err)

	rv, err = backend.GetLatestRV(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(42), rv)

	err = backend.Delete(ctx, "integration-test", "test-model", testCollectionID, "rv-test")
	require.NoError(t, err)
}

func TestIntegrationVectorDeleteSubresources(t *testing.T) {
	// Stale cleanup flow: upsert panels, caller computes the removed set via
	// GetCurrentContent, calls DeleteSubresources to remove them.
	backend, _, ctx := setupIntegrationTest(t)

	err := backend.Upsert(ctx, []Vector{
		{
			Namespace: "integration-test", CollectionID: testCollectionID, Name: "dash", Subresource: "panel/1",
			ResourceVersion: 10, Content: "panel one", Metadata: json.RawMessage(`{}`),
			Embedding: makeEmbedding(0.5, 0.5), Model: "test-model",
		},
		{
			Namespace: "integration-test", CollectionID: testCollectionID, Name: "dash", Subresource: "panel/2",
			ResourceVersion: 10, Content: "panel two", Metadata: json.RawMessage(`{}`),
			Embedding: makeEmbedding(0.5, 0.5), Model: "test-model",
		},
		{
			Namespace: "integration-test", CollectionID: testCollectionID, Name: "dash", Subresource: "panel/3",
			ResourceVersion: 10, Content: "panel three", Metadata: json.RawMessage(`{}`),
			Embedding: makeEmbedding(0.5, 0.5), Model: "test-model",
		},
	})
	require.NoError(t, err)

	// Caller now knows the dashboard only has panel/1. Diff against stored.
	stored, err := backend.GetCurrentContent(ctx, "integration-test", "test-model", testCollectionID, "dash")
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

	err = backend.DeleteSubresources(ctx, "integration-test", "test-model", testCollectionID, "dash", toDelete)
	require.NoError(t, err)

	results, err := backend.Search(ctx, "integration-test", "test-model", testCollectionID,
		makeEmbedding(0.5, 0.5), 10)
	require.NoError(t, err)
	require.Len(t, results, 1)
	assert.Equal(t, "panel/1", results[0].Subresource)

	err = backend.Delete(ctx, "integration-test", "test-model", testCollectionID, "dash")
	require.NoError(t, err)
}

func TestIntegrationVectorGetCurrentContent(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)

	got, err := backend.GetCurrentContent(ctx, "integration-test", "test-model", testCollectionID, "nope")
	require.NoError(t, err)
	require.Nil(t, got)

	err = backend.Upsert(ctx, []Vector{
		{
			Namespace: "integration-test", CollectionID: testCollectionID, Name: "dash", Subresource: "panel/1",
			ResourceVersion: 1, Content: "alpha", Metadata: json.RawMessage(`{}`),
			Embedding: makeEmbedding(0.5, 0.5), Model: "test-model",
		},
		{
			Namespace: "integration-test", CollectionID: testCollectionID, Name: "dash", Subresource: "panel/2",
			ResourceVersion: 1, Content: "beta", Metadata: json.RawMessage(`{}`),
			Embedding: makeEmbedding(0.5, 0.5), Model: "test-model",
		},
	})
	require.NoError(t, err)

	got, err = backend.GetCurrentContent(ctx, "integration-test", "test-model", testCollectionID, "dash")
	require.NoError(t, err)
	assert.Equal(t, map[string]string{"panel/1": "alpha", "panel/2": "beta"}, got)

	err = backend.Delete(ctx, "integration-test", "test-model", testCollectionID, "dash")
	require.NoError(t, err)
}

func TestIntegrationVectorUpsertOverwrite(t *testing.T) {
	backend, _, ctx := setupIntegrationTest(t)

	err := backend.Upsert(ctx, []Vector{
		{
			Namespace:       "integration-test",
			CollectionID:    testCollectionID,
			Name:            "overwrite-test",
			Subresource:     "panel/1",
			ResourceVersion: 10,
			Content:         "original content",
			Metadata:        json.RawMessage(`{}`),
			Embedding:       makeEmbedding(0.1, 0.9),
			Model:           "test-model",
		},
	})
	require.NoError(t, err)

	err = backend.Upsert(ctx, []Vector{
		{
			Namespace:       "integration-test",
			CollectionID:    testCollectionID,
			Name:            "overwrite-test",
			Subresource:     "panel/1",
			ResourceVersion: 20,
			Content:         "updated content",
			Metadata:        json.RawMessage(`{}`),
			Embedding:       makeEmbedding(0.9, 0.1),
			Model:           "test-model",
		},
	})
	require.NoError(t, err)

	results, err := backend.Search(ctx, "integration-test", "test-model", testCollectionID,
		makeEmbedding(0.9, 0.1), 10)
	require.NoError(t, err)
	require.Len(t, results, 1)
	assert.Equal(t, "updated content", results[0].Content)

	rv, err := backend.GetLatestRV(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(20), rv)

	err = backend.Delete(ctx, "integration-test", "test-model", testCollectionID, "overwrite-test")
	require.NoError(t, err)
}

// TestIntegrationVectorConcurrentUpsert exercises the advisory-lock
// provisioning path. N goroutines all write vectors to the same brand-new
// (namespace, model, collection_id) tuple; the catalog insert + CREATE TABLE
// must serialize cleanly. One collection row and one vec_<id> table must
// exist at the end.
func TestIntegrationVectorConcurrentUpsert(t *testing.T) {
	backend, engine, ctx := setupIntegrationTest(t)

	const workers = 8
	var wg sync.WaitGroup
	errs := make(chan error, workers)

	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			errs <- backend.Upsert(ctx, []Vector{
				{
					Namespace:       "integration-test",
					CollectionID:    testCollectionID,
					Name:            fmt.Sprintf("concurrent-%d", w),
					Subresource:     "panel/1",
					ResourceVersion: int64(w),
					Content:         fmt.Sprintf("worker %d", w),
					Metadata:        json.RawMessage(`{}`),
					Embedding:       makeEmbedding(0.5, 0.5),
					Model:           "concurrent-model",
				},
			})
		}(w)
	}
	wg.Wait()
	close(errs)
	for e := range errs {
		require.NoError(t, e)
	}

	// Exactly one catalog row for this tuple.
	var count int64
	err := engine.DB().QueryRowContext(ctx,
		`SELECT COUNT(*) FROM vector_collections WHERE namespace = $1 AND model = $2 AND collection_id = $3`,
		"integration-test", "concurrent-model", testCollectionID,
	).Scan(&count)
	require.NoError(t, err)
	assert.Equal(t, int64(1), count)

	// All worker rows landed in the single collection table.
	results, err := backend.Search(ctx, "integration-test", "concurrent-model", testCollectionID,
		makeEmbedding(0.5, 0.5), 100)
	require.NoError(t, err)
	assert.Equal(t, workers, len(results))

	// Cleanup
	for w := 0; w < workers; w++ {
		err := backend.Delete(ctx, "integration-test", "concurrent-model", testCollectionID, fmt.Sprintf("concurrent-%d", w))
		require.NoError(t, err)
	}
}

// makeEmbedding creates a 768-dim embedding with the first two values set and the rest zero.
func makeEmbedding(a, b float32) []float32 {
	e := make([]float32, 768)
	e[0] = a
	e[1] = b
	return e
}

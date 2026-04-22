package vector

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/util/xorm"
)

// To run these tests, start the pgvector devenv block and set the env var:
//
//	make devenv sources=pgvector
//	PGVECTOR_TEST_DB="host=localhost port=5433 dbname=grafana_vectors user=grafana password=password sslmode=disable" \
//	  go test -run TestIntegration ./pkg/storage/unified/search/vector/... -v -count=1
func setupIntegrationTest(t *testing.T) (VectorBackend, context.Context) {
	t.Helper()
	testutil.SkipIntegrationTestInShortMode(t)

	// TODO we'll need to get these working with CI
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

	// Clean up any leftover test data. Ignore error if partition doesn't exist yet.
	_, _ = engine.DB().ExecContext(ctx, `DELETE FROM resource_embeddings WHERE namespace = 'integration-test'`)

	return backend, ctx
}

func TestIntegrationVectorUpsertAndSearch(t *testing.T) {
	backend, ctx := setupIntegrationTest(t)

	vectors := []Vector{
		{
			Namespace:       "integration-test",
			Group:           "dashboard.grafana.app",
			Resource:        "dashboards",
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
			Group:           "dashboard.grafana.app",
			Resource:        "dashboards",
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
			Group:           "dashboard.grafana.app",
			Resource:        "dashboards",
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
	results, err := backend.Search(ctx, "integration-test", "test-model", "dashboard.grafana.app", "dashboards",
		makeEmbedding(0.85, 0.15), 10)
	require.NoError(t, err)
	require.GreaterOrEqual(t, len(results), 3)
	assert.Equal(t, "dash-1", results[0].Name)
	assert.Equal(t, "panel/1", results[0].Subresource)

	// Search with name filter
	results, err = backend.Search(ctx, "integration-test", "test-model", "dashboard.grafana.app", "dashboards",
		makeEmbedding(0.5, 0.5), 10,
		SearchFilter{Field: "name", Values: []string{"dash-2"}})
	require.NoError(t, err)
	require.Len(t, results, 1)
	assert.Equal(t, "dash-2", results[0].Name)

	// Search with folder filter
	results, err = backend.Search(ctx, "integration-test", "test-model", "dashboard.grafana.app", "dashboards",
		makeEmbedding(0.5, 0.5), 10,
		SearchFilter{Field: "folder", Values: []string{"folder-a"}})
	require.NoError(t, err)
	require.Len(t, results, 2)

	// Search with metadata filter
	results, err = backend.Search(ctx, "integration-test", "test-model", "dashboard.grafana.app", "dashboards",
		makeEmbedding(0.5, 0.5), 10,
		SearchFilter{Field: "query_languages", Values: []string{"logql"}})
	require.NoError(t, err)
	require.Len(t, results, 1)
	assert.Equal(t, "dash-2", results[0].Name)

	// Cleanup
	err = backend.Delete(ctx, "integration-test", "", "dashboard.grafana.app", "dashboards", "dash-1", 0)
	require.NoError(t, err)
	err = backend.Delete(ctx, "integration-test", "", "dashboard.grafana.app", "dashboards", "dash-2", 0)
	require.NoError(t, err)
}

func TestIntegrationVectorGetLatestRV(t *testing.T) {
	backend, ctx := setupIntegrationTest(t)

	// Empty namespace returns 0
	rv, err := backend.GetLatestRV(ctx, "integration-test", "test-model")
	require.NoError(t, err)
	assert.Equal(t, int64(0), rv)

	// Upsert some vectors
	err = backend.Upsert(ctx, []Vector{
		{
			Namespace:       "integration-test",
			Group:           "dashboard.grafana.app",
			Resource:        "dashboards",
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

	rv, err = backend.GetLatestRV(ctx, "integration-test", "test-model")
	require.NoError(t, err)
	assert.Equal(t, int64(42), rv)

	// Cleanup
	err = backend.Delete(ctx, "integration-test", "", "dashboard.grafana.app", "dashboards", "rv-test", 0)
	require.NoError(t, err)
}

func TestIntegrationVectorDeleteStale(t *testing.T) {
	backend, ctx := setupIntegrationTest(t)

	// Upsert two panels at RV 10
	err := backend.Upsert(ctx, []Vector{
		{
			Namespace:       "integration-test",
			Group:           "dashboard.grafana.app",
			Resource:        "dashboards",
			Name:            "stale-test",
			Subresource:     "panel/1",
			ResourceVersion: 10,
			Content:         "panel one",
			Metadata:        json.RawMessage(`{}`),
			Embedding:       makeEmbedding(0.5, 0.5),
			Model:           "test-model",
		},
		{
			Namespace:       "integration-test",
			Group:           "dashboard.grafana.app",
			Resource:        "dashboards",
			Name:            "stale-test",
			Subresource:     "panel/2",
			ResourceVersion: 10,
			Content:         "panel two",
			Metadata:        json.RawMessage(`{}`),
			Embedding:       makeEmbedding(0.5, 0.5),
			Model:           "test-model",
		},
	})
	require.NoError(t, err)

	// Update only panel/1 at RV 20 (simulates panel/2 being removed from dashboard)
	err = backend.Upsert(ctx, []Vector{
		{
			Namespace:       "integration-test",
			Group:           "dashboard.grafana.app",
			Resource:        "dashboards",
			Name:            "stale-test",
			Subresource:     "panel/1",
			ResourceVersion: 20,
			Content:         "panel one updated",
			Metadata:        json.RawMessage(`{}`),
			Embedding:       makeEmbedding(0.5, 0.5),
			Model:           "test-model",
		},
	})
	require.NoError(t, err)

	// Delete stale vectors (RV < 20) -- should remove panel/2
	err = backend.Delete(ctx, "integration-test", "test-model", "dashboard.grafana.app", "dashboards", "stale-test", 20)
	require.NoError(t, err)

	// Search should only find panel/1
	results, err := backend.Search(ctx, "integration-test", "test-model", "dashboard.grafana.app", "dashboards",
		makeEmbedding(0.5, 0.5), 10)
	require.NoError(t, err)
	require.Len(t, results, 1)
	assert.Equal(t, "panel/1", results[0].Subresource)

	// Cleanup
	err = backend.Delete(ctx, "integration-test", "", "dashboard.grafana.app", "dashboards", "stale-test", 0)
	require.NoError(t, err)
}

func TestIntegrationVectorUpsertOverwrite(t *testing.T) {
	backend, ctx := setupIntegrationTest(t)

	// Upsert a vector
	err := backend.Upsert(ctx, []Vector{
		{
			Namespace:       "integration-test",
			Group:           "dashboard.grafana.app",
			Resource:        "dashboards",
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

	// Upsert same key with new content (ON CONFLICT DO UPDATE)
	err = backend.Upsert(ctx, []Vector{
		{
			Namespace:       "integration-test",
			Group:           "dashboard.grafana.app",
			Resource:        "dashboards",
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

	// Search should return updated content
	results, err := backend.Search(ctx, "integration-test", "test-model", "dashboard.grafana.app", "dashboards",
		makeEmbedding(0.9, 0.1), 10)
	require.NoError(t, err)
	require.Len(t, results, 1)
	assert.Equal(t, "updated content", results[0].Content)

	// RV should reflect the update
	rv, err := backend.GetLatestRV(ctx, "integration-test", "test-model")
	require.NoError(t, err)
	assert.Equal(t, int64(20), rv)

	// Cleanup
	err = backend.Delete(ctx, "integration-test", "", "dashboard.grafana.app", "dashboards", "overwrite-test", 0)
	require.NoError(t, err)
}

// makeEmbedding creates a 768-dim embedding with the first two values set and the rest zero.
func makeEmbedding(a, b float32) []float32 {
	e := make([]float32, 768)
	e[0] = a
	e[1] = b
	return e
}

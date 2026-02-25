package semantic

import (
	"context"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

const defaultTestPostgresURL = "postgres://grafana:grafana@localhost:5433/semantic_search?sslmode=disable"

func testPostgresURL() string {
	if v := os.Getenv("PGVECTOR_URL"); v != "" {
		return v
	}
	return defaultTestPostgresURL
}

// TestStoreRoundTrip is an integration test against a running pgvector instance.
// Run with:
//
//	go test -run TestStoreRoundTrip -v ./pkg/storage/unified/resource/semantic/
//
// Set PGVECTOR_URL to override the default connection string.
func TestStoreRoundTrip(t *testing.T) {
	ctx := context.Background()

	store, err := NewStore(testPostgresURL(), 4)
	if err != nil {
		t.Skipf("pgvector not available: %v", err)
	}
	defer store.Close()

	// Clean up any leftover test data.
	cleanup := func() {
		store.DeleteEmbedding(ctx, "default", "dashboard.grafana.app", "dashboards", "test-dash-1")
		store.DeleteEmbedding(ctx, "default", "dashboard.grafana.app", "dashboards", "test-dash-2")
		store.DeleteEmbedding(ctx, "default", "alerting.grafana.app", "alertrules", "test-alert-1")
	}
	cleanup()
	t.Cleanup(cleanup)

	// Use small 4-dim vectors for testing.
	records := []EmbeddingRecord{
		{
			Namespace:   "default",
			Group:       "dashboard.grafana.app",
			Resource:    "dashboards",
			Name:        "test-dash-1",
			Title:       "CPU Usage Dashboard",
			Description: "Shows CPU metrics",
			Embedding:   []float32{1, 0, 0, 0},
		},
		{
			Namespace:   "default",
			Group:       "dashboard.grafana.app",
			Resource:    "dashboards",
			Name:        "test-dash-2",
			Title:       "Memory Dashboard",
			Description: "Shows memory metrics",
			Embedding:   []float32{0.9, 0.1, 0, 0},
		},
		{
			Namespace:   "default",
			Group:       "alerting.grafana.app",
			Resource:    "alertrules",
			Name:        "test-alert-1",
			Title:       "High CPU Alert",
			Description: "Alerts on CPU spikes",
			Embedding:   []float32{0, 0, 1, 0},
		},
	}

	t.Run("upsert", func(t *testing.T) {
		err := store.UpsertEmbeddings(ctx, records)
		require.NoError(t, err)
	})

	t.Run("search all", func(t *testing.T) {
		results, err := store.Search(ctx, []float32{1, 0, 0, 0}, "default", nil, 10, 0)
		require.NoError(t, err)
		require.GreaterOrEqual(t, len(results), 2)

		// The exact [1,0,0,0] vector should be the top result.
		require.Equal(t, "test-dash-1", results[0].Name)
		require.Equal(t, "CPU Usage Dashboard", results[0].Title)
		require.InDelta(t, 1.0, results[0].Score, 0.01)

		// The [0.9,0.1,0,0] vector should be second.
		require.Equal(t, "test-dash-2", results[1].Name)
	})

	t.Run("search with kind filter", func(t *testing.T) {
		results, err := store.Search(ctx, []float32{1, 0, 0, 0}, "default", []string{"alerting.grafana.app/alertrules"}, 10, 0)
		require.NoError(t, err)
		require.Len(t, results, 1)
		require.Equal(t, "test-alert-1", results[0].Name)
	})

	t.Run("search with min score", func(t *testing.T) {
		results, err := store.Search(ctx, []float32{1, 0, 0, 0}, "default", nil, 10, 0.999)
		require.NoError(t, err)
		require.Len(t, results, 1)
		require.Equal(t, "test-dash-1", results[0].Name)
	})

	t.Run("upsert updates existing", func(t *testing.T) {
		updated := []EmbeddingRecord{{
			Namespace:   "default",
			Group:       "dashboard.grafana.app",
			Resource:    "dashboards",
			Name:        "test-dash-1",
			Title:       "Updated CPU Dashboard",
			Description: "Updated description",
			Embedding:   []float32{0, 1, 0, 0},
		}}
		err := store.UpsertEmbeddings(ctx, updated)
		require.NoError(t, err)

		// Now searching for [1,0,0,0] should return test-dash-2 first.
		results, err := store.Search(ctx, []float32{1, 0, 0, 0}, "default", nil, 10, 0)
		require.NoError(t, err)
		require.Equal(t, "test-dash-2", results[0].Name)
	})

	t.Run("delete", func(t *testing.T) {
		err := store.DeleteEmbedding(ctx, "default", "dashboard.grafana.app", "dashboards", "test-dash-1")
		require.NoError(t, err)

		results, err := store.Search(ctx, []float32{0, 1, 0, 0}, "default", nil, 10, 0)
		require.NoError(t, err)
		for _, r := range results {
			require.NotEqual(t, "test-dash-1", r.Name, "deleted embedding should not appear")
		}
	})
}

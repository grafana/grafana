//go:build integration

package vertex

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Run with:
//
//	VERTEX_PROJECT_ID=$(gcloud config get-value project) \
//	  go test -tags=integration -run TestIntegration_VertexRerank \
//	    ./pkg/storage/unified/search/rerank/vertex/ -v
//
// Defaults: location=global, model=semantic-ranker-fast-004. The project
// needs discoveryengine.googleapis.com enabled and ADC credentials with
// roles/discoveryengine.viewer.
func TestIntegration_VertexRerank_ScoresRealDocuments(t *testing.T) {
	projectID := os.Getenv("VERTEX_PROJECT_ID")
	if projectID == "" {
		t.Skip("VERTEX_PROJECT_ID not set; skipping integration test")
	}

	location := envOr("VERTEX_LOCATION", "global")
	model := envOr("VERTEX_RERANK_MODEL", "semantic-ranker-fast-004")

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	client, err := NewClient(ctx, projectID, location)
	require.NoError(t, err)

	r := NewReranker(client, model)
	query := "dashboard showing API request latency percentiles"
	texts := []string{
		"Production API latency dashboard with p99 and p95 histogram quantiles",
		"Weekly grocery shopping list: eggs, milk, bread",
		"Kubernetes pod memory usage by namespace",
	}
	scores, err := r.Score(ctx, query, texts)
	require.NoError(t, err)
	require.Len(t, scores, len(texts))

	for i, s := range scores {
		assert.GreaterOrEqual(t, s, 0.0, "score %d negative", i)
		assert.LessOrEqual(t, s, 1.0, "score %d above 1", i)
	}
	// A cross-encoder must rank the on-topic document above the off-topic
	// ones; if this fails, the record-id mapping is likely scrambled.
	assert.Greater(t, scores[0], scores[1], "latency dashboard should outscore grocery list")
	assert.Greater(t, scores[0], scores[2], "latency dashboard should outscore k8s memory doc")

	t.Logf("model=%s scores=%v", model, scores)
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

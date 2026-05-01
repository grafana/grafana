//go:build integration

package vertex

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
)

// Run with:
//
//	VERTEX_PROJECT_ID=$(gcloud config get-value project) \
//	  go test -tags=integration -run TestIntegration_Vertex \
//	    ./pkg/storage/unified/search/embed/embedder/vertex/ -v
//
// Defaults: location=us-central1, model=gemini-embedding-001, dim=768.
//
// 768 is one of the recommended output dimensionalities for
// gemini-embedding-001 (768 / 1536 / 3072). Our pgvector column is
// halfvec(1024); the storage layer zero-pads 768 -> 1024 on upsert (the
// trailing zeros are inert under cosine similarity).
func TestIntegration_Vertex_EmbedRealTexts(t *testing.T) {
	projectID := os.Getenv("VERTEX_PROJECT_ID")
	if projectID == "" {
		t.Skip("VERTEX_PROJECT_ID not set; skipping integration test")
	}

	location := envOr("VERTEX_LOCATION", "us-central1")
	model := envOr("VERTEX_MODEL", "gemini-embedding-001")
	dim := 768

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	client, err := NewClient(ctx, projectID, location)
	require.NoError(t, err)

	e := NewDenseEmbedder(client, model, dim)
	out, err := e.EmbedText(ctx, embedder.EmbedTextInput{
		Texts: []string{
			"Production API latency dashboard with p99 metrics",
			"Kubernetes pod resource usage by namespace",
			"PostgreSQL connection pool saturation",
		},
		Normalize: true,
		Task:      embedder.TaskRetrievalDocument,
	})
	require.NoError(t, err)
	require.Len(t, out.Embeddings, 3)

	for i, emb := range out.Embeddings {
		assert.Len(t, emb.Dense, dim, "embedding %d wrong dim", i)
		// Non-zero check: at least one element should differ from 0.
		var nonZero bool
		for _, v := range emb.Dense {
			if v != 0 {
				nonZero = true
				break
			}
		}
		assert.True(t, nonZero, "embedding %d is all zeros", i)

		// L2 norm should be ~1 since we asked for normalization.
		var sum float64
		for _, v := range emb.Dense {
			sum += float64(v) * float64(v)
		}
		assert.InDelta(t, 1.0, sum, 0.01, "embedding %d not unit-norm", i)
	}

	t.Logf("model=%s dim=%d first 5 of vec[0]: %v", model, dim, out.Embeddings[0].Dense[:5])
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

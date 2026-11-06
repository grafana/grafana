//go:build integration

package vertex

import (
	"context"
	"os"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
)

type heldVertexResponse struct {
	Client
	calls     atomic.Int32
	holdFirst bool
	firstDone chan struct{}
}

func (c *heldVertexResponse) PredictEmbeddings(ctx context.Context, model string, texts []string, dim int, task string) (EmbeddingResult, error) {
	n := c.calls.Add(1)
	result, err := c.Client.PredictEmbeddings(ctx, model, texts, dim, task)
	if n == 1 && c.holdFirst && err == nil {
		<-ctx.Done()
		close(c.firstDone)
		return EmbeddingResult{}, ctx.Err()
	}
	return result, err
}

func TestIntegration_QueryHedge_Vertex(t *testing.T) {
	project := os.Getenv("VERTEX_PROJECT_ID")
	if project == "" {
		t.Skip("VERTEX_PROJECT_ID not set; live query hedge unverified")
	}
	ctx, cancel := context.WithTimeout(t.Context(), 90*time.Second)
	defer cancel()
	client, err := NewClient(ctx, project, envOr("VERTEX_LOCATION", "us-central1"))
	require.NoError(t, err)
	if closer, ok := client.(interface{ Close() error }); ok {
		t.Cleanup(func() { _ = closer.Close() })
	}
	hedger, err := embedder.NewQueryHedger(time.Second, 1, nil)
	require.NoError(t, err)
	model := envOr("VERTEX_MODEL", "gemini-embedding-001")
	normal := NewDenseEmbedder(client, model, 768, 50, hedger)
	query := embedder.EmbedTextInput{Texts: []string{"Production API latency"}, Task: embedder.TaskRetrievalQuery}
	out, err := normal.EmbedText(ctx, query)
	require.NoError(t, err)
	require.NotEmpty(t, out.Embeddings[0].Dense)

	held := &heldVertexResponse{Client: client, holdFirst: true, firstDone: make(chan struct{})}
	out, err = NewDenseEmbedder(held, model, 768, 50, hedger).EmbedText(ctx, query)
	require.NoError(t, err)
	require.NotEmpty(t, out.Embeddings[0].Dense)
	require.Equal(t, int32(2), held.calls.Load())
	select {
	case <-held.firstDone:
	case <-ctx.Done():
		t.Fatal("held original did not observe cancellation")
	}

	document := &heldVertexResponse{Client: client}
	_, err = NewDenseEmbedder(document, model, 768, 50, hedger).EmbedText(ctx, embedder.EmbedTextInput{Texts: []string{"Production API latency dashboard"}, Task: embedder.TaskRetrievalDocument})
	require.NoError(t, err)
	require.Equal(t, int32(1), document.calls.Load())
}

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

	e := NewDenseEmbedder(client, model, dim, 50)
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

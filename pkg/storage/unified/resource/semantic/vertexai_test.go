package semantic

import (
	"context"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

// TestVertexAIProviderSmoke is a manual integration test that verifies Vertex AI connectivity.
// Run with:
//
//	GOOGLE_CLOUD_PROJECT=<your-project> \
//	GOOGLE_CLOUD_LOCATION=us-central1 \
//	GOOGLE_GENAI_USE_VERTEXAI=True \
//	go test -run TestVertexAIProviderSmoke -v ./pkg/storage/unified/resource/semantic/
func TestVertexAIProviderSmoke(t *testing.T) {
	if os.Getenv("GOOGLE_CLOUD_PROJECT") == "" {
		t.Skip("GOOGLE_CLOUD_PROJECT not set, skipping Vertex AI smoke test")
	}

	ctx := context.Background()

	provider, err := NewVertexAIProvider(ctx, VertexAIConfig{})
	require.NoError(t, err)
	require.Equal(t, 768, provider.Dimensions())

	vectors, err := provider.EmbedTexts(ctx, []string{
		"Grafana dashboard for CPU usage",
		"Alert rule for memory exhaustion",
	})
	require.NoError(t, err)
	require.Len(t, vectors, 2)

	for i, v := range vectors {
		require.Len(t, v, 768, "vector %d should have 768 dimensions", i)
	}

	t.Logf("First 5 values of vector 0: %v", vectors[0][:5])
	t.Logf("First 5 values of vector 1: %v", vectors[1][:5])
}

//go:build integration

package bedrock

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
)

// Run with:
//
//	AWS_REGION=us-east-1 \
//	AWS_PROFILE=<your-profile> \
//	  go test -tags=integration -run TestIntegration_Bedrock \
//	    ./pkg/storage/unified/search/embed/embedder/bedrock/ -v
//
// Defaults: model=cohere.embed-v4:0, dim=1024.
//
// Matches what grafana-assistant-app runs in production — multilingual,
// current generation. embed-v4 supports output_dimension (256/512/1024/1536);
// 1024 lands directly in our halfvec(1024) column without padding.
//
// Prerequisites:
//   - The model must be enabled for your AWS account in the target region.
//     AWS console → Bedrock → Model access → Manage model access → enable
//     "Cohere — Embed English v3".
//   - Standard AWS credential chain (env vars, ~/.aws/credentials, IAM role).
func TestIntegration_Bedrock_EmbedRealTexts(t *testing.T) {
	region := os.Getenv("AWS_REGION")
	if region == "" {
		t.Skip("AWS_REGION not set; skipping integration test")
	}

	model := envOr("BEDROCK_MODEL", "cohere.embed-v4:0")
	dim := 1024
	expectedDim := dim

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(region))
	require.NoError(t, err)

	rt := bedrockruntime.NewFromConfig(cfg)
	client := NewClient(rt)
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
		assert.Len(t, emb.Dense, expectedDim, "embedding %d wrong dim", i)
		var nonZero bool
		for _, v := range emb.Dense {
			if v != 0 {
				nonZero = true
				break
			}
		}
		assert.True(t, nonZero, "embedding %d is all zeros", i)

		var sum float64
		for _, v := range emb.Dense {
			sum += float64(v) * float64(v)
		}
		assert.InDelta(t, 1.0, sum, 0.01, "embedding %d not unit-norm", i)
	}

	t.Logf("model=%s dim=%d first 5 of vec[0]: %v", model, expectedDim, out.Embeddings[0].Dense[:5])
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

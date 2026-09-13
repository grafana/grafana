//go:build integration

package bedrock

import (
	"context"
	"os"
	"testing"
	"time"

	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Run with:
//
//	AWS_REGION=us-east-1 \
//	  go test -tags=integration -run TestIntegration_BedrockRerank \
//	    ./pkg/storage/unified/search/rerank/bedrock/ -v
//
// Default model: cohere.rerank-v3-5:0 — only available in us-east-1,
// us-west-2, eu-central-1, ca-central-1, ap-northeast-1. Credentials come
// from the AWS default chain and need bedrock:InvokeModel.
func TestIntegration_BedrockRerank_ScoresRealDocuments(t *testing.T) {
	region := os.Getenv("AWS_REGION")
	if region == "" {
		t.Skip("AWS_REGION not set; skipping integration test")
	}

	model := envOr("BEDROCK_RERANK_MODEL", "cohere.rerank-v3-5:0")

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	awsCfg, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(region))
	require.NoError(t, err)

	r := NewReranker(NewClient(bedrockruntime.NewFromConfig(awsCfg)), model)
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
	// ones; if this fails, the index mapping is likely scrambled.
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

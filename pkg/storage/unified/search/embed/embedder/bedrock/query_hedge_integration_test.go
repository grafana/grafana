//go:build integration

package bedrock

import (
	"context"
	"os"
	"sync/atomic"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
)

type heldBedrockResponse struct {
	Client
	calls     atomic.Int32
	holdFirst bool
	firstDone chan struct{}
}

func (c *heldBedrockResponse) EmbedTexts(ctx context.Context, model string, texts []string, inputType string, dim int) (EmbedResult, error) {
	n := c.calls.Add(1)
	result, err := c.Client.EmbedTexts(ctx, model, texts, inputType, dim)
	if n == 1 && c.holdFirst && err == nil {
		<-ctx.Done()
		close(c.firstDone)
		return EmbedResult{}, ctx.Err()
	}
	return result, err
}

func (c *heldBedrockResponse) EmbedTextsHedge(ctx context.Context, model string, texts []string, inputType string, dim int) (EmbedResult, error) {
	c.calls.Add(1)
	return c.Client.(interface {
		EmbedTextsHedge(context.Context, string, []string, string, int) (EmbedResult, error)
	}).EmbedTextsHedge(ctx, model, texts, inputType, dim)
}

func TestIntegration_QueryHedge_Bedrock(t *testing.T) {
	region := os.Getenv("AWS_REGION")
	if region == "" {
		t.Skip("AWS_REGION not set; live query hedge unverified")
	}
	ctx, cancel := context.WithTimeout(t.Context(), 180*time.Second)
	defer cancel()
	config, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithRegion(region),
		awsconfig.WithRetryMode(aws.RetryModeAdaptive),
		awsconfig.WithRetryMaxAttempts(5),
	)
	require.NoError(t, err)
	client := NewClient(bedrockruntime.NewFromConfig(config))
	hedger, err := embedder.NewQueryHedger(time.Second, 1, nil)
	require.NoError(t, err)
	model := os.Getenv("BEDROCK_MODEL")
	if model == "" {
		model = "cohere.embed-v4:0"
	}
	query := embedder.EmbedTextInput{Texts: []string{"Production API latency"}, Task: embedder.TaskRetrievalQuery}
	out, err := NewDenseEmbedder(client, model, 1024, 50, hedger).EmbedText(ctx, query)
	require.NoError(t, err)
	require.NotEmpty(t, out.Embeddings[0].Dense)

	held := &heldBedrockResponse{Client: client, holdFirst: true, firstDone: make(chan struct{})}
	out, err = NewDenseEmbedder(held, model, 1024, 50, hedger).EmbedText(ctx, query)
	require.NoError(t, err)
	require.NotEmpty(t, out.Embeddings[0].Dense)
	require.Equal(t, int32(2), held.calls.Load())
	select {
	case <-held.firstDone:
	case <-ctx.Done():
		t.Fatal("held original did not observe cancellation")
	}

	document := &heldBedrockResponse{Client: client}
	_, err = NewDenseEmbedder(document, model, 1024, 50, hedger).EmbedText(ctx, embedder.EmbedTextInput{Texts: []string{"Production API latency dashboard"}, Task: embedder.TaskRetrievalDocument})
	require.NoError(t, err)
	require.Equal(t, int32(1), document.calls.Load())
}

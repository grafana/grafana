package provider

import (
	"context"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder/azure"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder/bedrock"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder/vertex"
)

type blockingVertexClient struct {
	calls        atomic.Int32
	extraCalls   *atomic.Int32
	releaseExtra <-chan struct{}
}

func (c *blockingVertexClient) PredictEmbeddings(ctx context.Context, _ string, _ []string, _ int, _ string) (vertex.EmbeddingResult, error) {
	if c.calls.Add(1) == 1 {
		<-ctx.Done()
		return vertex.EmbeddingResult{}, ctx.Err()
	}
	c.extraCalls.Add(1)
	<-c.releaseExtra
	return vertex.EmbeddingResult{}, ctx.Err()
}

type blockingBedrockClient struct {
	extraCalls   *atomic.Int32
	releaseExtra <-chan struct{}
}

func (*blockingBedrockClient) EmbedTexts(ctx context.Context, _ string, _ []string, _ string, _ int) (bedrock.EmbedResult, error) {
	<-ctx.Done()
	return bedrock.EmbedResult{}, ctx.Err()
}

func (c *blockingBedrockClient) EmbedTextsHedge(ctx context.Context, _ string, _ []string, _ string, _ int) (bedrock.EmbedResult, error) {
	c.extraCalls.Add(1)
	<-c.releaseExtra
	return bedrock.EmbedResult{}, ctx.Err()
}

type blockingAzureClient struct {
	extraCalls   *atomic.Int32
	releaseExtra <-chan struct{}
}

func (*blockingAzureClient) EmbedTexts(ctx context.Context, _ []string, _ int) (azure.EmbedResult, error) {
	<-ctx.Done()
	return azure.EmbedResult{}, ctx.Err()
}

func (c *blockingAzureClient) EmbedTextsHedge(ctx context.Context, _ []string, _ int) (azure.EmbedResult, error) {
	c.extraCalls.Add(1)
	<-c.releaseExtra
	return azure.EmbedResult{}, ctx.Err()
}

func TestQueryHedgeLimitIsSharedAcrossProviderAdapters(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		hegder, err := embedder.NewQueryHedger(time.Second, 4, nil)
		require.NoError(t, err)
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		releaseExtra := make(chan struct{})
		var extraCalls atomic.Int32
		adapters := []embedder.TextEmbedder{
			vertex.NewDenseEmbedder(&blockingVertexClient{extraCalls: &extraCalls, releaseExtra: releaseExtra}, "m", 1, 1, hegder),
			vertex.NewDenseEmbedder(&blockingVertexClient{extraCalls: &extraCalls, releaseExtra: releaseExtra}, "m", 1, 1, hegder),
			bedrock.NewDenseEmbedder(&blockingBedrockClient{extraCalls: &extraCalls, releaseExtra: releaseExtra}, "m", 1, 1, hegder),
			azure.NewDenseEmbedder(&blockingAzureClient{extraCalls: &extraCalls, releaseExtra: releaseExtra}, 1, 1, hegder),
			azure.NewDenseEmbedder(&blockingAzureClient{extraCalls: &extraCalls, releaseExtra: releaseExtra}, 1, 1, hegder),
		}
		results := make(chan error, len(adapters))
		for _, adapter := range adapters {
			go func() {
				_, err := adapter.EmbedText(ctx, embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery})
				results <- err
			}()
		}
		<-time.After(1500 * time.Millisecond)
		synctest.Wait()
		require.Equal(t, int32(4), extraCalls.Load())
		cancel()
		close(releaseExtra)
		for range adapters {
			require.ErrorIs(t, <-results, context.Canceled)
		}
	})
}

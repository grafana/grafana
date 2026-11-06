package vertex

import (
	"context"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
)

type controlledQueryClient struct {
	firstStarted chan struct{}
	firstDone    chan struct{}
	calls        atomic.Int32
}

type malformedVertexClient struct {
	originalDone chan struct{}
	calls        atomic.Int32
}

type timeoutVertexClient struct{ calls atomic.Int32 }

func (c *timeoutVertexClient) PredictEmbeddings(ctx context.Context, _ string, _ []string, _ int, _ string) (EmbeddingResult, error) {
	c.calls.Add(1)
	<-ctx.Done()
	return EmbeddingResult{}, ctx.Err()
}

func TestDenseEmbedderEnabledHedgePreservesCallTimeout(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		heder, err := embedder.NewQueryHedger(time.Second, 1, nil)
		require.NoError(t, err)
		client := &timeoutVertexClient{}
		_, err = NewDenseEmbedder(client, "model", 1, 1, heder).EmbedText(context.Background(), embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery})
		require.ErrorIs(t, err, ErrCallTimeout)
		require.Equal(t, int32(2), client.calls.Load())
	})
}

func (c *malformedVertexClient) PredictEmbeddings(ctx context.Context, _ string, _ []string, _ int, _ string) (EmbeddingResult, error) {
	if c.calls.Add(1) == 1 {
		<-ctx.Done()
		defer close(c.originalDone)
		return EmbeddingResult{InputTokens: 11}, nil
	}
	return EmbeddingResult{Vectors: [][]float32{{2}}, InputTokens: 7}, nil
}

type vertexUsageObserver struct{ tokens chan int }

func (*vertexUsageObserver) AttemptStarted(string, embedder.QueryAttemptKind) {}
func (o *vertexUsageObserver) AttemptFinished(_ string, _ embedder.QueryAttemptKind, _ embedder.QueryAttemptOutcome, tokens int) {
	o.tokens <- tokens
}
func (*vertexUsageObserver) HedgeSkipped(string)                      {}
func (*vertexUsageObserver) Winner(string, embedder.QueryAttemptKind) {}
func (*vertexUsageObserver) ExtraInFlight(string, int)                {}

func TestDenseEmbedderLateMalformedOriginalReportsTokens(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		observer := &vertexUsageObserver{tokens: make(chan int, 2)}
		hedger, err := embedder.NewQueryHedger(time.Second, 1, observer)
		require.NoError(t, err)
		client := &malformedVertexClient{originalDone: make(chan struct{})}
		out, err := NewDenseEmbedder(client, "model", 1, 1, hedger).EmbedText(context.Background(), embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery})
		require.NoError(t, err)
		require.Equal(t, 7, out.InputTokens)
		<-client.originalDone
		synctest.Wait()
		require.Equal(t, 18, <-observer.tokens+<-observer.tokens)
	})
}

func (c *controlledQueryClient) PredictEmbeddings(ctx context.Context, _ string, texts []string, _ int, task string) (EmbeddingResult, error) {
	if task != "RETRIEVAL_QUERY" || len(texts) != 1 || texts[0] != "query" {
		return EmbeddingResult{}, context.Canceled
	}
	if c.calls.Add(1) == 1 {
		close(c.firstStarted)
		<-ctx.Done()
		close(c.firstDone)
		return EmbeddingResult{}, ctx.Err()
	}
	return EmbeddingResult{Vectors: [][]float32{{2}}, InputTokens: 7}, nil
}

func TestDenseEmbedderQueryHedgeReturnsExtraVector(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		hedger, err := embedder.NewQueryHedger(time.Second, 1, nil)
		require.NoError(t, err)
		client := &controlledQueryClient{firstStarted: make(chan struct{}), firstDone: make(chan struct{})}
		e := NewDenseEmbedder(client, "model", 1, 1, hedger)
		out, err := e.EmbedText(context.Background(), embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery})
		require.NoError(t, err)
		require.Equal(t, float32(2), out.Embeddings[0].Dense[0])
		require.Equal(t, 7, out.InputTokens)
		<-client.firstDone
		require.Equal(t, int32(2), client.calls.Load())
	})
}

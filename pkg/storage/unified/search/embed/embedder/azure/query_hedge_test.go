package azure

import (
	"context"
	"io"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
)

func TestDenseEmbedderSDKHedgeReturnsWhileOriginalIsInRetryDelay(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var dispatched atomic.Int32
		var originalRequests, extraRequests atomic.Int32
		deadlines := make(chan time.Time, 2)
		transport := azureHTTPFunc(func(req *http.Request) (*http.Response, error) {
			if err := req.Context().Err(); err != nil {
				return nil, err
			}
			deadline, _ := req.Context().Deadline()
			deadlines <- deadline
			if dispatched.Add(1) == 1 {
				return &http.Response{
					StatusCode: http.StatusTooManyRequests,
					Header:     http.Header{"Content-Type": {"application/json"}, retryAfterMsHeader: {"59000"}},
					Body:       io.NopCloser(strings.NewReader(`{"error":{"message":"quota exhausted","type":"rate_limit_error","code":"429"}}`)),
					Request:    req,
				}, nil
			}
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": {"application/json"}},
				Body:       io.NopCloser(strings.NewReader(`{"data":[{"index":0,"embedding":[2]}],"usage":{"prompt_tokens":7}}`)),
				Request:    req,
			}, nil
		})
		observedTransport := &embedder.ObservedHTTPClient{Client: transport, Observer: func(kind embedder.QueryAttemptKind) {
			switch kind {
			case embedder.QueryAttemptOriginal:
				originalRequests.Add(1)
			case embedder.QueryAttemptExtra:
				extraRequests.Add(1)
			}
		}}
		client := &restClient{client: openai.NewClient(option.WithBaseURL("https://example.test"), option.WithAPIKey("test"), option.WithHTTPClient(observedTransport)), deployment: "dep"}
		observer := &azureUsageObserver{tokens: make(chan int, 2), finished: make(chan embedder.QueryAttemptKind, 2)}
		hedger, err := embedder.NewQueryHedger(time.Second, 1, observer)
		require.NoError(t, err)
		ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
		defer cancel()
		wantDeadline, _ := ctx.Deadline()
		started := time.Now()
		out, err := NewDenseEmbedder(client, 1, 1, hedger).EmbedText(ctx, embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery})
		require.NoError(t, err)
		require.Equal(t, float32(2), out.Embeddings[0].Dense[0])
		require.Less(t, time.Since(started), 2*time.Second)
		require.Equal(t, int32(2), dispatched.Load())
		require.Equal(t, int32(1), originalRequests.Load())
		require.Equal(t, int32(1), extraRequests.Load())
		require.Equal(t, wantDeadline, <-deadlines)
		require.Equal(t, wantDeadline, <-deadlines)
		<-observer.finished
		<-observer.finished
		synctest.Wait()
		require.Equal(t, int32(2), dispatched.Load(), "canceled original must not send another request after its SDK delay")
	})
}

func TestAzureObservedSDKDoesNotCountDocumentOrMultiTextAsQuery(t *testing.T) {
	var queryRequests atomic.Int32
	transport := &embedder.ObservedHTTPClient{Client: azureHTTPFunc(func(req *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": {"application/json"}},
			Body: io.NopCloser(strings.NewReader(`{"data":[{"index":0,"embedding":[2]}],"usage":{"prompt_tokens":7}}`)), Request: req}, nil
	}), Observer: func(embedder.QueryAttemptKind) { queryRequests.Add(1) }}
	client := &restClient{client: openai.NewClient(option.WithBaseURL("https://example.test"), option.WithAPIKey("test"), option.WithHTTPClient(transport)), deployment: "dep"}
	hedger, err := embedder.NewQueryHedger(time.Second, 1, nil)
	require.NoError(t, err)
	adapter := NewDenseEmbedder(client, 1, 2, hedger)
	_, err = adapter.EmbedText(t.Context(), embedder.EmbedTextInput{Texts: []string{"document"}, Task: embedder.TaskRetrievalDocument})
	require.NoError(t, err)
	_, err = adapter.EmbedText(t.Context(), embedder.EmbedTextInput{Texts: []string{"one", "two"}, Task: embedder.TaskRetrievalQuery})
	require.Error(t, err)
	require.Zero(t, queryRequests.Load())
}

type controlledAzureClient struct {
	originalStarted chan struct{}
	originalDone    chan struct{}
	extraCalls      int
}

type documentAzureClient struct {
	extraCalls int
}

type malformedAzureClient struct{ originalDone chan struct{} }

type timeoutAzureClient struct{ calls atomic.Int32 }

func (c *timeoutAzureClient) EmbedTexts(ctx context.Context, _ []string, _ int) (EmbedResult, error) {
	c.calls.Add(1)
	<-ctx.Done()
	return EmbedResult{}, ctx.Err()
}
func (c *timeoutAzureClient) EmbedTextsHedge(ctx context.Context, _ []string, _ int) (EmbedResult, error) {
	return c.EmbedTexts(ctx, nil, 0)
}

func TestDenseEmbedderEnabledHedgePreservesCallTimeout(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		heder, err := embedder.NewQueryHedger(time.Second, 1, nil)
		require.NoError(t, err)
		client := &timeoutAzureClient{}
		_, err = NewDenseEmbedder(client, 1, 1, heder).EmbedText(context.Background(), embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery})
		require.ErrorIs(t, err, ErrCallTimeout)
		require.Equal(t, int32(2), client.calls.Load())
	})
}

func (c *malformedAzureClient) EmbedTexts(ctx context.Context, _ []string, _ int) (EmbedResult, error) {
	<-ctx.Done()
	defer close(c.originalDone)
	return EmbedResult{Vectors: [][]float32{}, InputTokens: 11}, nil
}

func (c *malformedAzureClient) EmbedTextsHedge(context.Context, []string, int) (EmbedResult, error) {
	return EmbedResult{Vectors: [][]float32{{2}}, InputTokens: 7}, nil
}

type azureUsageObserver struct {
	tokens   chan int
	finished chan embedder.QueryAttemptKind
}

func (*azureUsageObserver) AttemptStarted(string, embedder.QueryAttemptKind) {}
func (o *azureUsageObserver) AttemptFinished(_ string, kind embedder.QueryAttemptKind, _ embedder.QueryAttemptOutcome, tokens int) {
	o.tokens <- tokens
	if o.finished != nil {
		o.finished <- kind
	}
}
func (*azureUsageObserver) HedgeSkipped(string)                      {}
func (*azureUsageObserver) Winner(string, embedder.QueryAttemptKind) {}
func (*azureUsageObserver) ExtraInFlight(string, int)                {}

func TestDenseEmbedderLateMalformedOriginalReportsTokens(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		observer := &azureUsageObserver{tokens: make(chan int, 2)}
		hedger, err := embedder.NewQueryHedger(time.Second, 1, observer)
		require.NoError(t, err)
		client := &malformedAzureClient{originalDone: make(chan struct{})}
		out, err := NewDenseEmbedder(client, 1, 1, hedger).EmbedText(context.Background(), embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery})
		require.NoError(t, err)
		require.Equal(t, 7, out.InputTokens)
		<-client.originalDone
		synctest.Wait()
		require.Equal(t, 18, <-observer.tokens+<-observer.tokens)
	})
}

func (c *documentAzureClient) EmbedTexts(context.Context, []string, int) (EmbedResult, error) {
	<-time.After(2 * time.Second)
	return EmbedResult{Vectors: [][]float32{{3, 4}}, InputTokens: 3}, nil
}

func (c *documentAzureClient) EmbedTextsHedge(context.Context, []string, int) (EmbedResult, error) {
	c.extraCalls++
	return EmbedResult{}, context.Canceled
}

func (c *controlledAzureClient) EmbedTexts(ctx context.Context, _ []string, _ int) (EmbedResult, error) {
	close(c.originalStarted)
	<-ctx.Done()
	close(c.originalDone)
	return EmbedResult{}, ctx.Err()
}

func (c *controlledAzureClient) EmbedTextsHedge(_ context.Context, texts []string, _ int) (EmbedResult, error) {
	c.extraCalls++
	return EmbedResult{Vectors: [][]float32{{float32(len(texts[0]))}}, InputTokens: 8}, nil
}

func TestDenseEmbedderQueryHedgeReturnsExtraVector(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		hedger, err := embedder.NewQueryHedger(time.Second, 1, nil)
		require.NoError(t, err)
		client := &controlledAzureClient{originalStarted: make(chan struct{}), originalDone: make(chan struct{})}
		e := NewDenseEmbedder(client, 1, 1, hedger)
		out, err := e.EmbedText(context.Background(), embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery})
		require.NoError(t, err)
		require.Equal(t, float32(5), out.Embeddings[0].Dense[0])
		require.Equal(t, 8, out.InputTokens)
		<-client.originalDone
		require.Equal(t, 1, client.extraCalls)
	})
}

func TestDenseEmbedderDocumentNeverHedgesAndNormalizesSelectedVector(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		hedger, err := embedder.NewQueryHedger(time.Second, 1, nil)
		require.NoError(t, err)
		client := &documentAzureClient{}
		e := NewDenseEmbedder(client, 2, 1, hedger)
		out, err := e.EmbedText(context.Background(), embedder.EmbedTextInput{Texts: []string{"document"}, Task: embedder.TaskRetrievalDocument, Normalize: true})
		require.NoError(t, err)
		require.Equal(t, []float32{0.6, 0.8}, out.Embeddings[0].Dense)
		require.Zero(t, client.extraCalls)
	})
}

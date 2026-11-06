package bedrock

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/retry"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
)

type controlledBedrockClient struct {
	originalDone chan struct{}
	extraCalls   int
}

type bedrockHTTPFunc func(*http.Request) (*http.Response, error)

func (f bedrockHTTPFunc) Do(req *http.Request) (*http.Response, error) { return f(req) }

type bedrockStartObserver struct {
	started  chan embedder.QueryAttemptKind
	finished chan embedder.QueryAttemptOutcome
}

func (o *bedrockStartObserver) AttemptStarted(_ string, kind embedder.QueryAttemptKind) {
	o.started <- kind
}
func (o *bedrockStartObserver) AttemptFinished(_ string, _ embedder.QueryAttemptKind, outcome embedder.QueryAttemptOutcome, _ int) {
	o.finished <- outcome
}
func (*bedrockStartObserver) HedgeSkipped(string)                      {}
func (*bedrockStartObserver) Winner(string, embedder.QueryAttemptKind) {}
func (*bedrockStartObserver) ExtraInFlight(string, int)                {}

func TestBedrockRealSDKHedgeWaitsOnActivatedAdaptiveLimiterAndCancels(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var dispatched atomic.Int32
		transport := bedrockHTTPFunc(func(req *http.Request) (*http.Response, error) {
			if err := req.Context().Err(); err != nil {
				return nil, err
			}
			dispatched.Add(1)
			return &http.Response{
				StatusCode: http.StatusTooManyRequests,
				Header:     http.Header{"X-Amzn-Errortype": {"ThrottlingException"}, "Content-Type": {"application/json"}},
				Body:       io.NopCloser(strings.NewReader(`{"message":"throttled"}`)), Request: req,
			}, nil
		})
		adaptive := retry.NewAdaptiveMode()
		runtime := bedrockruntime.New(bedrockruntime.Options{
			Region: "us-east-1", Credentials: credentials.NewStaticCredentialsProvider("key", "secret", ""),
			HTTPClient: transport, Retryer: adaptive, RetryMaxAttempts: 1,
		})
		client := NewClient(runtime)
		_, err := client.EmbedTexts(t.Context(), "model", []string{"seed"}, "search_query", 1)
		require.Error(t, err)
		require.Equal(t, int32(1), dispatched.Load())
		observer := &bedrockStartObserver{started: make(chan embedder.QueryAttemptKind, 2), finished: make(chan embedder.QueryAttemptOutcome, 2)}
		hedger, err := embedder.NewQueryHedger(time.Millisecond, 1, observer)
		require.NoError(t, err)
		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()
		done := make(chan error, 1)
		go func() {
			_, embedErr := NewDenseEmbedder(client, "model", 1, 1, hedger).EmbedText(ctx, embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery})
			done <- embedErr
		}()
		require.Equal(t, embedder.QueryAttemptOriginal, <-observer.started)
		require.Equal(t, embedder.QueryAttemptExtra, <-observer.started)
		synctest.Wait()
		require.Equal(t, int32(1), dispatched.Load(), "both attempts must wait on the throttled shared limiter")
		cancel()
		require.ErrorIs(t, <-done, context.Canceled)
		synctest.Wait()
		require.Equal(t, embedder.QueryAttemptCanceled, <-observer.finished)
		require.Equal(t, embedder.QueryAttemptCanceled, <-observer.finished)
		require.Equal(t, int32(1), dispatched.Load())
	})
}

func TestBedrockObservedSDKDoesNotCountDocumentOrMultiTextAsQuery(t *testing.T) {
	var queryRequests atomic.Int32
	transport := &embedder.ObservedHTTPClient{Client: bedrockHTTPFunc(func(req *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK,
			Header: http.Header{"Content-Type": {"application/json"}, "X-Amzn-Bedrock-Input-Token-Count": {"7"}},
			Body:   io.NopCloser(strings.NewReader(`{"embeddings":{"float":[[2]]},"response_type":"embeddings_floats"}`)), Request: req}, nil
	}), Observer: func(embedder.QueryAttemptKind) { queryRequests.Add(1) }}
	runtime := bedrockruntime.New(bedrockruntime.Options{Region: "us-east-1",
		Credentials: credentials.NewStaticCredentialsProvider("key", "secret", ""),
		HTTPClient:  transport, Retryer: retry.NewAdaptiveMode(), RetryMaxAttempts: 1})
	hedger, err := embedder.NewQueryHedger(time.Second, 1, nil)
	require.NoError(t, err)
	adapter := NewDenseEmbedder(NewClient(runtime), "model", 1, 2, hedger)
	_, err = adapter.EmbedText(t.Context(), embedder.EmbedTextInput{Texts: []string{"document"}, Task: embedder.TaskRetrievalDocument})
	require.NoError(t, err)
	_, err = adapter.EmbedText(t.Context(), embedder.EmbedTextInput{Texts: []string{"one", "two"}, Task: embedder.TaskRetrievalQuery})
	require.Error(t, err)
	require.Zero(t, queryRequests.Load())
}

func TestBedrockAdaptiveSDKCancelsAfterThrottleResponse(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var requests atomic.Int32
		first := make(chan struct{})
		transport := bedrockHTTPFunc(func(req *http.Request) (*http.Response, error) {
			if err := req.Context().Err(); err != nil {
				return nil, err
			}
			if requests.Add(1) == 1 {
				close(first)
			}
			return &http.Response{
				StatusCode: http.StatusTooManyRequests,
				Header:     http.Header{"X-Amzn-Errortype": {"ThrottlingException"}, "Content-Type": {"application/json"}},
				Body:       io.NopCloser(strings.NewReader(`{"message":"throttled"}`)),
				Request:    req,
			}, nil
		})
		runtime := bedrockruntime.New(bedrockruntime.Options{
			Region: "us-east-1", Credentials: credentials.NewStaticCredentialsProvider("key", "secret", ""),
			HTTPClient: transport, Retryer: retry.NewAdaptiveMode(), RetryMaxAttempts: 5,
		})
		client := &awsClient{runtime: runtime}
		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()
		done := make(chan error, 1)
		go func() { _, err := client.EmbedTexts(ctx, "model", []string{"query"}, "search_query", 1); done <- err }()
		<-first
		<-time.After(time.Millisecond)
		cancel()
		require.ErrorIs(t, <-done, context.Canceled)
		require.Equal(t, int32(1), requests.Load())
	})
}

func TestBedrockRealAdapterHedgeUsesSameRequestAndCancelsOriginal(t *testing.T) {
	var calls atomic.Int32
	requests := make(chan string, 2)
	deadlines := make(chan time.Time, 2)
	var originalRequests, extraRequests atomic.Int32
	originalCanceled := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		requests <- r.URL.Path + ":" + string(body)
		if calls.Add(1) == 1 {
			<-r.Context().Done()
			close(originalCanceled)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Amzn-Bedrock-Input-Token-Count", "7")
		_, _ = w.Write([]byte(`{"embeddings":{"float":[[2]]},"response_type":"embeddings_floats"}`))
	}))
	defer srv.Close()
	runtime := bedrockruntime.New(bedrockruntime.Options{
		Region: "us-east-1", BaseEndpoint: aws.String(srv.URL),
		Credentials: credentials.NewStaticCredentialsProvider("key", "secret", ""),
		HTTPClient: &embedder.ObservedHTTPClient{Client: bedrockHTTPFunc(func(req *http.Request) (*http.Response, error) {
			deadline, _ := req.Context().Deadline()
			deadlines <- deadline
			return srv.Client().Transport.RoundTrip(req)
		}), Observer: func(kind embedder.QueryAttemptKind) {
			switch kind {
			case embedder.QueryAttemptOriginal:
				originalRequests.Add(1)
			case embedder.QueryAttemptExtra:
				extraRequests.Add(1)
			}
		}}, Retryer: retry.NewAdaptiveMode(), RetryMaxAttempts: 5,
	})
	hedger, err := embedder.NewQueryHedger(10*time.Millisecond, 1, nil)
	require.NoError(t, err)
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	wantDeadline, _ := ctx.Deadline()
	out, err := NewDenseEmbedder(NewClient(runtime), "model", 1, 1, hedger).EmbedText(ctx, embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery})
	require.NoError(t, err)
	require.Equal(t, float32(2), out.Embeddings[0].Dense[0])
	require.Equal(t, 7, out.InputTokens)
	<-originalCanceled
	require.Equal(t, <-requests, <-requests)
	require.Equal(t, wantDeadline, <-deadlines)
	require.Equal(t, wantDeadline, <-deadlines)
	require.Equal(t, int32(2), calls.Load())
	require.Equal(t, int32(1), originalRequests.Load())
	require.Equal(t, int32(1), extraRequests.Load())
}

type timeoutBedrockClient struct{ calls atomic.Int32 }

type malformedBedrockClient struct {
	originalDone      chan struct{}
	extraDone         chan struct{}
	malformedOriginal bool
}

func (c *malformedBedrockClient) EmbedTexts(ctx context.Context, _ string, _ []string, _ string, _ int) (EmbedResult, error) {
	if c.malformedOriginal {
		<-ctx.Done()
		close(c.originalDone)
		return EmbedResult{InputTokens: 11}, nil
	}
	<-c.extraDone
	return EmbedResult{Vectors: [][]float32{{5}}, InputTokens: 6}, nil
}
func (c *malformedBedrockClient) EmbedTextsHedge(context.Context, string, []string, string, int) (EmbedResult, error) {
	if c.malformedOriginal {
		return EmbedResult{Vectors: [][]float32{{2}}, InputTokens: 7}, nil
	}
	close(c.extraDone)
	return EmbedResult{InputTokens: 4}, nil
}

type bedrockOutcomeObserver struct {
	finished chan embedder.QueryAttemptOutcome
}

func (*bedrockOutcomeObserver) AttemptStarted(string, embedder.QueryAttemptKind) {}
func (o *bedrockOutcomeObserver) AttemptFinished(_ string, _ embedder.QueryAttemptKind, outcome embedder.QueryAttemptOutcome, _ int) {
	o.finished <- outcome
}
func (*bedrockOutcomeObserver) HedgeSkipped(string)                      {}
func (*bedrockOutcomeObserver) Winner(string, embedder.QueryAttemptKind) {}
func (*bedrockOutcomeObserver) ExtraInFlight(string, int)                {}

func TestDenseEmbedderBedrockMalformedAttemptCannotWin(t *testing.T) {
	for _, malformedOriginal := range []bool{false, true} {
		synctest.Test(t, func(t *testing.T) {
			observer := &bedrockOutcomeObserver{finished: make(chan embedder.QueryAttemptOutcome, 2)}
			hedger, err := embedder.NewQueryHedger(time.Second, 1, observer)
			require.NoError(t, err)
			client := &malformedBedrockClient{originalDone: make(chan struct{}), extraDone: make(chan struct{}), malformedOriginal: malformedOriginal}
			out, err := NewDenseEmbedder(client, "model", 1, 1, hedger).EmbedText(context.Background(), embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery})
			require.NoError(t, err)
			if malformedOriginal {
				require.Equal(t, float32(2), out.Embeddings[0].Dense[0])
				require.Equal(t, 7, out.InputTokens)
				<-client.originalDone
			} else {
				require.Equal(t, float32(5), out.Embeddings[0].Dense[0])
				require.Equal(t, 6, out.InputTokens)
			}
			synctest.Wait()
			outcomes := []embedder.QueryAttemptOutcome{<-observer.finished, <-observer.finished}
			require.Contains(t, outcomes, embedder.QueryAttemptMalformed)
			require.Contains(t, outcomes, embedder.QueryAttemptSuccess)
		})
	}
}

func (c *timeoutBedrockClient) EmbedTexts(ctx context.Context, _ string, _ []string, _ string, _ int) (EmbedResult, error) {
	c.calls.Add(1)
	<-ctx.Done()
	return EmbedResult{}, ctx.Err()
}
func (c *timeoutBedrockClient) EmbedTextsHedge(ctx context.Context, model string, texts []string, inputType string, dim int) (EmbedResult, error) {
	return c.EmbedTexts(ctx, model, texts, inputType, dim)
}

func TestDenseEmbedderEnabledHedgePreservesCallTimeout(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		heder, err := embedder.NewQueryHedger(time.Second, 1, nil)
		require.NoError(t, err)
		client := &timeoutBedrockClient{}
		_, err = NewDenseEmbedder(client, "model", 1, 1, heder).EmbedText(context.Background(), embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery})
		require.ErrorIs(t, err, ErrCallTimeout)
		require.Equal(t, int32(2), client.calls.Load())
	})
}

type inspectRetryRuntime struct {
	retryer *retry.AdaptiveMode
	max     int
	same    bool
}

func (r *inspectRetryRuntime) InvokeModel(_ context.Context, _ *bedrockruntime.InvokeModelInput, optFns ...func(*bedrockruntime.Options)) (*bedrockruntime.InvokeModelOutput, error) {
	opts := bedrockruntime.Options{Retryer: r.retryer, RetryMaxAttempts: 5}
	for _, fn := range optFns {
		fn(&opts)
	}
	r.max = opts.RetryMaxAttempts
	r.same = opts.Retryer == r.retryer
	return nil, context.Canceled
}

func TestBedrockHedgeRetainsAdaptiveRetryer(t *testing.T) {
	runtime := &inspectRetryRuntime{retryer: retry.NewAdaptiveMode()}
	client := &awsClient{runtime: runtime}
	_, err := client.EmbedTextsHedge(t.Context(), "model", []string{"query"}, "search_query", 1)
	require.Error(t, err)
	require.Equal(t, 1, runtime.max)
	require.True(t, runtime.same)
}

func TestBedrockHedgeAddsOneWireRequestWithoutChangingOriginalRetryBudget(t *testing.T) {
	var requests atomic.Int32
	var observedOriginal, observedExtra atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requests.Add(1)
		w.Header().Set("X-Amzn-Errortype", "InternalServerException")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"message":"transient failure"}`))
	}))
	defer srv.Close()
	adaptive := retry.NewAdaptiveMode(func(o *retry.AdaptiveModeOptions) {
		o.StandardOptions = append(o.StandardOptions, func(s *retry.StandardOptions) { s.MaxBackoff = time.Millisecond })
	})
	runtime := bedrockruntime.New(bedrockruntime.Options{
		Region:       "us-east-1",
		BaseEndpoint: aws.String(srv.URL),
		Credentials:  credentials.NewStaticCredentialsProvider("key", "secret", ""),
		HTTPClient: &embedder.ObservedHTTPClient{Client: srv.Client(), Observer: func(kind embedder.QueryAttemptKind) {
			switch kind {
			case embedder.QueryAttemptOriginal:
				observedOriginal.Add(1)
			case embedder.QueryAttemptExtra:
				observedExtra.Add(1)
			}
		}},
		Retryer:          adaptive,
		RetryMaxAttempts: 3,
	})
	client := &awsClient{runtime: runtime}
	_, err := client.EmbedTextsHedge(embedder.WithQueryAttempt(t.Context(), embedder.QueryAttemptExtra), "model", []string{"query"}, "search_query", 1)
	require.Error(t, err)
	require.Equal(t, int32(1), requests.Load())
	_, err = client.EmbedTexts(embedder.WithQueryAttempt(t.Context(), embedder.QueryAttemptOriginal), "model", []string{"query"}, "search_query", 1)
	require.Error(t, err)
	require.Equal(t, int32(4), requests.Load())
	require.Equal(t, int32(1), observedExtra.Load())
	require.Equal(t, int32(3), observedOriginal.Load())
}

func (c *controlledBedrockClient) EmbedTexts(ctx context.Context, _ string, _ []string, _ string, _ int) (EmbedResult, error) {
	<-ctx.Done()
	close(c.originalDone)
	return EmbedResult{}, ctx.Err()
}

func (c *controlledBedrockClient) EmbedTextsHedge(_ context.Context, _ string, texts []string, inputType string, _ int) (EmbedResult, error) {
	if inputType != "search_query" {
		return EmbedResult{}, context.Canceled
	}
	c.extraCalls++
	return EmbedResult{Vectors: [][]float32{{float32(len(texts[0]))}}, InputTokens: 9}, nil
}

func TestDenseEmbedderQueryHedgeReturnsExtraVector(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		hedger, err := embedder.NewQueryHedger(time.Second, 1, nil)
		require.NoError(t, err)
		client := &controlledBedrockClient{originalDone: make(chan struct{})}
		e := NewDenseEmbedder(client, "model", 1, 1, hedger)
		out, err := e.EmbedText(context.Background(), embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery})
		require.NoError(t, err)
		require.Equal(t, float32(5), out.Embeddings[0].Dense[0])
		require.Equal(t, 9, out.InputTokens)
		<-client.originalDone
		require.Equal(t, 1, client.extraCalls)
	})
}

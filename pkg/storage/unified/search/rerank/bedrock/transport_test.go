package bedrock

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"go.opentelemetry.io/otel/trace"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/retry"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime/types"
	"github.com/stretchr/testify/require"
)

func TestRealSDKHedgeCancelsSlowRequest(t *testing.T) {
	var calls atomic.Int32
	cancelled := make(chan struct{})
	cleanup := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.Copy(io.Discard, r.Body)
		if calls.Add(1) == 1 {
			select {
			case <-r.Context().Done():
				close(cancelled)
			case <-cleanup:
			}
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"results":[{"index":0,"relevance_score":0.8}]}`))
	}))
	defer server.Close()
	defer close(cleanup)
	cfg := aws.Config{Region: "us-east-1", Credentials: credentials.NewStaticCredentialsProvider("key", "secret", ""), HTTPClient: server.Client(), BaseEndpoint: aws.String(server.URL)}
	client := NewClient(bedrockruntime.NewFromConfig(cfg))
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	scores, err := NewRerankerWithHedgeDelay(client, "cohere.rerank-v3-5:0", 20*time.Millisecond).Score(ctx, "q", []string{"a"})
	require.NoError(t, err)
	require.Equal(t, []float64{0.8}, scores)
	require.EqualValues(t, 2, calls.Load())
	select {
	case <-cancelled:
	case <-ctx.Done():
		t.Fatal("slow request did not observe cancellation")
	}
}

func TestRealSDKRetryableErrorUsesDefaultAttemptLimit(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		transport := roundTripFunc(func(r *http.Request) (*http.Response, error) {
			calls.Add(1)
			return &http.Response{StatusCode: http.StatusServiceUnavailable, Header: http.Header{"Content-Type": []string{"application/json"}}, Body: io.NopCloser(strings.NewReader(`{"message":"retryable"}`)), Request: r}, nil
		})
		cfg := aws.Config{Region: "us-east-1", Credentials: credentials.NewStaticCredentialsProvider("key", "secret", ""), HTTPClient: &http.Client{Transport: transport}, BaseEndpoint: aws.String("https://bedrock.test"), Retryer: func() aws.Retryer {
			return retry.NewStandard(func(o *retry.StandardOptions) { o.MaxBackoff = time.Millisecond })
		}}
		client := NewClient(bedrockruntime.NewFromConfig(cfg))
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_, err := NewRerankerWithHedgeDelay(client, "m", 0).Score(ctx, "q", []string{"a"})
		require.Error(t, err)
		require.EqualValues(t, 3, calls.Load())
	})
}

func TestRealSDKTransientFailureRetriesOnce(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if calls.Add(1) == 1 {
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte(`{"message":"try again"}`))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"results":[{"index":0,"relevance_score":0.6}]}`))
	}))
	defer server.Close()
	cfg := aws.Config{Region: "us-east-1", Credentials: credentials.NewStaticCredentialsProvider("key", "secret", ""), HTTPClient: server.Client(), BaseEndpoint: aws.String(server.URL)}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	scores, err := NewReranker(NewClient(bedrockruntime.NewFromConfig(cfg)), "m").Score(ctx, "q", []string{"a"})
	require.NoError(t, err)
	require.Equal(t, []float64{0.6}, scores)
	require.EqualValues(t, 2, calls.Load())
}

func TestRealSDKThrottlingUsesNativeRetryLimit(t *testing.T) {
	for _, tc := range []struct {
		name      string
		status    int
		errorType string
		isModeled bool
		attempts  int
	}{
		{name: "modeled throttling exception", status: http.StatusBadRequest, errorType: "ThrottlingException", isModeled: true, attempts: 3},
		{name: "unmodeled HTTP 429", status: http.StatusTooManyRequests, attempts: 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				var calls atomic.Int32
				transport := roundTripFunc(func(r *http.Request) (*http.Response, error) {
					calls.Add(1)
					header := make(http.Header)
					if tc.errorType != "" {
						header.Set("x-amzn-errortype", tc.errorType)
					}
					header.Set("Content-Type", "application/json")
					return &http.Response{StatusCode: tc.status, Header: header, Body: io.NopCloser(strings.NewReader(`{"message":"throttled"}`)), Request: r}, nil
				})

				cfg := aws.Config{Region: "us-east-1", Credentials: credentials.NewStaticCredentialsProvider("key", "secret", ""), HTTPClient: &http.Client{Transport: transport}, BaseEndpoint: aws.String("https://bedrock.test"), Retryer: func() aws.Retryer {
					return retry.NewStandard(func(o *retry.StandardOptions) { o.MaxBackoff = time.Millisecond })
				}}
				ctx, cancel := context.WithTimeout(context.Background(), time.Second)
				defer cancel()
				_, err := NewRerankerWithHedgeDelay(NewClient(bedrockruntime.NewFromConfig(cfg)), "m", 2*time.Second).Score(ctx, "q", []string{"a"})
				require.Error(t, err)
				require.EqualValues(t, tc.attempts, calls.Load())
				var statusErr interface{ HTTPStatusCode() int }
				require.ErrorAs(t, err, &statusErr)
				require.Equal(t, tc.status, statusErr.HTTPStatusCode())
				if tc.isModeled {
					var throttle *types.ThrottlingException
					require.ErrorAs(t, err, &throttle)
				}
			})
		})
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestRealSDKAuthorizationFailureDoesNotRetry(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`{"message":"denied"}`))
	}))
	defer server.Close()
	cfg := aws.Config{Region: "us-east-1", Credentials: credentials.NewStaticCredentialsProvider("key", "secret", ""), HTTPClient: server.Client(), BaseEndpoint: aws.String(server.URL)}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	_, err := NewReranker(NewClient(bedrockruntime.NewFromConfig(cfg)), "m").Score(ctx, "q", []string{"a"})
	require.Error(t, err)
	require.EqualValues(t, 1, calls.Load())
}

type observingRetryer struct {
	aws.NopRetryer
	tokens     atomic.Int32
	classified atomic.Int32
	quota      atomic.Int32
	backoff    atomic.Int32
	released   atomic.Int32
	delay      time.Duration
}

type waitingRetryer struct {
	observingRetryer
	secondToken chan struct{}
}

func (r *waitingRetryer) GetAttemptToken(ctx context.Context) (func(error) error, error) {
	if r.tokens.Add(1) == 2 {
		close(r.secondToken)
		<-ctx.Done()
		return nil, ctx.Err()
	}
	return func(error) error { return nil }, nil
}

func TestRealSDKV2AttemptTokenWaitHonorsCancellation(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		transport := roundTripFunc(func(r *http.Request) (*http.Response, error) {
			calls.Add(1)
			return &http.Response{StatusCode: http.StatusServiceUnavailable, Header: http.Header{"Content-Type": []string{"application/json"}}, Body: io.NopCloser(strings.NewReader(`{"message":"temporary"}`)), Request: r}, nil
		})
		retryer := &waitingRetryer{secondToken: make(chan struct{})}
		cfg := aws.Config{Region: "us-east-1", Credentials: credentials.NewStaticCredentialsProvider("key", "secret", ""), HTTPClient: &http.Client{Transport: transport}, BaseEndpoint: aws.String("https://bedrock.test"), Retryer: func() aws.Retryer { return retryer }}
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		result := make(chan error, 1)
		go func() {
			_, err := NewRerankerWithHedgeDelay(NewClient(bedrockruntime.NewFromConfig(cfg)), "m", 0).Score(ctx, "q", []string{"a"})
			result <- err
		}()
		select {
		case <-retryer.secondToken:
		case <-ctx.Done():
			t.Fatal("SDK did not request a second attempt token")
		}
		cancel()
		select {
		case err := <-result:
			require.ErrorIs(t, err, context.Canceled)
		case <-time.After(time.Second):
			t.Fatal("cancelled attempt token wait did not return")
		}
		require.EqualValues(t, 1, calls.Load())
	})
}

func (r *observingRetryer) MaxAttempts() int { return 5 }

func (r *observingRetryer) GetAttemptToken(ctx context.Context) (func(error) error, error) {
	r.tokens.Add(1)
	return r.NopRetryer.GetAttemptToken(ctx)
}

func (r *observingRetryer) IsErrorRetryable(err error) bool {
	r.classified.Add(1)
	var statusErr interface{ HTTPStatusCode() int }
	return errors.As(err, &statusErr) && (statusErr.HTTPStatusCode() == http.StatusServiceUnavailable || statusErr.HTTPStatusCode() == http.StatusTooManyRequests)
}

func (r *observingRetryer) GetRetryToken(context.Context, error) (func(error) error, error) {
	r.quota.Add(1)
	return func(error) error { r.released.Add(1); return nil }, nil
}

func (r *observingRetryer) RetryDelay(int, error) (time.Duration, error) {
	r.backoff.Add(1)
	if r.delay != 0 {
		return r.delay, nil
	}
	return time.Millisecond, nil
}

func TestRealSDKEarlyThrottleSuppressesHedgeDuringNativeBackoff(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		transport := roundTripFunc(func(r *http.Request) (*http.Response, error) {
			attempt := calls.Add(1)
			if attempt == 1 {
				select {
				case <-time.After(100 * time.Millisecond):
				case <-r.Context().Done():
					return nil, r.Context().Err()
				}
				return &http.Response{StatusCode: http.StatusTooManyRequests, Header: http.Header{"Content-Type": []string{"application/json"}}, Body: io.NopCloser(strings.NewReader(`{"message":"throttled"}`)), Request: r}, nil
			}
			return &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": []string{"application/json"}}, Body: io.NopCloser(strings.NewReader(`{"results":[{"index":0,"relevance_score":0.8}]}`)), Request: r}, nil
		})
		retryer := &observingRetryer{delay: 650 * time.Millisecond}
		cfg := aws.Config{Region: "us-east-1", Credentials: credentials.NewStaticCredentialsProvider("key", "secret", ""), HTTPClient: &http.Client{Transport: transport}, BaseEndpoint: aws.String("https://bedrock.test"), Retryer: func() aws.Retryer { return retryer }}
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		start := time.Now()
		scores, err := NewRerankerWithHedgeDelay(NewClient(bedrockruntime.NewFromConfig(cfg)), "m", 500*time.Millisecond).Score(ctx, "q", []string{"a"})
		require.NoError(t, err)
		require.Equal(t, 750*time.Millisecond, time.Since(start))
		require.Equal(t, []float64{0.8}, scores)
		require.EqualValues(t, 2, calls.Load())
		require.EqualValues(t, 1, retryer.quota.Load())
		require.EqualValues(t, 1, retryer.backoff.Load())
	})
}

func TestRealSDKAlreadyStartedHedgeUsesConfiguredRetryLimit(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		secondStarted := make(chan struct{})
		transport := roundTripFunc(func(r *http.Request) (*http.Response, error) {
			attempt := calls.Add(1)
			switch attempt {
			case 1:
				select {
				case <-secondStarted:
				case <-r.Context().Done():
					return nil, r.Context().Err()
				}
			case 2:
				close(secondStarted)
			}
			return &http.Response{StatusCode: http.StatusServiceUnavailable, Header: http.Header{"Content-Type": []string{"application/json"}}, Body: io.NopCloser(strings.NewReader(`{"message":"temporary"}`)), Request: r}, nil
		})
		retryer := &observingRetryer{}
		cfg := aws.Config{Region: "us-east-1", Credentials: credentials.NewStaticCredentialsProvider("key", "secret", ""), HTTPClient: &http.Client{Transport: transport}, BaseEndpoint: aws.String("https://bedrock.test"), Retryer: func() aws.Retryer { return retryer }}
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_, err := NewRerankerWithHedgeDelay(NewClient(bedrockruntime.NewFromConfig(cfg)), "m", 20*time.Millisecond).Score(ctx, "q", []string{"a"})
		require.Error(t, err)
		require.EqualValues(t, 10, calls.Load())
		require.EqualValues(t, 8, retryer.quota.Load())
		require.EqualValues(t, 8, retryer.backoff.Load())
	})
}

func TestRealSDKRespectsStricterConfiguredAttemptCap(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		transport := roundTripFunc(func(r *http.Request) (*http.Response, error) {
			calls.Add(1)
			return &http.Response{StatusCode: http.StatusServiceUnavailable, Header: http.Header{"Content-Type": []string{"application/json"}}, Body: io.NopCloser(strings.NewReader(`{"message":"temporary"}`)), Request: r}, nil
		})
		retryer := &observingRetryer{}
		cfg := aws.Config{Region: "us-east-1", Credentials: credentials.NewStaticCredentialsProvider("key", "secret", ""), HTTPClient: &http.Client{Transport: transport}, BaseEndpoint: aws.String("https://bedrock.test"), RetryMaxAttempts: 1, Retryer: func() aws.Retryer { return retryer }}
		runtime := bedrockruntime.NewFromConfig(cfg)
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_, err := NewRerankerWithHedgeDelay(NewClient(runtime), "m", 0).Score(ctx, "q", []string{"a"})
		require.Error(t, err)
		require.EqualValues(t, 1, calls.Load())
		require.Equal(t, 1, runtime.Options().RetryMaxAttempts)
		require.EqualValues(t, 0, retryer.quota.Load())
	})
}

type legacyObservingRetryer struct {
	aws.Retryer
	tokens  atomic.Int32
	quota   atomic.Int32
	backoff atomic.Int32
}

func (r *legacyObservingRetryer) MaxAttempts() int { return 5 }

func (r *legacyObservingRetryer) IsErrorRetryable(err error) bool {
	var statusErr interface{ HTTPStatusCode() int }
	return errors.As(err, &statusErr) && statusErr.HTTPStatusCode() == http.StatusServiceUnavailable
}

func (r *legacyObservingRetryer) GetInitialToken() func(error) error {
	r.tokens.Add(1)
	return func(error) error { return nil }
}

func (r *legacyObservingRetryer) GetRetryToken(context.Context, error) (func(error) error, error) {
	r.quota.Add(1)
	return func(error) error { return nil }, nil
}

func (r *legacyObservingRetryer) RetryDelay(int, error) (time.Duration, error) {
	r.backoff.Add(1)
	return time.Millisecond, nil
}

func TestRealSDKAdaptsLegacyConfiguredRetryer(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		transport := roundTripFunc(func(r *http.Request) (*http.Response, error) {
			if calls.Add(1) == 1 {
				return &http.Response{StatusCode: http.StatusServiceUnavailable, Header: http.Header{"Content-Type": []string{"application/json"}}, Body: io.NopCloser(strings.NewReader(`{"message":"temporary"}`)), Request: r}, nil
			}
			return &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": []string{"application/json"}}, Body: io.NopCloser(strings.NewReader(`{"results":[{"index":0,"relevance_score":0.6}]}`)), Request: r}, nil
		})
		retryer := &legacyObservingRetryer{Retryer: aws.NopRetryer{}}
		cfg := aws.Config{Region: "us-east-1", Credentials: credentials.NewStaticCredentialsProvider("key", "secret", ""), HTTPClient: &http.Client{Transport: transport}, BaseEndpoint: aws.String("https://bedrock.test"), Retryer: func() aws.Retryer { return retryer }}
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		scores, err := NewRerankerWithHedgeDelay(NewClient(bedrockruntime.NewFromConfig(cfg)), "m", 0).Score(ctx, "q", []string{"a"})
		require.NoError(t, err)
		require.Equal(t, []float64{0.6}, scores)
		require.EqualValues(t, 2, calls.Load())
		require.EqualValues(t, 2, retryer.tokens.Load())
		require.EqualValues(t, 1, retryer.quota.Load())
		require.EqualValues(t, 1, retryer.backoff.Load())
	})
}

func TestRealSDKCancellationDuringNativeBackoffStopsRetry(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		transport := roundTripFunc(func(r *http.Request) (*http.Response, error) {
			calls.Add(1)
			return &http.Response{StatusCode: http.StatusServiceUnavailable, Header: http.Header{"Content-Type": []string{"application/json"}}, Body: io.NopCloser(strings.NewReader(`{"message":"temporary"}`)), Request: r}, nil
		})
		retryer := &observingRetryer{delay: time.Second}
		cfg := aws.Config{Region: "us-east-1", Credentials: credentials.NewStaticCredentialsProvider("key", "secret", ""), HTTPClient: &http.Client{Transport: transport}, BaseEndpoint: aws.String("https://bedrock.test"), Retryer: func() aws.Retryer { return retryer }}
		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		defer cancel()
		_, err := NewRerankerWithHedgeDelay(NewClient(bedrockruntime.NewFromConfig(cfg)), "m", 0).Score(ctx, "q", []string{"a"})
		require.ErrorIs(t, err, context.DeadlineExceeded)
		require.EqualValues(t, 1, calls.Load())
		require.EqualValues(t, 1, retryer.backoff.Load())
	})
}

func TestRealSDKUsesConfiguredRetryQuotaAndBackoffWithHedgingDisabled(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		transport := roundTripFunc(func(r *http.Request) (*http.Response, error) {
			if calls.Add(1) == 1 {
				return &http.Response{StatusCode: http.StatusServiceUnavailable, Header: http.Header{"Content-Type": []string{"application/json"}}, Body: io.NopCloser(strings.NewReader(`{"message":"temporary"}`)), Request: r}, nil
			}
			return &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": []string{"application/json"}}, Body: io.NopCloser(strings.NewReader(`{"results":[{"index":0,"relevance_score":0.6}]}`)), Request: r}, nil
		})
		retryer := &observingRetryer{}
		cfg := aws.Config{Region: "us-east-1", Credentials: credentials.NewStaticCredentialsProvider("key", "secret", ""), HTTPClient: &http.Client{Transport: transport}, BaseEndpoint: aws.String("https://bedrock.test"), Retryer: func() aws.Retryer { return retryer }}
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		scores, err := NewRerankerWithHedgeDelay(NewClient(bedrockruntime.NewFromConfig(cfg)), "m", 0).Score(ctx, "q", []string{"a"})
		require.NoError(t, err)
		require.Equal(t, []float64{0.6}, scores)
		require.EqualValues(t, 2, calls.Load())
		require.EqualValues(t, 2, retryer.tokens.Load())
		require.EqualValues(t, 1, retryer.quota.Load())
		require.EqualValues(t, 1, retryer.backoff.Load())
		require.EqualValues(t, 1, retryer.released.Load())
	})
}

func TestRealSDKPreservesConfiguredRetryerV2AttemptLimit(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		transport := roundTripFunc(func(r *http.Request) (*http.Response, error) {
			calls.Add(1)
			return &http.Response{StatusCode: http.StatusServiceUnavailable, Header: http.Header{"Content-Type": []string{"application/json"}}, Body: io.NopCloser(strings.NewReader(`{"message":"temporary"}`)), Request: r}, nil
		})
		retryer := &observingRetryer{}
		cfg := aws.Config{Region: "us-east-1", Credentials: credentials.NewStaticCredentialsProvider("key", "secret", ""), HTTPClient: &http.Client{Transport: transport}, BaseEndpoint: aws.String("https://bedrock.test"), Retryer: func() aws.Retryer { return retryer }}
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_, err := NewReranker(NewClient(bedrockruntime.NewFromConfig(cfg)), "m").Score(ctx, "q", []string{"a"})
		require.Error(t, err)
		require.EqualValues(t, 5, calls.Load())
		require.EqualValues(t, 5, retryer.tokens.Load())
		require.GreaterOrEqual(t, retryer.classified.Load(), int32(5))
	})
}

type notifyingSpan struct {
	trace.Span
	onEvent func(string)
}

func (s *notifyingSpan) AddEvent(name string, options ...trace.EventOption) {
	if s.onEvent != nil {
		s.onEvent(name)
	}
}

func TestRealSDKMalformedResponseDoesNotBeatPendingSuccess(t *testing.T) {
	var calls atomic.Int32
	secondStarted := make(chan struct{})
	invalidProcessed := make(chan struct{})
	cleanup := make(chan struct{})
	var invalidOnce sync.Once
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.Copy(io.Discard, r.Body)
		if calls.Add(1) == 1 {
			select {
			case <-secondStarted:
			case <-r.Context().Done():
				return
			case <-cleanup:
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{invalid`))

			return
		}
		close(secondStarted)
		select {
		case <-invalidProcessed:
		case <-r.Context().Done():
			return
		case <-cleanup:
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"results":[{"index":0,"relevance_score":0.6}]}`))
	}))
	defer server.Close()
	defer close(cleanup)
	cfg := aws.Config{Region: "us-east-1", Credentials: credentials.NewStaticCredentialsProvider("key", "secret", ""), HTTPClient: server.Client(), BaseEndpoint: aws.String(server.URL)}
	ctx := trace.ContextWithSpan(context.Background(), &notifyingSpan{Span: trace.SpanFromContext(context.Background()), onEvent: func(name string) {
		if name == "hedge.attempt_failed" {
			invalidOnce.Do(func() { close(invalidProcessed) })
		}
	}})
	deadlineCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	scores, err := NewRerankerWithHedgeDelay(NewClient(bedrockruntime.NewFromConfig(cfg)), "m", 20*time.Millisecond).Score(deadlineCtx, "q", []string{"a"})
	require.NoError(t, err)
	require.Equal(t, []float64{0.6}, scores)
	require.EqualValues(t, 2, calls.Load())
}

func TestRealSharedSDKClientKeepsOverlappingPayloadsIndependent(t *testing.T) {
	var mu sync.Mutex
	requests := make(map[string][]string)
	cleanup := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload rerankRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		mu.Lock()
		requests[payload.Query] = append(requests[payload.Query], payload.Documents[0])
		attempt := len(requests[payload.Query])
		mu.Unlock()
		if attempt == 1 {
			select {
			case <-r.Context().Done():
			case <-cleanup:
			}
			return
		}
		score := "0.3"
		if payload.Query == "query-b" {
			score = "0.7"
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"results":[{"index":0,"relevance_score":` + score + `}]}`))
	}))
	defer server.Close()
	defer close(cleanup)
	cfg := aws.Config{Region: "us-east-1", Credentials: credentials.NewStaticCredentialsProvider("key", "secret", ""), HTTPClient: server.Client(), BaseEndpoint: aws.String(server.URL)}
	scorer := NewRerankerWithHedgeDelay(NewClient(bedrockruntime.NewFromConfig(cfg)), "m", 20*time.Millisecond)
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()
	type result struct {
		query  string
		scores []float64
		err    error
	}
	results := make(chan result, 2)
	for _, item := range []struct{ query, text string }{{"query-a", "document-a"}, {"query-b", "document-b"}} {
		go func(q, text string) {
			scores, err := scorer.Score(ctx, q, []string{text})
			results <- result{q, scores, err}
		}(item.query, item.text)
	}
	got := make(map[string][]float64)
	for range 2 {
		var r result
		select {
		case r = <-results:
		case <-ctx.Done():
			t.Fatal("overlapping reranks did not complete")
		}
		require.NoError(t, r.err)
		got[r.query] = r.scores
	}
	require.Equal(t, []float64{0.3}, got["query-a"])
	require.Equal(t, []float64{0.7}, got["query-b"])
	mu.Lock()
	defer mu.Unlock()
	require.Equal(t, []string{"document-a", "document-a"}, requests["query-a"])
	require.Equal(t, []string{"document-b", "document-b"}, requests["query-b"])
}

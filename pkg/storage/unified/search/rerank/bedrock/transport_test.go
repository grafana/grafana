package bedrock

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"go.opentelemetry.io/otel/trace"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/stretchr/testify/require"
)

func TestRealSDKHedgeCancelsSlowRequest(t *testing.T) {
	var calls atomic.Int32
	cancelled := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.Copy(io.Discard, r.Body)
		if calls.Add(1) == 1 {
			<-r.Context().Done()
			close(cancelled)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"results":[{"index":0,"relevance_score":0.8}]}`))
	}))
	defer server.Close()
	cfg := aws.Config{Region: "us-east-1", Credentials: credentials.NewStaticCredentialsProvider("key", "secret", ""), HTTPClient: server.Client(), BaseEndpoint: aws.String(server.URL)}
	client := NewClient(bedrockruntime.NewFromConfig(cfg))
	scores, err := NewReranker(client, "cohere.rerank-v3-5:0").Score(context.Background(), "q", []string{"a"})
	require.NoError(t, err)
	require.Equal(t, []float64{0.8}, scores)
	require.EqualValues(t, 2, calls.Load())
	<-cancelled
}

func TestRealSDKRetryableErrorUsesOneRequest(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = w.Write([]byte(`{"message":"retryable"}`))
	}))
	defer server.Close()
	cfg := aws.Config{Region: "us-east-1", Credentials: credentials.NewStaticCredentialsProvider("key", "secret", ""), HTTPClient: server.Client(), BaseEndpoint: aws.String(server.URL)}
	client := NewClient(bedrockruntime.NewFromConfig(cfg))
	_, err := NewReranker(client, "m").Score(context.Background(), "q", []string{"a"})
	require.Error(t, err)
	require.EqualValues(t, 1, calls.Load())
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
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.Copy(io.Discard, r.Body)
		if calls.Add(1) == 1 {
			<-secondStarted
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{invalid`))

			return
		}
		close(secondStarted)
		<-invalidProcessed
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"results":[{"index":0,"relevance_score":0.6}]}`))
	}))
	defer server.Close()
	cfg := aws.Config{Region: "us-east-1", Credentials: credentials.NewStaticCredentialsProvider("key", "secret", ""), HTTPClient: server.Client(), BaseEndpoint: aws.String(server.URL)}
	ctx := trace.ContextWithSpan(context.Background(), &notifyingSpan{Span: trace.SpanFromContext(context.Background()), onEvent: func(name string) {
		if name == "rerank.attempt_failed" {
			close(invalidProcessed)
		}
	}})
	scores, err := NewReranker(NewClient(bedrockruntime.NewFromConfig(cfg)), "m").Score(ctx, "q", []string{"a"})
	require.NoError(t, err)
	require.Equal(t, []float64{0.6}, scores)
	require.EqualValues(t, 2, calls.Load())
}

func TestRealSharedSDKClientKeepsOverlappingPayloadsIndependent(t *testing.T) {
	var mu sync.Mutex
	requests := make(map[string][]string)
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
			<-r.Context().Done()
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
	cfg := aws.Config{Region: "us-east-1", Credentials: credentials.NewStaticCredentialsProvider("key", "secret", ""), HTTPClient: server.Client(), BaseEndpoint: aws.String(server.URL)}
	scorer := NewReranker(NewClient(bedrockruntime.NewFromConfig(cfg)), "m")
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
		r := <-results
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

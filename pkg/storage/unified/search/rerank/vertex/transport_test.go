package vertex

import (
	"context"
	"net"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"cloud.google.com/go/discoveryengine/apiv1/discoveryenginepb"
	"github.com/stretchr/testify/require"
	"google.golang.org/api/option"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
)

type localRankService struct {
	discoveryenginepb.UnimplementedRankServiceServer
	calls     atomic.Int32
	cancelled chan struct{}
}

func newTestClient(t *testing.T, service discoveryenginepb.RankServiceServer) Client {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	t.Cleanup(func() { _ = listener.Close() })
	server := grpc.NewServer()
	t.Cleanup(server.Stop)
	discoveryenginepb.RegisterRankServiceServer(server, service)
	go func() { _ = server.Serve(listener) }()
	conn, err := grpc.NewClient(listener.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })
	client, err := NewClient(context.Background(), "p", "global", option.WithGRPCConn(conn), option.WithoutAuthentication())
	require.NoError(t, err)
	t.Cleanup(func() { _ = client.(*rankClient).Close() })
	return client
}

func (s *localRankService) Rank(ctx context.Context, _ *discoveryenginepb.RankRequest) (*discoveryenginepb.RankResponse, error) {
	if s.calls.Add(1) == 1 {
		<-ctx.Done()
		close(s.cancelled)
		return nil, ctx.Err()
	}
	return &discoveryenginepb.RankResponse{Records: []*discoveryenginepb.RankingRecord{{Id: "0", Score: 0.8}}}, nil
}

func TestRealSDKHedgeCancelsSlowRequest(t *testing.T) {
	service := &localRankService{cancelled: make(chan struct{})}
	client := newTestClient(t, service)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	scores, err := NewRerankerWithHedgeDelay(client, "m", 20*time.Millisecond).Score(ctx, "q", []string{"a"})
	require.NoError(t, err)
	require.InDelta(t, 0.8, scores[0], 0.000001)
	require.EqualValues(t, 2, service.calls.Load())
	select {
	case <-service.cancelled:
	case <-ctx.Done():
		t.Fatal("slow request did not observe cancellation")
	}
}

type failingRankService struct {
	discoveryenginepb.UnimplementedRankServiceServer
	calls               atomic.Int32
	code                codes.Code
	message             string
	succeedAfterFailure bool
}

func (s *failingRankService) Rank(context.Context, *discoveryenginepb.RankRequest) (*discoveryenginepb.RankResponse, error) {
	if s.calls.Add(1) > 1 && s.succeedAfterFailure {
		return &discoveryenginepb.RankResponse{Records: []*discoveryenginepb.RankingRecord{{Id: "0", Score: 0.7}}}, nil
	}
	message := s.message
	if message == "" {
		message = "provider failure"
	}
	return nil, status.Error(s.code, message)
}

func TestRealSDKCertificateFailureDoesNotRetry(t *testing.T) {
	service := &failingRankService{
		code:    codes.Unavailable,
		message: "connection failed: x509: certificate signed by unknown authority",
	}
	client := newTestClient(t, service)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	_, err := NewReranker(client, "m").Score(ctx, "q", []string{"a"})
	require.ErrorContains(t, err, "x509: certificate signed by unknown authority")
	require.EqualValues(t, 1, service.calls.Load())
}

func TestRealSDKUnavailableStopsAfterTwoAttemptsWithoutHedge(t *testing.T) {
	service := &failingRankService{code: codes.Unavailable}
	client := newTestClient(t, service)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	_, err := NewRerankerWithHedgeDelay(client, "m", 0).Score(ctx, "q", []string{"a"})
	require.Error(t, err)
	require.EqualValues(t, 2, service.calls.Load())
}

func TestRealSDKUnavailableRetriesAfterBackoffWithoutDuplicate(t *testing.T) {
	service := &failingRankService{code: codes.Unavailable, succeedAfterFailure: true}
	client := newTestClient(t, service)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	scores, err := NewRerankerWithHedgeDelay(client, "m", 500*time.Millisecond).Score(ctx, "q", []string{"a"})
	require.NoError(t, err)
	require.InDelta(t, 0.7, scores[0], 0.000001)
	require.EqualValues(t, 2, service.calls.Load())
}

func TestRealSDKResourceExhaustedDoesNotRetry(t *testing.T) {
	service := &failingRankService{code: codes.ResourceExhausted}
	client := newTestClient(t, service)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	_, err := NewRerankerWithHedgeDelay(client, "m", 500*time.Millisecond).Score(ctx, "q", []string{"a"})
	require.Error(t, err)
	require.EqualValues(t, 1, service.calls.Load())
}

type slowFailingRankService struct {
	discoveryenginepb.UnimplementedRankServiceServer
	calls atomic.Int32
}

func (s *slowFailingRankService) Rank(ctx context.Context, _ *discoveryenginepb.RankRequest) (*discoveryenginepb.RankResponse, error) {
	s.calls.Add(1)
	select {
	case <-time.After(100 * time.Millisecond):
		return nil, status.Error(codes.Unavailable, "retryable failure")
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func TestRealSDKHedgedCallsEachStopAfterOneRetry(t *testing.T) {
	service := &slowFailingRankService{}
	client := newTestClient(t, service)
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()
	_, err := NewRerankerWithHedgeDelay(client, "m", 20*time.Millisecond).Score(ctx, "q", []string{"a"})
	require.Error(t, err)
	require.EqualValues(t, 4, service.calls.Load())
}

func TestRealSDKInvalidArgumentDoesNotRetry(t *testing.T) {
	service := &failingRankService{code: codes.InvalidArgument}
	client := newTestClient(t, service)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	_, err := NewReranker(client, "m").Score(ctx, "q", []string{"a"})
	require.Error(t, err)
	require.EqualValues(t, 1, service.calls.Load())
}

type sharedRankService struct {
	discoveryenginepb.UnimplementedRankServiceServer
	mu       sync.Mutex
	requests map[string][]string
}

func (s *sharedRankService) Rank(ctx context.Context, req *discoveryenginepb.RankRequest) (*discoveryenginepb.RankResponse, error) {
	s.mu.Lock()
	s.requests[req.Query] = append(s.requests[req.Query], req.Records[0].Content)
	attempt := len(s.requests[req.Query])
	s.mu.Unlock()
	if attempt == 1 {
		<-ctx.Done()
		return nil, ctx.Err()
	}
	score := float32(0.3)
	if req.Query == "query-b" {
		score = 0.7
	}
	return &discoveryenginepb.RankResponse{Records: []*discoveryenginepb.RankingRecord{{Id: "0", Score: score}}}, nil
}

func TestRealSharedSDKClientKeepsOverlappingPayloadsIndependent(t *testing.T) {
	service := &sharedRankService{requests: make(map[string][]string)}
	client := newTestClient(t, service)
	scorer := NewRerankerWithHedgeDelay(client, "m", 20*time.Millisecond)
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
	require.InDelta(t, 0.3, got["query-a"][0], 0.000001)
	require.InDelta(t, 0.7, got["query-b"][0], 0.000001)
	service.mu.Lock()
	defer service.mu.Unlock()
	require.Equal(t, []string{"document-a", "document-a"}, service.requests["query-a"])
	require.Equal(t, []string{"document-b", "document-b"}, service.requests["query-b"])
}

type concurrentRetryRankService struct {
	discoveryenginepb.UnimplementedRankServiceServer
	mu           sync.Mutex
	requests     map[string]int
	firstPair    chan struct{}
	firstArrived int
}

func (s *concurrentRetryRankService) Rank(ctx context.Context, req *discoveryenginepb.RankRequest) (*discoveryenginepb.RankResponse, error) {
	s.mu.Lock()
	s.requests[req.Query]++
	attempt := s.requests[req.Query]
	if attempt == 1 {
		s.firstArrived++
		if s.firstArrived == 2 {
			close(s.firstPair)
		}
	}
	s.mu.Unlock()
	if attempt == 1 {
		select {
		case <-s.firstPair:
			return nil, status.Error(codes.Unavailable, "transient failure")
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	score := float32(0.3)
	if req.Query == "query-b" {
		score = 0.7
	}
	return &discoveryenginepb.RankResponse{Records: []*discoveryenginepb.RankingRecord{{Id: "0", Score: score}}}, nil
}

func TestRealSharedSDKClientRetriesOverlappingSearchesIndependently(t *testing.T) {
	service := &concurrentRetryRankService{requests: make(map[string]int), firstPair: make(chan struct{})}
	client := newTestClient(t, service)
	scorer := NewRerankerWithHedgeDelay(client, "m", 500*time.Millisecond)
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()
	type result struct {
		query  string
		scores []float64
		err    error
	}
	results := make(chan result, 2)
	for _, query := range []string{"query-a", "query-b"} {
		go func(q string) {
			scores, err := scorer.Score(ctx, q, []string{q + "-document"})
			results <- result{query: q, scores: scores, err: err}
		}(query)
	}
	got := make(map[string][]float64)
	for range 2 {
		select {
		case outcome := <-results:
			require.NoError(t, outcome.err)
			got[outcome.query] = outcome.scores
		case <-ctx.Done():
			t.Fatal("overlapping SDK retries did not complete")
		}
	}
	require.InDelta(t, 0.3, got["query-a"][0], 0.000001)
	require.InDelta(t, 0.7, got["query-b"][0], 0.000001)
	service.mu.Lock()
	defer service.mu.Unlock()
	require.Equal(t, map[string]int{"query-a": 2, "query-b": 2}, service.requests)
}

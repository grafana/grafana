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

func (s *localRankService) Rank(ctx context.Context, _ *discoveryenginepb.RankRequest) (*discoveryenginepb.RankResponse, error) {
	if s.calls.Add(1) == 1 {
		<-ctx.Done()
		close(s.cancelled)
		return nil, ctx.Err()
	}
	return &discoveryenginepb.RankResponse{Records: []*discoveryenginepb.RankingRecord{{Id: "0", Score: 0.8}}}, nil
}

func TestRealSDKHedgeCancelsSlowRequest(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	server := grpc.NewServer()
	service := &localRankService{cancelled: make(chan struct{})}
	discoveryenginepb.RegisterRankServiceServer(server, service)
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(server.Stop)
	conn, err := grpc.NewClient(listener.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })
	client, err := NewClient(context.Background(), "p", "global", option.WithGRPCConn(conn), option.WithoutAuthentication())
	require.NoError(t, err)
	t.Cleanup(func() { _ = client.(*rankClient).Close() })
	scores, err := NewReranker(client, "m").Score(context.Background(), "q", []string{"a"})
	require.NoError(t, err)
	require.InDelta(t, 0.8, scores[0], 0.000001)
	require.EqualValues(t, 2, service.calls.Load())
	<-service.cancelled
}

type failingRankService struct {
	discoveryenginepb.UnimplementedRankServiceServer
	calls atomic.Int32
}

func (s *failingRankService) Rank(context.Context, *discoveryenginepb.RankRequest) (*discoveryenginepb.RankResponse, error) {
	s.calls.Add(1)
	return nil, status.Error(codes.Unavailable, "retryable")
}

func TestRealSDKRetryableErrorUsesOneRequest(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	server := grpc.NewServer()
	service := &failingRankService{}
	discoveryenginepb.RegisterRankServiceServer(server, service)
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(server.Stop)
	conn, err := grpc.NewClient(listener.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })
	client, err := NewClient(context.Background(), "p", "global", option.WithGRPCConn(conn), option.WithoutAuthentication())
	require.NoError(t, err)
	_, err = NewReranker(client, "m").Score(context.Background(), "q", []string{"a"})
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
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	server := grpc.NewServer()
	service := &sharedRankService{requests: make(map[string][]string)}
	discoveryenginepb.RegisterRankServiceServer(server, service)
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(server.Stop)
	conn, err := grpc.NewClient(listener.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })
	client, err := NewClient(context.Background(), "p", "global", option.WithGRPCConn(conn), option.WithoutAuthentication())
	require.NoError(t, err)
	scorer := NewReranker(client, "m")
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
	require.InDelta(t, 0.3, got["query-a"][0], 0.000001)
	require.InDelta(t, 0.7, got["query-b"][0], 0.000001)
	service.mu.Lock()
	defer service.mu.Unlock()
	require.Equal(t, []string{"document-a", "document-a"}, service.requests["query-a"])
	require.Equal(t, []string{"document-b", "document-b"}, service.requests["query-b"])
}

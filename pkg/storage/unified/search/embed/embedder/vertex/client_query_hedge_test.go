package vertex

import (
	"context"
	"net"
	"sync/atomic"
	"testing"
	"time"

	aiplatform "cloud.google.com/go/aiplatform/apiv1"
	"cloud.google.com/go/aiplatform/apiv1/aiplatformpb"
	"github.com/stretchr/testify/require"
	"google.golang.org/api/option"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/structpb"

	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
)

type heldPredictionServer struct {
	aiplatformpb.UnimplementedPredictionServiceServer
	calls        atomic.Int32
	requests     chan *aiplatformpb.PredictRequest
	originalDone chan struct{}
}

type partialPredictionServer struct {
	aiplatformpb.UnimplementedPredictionServiceServer
}

func (*partialPredictionServer) Predict(context.Context, *aiplatformpb.PredictRequest) (*aiplatformpb.PredictResponse, error) {
	prediction, err := structpb.NewValue(map[string]any{"embeddings": map[string]any{
		"values": []any{2.0}, "statistics": map[string]any{"token_count": 13.0},
	}})
	if err != nil {
		return nil, err
	}
	return &aiplatformpb.PredictResponse{Predictions: []*structpb.Value{prediction}}, nil
}

func TestVertexCountMismatchRetainsReportedTokens(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	server := grpc.NewServer()
	aiplatformpb.RegisterPredictionServiceServer(server, &partialPredictionServer{})
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(server.Stop)
	client, err := NewClient(t.Context(), "p", "global", option.WithEndpoint(listener.Addr().String()), option.WithoutAuthentication(), option.WithGRPCDialOption(grpc.WithTransportCredentials(insecure.NewCredentials())))
	require.NoError(t, err)
	t.Cleanup(func() { _ = client.(*httpClient).Close() })
	result, err := client.PredictEmbeddings(t.Context(), "m", []string{"one", "two"}, 1, "RETRIEVAL_QUERY")
	require.Error(t, err)
	require.Equal(t, 13, result.InputTokens)
	require.Len(t, result.Vectors, 1)
}

func TestVertexObservedSDKDoesNotCountDocumentOrMultiTextAsQuery(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	server := grpc.NewServer()
	aiplatformpb.RegisterPredictionServiceServer(server, &partialPredictionServer{})
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(server.Stop)
	var queryRequests atomic.Int32
	client, err := NewClientWithRequestObserver(t.Context(), "p", "global", func(embedder.QueryAttemptKind) { queryRequests.Add(1) },
		option.WithEndpoint(listener.Addr().String()), option.WithoutAuthentication(),
		option.WithGRPCDialOption(grpc.WithTransportCredentials(insecure.NewCredentials())))
	require.NoError(t, err)
	t.Cleanup(func() { _ = client.(*httpClient).Close() })
	hedger, err := embedder.NewQueryHedger(time.Second, 1, nil)
	require.NoError(t, err)
	adapter := NewDenseEmbedder(client, "m", 1, 2, hedger)
	_, err = adapter.EmbedText(t.Context(), embedder.EmbedTextInput{Texts: []string{"document"}, Task: embedder.TaskRetrievalDocument})
	require.NoError(t, err)
	_, err = adapter.EmbedText(t.Context(), embedder.EmbedTextInput{Texts: []string{"one", "two"}, Task: embedder.TaskRetrievalQuery})
	require.Error(t, err)
	require.Zero(t, queryRequests.Load())
}

func (s *heldPredictionServer) Predict(ctx context.Context, req *aiplatformpb.PredictRequest) (*aiplatformpb.PredictResponse, error) {
	s.requests <- req
	if s.calls.Add(1) == 1 {
		<-ctx.Done()
		close(s.originalDone)
		return nil, ctx.Err()
	}
	prediction, err := structpb.NewValue(map[string]any{"embeddings": map[string]any{
		"values": []any{2.0}, "statistics": map[string]any{"token_count": 7.0},
	}})
	if err != nil {
		return nil, err
	}
	return &aiplatformpb.PredictResponse{Predictions: []*structpb.Value{prediction}}, nil
}

func TestVertexRealAdapterHedgeUsesSameRequestAndCancelsOriginal(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	server := grpc.NewServer()
	stub := &heldPredictionServer{requests: make(chan *aiplatformpb.PredictRequest, 2), originalDone: make(chan struct{})}
	aiplatformpb.RegisterPredictionServiceServer(server, stub)
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(server.Stop)
	deadlines := make(chan time.Time, 2)
	var originalRequests, extraRequests atomic.Int32
	client, err := NewClientWithRequestObserver(t.Context(), "p", "global", func(kind embedder.QueryAttemptKind) {
		switch kind {
		case embedder.QueryAttemptOriginal:
			originalRequests.Add(1)
		case embedder.QueryAttemptExtra:
			extraRequests.Add(1)
		}
	}, option.WithEndpoint(listener.Addr().String()), option.WithoutAuthentication(), option.WithGRPCDialOption(grpc.WithTransportCredentials(insecure.NewCredentials())), option.WithGRPCDialOption(grpc.WithChainUnaryInterceptor(func(ctx context.Context, method string, req, reply any, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, options ...grpc.CallOption) error {
		if method == "/google.cloud.aiplatform.v1.PredictionService/Predict" {
			deadline, _ := ctx.Deadline()
			deadlines <- deadline
		}
		return invoker(ctx, method, req, reply, cc, options...)
	})))
	require.NoError(t, err)
	t.Cleanup(func() { _ = client.(*httpClient).Close() })
	hedger, err := embedder.NewQueryHedger(10*time.Millisecond, 1, nil)
	require.NoError(t, err)
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	wantDeadline, _ := ctx.Deadline()
	out, err := NewDenseEmbedder(client, "m", 1, 1, hedger).EmbedText(ctx, embedder.EmbedTextInput{Texts: []string{"query"}, Task: embedder.TaskRetrievalQuery})
	require.NoError(t, err)
	require.Equal(t, float32(2), out.Embeddings[0].Dense[0])
	require.Equal(t, 7, out.InputTokens)
	<-stub.originalDone
	require.True(t, proto.Equal(<-stub.requests, <-stub.requests))
	require.Equal(t, wantDeadline, <-deadlines)
	require.Equal(t, wantDeadline, <-deadlines)
	require.Equal(t, int32(2), stub.calls.Load())
	require.Equal(t, int32(1), originalRequests.Load())
	require.Equal(t, int32(1), extraRequests.Load())
}

type countingPredictionServer struct {
	aiplatformpb.UnimplementedPredictionServiceServer
	requests atomic.Int32
}

func TestVertexTransportObserverAttributesOriginalAndExtra(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	server := grpc.NewServer()
	stub := &countingPredictionServer{}
	aiplatformpb.RegisterPredictionServiceServer(server, stub)
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(server.Stop)
	var original, extra atomic.Int32
	client, err := NewClientWithRequestObserver(t.Context(), "p", "global", func(kind embedder.QueryAttemptKind) {
		switch kind {
		case embedder.QueryAttemptOriginal:
			original.Add(1)
		case embedder.QueryAttemptExtra:
			extra.Add(1)
		}
	}, option.WithEndpoint(listener.Addr().String()), option.WithoutAuthentication(), option.WithGRPCDialOption(grpc.WithTransportCredentials(insecure.NewCredentials())))
	require.NoError(t, err)
	t.Cleanup(func() { _ = client.(*httpClient).Close() })
	for _, kind := range []embedder.QueryAttemptKind{embedder.QueryAttemptOriginal, embedder.QueryAttemptExtra} {
		_, err := client.PredictEmbeddings(embedder.WithQueryAttempt(t.Context(), kind), "m", []string{"query"}, 1, "RETRIEVAL_QUERY")
		require.Error(t, err)
	}
	require.Equal(t, int32(2), stub.requests.Load())
	require.Equal(t, int32(1), original.Load())
	require.Equal(t, int32(1), extra.Load())
}

func (s *countingPredictionServer) Predict(context.Context, *aiplatformpb.PredictRequest) (*aiplatformpb.PredictResponse, error) {
	s.requests.Add(1)
	return nil, status.Error(codes.ResourceExhausted, "quota")
}

func TestVertexPredictDoesNotRetryQuotaAtTransportBoundary(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	server := grpc.NewServer()
	stub := &countingPredictionServer{}
	aiplatformpb.RegisterPredictionServiceServer(server, stub)
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(server.Stop)
	conn, err := grpc.NewClient(listener.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })
	pred, err := aiplatform.NewPredictionClient(t.Context(), option.WithGRPCConn(conn))
	require.NoError(t, err)
	t.Cleanup(func() { _ = pred.Close() })
	client := &httpClient{pred: pred, endpointFn: func(string) string { return "projects/p/locations/global/publishers/google/models/m" }}

	for range 2 {
		_, err := client.PredictEmbeddings(t.Context(), "m", []string{"query"}, 1, "RETRIEVAL_QUERY")
		require.Error(t, err)
	}
	require.Equal(t, int32(2), stub.requests.Load())
}

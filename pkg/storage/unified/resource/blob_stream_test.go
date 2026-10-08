package resource

import (
	"context"
	"io"
	"net"
	"strings"
	"testing"
	"time"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type testStreamingBlob struct{ *stubBlobSupport }

func (b *testStreamingBlob) PutResourceBlobStream(_ context.Context, _ *resourcepb.PutBlobRequest, r io.Reader) (*resourcepb.PutBlobResponse, error) {
	n, err := io.Copy(io.Discard, r)
	if err != nil {
		return nil, err
	}
	return &resourcepb.PutBlobResponse{Uid: "stream-uid", Size: n}, nil
}

func (b *testStreamingBlob) GetResourceBlobStream(_ context.Context, _ *resourcepb.ResourceKey, _ *utils.BlobInfo, open func(string) (io.Writer, error)) error {
	w, err := open("application/octet-stream")
	if err != nil {
		return err
	}
	_, err = io.Copy(w, strings.NewReader(strings.Repeat("x", 64<<10)))
	return err
}

type stalledPutBlobStream struct {
	resourcepb.BlobStoreStreaming_PutBlobStreamServer
	ctx     context.Context
	started chan struct{}
	unblock chan struct{}
}

func (s *stalledPutBlobStream) Context() context.Context { return s.ctx }
func (s *stalledPutBlobStream) Recv() (*resourcepb.PutBlobRequest, error) {
	close(s.started)
	<-s.unblock
	return nil, io.EOF
}

func TestPutBlobStreamDeadlineBeforeMetadata(t *testing.T) {
	s := &server{blobTransfers: newBlobTransfers()}
	ctx, cancel := context.WithTimeout(authlib.WithAuthInfo(t.Context(), &identity.StaticRequester{Namespace: "default"}), 500*time.Millisecond)
	defer cancel()
	newStream := func(ctx context.Context) *stalledPutBlobStream {
		stream := &stalledPutBlobStream{ctx: ctx, started: make(chan struct{}), unblock: make(chan struct{})}
		t.Cleanup(func() { close(stream.unblock) })
		return stream
	}
	first := newStream(ctx)
	second := newStream(ctx)
	firstResult := make(chan error, 1)
	secondResult := make(chan error, 1)
	go func() { firstResult <- s.PutBlobStream(first) }()
	go func() { secondResult <- s.PutBlobStream(second) }()
	<-first.started
	<-second.started

	third := newStream(ctx)
	require.Equal(t, codes.ResourceExhausted, status.Code(s.PutBlobStream(third)))
	select {
	case <-third.started:
		t.Fatal("received metadata without a transfer slot")
	default:
	}
	require.Equal(t, codes.DeadlineExceeded, status.Code(<-firstResult))
	require.Equal(t, codes.DeadlineExceeded, status.Code(<-secondResult))
	release, err := s.acquireBlobTransfer("default")
	require.NoError(t, err)
	release()
}

type contextStream struct {
	grpc.ServerStream
	ctx context.Context
}

func (s contextStream) Context() context.Context { return s.ctx }

type stalledGetBlobStream struct {
	grpc.ServerStream
	ctx     context.Context
	started chan struct{}
	unblock chan struct{}
}

func (s *stalledGetBlobStream) Context() context.Context { return s.ctx }
func (s *stalledGetBlobStream) RecvMsg(any) error {
	close(s.started)
	<-s.unblock
	return io.EOF
}

func TestGetBlobStreamDeadlineBeforeRequest(t *testing.T) {
	s := &server{blobTransfers: newBlobTransfers()}
	ctx, cancel := context.WithCancel(authlib.WithAuthInfo(t.Context(), &identity.StaticRequester{Namespace: "default"}))
	defer cancel()
	interceptor := BlobStreamServerInterceptor(s)
	info := &grpc.StreamServerInfo{FullMethod: resourcepb.BlobStoreStreaming_GetBlobStream_FullMethodName}
	handler := resourcepb.BlobStoreStreaming_ServiceDesc.Streams[1].Handler
	newStream := func() *stalledGetBlobStream {
		stream := &stalledGetBlobStream{ctx: ctx, started: make(chan struct{}), unblock: make(chan struct{})}
		t.Cleanup(func() { close(stream.unblock) })
		return stream
	}
	first, second := newStream(), newStream()
	results := make(chan error, 2)
	deadline := make(chan time.Time, 2)
	run := func(stream *stalledGetBlobStream) {
		results <- interceptor(s, stream, info, func(srv any, wrapped grpc.ServerStream) error {
			d, ok := wrapped.Context().Deadline()
			if !ok {
				return status.Error(codes.Internal, "missing server deadline")
			}
			deadline <- d
			return handler(srv, wrapped)
		})
	}
	before := time.Now()
	go run(first)
	go run(second)
	<-first.started
	<-second.started
	for range 2 {
		d := <-deadline
		require.WithinDuration(t, before.Add(blobStreamTimeout), d, time.Second)
	}
	third := newStream()
	require.Equal(t, codes.ResourceExhausted, status.Code(interceptor(s, third, info, handler)))
	select {
	case <-third.started:
		t.Fatal("received request without a transfer slot")
	default:
	}
	cancel()
	for range 2 {
		require.Equal(t, codes.Canceled, status.Code(<-results))
	}
	s.blobTransfers.mu.Lock()
	require.Empty(t, s.blobTransfers.active)
	s.blobTransfers.mu.Unlock()
}

func TestGetBlobStreamInitialRequestTimeout(t *testing.T) {
	s := &server{blobTransfers: newBlobTransfers()}
	ctx, cancel := context.WithTimeout(authlib.WithAuthInfo(t.Context(), &identity.StaticRequester{Namespace: "default"}), 100*time.Millisecond)
	defer cancel()
	stream := &stalledGetBlobStream{ctx: ctx, started: make(chan struct{}), unblock: make(chan struct{})}
	defer close(stream.unblock)
	err := BlobStreamServerInterceptor(s)(s, stream,
		&grpc.StreamServerInfo{FullMethod: resourcepb.BlobStoreStreaming_GetBlobStream_FullMethodName},
		resourcepb.BlobStoreStreaming_ServiceDesc.Streams[1].Handler)
	require.Equal(t, codes.DeadlineExceeded, status.Code(err))
	require.Empty(t, s.blobTransfers.active)
}

func TestBlobStreamLimits(t *testing.T) {
	s := &server{blobTransfers: newBlobTransfers()}
	release1, err := s.acquireBlobTransfer("tenant-a")
	require.NoError(t, err)
	defer release1()
	release2, err := s.acquireBlobTransfer("tenant-a")
	require.NoError(t, err)
	defer release2()
	_, err = s.acquireBlobTransfer("tenant-a")
	require.Equal(t, codes.ResourceExhausted, status.Code(err))
	releaseOther, err := s.acquireBlobTransfer("tenant-b")
	require.NoError(t, err)
	releaseOther()

	reader := &blobStreamReader{ctx: t.Context(), total: blobStreamMaxSize, recv: func() (*resourcepb.PutBlobRequest, error) {
		return &resourcepb.PutBlobRequest{Value: []byte("excess")}, nil
	}}
	_, err = reader.Read(make([]byte, 10))
	require.Equal(t, codes.ResourceExhausted, status.Code(err))
	writer := &blobStreamWriter{ctx: t.Context(), total: blobStreamMaxSize, send: func(*resourcepb.GetBlobResponse) error { t.Fatal("sent oversized value"); return nil }}
	_, err = writer.Write([]byte("excess"))
	require.Equal(t, codes.ResourceExhausted, status.Code(err))
}

func TestBlobStreamLocalClient(t *testing.T) {
	srv, _, unary := newBlobAuthzTestServer(t, nil)
	srv.blob = &testStreamingBlob{stubBlobSupport: unary}
	client := NewLocalResourceClient(srv)
	ctx := ctxWithUserInNs("default")
	key := &resourcepb.ResourceKey{Group: "playlist.grafana.app", Resource: "playlists", Namespace: "default", Name: "local-stream"}

	put, err := client.PutBlob(ctx, &resourcepb.PutBlobRequest{Resource: key, Value: []byte("streamed")})
	require.NoError(t, err)
	require.Equal(t, "stream-uid", put.Uid)
	require.False(t, unary.putReached)

	created, err := srv.Create(ctx, &resourcepb.CreateRequest{
		Key:   key,
		Value: []byte(`{"apiVersion":"playlist.grafana.app/v0alpha1","kind":"Playlist","metadata":{"name":"local-stream","namespace":"default"},"spec":{"title":"test","interval":"5m","items":[]}}`),
	})
	require.NoError(t, err)
	require.Nil(t, created.Error)

	get, err := client.GetBlob(ctx, &resourcepb.GetBlobRequest{Resource: key, Uid: put.Uid, MustProxyBytes: true})
	require.NoError(t, err)
	require.Equal(t, "application/octet-stream", get.ContentType)
	require.Equal(t, strings.Repeat("x", 64<<10), string(get.Value))
	require.False(t, unary.getReached)
}

func TestBlobStreamRemoteTransportAndAuthorization(t *testing.T) {
	srv, ac, _ := newBlobAuthzTestServer(t, nil)
	srv.blob = &testStreamingBlob{stubBlobSupport: &stubBlobSupport{}}
	listener := bufconn.Listen(1 << 20)
	server := grpc.NewServer(grpc.ChainStreamInterceptor(func(_ any, stream grpc.ServerStream, _ *grpc.StreamServerInfo, next grpc.StreamHandler) error {
		ctx := authlib.WithAuthInfo(stream.Context(), &identity.StaticRequester{
			Type: authlib.TypeUser, UserID: 1, UserUID: "u1", Namespace: "default",
		})
		return next(srv, contextStream{ServerStream: stream, ctx: ctx})
	}, BlobStreamServerInterceptor(srv)))
	resourcepb.RegisterBlobStoreStreamingServer(server, srv)
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(func() { server.Stop(); _ = listener.Close() })
	conn, err := grpc.NewClient("passthrough:///blob-stream", grpc.WithTransportCredentials(insecure.NewCredentials()), grpc.WithContextDialer(func(context.Context, string) (net.Conn, error) { return listener.Dial() }))
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })
	client := resourcepb.NewBlobStoreStreamingClient(conn)
	ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
	defer cancel()
	key := &resourcepb.ResourceKey{Group: "playlist.grafana.app", Resource: "playlists", Namespace: "default", Name: "stream"}

	upload := func(size int) (*resourcepb.PutBlobResponse, error) {
		stream, err := client.PutBlobStream(ctx)
		if err != nil {
			return nil, err
		}
		if err := stream.Send(&resourcepb.PutBlobRequest{Resource: key, ContentType: "application/octet-stream"}); err != nil {
			return nil, err
		}
		for remaining := size; remaining > 0; {
			n := min(remaining, blobStreamChunkSize)
			if err := stream.Send(&resourcepb.PutBlobRequest{Value: make([]byte, n)}); err != nil {
				return nil, err
			}
			remaining -= n
		}
		return stream.CloseAndRecv()
	}
	rsp, err := upload(5 << 20)
	require.NoError(t, err)
	require.Nil(t, rsp.Error)
	require.Equal(t, int64(5<<20), rsp.Size)

	ac.fn = func(authlib.CheckRequest, string) (authlib.CheckResponse, error) { return deny() }
	denied, err := upload(1)
	require.NoError(t, err)
	require.Equal(t, int32(403), denied.Error.Code)
	ac.fn = func(authlib.CheckRequest, string) (authlib.CheckResponse, error) { return allow() }
	created, err := srv.Create(ctxWithUserInNs("default"), &resourcepb.CreateRequest{
		Key:   key,
		Value: []byte(`{"apiVersion":"playlist.grafana.app/v0alpha1","kind":"Playlist","metadata":{"name":"stream","namespace":"default"},"spec":{"title":"test","interval":"5m","items":[]}}`),
	})
	require.NoError(t, err)
	require.Nil(t, created.Error)

	release, err := srv.acquireBlobTransfer("default")
	require.NoError(t, err)
	defer release()
	get, err := client.GetBlobStream(ctx, &resourcepb.GetBlobRequest{Resource: key, Uid: rsp.Uid})
	require.NoError(t, err)
	first, err := get.Recv()
	require.NoError(t, err)
	require.Equal(t, "application/octet-stream", first.ContentType)
	chunk, err := get.Recv()
	require.NoError(t, err)
	require.Len(t, chunk.Value, blobStreamChunkSize)
	_, err = get.Recv()
	require.ErrorIs(t, err, io.EOF)

	tooLarge, err := client.PutBlobStream(ctx)
	require.NoError(t, err)
	require.NoError(t, tooLarge.Send(&resourcepb.PutBlobRequest{Resource: key}))
	require.NoError(t, tooLarge.Send(&resourcepb.PutBlobRequest{Value: make([]byte, blobStreamChunkSize+1)}))
	_, err = tooLarge.CloseAndRecv()
	require.Equal(t, codes.ResourceExhausted, status.Code(err))
}

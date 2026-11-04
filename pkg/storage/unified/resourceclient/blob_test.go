package resourceclient

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/hex"
	"errors"
	"io"
	"net"
	"strconv"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type blobTestServer struct {
	resourcepb.UnimplementedBlobStoreServer
	resourcepb.UnimplementedBlobStoreStreamingServer
	put      func(resourcepb.BlobStoreStreaming_PutBlobStreamServer) error
	get      func(*resourcepb.GetBlobRequest, resourcepb.BlobStoreStreaming_GetBlobStreamServer) error
	unaryPut func(*resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error)
	unaryGet func(*resourcepb.GetBlobRequest) (*resourcepb.GetBlobResponse, error)
	putCalls atomic.Int32
	getCalls atomic.Int32
}

func (s *blobTestServer) PutBlob(_ context.Context, req *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error) {
	s.putCalls.Add(1)
	return s.unaryPut(req)
}

func (s *blobTestServer) GetBlob(_ context.Context, req *resourcepb.GetBlobRequest) (*resourcepb.GetBlobResponse, error) {
	s.getCalls.Add(1)
	return s.unaryGet(req)
}

func (s *blobTestServer) PutBlobStream(stream resourcepb.BlobStoreStreaming_PutBlobStreamServer) error {
	return s.put(stream)
}

func (s *blobTestServer) GetBlobStream(req *resourcepb.GetBlobRequest, stream resourcepb.BlobStoreStreaming_GetBlobStreamServer) error {
	return s.get(req, stream)
}

func newBlobTestClient(t *testing.T, srv *blobTestServer, streaming bool) ResourceClient {
	t.Helper()
	listener := bufconn.Listen(1 << 20)
	server := grpc.NewServer()
	resourcepb.RegisterBlobStoreServer(server, srv)
	if streaming {
		resourcepb.RegisterBlobStoreStreamingServer(server, srv)
	}
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(server.Stop)
	t.Cleanup(func() { _ = listener.Close() })
	conn, err := grpc.NewClient("passthrough:///blob-test",
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithContextDialer(func(context.Context, string) (net.Conn, error) { return listener.Dial() }))
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })
	return NewResourceClientFromConns(conn, conn)
}

func TestBlobClientStreamingRoundTrip(t *testing.T) {
	for _, size := range []int{1024, 5 << 20, 64 << 20} {
		t.Run(strconv.Itoa(size)+" bytes", func(t *testing.T) {
			value := bytes.Repeat([]byte{0, 1, 127, 255}, size/4)
			hash := md5.Sum(value)
			want := &resourcepb.PutBlobResponse{Uid: "blob-uid", Size: int64(size), Hash: hex.EncodeToString(hash[:]), MimeType: "application/octet-stream"}
			putMetadata := make(chan *resourcepb.PutBlobRequest, 1)
			getRequest := make(chan *resourcepb.GetBlobRequest, 1)
			srv := &blobTestServer{
				put: func(stream resourcepb.BlobStoreStreaming_PutBlobStreamServer) error {
					first, err := stream.Recv()
					if err != nil {
						return err
					}
					putMetadata <- first
					if len(first.Value) != 0 {
						return status.Error(codes.InvalidArgument, "metadata contains bytes")
					}
					digest, received := md5.New(), 0
					for {
						chunk, err := stream.Recv()
						if errors.Is(err, io.EOF) {
							break
						}
						if err != nil {
							return err
						}
						if len(chunk.Value) == 0 || len(chunk.Value) > blobChunkSize || chunk.Resource != nil || chunk.ContentType != "" || chunk.Folder != "" || chunk.Method != resourcepb.PutBlobRequest_GRPC {
							return status.Error(codes.InvalidArgument, "invalid value-only chunk")
						}
						received += len(chunk.Value)
						_, _ = digest.Write(chunk.Value)
					}
					if received != size || hex.EncodeToString(digest.Sum(nil)) != want.Hash {
						return status.Error(codes.DataLoss, "upload differs from source")
					}
					if err := stream.SendHeader(metadata.Pairs("blob-test", "upload")); err != nil {
						return err
					}
					return stream.SendAndClose(want)
				},
				get: func(req *resourcepb.GetBlobRequest, stream resourcepb.BlobStoreStreaming_GetBlobStreamServer) error {
					getRequest <- req
					if err := stream.Send(&resourcepb.GetBlobResponse{ContentType: "application/octet-stream"}); err != nil {
						return err
					}
					for start := 0; start < size; start += blobChunkSize {
						if err := stream.Send(&resourcepb.GetBlobResponse{Value: value[start:min(start+blobChunkSize, size)]}); err != nil {
							return err
						}
					}
					return nil
				},
			}
			client := newBlobTestClient(t, srv, true)
			ctx, cancel := context.WithTimeout(t.Context(), time.Minute)
			defer cancel()
			key := &resourcepb.ResourceKey{Namespace: "default", Group: "dashboard.grafana.app", Resource: "snapshots", Name: "fixture"}
			req := &resourcepb.PutBlobRequest{Resource: key, ContentType: "application/octet-stream", Folder: "folder", Value: value}
			var header metadata.MD
			put, err := client.PutBlob(ctx, req, grpc.Header(&header))
			require.NoError(t, err)
			require.True(t, proto.Equal(want, put))
			require.Equal(t, []string{"upload"}, header.Get("blob-test"))
			require.Equal(t, value, req.Value)
			require.True(t, proto.Equal(&resourcepb.PutBlobRequest{Resource: key, ContentType: req.ContentType, Folder: req.Folder}, <-putMetadata))
			getReq := &resourcepb.GetBlobRequest{Resource: key, Uid: put.Uid, ResourceVersion: 42, MustProxyBytes: true}
			get, err := client.GetBlob(ctx, getReq)
			require.NoError(t, err)
			require.Equal(t, req.ContentType, get.ContentType)
			require.Equal(t, value, get.Value)
			require.True(t, proto.Equal(getReq, <-getRequest))
			require.Zero(t, srv.putCalls.Load())
			require.Zero(t, srv.getCalls.Load())
		})
	}
}

func TestBlobClientUnaryFallback(t *testing.T) {
	for _, streaming := range []bool{false, true} {
		name := "old server"
		if streaming {
			name = "unsupported backend"
		}
		t.Run(name, func(t *testing.T) {
			putReq := &resourcepb.PutBlobRequest{ContentType: "application/json", Folder: "folder", Value: []byte("blob")}
			getReq := &resourcepb.GetBlobRequest{Uid: "uid", ResourceVersion: 12, MustProxyBytes: true}
			putRequests := make(chan *resourcepb.PutBlobRequest, 1)
			getRequests := make(chan *resourcepb.GetBlobRequest, 1)
			wantPut := &resourcepb.PutBlobResponse{Uid: "uid", Size: 4, MimeType: "application/json", Charset: "utf-8"}
			wantGet := &resourcepb.GetBlobResponse{ContentType: "application/json", Value: putReq.Value}
			srv := &blobTestServer{
				put: func(stream resourcepb.BlobStoreStreaming_PutBlobStreamServer) error {
					if _, err := stream.Recv(); err != nil {
						return err
					}
					return status.Error(codes.Unimplemented, "unsupported backend")
				},
				get: func(*resourcepb.GetBlobRequest, resourcepb.BlobStoreStreaming_GetBlobStreamServer) error {
					return status.Error(codes.Unimplemented, "unsupported backend")
				},
				unaryPut: func(req *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error) {
					putRequests <- req
					return wantPut, nil
				},
				unaryGet: func(req *resourcepb.GetBlobRequest) (*resourcepb.GetBlobResponse, error) {
					getRequests <- req
					return wantGet, nil
				},
			}
			client := newBlobTestClient(t, srv, streaming)
			put, err := client.PutBlob(t.Context(), putReq)
			require.NoError(t, err)
			require.True(t, proto.Equal(wantPut, put))
			require.True(t, proto.Equal(putReq, <-putRequests))
			get, err := client.GetBlob(t.Context(), getReq)
			require.NoError(t, err)
			require.True(t, proto.Equal(wantGet, get))
			require.True(t, proto.Equal(getReq, <-getRequests))
			require.EqualValues(t, 1, srv.putCalls.Load())
			require.EqualValues(t, 1, srv.getCalls.Load())
		})
	}
}

func TestBlobClientKeepsSignedURLRequestsUnary(t *testing.T) {
	putRequests := make(chan *resourcepb.PutBlobRequest, 1)
	getRequests := make(chan *resourcepb.GetBlobRequest, 1)
	srv := &blobTestServer{
		unaryPut: func(req *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error) {
			putRequests <- req
			return &resourcepb.PutBlobResponse{Url: "https://example.com/upload"}, nil
		},
		unaryGet: func(req *resourcepb.GetBlobRequest) (*resourcepb.GetBlobResponse, error) {
			getRequests <- req
			return &resourcepb.GetBlobResponse{Url: "https://example.com/download"}, nil
		},
	}
	client := newBlobTestClient(t, srv, true)
	putReq := &resourcepb.PutBlobRequest{Method: resourcepb.PutBlobRequest_HTTP}
	put, err := client.PutBlob(t.Context(), putReq)
	require.NoError(t, err)
	require.Equal(t, "https://example.com/upload", put.Url)
	require.True(t, proto.Equal(putReq, <-putRequests))
	getReq := &resourcepb.GetBlobRequest{Uid: "uid"}
	get, err := client.GetBlob(t.Context(), getReq)
	require.NoError(t, err)
	require.Equal(t, "https://example.com/download", get.Url)
	require.True(t, proto.Equal(getReq, <-getRequests))
}

func TestBlobClientDoesNotReplayFailures(t *testing.T) {
	for _, code := range []codes.Code{codes.PermissionDenied, codes.ResourceExhausted, codes.Unavailable, codes.DeadlineExceeded, codes.Canceled} {
		t.Run(code.String(), func(t *testing.T) {
			srv := &blobTestServer{
				put: func(resourcepb.BlobStoreStreaming_PutBlobStreamServer) error { return status.Error(code, "failure") },
				get: func(*resourcepb.GetBlobRequest, resourcepb.BlobStoreStreaming_GetBlobStreamServer) error {
					return status.Error(code, "failure")
				},
			}
			client := newBlobTestClient(t, srv, true)
			_, err := client.PutBlob(t.Context(), &resourcepb.PutBlobRequest{Value: bytes.Repeat([]byte("x"), 5<<20)})
			require.Equal(t, code, status.Code(err))
			_, err = client.GetBlob(t.Context(), &resourcepb.GetBlobRequest{MustProxyBytes: true})
			require.Equal(t, code, status.Code(err))
			require.Zero(t, srv.putCalls.Load())
			require.Zero(t, srv.getCalls.Load())
		})
	}
}

func TestBlobClientPreservesErrorResults(t *testing.T) {
	failure := &resourcepb.ErrorResult{Code: 403, Message: "denied"}
	srv := &blobTestServer{
		put: func(stream resourcepb.BlobStoreStreaming_PutBlobStreamServer) error {
			if _, err := stream.Recv(); err != nil {
				return err
			}
			return stream.SendAndClose(&resourcepb.PutBlobResponse{Error: failure})
		},
		get: func(_ *resourcepb.GetBlobRequest, stream resourcepb.BlobStoreStreaming_GetBlobStreamServer) error {
			return stream.Send(&resourcepb.GetBlobResponse{Error: failure})
		},
	}
	client := newBlobTestClient(t, srv, true)
	put, err := client.PutBlob(t.Context(), &resourcepb.PutBlobRequest{Value: bytes.Repeat([]byte("x"), 5<<20)})
	require.NoError(t, err)
	require.True(t, proto.Equal(failure, put.Error))
	get, err := client.GetBlob(t.Context(), &resourcepb.GetBlobRequest{MustProxyBytes: true})
	require.NoError(t, err)
	require.True(t, proto.Equal(failure, get.Error))
	require.Zero(t, srv.putCalls.Load())
	require.Zero(t, srv.getCalls.Load())
}

func TestBlobClientRejectsInvalidDownloads(t *testing.T) {
	for _, tc := range []struct {
		name     string
		messages []*resourcepb.GetBlobResponse
		end      error
		code     codes.Code
	}{
		{name: "missing metadata", code: codes.DataLoss},
		{name: "data before metadata", messages: []*resourcepb.GetBlobResponse{{Value: []byte("x")}}, code: codes.DataLoss},
		{name: "oversized chunk", messages: []*resourcepb.GetBlobResponse{{ContentType: "application/json"}, {Value: make([]byte, blobChunkSize+1)}}, code: codes.ResourceExhausted},
		{name: "repeated metadata", messages: []*resourcepb.GetBlobResponse{{ContentType: "application/json"}, {ContentType: "application/json"}}, code: codes.DataLoss},
		{name: "partial failure", messages: []*resourcepb.GetBlobResponse{{ContentType: "application/json"}, {Value: []byte("x")}}, end: status.Error(codes.Unavailable, "interrupted"), code: codes.Unavailable},
		{name: "late unimplemented", messages: []*resourcepb.GetBlobResponse{{ContentType: "application/json"}}, end: status.Error(codes.Unimplemented, "interrupted"), code: codes.Unimplemented},
	} {
		t.Run(tc.name, func(t *testing.T) {
			srv := &blobTestServer{get: func(_ *resourcepb.GetBlobRequest, stream resourcepb.BlobStoreStreaming_GetBlobStreamServer) error {
				for _, message := range tc.messages {
					if err := stream.Send(message); err != nil {
						return err
					}
				}
				return tc.end
			}}
			client := newBlobTestClient(t, srv, true)
			get, err := client.GetBlob(t.Context(), &resourcepb.GetBlobRequest{MustProxyBytes: true})
			require.Nil(t, get)
			require.Equal(t, tc.code, status.Code(err))
			require.Zero(t, srv.getCalls.Load())
		})
	}
}

func TestBlobClientSizeLimits(t *testing.T) {
	srv := &blobTestServer{get: func(_ *resourcepb.GetBlobRequest, stream resourcepb.BlobStoreStreaming_GetBlobStreamServer) error {
		if err := stream.Send(&resourcepb.GetBlobResponse{ContentType: "application/octet-stream"}); err != nil {
			return err
		}
		chunk := &resourcepb.GetBlobResponse{Value: make([]byte, blobChunkSize)}
		for i := 0; i <= blobMaxSize/blobChunkSize; i++ {
			if err := stream.Send(chunk); err != nil {
				return err
			}
		}
		return nil
	}}
	client := newBlobTestClient(t, srv, true)
	_, err := client.PutBlob(t.Context(), &resourcepb.PutBlobRequest{Value: make([]byte, blobMaxSize+1)})
	require.Equal(t, codes.ResourceExhausted, status.Code(err))
	get, err := client.GetBlob(t.Context(), &resourcepb.GetBlobRequest{MustProxyBytes: true})
	require.Nil(t, get)
	require.Equal(t, codes.ResourceExhausted, status.Code(err))
	require.Zero(t, srv.putCalls.Load())
	require.Zero(t, srv.getCalls.Load())
}

func TestBlobClientCancellation(t *testing.T) {
	started := make(chan struct{})
	stopped := make(chan struct{})
	srv := &blobTestServer{get: func(_ *resourcepb.GetBlobRequest, stream resourcepb.BlobStoreStreaming_GetBlobStreamServer) error {
		close(started)
		<-stream.Context().Done()
		close(stopped)
		return stream.Context().Err()
	}}
	client := newBlobTestClient(t, srv, true)
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	result := make(chan error, 1)
	go func() {
		_, err := client.GetBlob(ctx, &resourcepb.GetBlobRequest{MustProxyBytes: true})
		result <- err
	}()
	select {
	case <-started:
	case <-time.After(time.Second * 5):
		t.Fatal("download did not start")
	}
	cancel()
	select {
	case err := <-result:
		require.Equal(t, codes.Canceled, status.Code(err))
	case <-time.After(time.Second * 5):
		t.Fatal("client did not cancel")
	}
	select {
	case <-stopped:
	case <-time.After(time.Second * 5):
		t.Fatal("server stream was not cancelled")
	}
	require.Zero(t, srv.getCalls.Load())
}

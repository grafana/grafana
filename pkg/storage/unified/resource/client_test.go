package resource

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"testing"
	"testing/synctest"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type retryTestResourceServer struct {
	ResourceServer
	failure  error
	attempts int
}

func (s *retryTestResourceServer) Update(context.Context, *resourcepb.UpdateRequest) (*resourcepb.UpdateResponse, error) {
	s.attempts++
	if s.attempts == 1 {
		return nil, s.failure
	}
	return &resourcepb.UpdateResponse{}, nil
}

func TestLocalResourceClientRetryCodes(t *testing.T) {
	for _, code := range []codes.Code{codes.Aborted, codes.Unavailable, codes.ResourceExhausted, codes.InvalidArgument} {
		t.Run(code.String(), func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				st, err := status.New(code, "failure").WithDetails(&resourcepb.ErrorResult{Code: http.StatusConflict, Message: "conflict"})
				require.NoError(t, err)
				srv := &retryTestResourceServer{failure: st.Err()}
				client := NewLocalResourceClient(srv)
				ctx, _ := identity.WithServiceIdentity(t.Context(), 1)
				_, err = client.Update(ctx, &resourcepb.UpdateRequest{})
				if code == codes.Unavailable || code == codes.ResourceExhausted {
					require.NoError(t, err)
					require.Equal(t, 2, srv.attempts)
				} else {
					require.Equal(t, 1, srv.attempts)
					require.Equal(t, st.Proto(), status.Convert(err).Proto())
				}
			})
		})
	}
}

type rejectedLocalClientStream struct {
	grpc.ClientStream
	sendErr error
	recvErr error
}

func (s *rejectedLocalClientStream) SendMsg(any) error { return s.sendErr }
func (s *rejectedLocalClientStream) RecvMsg(any) error { return s.recvErr }

func TestLocalStreamClientInterceptor(t *testing.T) {
	rejected := status.Error(codes.ResourceExhausted, "too many blob transfers for tenant")
	for _, tc := range []struct {
		name          string
		clientStreams bool
		sendErr       error
		wantErr       error
	}{
		{name: "server streaming early rejection", sendErr: io.EOF},
		{name: "server streaming wrapped EOF", sendErr: fmt.Errorf("send failed: %w", io.EOF)},
		{name: "server streaming send succeeds"},
		{name: "server streaming other error", sendErr: context.Canceled, wantErr: context.Canceled},
		{name: "client streaming preserves EOF", clientStreams: true, sendErr: io.EOF, wantErr: io.EOF},
	} {
		t.Run(tc.name, func(t *testing.T) {
			underlying := &rejectedLocalClientStream{sendErr: tc.sendErr, recvErr: rejected}
			streamer := func(context.Context, *grpc.StreamDesc, *grpc.ClientConn, string, ...grpc.CallOption) (grpc.ClientStream, error) {
				return underlying, nil
			}
			stream, err := localStreamClientInterceptor(t.Context(), &grpc.StreamDesc{ClientStreams: tc.clientStreams, ServerStreams: true}, nil, "test", streamer)
			require.NoError(t, err)
			require.ErrorIs(t, stream.SendMsg(&resourcepb.GetBlobRequest{}), tc.wantErr)
			require.ErrorIs(t, stream.RecvMsg(&resourcepb.GetBlobResponse{}), rejected)
		})
	}

	t.Run("stream creation error", func(t *testing.T) {
		streamer := func(context.Context, *grpc.StreamDesc, *grpc.ClientConn, string, ...grpc.CallOption) (grpc.ClientStream, error) {
			return nil, rejected
		}
		stream, err := localStreamClientInterceptor(t.Context(), &grpc.StreamDesc{ServerStreams: true}, nil, "test", streamer)
		require.Nil(t, stream)
		require.ErrorIs(t, err, rejected)
	})
}

type missingReadBackend struct{ mockStorageBackend }

func (*missingReadBackend) ReadResource(context.Context, *resourcepb.ReadRequest) *BackendReadResponse {
	return &BackendReadResponse{Error: &resourcepb.ErrorResult{Code: http.StatusNotFound, Message: "missing"}}
}

func TestLocalResourceClientErrorConversion(t *testing.T) {
	for _, enabled := range []bool{false, true} {
		t.Run(fmt.Sprintf("enabled=%t", enabled), func(t *testing.T) {
			srv, err := NewResourceServer(ResourceServerOptions{
				Backend: &missingReadBackend{}, GRPCErrorResultToStatus: enabled,
			})
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, srv.Stop(context.Background())) })
			client := NewLocalResourceClient(srv)
			ctx, _ := identity.WithServiceIdentity(t.Context(), 1)
			resp, err := client.Read(ctx, &resourcepb.ReadRequest{Key: &resourcepb.ResourceKey{
				Namespace: "default", Group: "example.grafana.app", Resource: "widgets", Name: "missing",
			}})
			if !enabled {
				require.NoError(t, err)
				require.Equal(t, int32(http.StatusNotFound), resp.GetError().GetCode())
				return
			}
			require.Equal(t, codes.NotFound, status.Code(err))
			details := status.Convert(err).Details()
			require.Len(t, details, 1)
			require.Equal(t, int32(http.StatusNotFound), details[0].(*resourcepb.ErrorResult).Code)
		})
	}
}

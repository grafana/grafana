package options

import (
	"context"
	"net"
	"net/http"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/storage/unified/resourceclient/resourceutil"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type retryTestStorageServer struct {
	resourcepb.UnimplementedResourceStoreServer
	failure  error
	attempts atomic.Int32
}

func (s *retryTestStorageServer) Update(context.Context, *resourcepb.UpdateRequest) (*resourcepb.UpdateResponse, error) {
	if s.attempts.Add(1) == 1 {
		return nil, s.failure
	}
	return &resourcepb.UpdateResponse{}, nil
}

func TestStorageOptionsRetryCodes(t *testing.T) {
	for _, code := range []codes.Code{codes.Aborted, codes.Unavailable, codes.ResourceExhausted, codes.InvalidArgument} {
		t.Run(code.String(), func(t *testing.T) {
			st, err := status.New(code, "failure").WithDetails(&resourcepb.ErrorResult{Code: http.StatusConflict, Message: "conflict"})
			require.NoError(t, err)
			srv := &retryTestStorageServer{failure: st.Err()}
			listener := bufconn.Listen(1024 * 1024)
			t.Cleanup(func() { require.NoError(t, listener.Close()) })
			server := grpc.NewServer()
			resourcepb.RegisterResourceStoreServer(server, srv)
			t.Cleanup(server.Stop)
			go func() { _ = server.Serve(listener) }()

			opts := NewStorageOptions().buildGrpcDialOptions()
			opts = append(opts, grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
				return listener.DialContext(ctx)
			}))
			conn, err := grpc.NewClient("passthrough:///storage", opts...)
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, conn.Close()) })
			ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
			defer cancel()
			_, err = resourcepb.NewResourceStoreClient(conn).Update(ctx, &resourcepb.UpdateRequest{})
			if code == codes.Unavailable || code == codes.ResourceExhausted {
				require.NoError(t, err)
				require.Equal(t, int32(2), srv.attempts.Load())
			} else {
				require.Equal(t, int32(1), srv.attempts.Load())
				require.Equal(t, st.Proto(), status.Convert(err).Proto())
			}
		})
	}
}

type oversizedReadServer struct {
	resourcepb.UnimplementedResourceStoreServer
	attempts atomic.Int32
}

func (s *oversizedReadServer) Read(context.Context, *resourcepb.ReadRequest) (*resourcepb.ReadResponse, error) {
	s.attempts.Add(1)
	return &resourcepb.ReadResponse{Value: make([]byte, 64*1024)}, nil
}

func TestStorageOptionsDoesNotRetryMessageSizeErrors(t *testing.T) {
	srv := &oversizedReadServer{}
	listener := bufconn.Listen(1024 * 1024)
	t.Cleanup(func() { require.NoError(t, listener.Close()) })
	server := grpc.NewServer()
	resourcepb.RegisterResourceStoreServer(server, srv)
	t.Cleanup(server.Stop)
	go func() { _ = server.Serve(listener) }()

	opts := NewStorageOptions().buildGrpcDialOptions()
	opts = append(opts,
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return listener.DialContext(ctx)
		}),
		// The server response is far larger than this limit.
		grpc.WithDefaultCallOptions(grpc.MaxCallRecvMsgSize(1024)),
	)
	conn, err := grpc.NewClient("passthrough:///storage", opts...)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, conn.Close()) })
	ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
	defer cancel()
	_, err = resourcepb.NewResourceStoreClient(conn).Read(ctx, &resourcepb.ReadRequest{})
	require.Equal(t, int32(1), srv.attempts.Load())
	require.ErrorContains(t, err, "received message larger than max")
	res := resourceutil.AsErrorResult(err)
	require.Equal(t, int32(http.StatusRequestEntityTooLarge), res.Code)
	require.Equal(t, string(metav1.StatusReasonRequestEntityTooLarge), res.Reason)
}

func TestStorageOptions_Validate(t *testing.T) {
	tests := []struct {
		name    string
		Opts    StorageOptions
		wantErr bool
	}{
		{
			name: "with unified storage grpc and no auth token",
			Opts: StorageOptions{
				StorageType: StorageTypeUnifiedGrpc,
			},
			wantErr: true,
		},
		{
			name: "with unified storage grpc and auth info",
			Opts: StorageOptions{
				StorageType:                              StorageTypeUnifiedGrpc,
				Address:                                  "localhost:10000",
				GrpcClientAuthenticationToken:            "1234",
				GrpcClientAuthenticationTokenExchangeURL: "http://localhost:8080",
				GrpcClientAuthenticationTokenNamespace:   "*",
			},
			wantErr: false,
		},
		{
			name: "with secrets manager grpc client and no server address",
			Opts: StorageOptions{
				StorageType:                              StorageTypeUnifiedGrpc,
				Address:                                  "localhost:10000",
				GrpcClientAuthenticationToken:            "1234",
				GrpcClientAuthenticationTokenExchangeURL: "http://localhost:8080",
				GrpcClientAuthenticationTokenNamespace:   "*",
				SecretsManagerGrpcClientEnable:           true,
			},
			wantErr: true,
		},
		{
			name: "with secrets manager grpc client and no server ca file",
			Opts: StorageOptions{
				StorageType:                              StorageTypeUnifiedGrpc,
				Address:                                  "localhost:10000",
				GrpcClientAuthenticationToken:            "1234",
				GrpcClientAuthenticationTokenExchangeURL: "http://localhost:8080",
				GrpcClientAuthenticationTokenNamespace:   "*",
				SecretsManagerGrpcClientEnable:           true,
				SecretsManagerGrpcServerAddress:          "localhost:10000",
				SecretsManagerGrpcServerUseTLS:           true,
			},
			wantErr: true,
		},
		{
			name: "with secrets manager grpc client and server ca file",
			Opts: StorageOptions{
				StorageType:                              StorageTypeUnifiedGrpc,
				Address:                                  "localhost:10000",
				GrpcClientAuthenticationToken:            "1234",
				GrpcClientAuthenticationTokenExchangeURL: "http://localhost:8080",
				GrpcClientAuthenticationTokenNamespace:   "*",
				SecretsManagerGrpcClientEnable:           true,
				SecretsManagerGrpcServerAddress:          "localhost:10000",
				SecretsManagerGrpcServerUseTLS:           true,
				SecretsManagerGrpcServerTLSCAFile:        "ca.crt",
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errs := tt.Opts.Validate()
			if tt.wantErr {
				assert.NotEmpty(t, errs)
				return
			}
			assert.Empty(t, errs)
		})
	}
}

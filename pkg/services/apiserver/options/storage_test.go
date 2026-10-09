package options

import (
	"bytes"
	"context"
	"net"
	"net/http"
	"sync/atomic"
	"testing"
	"time"

	"github.com/spf13/pflag"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestStorageOptionsReadLargeResponse(t *testing.T) {
	for _, tc := range []struct {
		name     string
		args     []string
		wantCode codes.Code
	}{
		{name: "default", wantCode: codes.ResourceExhausted},
		{name: "explicit zero", args: []string{"--grpc-client-max-recv-msg-size=0"}, wantCode: codes.ResourceExhausted},
		{name: "configured 100 MiB", args: []string{"--grpc-client-max-recv-msg-size=104857600"}, wantCode: codes.OK},
	} {
		t.Run(tc.name, func(t *testing.T) {
			payload := bytes.Repeat([]byte("x"), 5<<20)
			listener := bufconn.Listen(1024 * 1024)
			t.Cleanup(func() { require.NoError(t, listener.Close()) })
			server := grpc.NewServer()
			resourcepb.RegisterResourceStoreServer(server, &largeResponseStorageServer{value: payload})
			t.Cleanup(server.Stop)
			go func() { _ = server.Serve(listener) }()

			storageOpts := NewStorageOptions()
			flags := pflag.NewFlagSet("test", pflag.ContinueOnError)
			storageOpts.AddFlags(flags)
			require.NoError(t, flags.Parse(tc.args))
			require.Empty(t, storageOpts.Validate())
			opts := storageOpts.buildGrpcDialOptions()
			opts = append(opts, grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
				return listener.DialContext(ctx)
			}))
			conn, err := grpc.NewClient("passthrough:///storage", opts...)
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, conn.Close()) })
			ctx, cancel := context.WithTimeout(t.Context(), 15*time.Second)
			defer cancel()
			response, err := resourcepb.NewResourceStoreClient(conn).Read(ctx, &resourcepb.ReadRequest{})
			require.Equal(t, tc.wantCode, status.Code(err), "%v", err)
			if tc.wantCode != codes.OK {
				require.Contains(t, err.Error(), "5242885 vs. 4194304")
				return
			}
			require.Equal(t, payload, response.Value)
		})
	}
}

func TestStorageOptionsNegativeMaxRecvMsgSize(t *testing.T) {
	opts := NewStorageOptions()
	flags := pflag.NewFlagSet("test", pflag.ContinueOnError)
	opts.AddFlags(flags)
	require.NoError(t, flags.Parse([]string{"--grpc-client-max-recv-msg-size=-1"}))
	errs := opts.Validate()
	require.Len(t, errs, 1)
	require.EqualError(t, errs[0], "--grpc-client-max-recv-msg-size must be non-negative")
}

type largeResponseStorageServer struct {
	resourcepb.UnimplementedResourceStoreServer
	value []byte
}

func (s *largeResponseStorageServer) Read(context.Context, *resourcepb.ReadRequest) (*resourcepb.ReadResponse, error) {
	return &resourcepb.ReadResponse{Value: s.value}, nil
}

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

package inline_test

import (
	"context"
	"crypto/tls"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	inlinev1beta1 "github.com/grafana/grafana/apps/secret/inline/v1beta1"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"golang.org/x/net/nettest"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/metadata"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/inline"
	"github.com/grafana/grafana/pkg/registry/apis/secret/testutils"
	"github.com/grafana/grafana/pkg/services/authn/clients"
	"github.com/grafana/grafana/pkg/setting"
)

func TestProvideInlineSecureValueService(t *testing.T) {
	t.Parallel()

	tracer := noop.NewTracerProvider().Tracer("test")

	t.Run("when the grpc server is disabled, it returns local inline service", func(t *testing.T) {
		t.Parallel()

		cfg := setting.NewCfg()
		cfg.SecretsManagement.GrpcClientEnable = false

		service, err := inline.ProvideInlineSecureValueService(cfg, nil, nil, nil)
		require.NoError(t, err)
		require.IsType(t, &inline.LocalInlineSecureValueService{}, service)
	})

	t.Run("when grpc server is enabled but server address is missing, it returns an error", func(t *testing.T) {
		t.Parallel()

		cfg := setting.NewCfg()
		cfg.SecretsManagement.GrpcClientEnable = true

		service, err := inline.ProvideInlineSecureValueService(cfg, nil, nil, nil)
		require.Error(t, err)
		require.Nil(t, service)
	})

	t.Run("when grpc server is enabled but token exchange config is missing, it returns an error", func(t *testing.T) {
		t.Parallel()

		cfg := setting.NewCfg()
		cfg.SecretsManagement.GrpcClientEnable = true
		cfg.SecretsManagement.GrpcServerAddress = "127.0.0.1:10000"

		service, err := inline.ProvideInlineSecureValueService(cfg, nil, nil, nil)
		require.Error(t, err)
		require.Nil(t, service)
	})

	t.Run("happy path with grpc+tls server with fake token exchanger and server", func(t *testing.T) {
		t.Parallel()

		respTokenExchanged := "test-token"
		tokenExchangeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			response := `{
				"data": { 
					"token": "` + respTokenExchanged + `"
				}
			}`
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(response))
		}))
		t.Cleanup(tokenExchangeServer.Close)

		// Set up gRPC Server with TLS
		listener, err := nettest.NewLocalListener("tcp")
		require.NoError(t, err)

		certPaths := testutils.CreateX509TestDir(t)

		serverCert, err := tls.LoadX509KeyPair(certPaths.ServerCert, certPaths.ServerKey)
		require.NoError(t, err)

		tlsConfig := &tls.Config{
			Certificates:       []tls.Certificate{serverCert},
			ClientAuth:         tls.NoClientCert,
			InsecureSkipVerify: false,
			ServerName:         "localhost",
		}

		grpcServer := grpc.NewServer(grpc.Creds(credentials.NewTLS(tlsConfig)))
		t.Cleanup(grpcServer.Stop)

		inlineServer := &mockInlineServer{}
		inlineServer.On("CreateInline", mock.Anything, mock.Anything).Return(&inlinev1beta1.CreateInlineResponse{Name: "test-value"}, nil)
		inlineServer.On("CanReference", mock.Anything, mock.Anything).Return(&inlinev1beta1.CanReferenceResponse{}, nil)
		inlineServer.On("DeleteWhenOwnedByResource", mock.Anything, mock.Anything).Return(&inlinev1beta1.DeleteWhenOwnedByResourceResponse{}, nil)

		inlinev1beta1.RegisterInlineSecureValueServiceServer(grpcServer, inlineServer)

		go func() {
			_ = grpcServer.Serve(listener)
			<-t.Context().Done()
		}()

		// Populate configuration with gRPC+TLS options and mock token exchanger
		namespace := "stacks-1234"

		cfg := setting.NewCfg()
		cfg.SecretsManagement.GrpcClientEnable = true
		cfg.SecretsManagement.GrpcServerAddress = listener.Addr().String()
		cfg.SecretsManagement.GrpcServerUseTLS = true
		cfg.SecretsManagement.GrpcServerTLSServerName = "localhost"
		cfg.SecretsManagement.GrpcServerTLSSkipVerify = false

		grpcClientAuth := cfg.Raw.Section("grpc_client_authentication")
		_, err = grpcClientAuth.NewKey("token", "test-token")
		require.NoError(t, err)
		_, err = grpcClientAuth.NewKey("token_exchange_url", tokenExchangeServer.URL)
		require.NoError(t, err)
		_, err = grpcClientAuth.NewKey("token_namespace", namespace)
		require.NoError(t, err)

		apiServer := cfg.Raw.Section("grafana-apiserver")
		_, err = apiServer.NewKey("proxy_client_cert_file", certPaths.ClientCert)
		require.NoError(t, err)
		_, err = apiServer.NewKey("proxy_client_key_file", certPaths.ClientKey)
		require.NoError(t, err)
		_, err = apiServer.NewKey("apiservice_ca_bundle_file", certPaths.CA)
		require.NoError(t, err)

		inlineService, err := inline.ProvideInlineSecureValueService(cfg, tracer, nil, nil)
		require.NoError(t, err)
		require.IsType(t, &inline.GRPCInlineClient{}, inlineService)

		owner := common.ObjectReference{
			APIGroup:   "example.com",
			APIVersion: "v1",
			Kind:       "TestResource",
			Namespace:  namespace,
			Name:       "test-resource",
		}

		name, err := inlineService.CreateInline(t.Context(), owner, common.NewSecretValue("test-value"))
		require.NoError(t, err)
		require.Equal(t, "test-value", name)

		err = inlineService.CanReference(t.Context(), owner, "test-value")
		require.NoError(t, err)

		err = inlineService.DeleteWhenOwnedByResource(t.Context(), owner, "test-value")
		require.NoError(t, err)

		mock.AssertExpectationsForObjects(t, inlineServer)

		requestContext := inlineServer.Calls[0].Arguments[0].(context.Context)

		md, ok := metadata.FromIncomingContext(requestContext)
		require.True(t, ok)
		require.NotEmpty(t, md)
		require.Equal(t, respTokenExchanged, md[strings.ToLower(clients.ExtJWTAuthenticationHeaderName)][0])
	})
}

type mockInlineServer struct {
	mock.Mock
}

var _ inlinev1beta1.InlineSecureValueServiceServer = (*mockInlineServer)(nil)

func (m *mockInlineServer) CanReference(ctx context.Context, req *inlinev1beta1.CanReferenceRequest) (*inlinev1beta1.CanReferenceResponse, error) {
	args := m.Called(ctx, req)
	return args.Get(0).(*inlinev1beta1.CanReferenceResponse), args.Error(1)
}

func (m *mockInlineServer) CreateInline(ctx context.Context, req *inlinev1beta1.CreateInlineRequest) (*inlinev1beta1.CreateInlineResponse, error) {
	args := m.Called(ctx, req)
	return args.Get(0).(*inlinev1beta1.CreateInlineResponse), args.Error(1)
}

func (m *mockInlineServer) DeleteWhenOwnedByResource(ctx context.Context, req *inlinev1beta1.DeleteWhenOwnedByResourceRequest) (*inlinev1beta1.DeleteWhenOwnedByResourceResponse, error) {
	args := m.Called(ctx, req)
	return args.Get(0).(*inlinev1beta1.DeleteWhenOwnedByResourceResponse), args.Error(1)
}

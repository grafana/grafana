package decrypt_test

import (
	"context"
	"crypto/tls"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	decryptv1beta1 "github.com/grafana/grafana/apps/secret/decrypt/v1beta1"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"golang.org/x/net/nettest"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/decrypt"
	"github.com/grafana/grafana/pkg/registry/apis/secret/testutils"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/services/authn/clients"
	"github.com/grafana/grafana/pkg/setting"
)

func TestDecryptService(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	tracer := noop.NewTracerProvider().Tracer("test")

	t.Run("when there are only errors from the storage, the service returns them in the map", func(t *testing.T) {
		t.Parallel()

		mockErr := errors.New("mock error")
		mockStorage := &mockDecryptStorage{}
		mockStorage.On("Decrypt", mock.Anything, mock.Anything, mock.Anything).Return(secretv1beta1.ExposedSecureValue(""), mockErr)
		decryptedValuesResp := map[string]contracts.DecryptResult{
			"secure-value-1": contracts.NewDecryptResultErr(mockErr),
		}

		cfg := setting.NewCfg()
		cfg.SecretsManagement.DecryptServerType = "local"

		decryptService, err := decrypt.ProvideDecryptService(cfg, tracer, mockStorage)
		require.NoError(t, err)

		resp, err := decryptService.Decrypt(ctx, "svc-name", "default", []string{"secure-value-1"})
		require.NotNil(t, resp)
		require.NoError(t, err)
		require.EqualValues(t, decryptedValuesResp, resp)
	})

	t.Run("when there is no error from the storage, it returns a map of the decrypted values", func(t *testing.T) {
		t.Parallel()

		mockStorage := &mockDecryptStorage{}
		// Set up the mock to return a different value for each name in the test
		exposedSecureValue1 := secretv1beta1.NewExposedSecureValue("value1")
		exposedSecureValue2 := secretv1beta1.NewExposedSecureValue("value2")
		mockStorage.On("Decrypt", mock.Anything, xkube.Namespace("default"), "secure-value-1").
			Return(exposedSecureValue1, nil)
		mockStorage.On("Decrypt", mock.Anything, xkube.Namespace("default"), "secure-value-2").
			Return(exposedSecureValue2, nil)

		decryptedValuesResp := map[string]contracts.DecryptResult{
			"secure-value-1": contracts.NewDecryptResultValue(&exposedSecureValue1),
			"secure-value-2": contracts.NewDecryptResultValue(&exposedSecureValue2),
		}

		cfg := setting.NewCfg()
		cfg.SecretsManagement.DecryptServerType = "local"

		decryptService, err := decrypt.ProvideDecryptService(cfg, tracer, mockStorage)
		require.NoError(t, err)

		resp, err := decryptService.Decrypt(ctx, "svc-name", "default", []string{"secure-value-1", "secure-value-2"})
		require.NotNil(t, resp)
		require.NoError(t, err)
		require.EqualValues(t, decryptedValuesResp, resp)
	})

	t.Run("when there is an error from the storage, the service returns a map of errors and decrypted values", func(t *testing.T) {
		t.Parallel()

		mockErr := errors.New("mock error")
		mockStorage := &mockDecryptStorage{}
		exposedSecureValue := secretv1beta1.NewExposedSecureValue("value")
		mockStorage.On("Decrypt", mock.Anything, xkube.Namespace("default"), "secure-value-1").
			Return(exposedSecureValue, nil)
		mockStorage.On("Decrypt", mock.Anything, xkube.Namespace("default"), "secure-value-2").
			Return(secretv1beta1.ExposedSecureValue(""), mockErr)

		decryptedValuesResp := map[string]contracts.DecryptResult{
			"secure-value-1": contracts.NewDecryptResultValue(&exposedSecureValue),
			"secure-value-2": contracts.NewDecryptResultErr(mockErr),
		}

		cfg := setting.NewCfg()
		cfg.SecretsManagement.DecryptServerType = "local"

		decryptService, err := decrypt.ProvideDecryptService(cfg, tracer, mockStorage)
		require.NoError(t, err)

		resp, err := decryptService.Decrypt(ctx, "svc-name", "default", []string{"secure-value-1", "secure-value-2"})
		require.NotNil(t, resp)
		require.NoError(t, err)
		require.EqualValues(t, decryptedValuesResp, resp)
	})

	t.Run("when storage type is unsupported, it returns an error", func(t *testing.T) {
		t.Parallel()

		cfg := setting.NewCfg()
		cfg.SecretsManagement.DecryptServerType = "unsupported"

		decryptService, err := decrypt.ProvideDecryptService(cfg, tracer, nil)
		require.Error(t, err)
		require.Contains(t, err.Error(), "unsupported storage type")
		require.Nil(t, decryptService)
	})

	t.Run("when storage type is grpc but token exchange config is missing, it returns an error", func(t *testing.T) {
		t.Parallel()

		cfg := setting.NewCfg()
		cfg.SecretsManagement.DecryptServerType = "grpc"
		cfg.SecretsManagement.GrpcServerAddress = "127.0.0.1:10000"

		_, err := decrypt.ProvideDecryptService(cfg, tracer, nil)
		require.Error(t, err)
		require.Contains(t, err.Error(), "grpc_client_authentication.token and grpc_client_authentication.token_exchange_url are required")
	})

	t.Run("when storage type is grpc but storage address is missing, it returns an error", func(t *testing.T) {
		t.Parallel()

		cfg := setting.NewCfg()
		cfg.SecretsManagement.DecryptServerType = "grpc"

		_, err := decrypt.ProvideDecryptService(cfg, tracer, nil)
		require.Error(t, err)
		require.Contains(t, err.Error(), "grpc_server_address is required")
	})

	t.Run("happy path with grpc+tls server with fake toke exchanger and server", func(t *testing.T) {
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

		decryptServer := &mockDecryptServer{}
		decryptServer.On("DecryptSecureValues", mock.Anything, mock.Anything).Return(
			&decryptv1beta1.SecureValueDecryptResponseCollection{
				DecryptedValues: map[string]*decryptv1beta1.Result{
					"secure-value-1": {
						Result: &decryptv1beta1.Result_Value{Value: "decrypted-value-1"},
					},
				},
			},
			nil,
		)

		decryptv1beta1.RegisterSecureValueDecrypterServer(grpcServer, decryptServer)

		go func() {
			_ = grpcServer.Serve(listener)
			<-t.Context().Done()
		}()

		// Populate configuration with gRPC+TLS options and mock token exchanger
		grafanaSvcIdentity := "svc-identity-decrypter"
		namespace := "stacks-1234"

		cfg := setting.NewCfg()
		cfg.SecretsManagement.DecryptServerType = "grpc"
		cfg.SecretsManagement.GrpcServerAddress = listener.Addr().String()
		cfg.SecretsManagement.GrpcGrafanaServiceName = grafanaSvcIdentity
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

		// Create and test decryption, using the mock grpc server as we dont test the business logic here
		decryptService, err := decrypt.ProvideDecryptService(cfg, tracer, nil)
		require.NoError(t, err)
		require.NotNil(t, decryptService)

		t.Cleanup(func() { require.NoError(t, decryptService.Close()) })

		svcIdentity := "provsysoning-test"

		result, err := decryptService.Decrypt(t.Context(), svcIdentity, namespace, []string{"secure-value-1"})
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Len(t, result, 1)
		require.NotEmpty(t, result["secure-value-1"])

		requestContext := decryptServer.Calls[0].Arguments[0].(context.Context)

		md, ok := metadata.FromIncomingContext(requestContext)
		require.True(t, ok)
		require.NotEmpty(t, md)
		require.Equal(t, svcIdentity, md[strings.ToLower(contracts.HeaderGrafanaServiceIdentityName)][0])
		require.Equal(t, respTokenExchanged, md[strings.ToLower(clients.ExtJWTAuthenticationHeaderName)][0])
	})
}

type mockDecryptStorage struct {
	mock.Mock
}

func (m *mockDecryptStorage) Decrypt(ctx context.Context, namespace xkube.Namespace, name string) (secretv1beta1.ExposedSecureValue, error) {
	args := m.Called(ctx, namespace, name)
	return args.Get(0).(secretv1beta1.ExposedSecureValue), args.Error(1)
}

type mockDecryptServer struct {
	mock.Mock
}

var _ decryptv1beta1.SecureValueDecrypterServer = (*mockDecryptServer)(nil)

func (m *mockDecryptServer) DecryptSecureValues(ctx context.Context, req *decryptv1beta1.SecureValueDecryptRequest) (*decryptv1beta1.SecureValueDecryptResponseCollection, error) {
	args := m.Called(ctx, req)
	return args.Get(0).(*decryptv1beta1.SecureValueDecryptResponseCollection), args.Error(1)
}

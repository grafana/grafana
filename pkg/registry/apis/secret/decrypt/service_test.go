package decrypt

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	decryptv1beta1 "github.com/grafana/grafana/apps/secret/decrypt/v1beta1"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"golang.org/x/net/nettest"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
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

		decryptService, err := NewDecryptService(cfg, tracer, mockStorage)
		require.NoError(t, err)

		resp, err := decryptService.Decrypt(ctx, "default", "secure-value-1")
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

		decryptService, err := NewDecryptService(cfg, tracer, mockStorage)
		require.NoError(t, err)

		resp, err := decryptService.Decrypt(ctx, "default", "secure-value-1", "secure-value-2")
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

		decryptService, err := NewDecryptService(cfg, tracer, mockStorage)
		require.NoError(t, err)

		resp, err := decryptService.Decrypt(ctx, "default", "secure-value-1", "secure-value-2")
		require.NotNil(t, resp)
		require.NoError(t, err)
		require.EqualValues(t, decryptedValuesResp, resp)
	})

	t.Run("when storage type is unsupported, it returns an error", func(t *testing.T) {
		t.Parallel()

		cfg := setting.NewCfg()
		cfg.SecretsManagement.DecryptServerType = "unsupported"

		decryptService, err := NewDecryptService(cfg, tracer, nil)
		require.Error(t, err)
		require.Contains(t, err.Error(), "unsupported storage type")
		require.Nil(t, decryptService)
	})

	t.Run("when storage type is grpc but token exchange config is missing, it returns an error", func(t *testing.T) {
		t.Parallel()

		cfg := setting.NewCfg()
		cfg.SecretsManagement.DecryptServerType = "grpc"
		cfg.SecretsManagement.DecryptServerAddress = "127.0.0.1:10000"

		_, err := NewDecryptService(cfg, tracer, nil)
		require.Error(t, err)
		require.Contains(t, err.Error(), "grpc_client_authentication.token and grpc_client_authentication.token_exchange_url are required")
	})

	t.Run("when storage type is grpc but storage address is missing, it returns an error", func(t *testing.T) {
		t.Parallel()

		cfg := setting.NewCfg()
		cfg.SecretsManagement.DecryptServerType = "grpc"

		_, err := NewDecryptService(cfg, tracer, nil)
		require.Error(t, err)
		require.Contains(t, err.Error(), "decrypt_server_address is required")
	})

	t.Run("when storage type is grpc with valid config, it uses token exchange", func(t *testing.T) {
		t.Parallel()

		tracer := noop.NewTracerProvider().Tracer("test")

		grafanaSvcIdentity := "svc-identity-decrypter"
		svcIdentity := "provsysoning-test"
		namespace := "stacks-1234"

		tokenExchangeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			response := `{
				"data": { 
					"token": "test-token"
				}
			}`
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(response))
		}))
		t.Cleanup(tokenExchangeServer.Close)

		listener, err := nettest.NewLocalListener("tcp")
		require.NoError(t, err)

		grpcServer := grpc.NewServer()
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

		cfg := setting.NewCfg()
		cfg.SecretsManagement.DecryptServerType = "grpc"
		cfg.SecretsManagement.DecryptServerAddress = listener.Addr().String()
		cfg.SecretsManagement.DecryptGrafanaServiceName = grafanaSvcIdentity
		cfg.SecretsManagement.DecryptServerUseTLS = false

		grpcClientAuth := cfg.Raw.Section("grpc_client_authentication")
		_, err = grpcClientAuth.NewKey("token", "test-token")
		require.NoError(t, err)
		_, err = grpcClientAuth.NewKey("token_exchange_url", tokenExchangeServer.URL)
		require.NoError(t, err)
		_, err = grpcClientAuth.NewKey("token_namespace", namespace)
		require.NoError(t, err)

		decryptService, err := NewDecryptService(cfg, tracer, nil)
		require.NoError(t, err)
		require.NotNil(t, decryptService)

		t.Cleanup(func() { require.NoError(t, decryptService.Close()) })

		authCtx := identity.WithServiceIdentityContext(ctx, 1, identity.WithServiceIdentityName(svcIdentity))

		result, err := decryptService.Decrypt(authCtx, namespace, "secure-value-1")
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Len(t, result, 1)
		require.NotEmpty(t, result["secure-value-1"])
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

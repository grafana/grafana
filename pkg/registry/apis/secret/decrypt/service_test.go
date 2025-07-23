package decrypt

import (
	"context"
	"errors"
	"testing"

	authnlib "github.com/grafana/authlib/authn"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/services/authn/grpcutils"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestDecryptService(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("when there are only errors from the storage, the service returns them in the map", func(t *testing.T) {
		t.Parallel()

		mockErr := errors.New("mock error")
		mockStorage := &MockDecryptStorage{}
		mockStorage.On("Decrypt", mock.Anything, mock.Anything, mock.Anything).Return(secretv1beta1.ExposedSecureValue(""), mockErr)
		decryptedValuesResp := map[string]contracts.DecryptResult{
			"secure-value-1": contracts.NewDecryptResultErr(mockErr),
		}

		cfg := setting.NewCfg()
		cfg.SecretsManagement.DecryptServerType = "local"

		decryptService := &DecryptService{
			cfg:                    cfg,
			existingDecryptStorage: mockStorage,
		}

		resp, err := decryptService.Decrypt(ctx, "default", "secure-value-1")
		require.NotNil(t, resp)
		require.NoError(t, err)
		require.EqualValues(t, decryptedValuesResp, resp)
	})

	t.Run("when there is no error from the storage, it returns a map of the decrypted values", func(t *testing.T) {
		t.Parallel()

		mockStorage := &MockDecryptStorage{}
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

		decryptService := &DecryptService{
			cfg:                    cfg,
			existingDecryptStorage: mockStorage,
		}

		resp, err := decryptService.Decrypt(ctx, "default", "secure-value-1", "secure-value-2")
		require.NotNil(t, resp)
		require.NoError(t, err)
		require.EqualValues(t, decryptedValuesResp, resp)
	})

	t.Run("when there is an error from the storage, the service returns a map of errors and decrypted values", func(t *testing.T) {
		t.Parallel()

		mockErr := errors.New("mock error")
		mockStorage := &MockDecryptStorage{}
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

		decryptService := &DecryptService{
			cfg:                    cfg,
			existingDecryptStorage: mockStorage,
		}

		resp, err := decryptService.Decrypt(ctx, "default", "secure-value-1", "secure-value-2")
		require.NotNil(t, resp)
		require.NoError(t, err)
		require.EqualValues(t, decryptedValuesResp, resp)
	})

	t.Run("when storage type is unsupported, it returns an error", func(t *testing.T) {
		t.Parallel()

		mockStorage := &MockDecryptStorage{}

		cfg := setting.NewCfg()
		cfg.SecretsManagement.DecryptServerType = "unsupported"

		decryptService := &DecryptService{
			cfg:                    cfg,
			existingDecryptStorage: mockStorage,
		}

		resp, err := decryptService.Decrypt(ctx, "default", "secure-value-1")
		require.Nil(t, resp)
		require.Error(t, err)
		require.Contains(t, err.Error(), "unsupported storage type")
	})

	t.Run("when storage type is grpc but token exchange config is missing, it returns an error", func(t *testing.T) {
		t.Parallel()

		mockStorage := &MockDecryptStorage{}

		cfg := setting.NewCfg()
		cfg.SecretsManagement.DecryptServerType = "grpc"
		cfg.SecretsManagement.DecryptServerAddress = "127.0.0.1:10000"

		_, err := NewDecryptService(cfg, mockStorage)
		require.Error(t, err)
		require.Contains(t, err.Error(), "grpc_client_authentication.token and grpc_client_authentication.token_exchange_url are required")
	})

	t.Run("when storage type is grpc but storage address is missing, it returns an error", func(t *testing.T) {
		t.Parallel()

		mockStorage := &MockDecryptStorage{}

		cfg := setting.NewCfg()
		cfg.SecretsManagement.DecryptServerType = "grpc"

		_, err := NewDecryptService(cfg, mockStorage)
		require.Error(t, err)
		require.Contains(t, err.Error(), "decrypt_server_address is required")
	})

	t.Run("when storage type is grpc with valid config, it uses token exchange", func(t *testing.T) {
		t.Parallel()

		mockStorage := &MockDecryptStorage{}
		mockTokenExchanger := &MockTokenExchanger{}

		expectedToken := "exchanged-access-token"
		mockTokenExchanger.On("Exchange", mock.Anything, authnlib.TokenExchangeRequest{
			Namespace: "stacks-test",
			Audiences: []string{"secret.grafana.app"},
		}).Return(&authnlib.TokenExchangeResponse{Token: expectedToken}, nil)

		cfg := setting.NewCfg()
		cfg.SecretsManagement.DecryptServerType = "grpc"
		cfg.SecretsManagement.DecryptServerAddress = "127.0.0.1:10000"

		decryptService := &DecryptService{
			cfg:                    cfg,
			existingDecryptStorage: mockStorage,
			grpcClientConfig: &grpcutils.GrpcClientConfig{
				Token:            "test-token",
				TokenExchangeURL: "http://localhost:4040/v1/sign-access-token",
				TokenNamespace:   "stacks-test",
			},
			tokenExchangeClient: mockTokenExchanger,
		}

		require.NotNil(t, decryptService)
		require.NotNil(t, decryptService.tokenExchangeClient)

		token, err := decryptService.getAccessToken(ctx)
		require.NoError(t, err)
		require.Equal(t, expectedToken, token)

		mockTokenExchanger.AssertExpectations(t)
	})
}

type MockDecryptStorage struct {
	mock.Mock
}

func (m *MockDecryptStorage) Decrypt(ctx context.Context, namespace xkube.Namespace, name string) (secretv1beta1.ExposedSecureValue, error) {
	args := m.Called(ctx, namespace, name)
	return args.Get(0).(secretv1beta1.ExposedSecureValue), args.Error(1)
}

type MockTokenExchanger struct {
	mock.Mock
}

func (m *MockTokenExchanger) Exchange(ctx context.Context, req authnlib.TokenExchangeRequest) (*authnlib.TokenExchangeResponse, error) {
	args := m.Called(ctx, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*authnlib.TokenExchangeResponse), args.Error(1)
}

package decrypt

import (
	"context"
	"errors"
	"testing"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
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

		decryptService := &OSSDecryptService{
			decryptStore: mockStorage,
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

		decryptService := &OSSDecryptService{
			decryptStore: mockStorage,
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

		decryptService := &OSSDecryptService{
			decryptStore: mockStorage,
		}

		resp, err := decryptService.Decrypt(ctx, "default", "secure-value-1", "secure-value-2")
		require.NotNil(t, resp)
		require.NoError(t, err)
		require.EqualValues(t, decryptedValuesResp, resp)
	})
}

type MockDecryptStorage struct {
	mock.Mock
}

func (m *MockDecryptStorage) Decrypt(ctx context.Context, namespace xkube.Namespace, name string) (secretv1beta1.ExposedSecureValue, error) {
	args := m.Called(ctx, namespace, name)
	return args.Get(0).(secretv1beta1.ExposedSecureValue), args.Error(1)
}

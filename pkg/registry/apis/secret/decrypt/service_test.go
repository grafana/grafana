package decrypt

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/service"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

func TestDecryptService(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("when there are only errors from the storage, the service returns them in the map", func(t *testing.T) {
		t.Parallel()

		mockErr := errors.New("mock error")
		mockStorage := &MockDecryptStorage{}
		mockStorage.On("Decrypt", mock.Anything, mock.Anything, mock.Anything).Return(common.RawSecureValue(""), mockErr)
		decryptedValuesResp := map[string]service.DecryptResult{
			"secure-value-1": service.NewDecryptResultErr(mockErr),
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
		exposedSecureValue1 := common.NewSecretValue("value1")
		exposedSecureValue2 := common.NewSecretValue("value2")
		mockStorage.On("Decrypt", mock.Anything, xkube.Namespace("default"), "secure-value-1").
			Return(exposedSecureValue1, nil)
		mockStorage.On("Decrypt", mock.Anything, xkube.Namespace("default"), "secure-value-2").
			Return(exposedSecureValue2, nil)

		decryptedValuesResp := map[string]service.DecryptResult{
			"secure-value-1": service.NewDecryptResultValue(&exposedSecureValue1),
			"secure-value-2": service.NewDecryptResultValue(&exposedSecureValue2),
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
		exposedSecureValue := common.NewSecretValue("value")
		mockStorage.On("Decrypt", mock.Anything, xkube.Namespace("default"), "secure-value-1").
			Return(exposedSecureValue, nil)
		mockStorage.On("Decrypt", mock.Anything, xkube.Namespace("default"), "secure-value-2").
			Return(common.RawSecureValue(""), mockErr)

		decryptedValuesResp := map[string]service.DecryptResult{
			"secure-value-1": service.NewDecryptResultValue(&exposedSecureValue),
			"secure-value-2": service.NewDecryptResultErr(mockErr),
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

func (m *MockDecryptStorage) Decrypt(ctx context.Context, namespace xkube.Namespace, name string) (common.RawSecureValue, error) {
	args := m.Called(ctx, namespace, name)
	return args.Get(0).(common.RawSecureValue), args.Error(1)
}

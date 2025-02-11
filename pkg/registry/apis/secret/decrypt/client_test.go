package decrypt

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestDecryptClientFunc(t *testing.T) {
	t.Parallel()

	ctx := context.Background()

	t.Run("it decrypts each secure value returning an empty string for errors", func(t *testing.T) {
		t.Parallel()

		decryptStorage := &MockDecryptStorage{}

		ns := "default"
		name1, name2 := "first", "second"

		decryptStorage.On("Decrypt", mock.Anything, ns, name1).Return(v0alpha1.ExposedSecureValue("secure-value-1"), nil).Once()
		decryptStorage.On("Decrypt", mock.Anything, ns, name2).Return(v0alpha1.ExposedSecureValue(""), errors.New("mock error")).Once()

		client := DecryptClientFunc{decryptStorage: decryptStorage}

		decryptedValues, err := client.Decrypt(ctx, ns, name1, name2)
		require.NoError(t, err)
		require.Len(t, decryptedValues, 2)
		require.NotEmpty(t, decryptedValues[name1])
		require.Empty(t, decryptedValues[name2])
	})
}

type MockDecryptStorage struct {
	mock.Mock
}

func (m *MockDecryptStorage) Decrypt(ctx context.Context, namespace xkube.Namespace, name string) (v0alpha1.ExposedSecureValue, error) {
	args := m.Called(ctx, namespace, name)
	return args.Get(0).(v0alpha1.ExposedSecureValue), args.Error(1)
}

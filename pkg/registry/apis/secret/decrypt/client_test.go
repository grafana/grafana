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

	t.Run("it decrypts each secure value", func(t *testing.T) {
		t.Parallel()

		decryptStorage := &MockDecryptStorage{}

		ns := "default"
		name1, name2 := "first", "second"

		decryptStorage.On("Decrypt", mock.Anything, xkube.Namespace(ns), name1).Return(v0alpha1.ExposedSecureValue("secure-value-1"), nil).Once()
		decryptStorage.On("Decrypt", mock.Anything, xkube.Namespace(ns), name2).Return(v0alpha1.ExposedSecureValue("secure-value-2"), nil).Once()

		client := DecryptClientFunc{decryptStorage: decryptStorage}

		decryptedValues, err := client.Decrypt(ctx, ns, []string{name1, name2})
		require.NoError(t, err)
		require.Len(t, decryptedValues, 2)
		require.NotEmpty(t, decryptedValues[name1])
		require.NotEmpty(t, decryptedValues[name2])
	})

	t.Run("if there is an error, none of the values are returned", func(t *testing.T) {
		t.Parallel()

		decryptStorage := &MockDecryptStorage{}

		ns := "default"
		name1, name2 := "first", "second"

		mockErr := errors.New("mock error")

		decryptStorage.On("Decrypt", mock.Anything, xkube.Namespace(ns), name1).Return(v0alpha1.ExposedSecureValue("secure-value-1"), nil).Once()
		decryptStorage.On("Decrypt", mock.Anything, xkube.Namespace(ns), name2).Return(v0alpha1.ExposedSecureValue(""), mockErr).Once()

		client := DecryptClientFunc{decryptStorage: decryptStorage}

		decryptedValues, err := client.Decrypt(ctx, ns, []string{name1, name2})
		require.NotErrorIs(t, err, mockErr)
		require.Nil(t, decryptedValues)
	})
}

type MockDecryptStorage struct {
	mock.Mock
}

func (m *MockDecryptStorage) Decrypt(ctx context.Context, namespace xkube.Namespace, name string) (v0alpha1.ExposedSecureValue, error) {
	args := m.Called(ctx, namespace, name)
	return args.Get(0).(v0alpha1.ExposedSecureValue), args.Error(1)
}

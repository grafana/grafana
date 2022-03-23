package ossencryption

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEncryption(t *testing.T) {
	svc := Service{}

	t.Run("getting encryption key", func(t *testing.T) {
		key, err := encryptionKeyToBytes("secret", "salt")
		require.NoError(t, err)
		assert.Len(t, key, 32)

		key, err = encryptionKeyToBytes("a very long secret key that is larger then 32bytes", "salt")
		require.NoError(t, err)
		assert.Len(t, key, 32)
	})

	t.Run("decrypting basic payload", func(t *testing.T) {
		ctx := context.Background()

		encrypted, err := svc.Encrypt(ctx, []byte("grafana"), "1234")
		require.NoError(t, err)

		decrypted, err := svc.Decrypt(ctx, encrypted, "1234")
		require.NoError(t, err)

		assert.Equal(t, []byte("grafana"), decrypted)
	})

	t.Run("decrypting empty payload should return error", func(t *testing.T) {
		_, err := svc.Decrypt(context.Background(), []byte(""), "1234")
		require.Error(t, err)

		assert.Equal(t, "unable to compute salt", err.Error())
	})
}

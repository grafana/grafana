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

		assert.Equal(t, "unable to derive encryption algorithm", err.Error())
	})

	t.Run("decrypting ciphertext with aes-gcm as encryption algorithm should return error", func(t *testing.T) {
		// Raw slice of bytes that corresponds to the following ciphertext:
		// - 'grafana' as payload
		// - '1234' as secret
		// - 'aes-gcm' as encryption algorithm
		// With no encryption algorithm metadata.
		ciphertext := []byte{42, 89, 87, 86, 122, 76, 87, 100, 106, 98, 81, 42, 48, 99, 55, 50, 51, 48, 83, 66, 20, 99, 47, 238, 61, 44, 129, 125, 14, 37, 162, 230, 47, 31, 104, 70, 144, 223, 26, 51, 180, 17, 76, 52, 36, 93, 17, 203, 99, 158, 219, 102, 74, 173, 74}
		_, err := svc.Decrypt(context.Background(), ciphertext, "1234")
		require.Error(t, err)

		assert.Equal(t, "unsupported encryption algorithm", err.Error())
	})

	t.Run("decrypting ciphertext with aes-cfb as encryption algorithm do not fail", func(t *testing.T) {
		// Raw slice of bytes that corresponds to the following ciphertext:
		// - 'grafana' as payload
		// - '1234' as secret
		// - 'aes-cfb' as encryption algorithm
		// With no encryption algorithm metadata.
		ciphertext := []byte{42, 89, 87, 86, 122, 76, 87, 78, 109, 89, 103, 42, 73, 71, 50, 57, 121, 110, 90, 109, 115, 23, 237, 13, 130, 188, 151, 118, 98, 103, 80, 209, 79, 143, 22, 122, 44, 40, 102, 41, 136, 16, 27}
		decrypted, err := svc.Decrypt(context.Background(), ciphertext, "1234")
		require.NoError(t, err)

		assert.Equal(t, []byte("grafana"), decrypted)
	})
}

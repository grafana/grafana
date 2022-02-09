package util

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEncryption(t *testing.T) {
	t.Run("getting encryption key", func(t *testing.T) {
		key, err := encryptionKeyToBytes("secret", "salt")
		require.NoError(t, err)
		assert.Len(t, key, 32)

		key, err = encryptionKeyToBytes("a very long secret key that is larger then 32bytes", "salt")
		require.NoError(t, err)
		assert.Len(t, key, 32)
	})

	t.Run("decrypting basic payload", func(t *testing.T) {
		encrypted, err := Encrypt([]byte("grafana"), "1234")
		require.NoError(t, err)

		decrypted, err := Decrypt(encrypted, "1234")
		require.NoError(t, err)

		assert.Equal(t, []byte("grafana"), decrypted)
	})

	t.Run("decrypting empty payload should fail", func(t *testing.T) {
		_, err := Decrypt([]byte(""), "1234")
		require.Error(t, err)

		assert.Equal(t, "unable to derive encryption algorithm", err.Error())
	})

	t.Run("decrypting secrets with algorithm metadata", func(t *testing.T) {
		// Slice of bytes that corresponds to the following legacy ciphertext:
		// - 'my very secret secret key' as a payload
		// - '1234' as a secret
		// - 'aes-cfb' as an encryption algorithm
		// Has algorithm prefix
		encrypted := []byte{0x2a, 0x59, 0x57, 0x56, 0x7a, 0x4c, 0x57, 0x4e, 0x6d, 0x59, 0x67, 0x2a, 0x7a, 0x35, 0x64, 0x57, 0x64, 0x37, 0x6b, 0x38, 0x77, 0x9a, 0xda, 0x7a, 0x1a, 0x24, 0x42, 0x22, 0x5f, 0x3d, 0x2e, 0xf, 0xd2, 0xad, 0x53, 0xa6, 0x69, 0x61, 0x5a, 0xe1, 0x9c, 0xc3, 0xda, 0x13, 0x80, 0xdc, 0x3e, 0x87, 0x49, 0xbf, 0xe7, 0x2d, 0xc1, 0x8f, 0x48, 0x26, 0x45, 0xe8, 0x1b, 0xe7, 0x51}
		decrypted, err := Decrypt(encrypted, "1234")
		require.NoError(t, err)
		assert.Equal(t, "my very secret secret key", string(decrypted))
	})
}

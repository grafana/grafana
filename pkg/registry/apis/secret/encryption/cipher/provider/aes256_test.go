package provider

import (
	"crypto/rand"
	"encoding/hex"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAes256CipherKey(t *testing.T) {
	t.Parallel()

	t.Run("with regular password", func(t *testing.T) {
		t.Parallel()

		key, err := aes256CipherKey("password", []byte("salt"))
		require.NoError(t, err)
		require.Len(t, key, 32)
	})

	t.Run("with very long password", func(t *testing.T) {
		t.Parallel()

		key, err := aes256CipherKey("a very long secret key that is much larger than 32 bytes", []byte("salt"))
		require.NoError(t, err)
		require.Len(t, key, 32)
	})

	t.Run("withstands randomness", func(t *testing.T) {
		t.Parallel()

		password := make([]byte, 512)
		salt := make([]byte, 512)
		_, err := rand.Read(password)
		require.NoError(t, err, "failed to generate random password")
		_, err = rand.Read(salt)
		require.NoError(t, err, "failed to generate random salt")

		key, err := aes256CipherKey(hex.EncodeToString(password), salt)
		require.NoError(t, err, "failed to generate key")
		require.Len(t, key, 32, "key should be 32 bytes long")
	})
}

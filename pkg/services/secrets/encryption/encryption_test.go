package encryption

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOSSEncryptionService_EncryptDecrypt(t *testing.T) {
	e := &OSSEncryptionService{}

	t.Run("getting encryption key", func(t *testing.T) {
		key, err := encryptionKeyToBytes([]byte("secret"), []byte("salt"))
		require.NoError(t, err)
		assert.Len(t, key, 32)

		key, err = encryptionKeyToBytes([]byte("a very long secret key that is larger then 32bytes"), []byte("salt"))
		require.NoError(t, err)
		assert.Len(t, key, 32)
	})

	t.Run("decrypting basic payload", func(t *testing.T) {
		encrypted, err := e.Encrypt([]byte("grafana"), []byte("1234"))
		require.NoError(t, err)

		decrypted, err := e.Decrypt(encrypted, []byte("1234"))
		require.NoError(t, err)

		assert.Equal(t, []byte("grafana"), decrypted)
	})

	t.Run("decrypting empty payload should not fail", func(t *testing.T) {
		_, err := e.Decrypt([]byte(""), []byte("1234"))
		require.Error(t, err)

		assert.Equal(t, "unable to compute salt", err.Error())
	})
}

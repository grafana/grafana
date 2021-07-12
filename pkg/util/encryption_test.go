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

	encAlgorithms := []string{AesCfb}

	t.Run("decrypting basic payload", func(t *testing.T) {
		for _, algorithm := range encAlgorithms {
			algorithm := algorithm

			t.Run(string(algorithm), func(t *testing.T) {
				encrypted, err := Encrypt([]byte("grafana"), "1234", algorithm)
				require.NoError(t, err)

				decrypted, err := Decrypt(encrypted, "1234", algorithm)
				require.NoError(t, err)

				assert.Equal(t, []byte("grafana"), decrypted)
			})
		}
	})

	t.Run("decrypting empty payload should not fail", func(t *testing.T) {
		for _, algorithm := range encAlgorithms {
			algorithm := algorithm

			t.Run(algorithm, func(t *testing.T) {
				_, err := Decrypt([]byte(""), "1234", algorithm)
				require.Error(t, err)

				assert.Equal(t, "unable to compute salt", err.Error())
			})
		}
	})
}

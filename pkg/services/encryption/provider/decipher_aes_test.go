package provider

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/encryption"
)

func Test_aesDecipher(t *testing.T) {
	ctx := context.Background()

	t.Run("aes-cfb", func(t *testing.T) {
		cipher := aesDecipher{algorithm: encryption.AesCfb}
		cfbEncryptedCiphertext := []byte{69, 84, 85, 120, 65, 82, 107, 88, 144, 188, 109, 229, 91, 88, 85, 113, 220, 35, 178, 190, 208, 182, 209, 91, 252, 119, 138, 133, 198, 8, 1}

		decrypted, err := cipher.Decrypt(ctx, cfbEncryptedCiphertext, "1234")
		require.NoError(t, err)
		assert.Equal(t, []byte("grafana"), decrypted)
	})

	t.Run("aes-gcm", func(t *testing.T) {
		cipher := aesDecipher{algorithm: encryption.AesGcm}
		gcmEncryptedCiphertext := []byte{48, 99, 55, 50, 51, 48, 83, 66, 20, 99, 47, 238, 61, 44, 129, 125, 14, 37, 162, 230, 47, 31, 104, 70, 144, 223, 26, 51, 180, 17, 76, 52, 36, 93, 17, 203, 99, 158, 219, 102, 74, 173, 74}

		decrypted, err := cipher.Decrypt(ctx, gcmEncryptedCiphertext, "1234")
		require.NoError(t, err)
		assert.Equal(t, []byte("grafana"), decrypted)
	})
}

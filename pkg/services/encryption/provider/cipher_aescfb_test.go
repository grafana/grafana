package provider

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_aesCipher(t *testing.T) {
	ctx := context.Background()

	t.Run("aes-cfb", func(t *testing.T) {
		cipher := aesCipher{algorithm: encryption.AesCfb}
		encrypted, err := cipher.Encrypt(ctx, []byte("grafana"), "1234")
		require.NoError(t, err)
		assert.NotNil(t, encrypted)
		assert.NotEmpty(t, encrypted)
	})

	t.Run("aes-gcm", func(t *testing.T) {
		cipher := aesCipher{algorithm: encryption.AesGcm}
		encrypted, err := cipher.Encrypt(ctx, []byte("grafana"), "1234")
		require.NoError(t, err)
		assert.NotNil(t, encrypted)
		assert.NotEmpty(t, encrypted)
	})
}

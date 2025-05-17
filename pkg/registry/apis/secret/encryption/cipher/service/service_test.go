package service

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
	"github.com/grafana/grafana/pkg/setting"
)

func newGcmService(t *testing.T) *Service {
	t.Helper()

	usageStats := &usagestats.UsageStatsMock{}
	settings := &setting.Cfg{
		SecretsManagement: setting.SecretsManagerSettings{
			SecretKey:          "SdlklWklckeLS",
			EncryptionProvider: "secretKey.v1",
			Encryption: setting.EncryptionSettings{
				DataKeysCacheTTL:        5 * time.Minute,
				DataKeysCleanupInterval: 1 * time.Nanosecond,
				Algorithm:               cipher.AesGcm,
			},
		},
	}

	svc, err := NewEncryptionService(tracing.InitializeTracerForTest(), usageStats, settings)
	require.NoError(t, err, "failed to set up encryption service")
	return svc
}

func TestService(t *testing.T) {
	t.Parallel()

	t.Run("decrypt empty payload should return error", func(t *testing.T) {
		t.Parallel()

		svc := newGcmService(t)
		_, err := svc.Decrypt(t.Context(), []byte(""), "1234")
		require.Error(t, err)

		assert.Equal(t, "unable to derive encryption algorithm", err.Error())
	})

	t.Run("encrypt and decrypt with GCM should work", func(t *testing.T) {
		t.Parallel()

		svc := newGcmService(t)
		encrypted, err := svc.Encrypt(t.Context(), []byte("grafana"), "1234")
		require.NoError(t, err)

		decrypted, err := svc.Decrypt(t.Context(), encrypted, "1234")
		require.NoError(t, err)

		assert.Equal(t, []byte("grafana"), decrypted)
		// We'll let the provider deal with testing details.
	})

	t.Run("decrypting legacy ciphertext should work", func(t *testing.T) {
		t.Parallel()

		// Raw slice of bytes that corresponds to the following ciphertext:
		// - 'grafana' as payload
		// - '1234' as secret
		// - no encryption algorithm metadata
		ciphertext := []byte{73, 71, 50, 57, 121, 110, 90, 109, 115, 23, 237, 13, 130, 188, 151, 118, 98, 103, 80, 209, 79, 143, 22, 122, 44, 40, 102, 41, 136, 16, 27}

		svc := newGcmService(t)
		decrypted, err := svc.Decrypt(t.Context(), ciphertext, "1234")
		require.NoError(t, err)
		assert.Equal(t, []byte("grafana"), decrypted)
	})
}

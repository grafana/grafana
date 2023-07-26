package service

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/encryption/provider"
	"github.com/grafana/grafana/pkg/setting"
)

func Test_Service(t *testing.T) {
	ctx := context.Background()

	encProvider := provider.Provider{}
	usageStats := &usagestats.UsageStatsMock{}
	settings := setting.NewCfg()

	svc, err := ProvideEncryptionService(encProvider, usageStats, settings)
	require.NoError(t, err)

	t.Run("decrypt empty payload should return error", func(t *testing.T) {
		_, err := svc.Decrypt(context.Background(), []byte(""), "1234")
		require.Error(t, err)

		assert.Equal(t, "unable to derive encryption algorithm", err.Error())
	})

	t.Run("encrypt and decrypt with aes-cfb should work", func(t *testing.T) {
		settings.Raw.Section(securitySection).Key(encryptionAlgorithmKey).SetValue(encryption.AesCfb)

		encrypted, err := svc.Encrypt(ctx, []byte("grafana"), "1234")
		require.NoError(t, err)

		decrypted, err := svc.Decrypt(ctx, encrypted, "1234")
		require.NoError(t, err)

		assert.Equal(t, []byte("grafana"), decrypted)
	})

	t.Run("decrypt with aes-gcm should work", func(t *testing.T) {
		// Raw slice of bytes that corresponds to the following ciphertext:
		// - 'grafana' as payload
		// - '1234' as secret
		// - 'aes-gcm' as encryption algorithm
		ciphertext := []byte{42, 89, 87, 86, 122, 76, 87, 100, 106, 98, 81, 42, 48, 99, 55, 50, 51, 48, 83, 66, 20, 99, 47, 238, 61, 44, 129, 125, 14, 37, 162, 230, 47, 31, 104, 70, 144, 223, 26, 51, 180, 17, 76, 52, 36, 93, 17, 203, 99, 158, 219, 102, 74, 173, 74}

		decrypted, err := svc.Decrypt(context.Background(), ciphertext, "1234")
		require.NoError(t, err)
		assert.Equal(t, []byte("grafana"), decrypted)
	})

	t.Run("encrypt with aes-gcm should fail", func(t *testing.T) {
		settings.Raw.Section(securitySection).Key(encryptionAlgorithmKey).SetValue(encryption.AesGcm)

		_, err := svc.Encrypt(ctx, []byte("grafana"), "1234")
		require.Error(t, err)
	})

	t.Run("decrypting legacy ciphertext should work", func(t *testing.T) {
		// Raw slice of bytes that corresponds to the following ciphertext:
		// - 'grafana' as payload
		// - '1234' as secret
		// - no encryption algorithm metadata
		ciphertext := []byte{73, 71, 50, 57, 121, 110, 90, 109, 115, 23, 237, 13, 130, 188, 151, 118, 98, 103, 80, 209, 79, 143, 22, 122, 44, 40, 102, 41, 136, 16, 27}

		decrypted, err := svc.Decrypt(context.Background(), ciphertext, "1234")
		require.NoError(t, err)
		assert.Equal(t, []byte("grafana"), decrypted)
	})
}

func Test_Service_MissingProvider(t *testing.T) {
	encProvider := fakeProvider{}
	usageStats := &usagestats.UsageStatsMock{}
	settings := setting.NewCfg()

	service, err := ProvideEncryptionService(encProvider, usageStats, settings)
	assert.Nil(t, service)
	assert.Error(t, err)
}

type fakeProvider struct{}

func (p fakeProvider) ProvideCiphers() map[string]encryption.Cipher {
	return nil
}

func (p fakeProvider) ProvideDeciphers() map[string]encryption.Decipher {
	return nil
}

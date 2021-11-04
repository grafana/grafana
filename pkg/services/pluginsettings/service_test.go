package pluginsettings

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/encryption/ossencryption"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestService_DecryptedValuesCache(t *testing.T) {
	t.Run("When plugin settings hasn't been updated, encrypted JSON should be fetched from cache", func(t *testing.T) {
		ctx := context.Background()

		encryptionService := ossencryption.ProvideService()
		psService := ProvideService(bus.New(), nil, encryptionService)

		encryptedJsonData, err := encryptionService.EncryptJsonData(
			ctx,
			map[string]string{
				"password": "password",
			}, setting.SecretKey)
		require.NoError(t, err)

		ps := models.PluginSetting{
			Id:             1,
			JsonData:       map[string]interface{}{},
			SecureJsonData: encryptedJsonData,
		}

		// Populate cache
		password, ok := psService.DecryptedValues(&ps)["password"]
		require.Equal(t, "password", password)
		require.True(t, ok)

		encryptedJsonData, err = encryptionService.EncryptJsonData(
			ctx,
			map[string]string{
				"password": "",
			}, setting.SecretKey)
		require.NoError(t, err)

		ps.SecureJsonData = encryptedJsonData

		password, ok = psService.DecryptedValues(&ps)["password"]
		require.Equal(t, "password", password)
		require.True(t, ok)
	})

	t.Run("When plugin settings is updated, encrypted JSON should not be fetched from cache", func(t *testing.T) {
		ctx := context.Background()

		encryptionService := ossencryption.ProvideService()
		psService := ProvideService(bus.New(), nil, encryptionService)

		encryptedJsonData, err := encryptionService.EncryptJsonData(
			ctx,
			map[string]string{
				"password": "password",
			}, setting.SecretKey)
		require.NoError(t, err)

		ps := models.PluginSetting{
			Id:             1,
			JsonData:       map[string]interface{}{},
			SecureJsonData: encryptedJsonData,
		}

		// Populate cache
		password, ok := psService.DecryptedValues(&ps)["password"]
		require.Equal(t, "password", password)
		require.True(t, ok)

		encryptedJsonData, err = encryptionService.EncryptJsonData(
			ctx,
			map[string]string{
				"password": "",
			}, setting.SecretKey)
		require.NoError(t, err)

		ps.SecureJsonData = encryptedJsonData
		ps.Updated = time.Now()

		password, ok = psService.DecryptedValues(&ps)["password"]
		require.Empty(t, password)
		require.True(t, ok)
	})
}

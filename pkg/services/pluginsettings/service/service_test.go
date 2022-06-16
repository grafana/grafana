package service

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/pluginsettings"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"

	"github.com/stretchr/testify/require"
)

func TestService_DecryptedValuesCache(t *testing.T) {
	t.Run("When plugin settings hasn't been updated, encrypted JSON should be fetched from cache", func(t *testing.T) {
		ctx := context.Background()

		secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
		psService := ProvideService(nil, secretsService)

		encryptedJsonData, err := secretsService.EncryptJsonData(
			ctx,
			map[string]string{
				"password": "password",
			}, secrets.WithoutScope())
		require.NoError(t, err)

		ps := pluginsettings.DTO{
			ID:             1,
			JSONData:       map[string]interface{}{},
			SecureJSONData: encryptedJsonData,
		}

		// Populate cache
		password, ok := psService.DecryptedValues(&ps)["password"]
		require.Equal(t, "password", password)
		require.True(t, ok)

		encryptedJsonData, err = secretsService.EncryptJsonData(
			ctx,
			map[string]string{
				"password": "",
			}, secrets.WithoutScope())
		require.NoError(t, err)

		ps.SecureJSONData = encryptedJsonData

		password, ok = psService.DecryptedValues(&ps)["password"]
		require.Equal(t, "password", password)
		require.True(t, ok)
	})

	t.Run("When plugin settings is updated, encrypted JSON should not be fetched from cache", func(t *testing.T) {
		ctx := context.Background()

		secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
		psService := ProvideService(nil, secretsService)

		encryptedJsonData, err := secretsService.EncryptJsonData(
			ctx,
			map[string]string{
				"password": "password",
			}, secrets.WithoutScope())
		require.NoError(t, err)

		ps := pluginsettings.DTO{
			ID:             1,
			JSONData:       map[string]interface{}{},
			SecureJSONData: encryptedJsonData,
		}

		// Populate cache
		password, ok := psService.DecryptedValues(&ps)["password"]
		require.Equal(t, "password", password)
		require.True(t, ok)

		encryptedJsonData, err = secretsService.EncryptJsonData(
			ctx,
			map[string]string{
				"password": "",
			}, secrets.WithoutScope())
		require.NoError(t, err)

		ps.SecureJSONData = encryptedJsonData
		ps.Updated = time.Now()

		password, ok = psService.DecryptedValues(&ps)["password"]
		require.Empty(t, password)
		require.True(t, ok)
	})
}

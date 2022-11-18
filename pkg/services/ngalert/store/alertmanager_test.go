package store

import (
	"context"
	"crypto/md5"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestIntegrationAlertManagerHash(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	sqlStore := db.InitTestDB(t)
	store := &DBstore{
		SQLStore: sqlStore,
		Logger:   log.NewNopLogger(),
	}

	t.Run("After saving the DB should return the right hash", func(t *testing.T) {
		_, configMD5 := setupConfig(t, "my-config", store)
		req := &models.GetLatestAlertmanagerConfigurationQuery{
			OrgID: 1,
		}
		err := store.GetLatestAlertmanagerConfiguration(context.Background(), req)
		require.NoError(t, err)
		require.Equal(t, configMD5, req.Result.ConfigurationHash)
	})

	t.Run("When passing the right hash the config should be updated", func(t *testing.T) {
		_, configMD5 := setupConfig(t, "my-config", store)
		req := &models.GetLatestAlertmanagerConfigurationQuery{
			OrgID: 1,
		}
		err := store.GetLatestAlertmanagerConfiguration(context.Background(), req)
		require.NoError(t, err)
		require.Equal(t, configMD5, req.Result.ConfigurationHash)
		newConfig, newConfigMD5 := "my-config-new", fmt.Sprintf("%x", md5.Sum([]byte("my-config-new")))
		err = store.UpdateAlertmanagerConfiguration(context.Background(), &models.SaveAlertmanagerConfigurationCmd{
			AlertmanagerConfiguration: newConfig,
			FetchedConfigurationHash:  configMD5,
			ConfigurationVersion:      "v1",
			Default:                   false,
			OrgID:                     1,
		})
		require.NoError(t, err)
		err = store.GetLatestAlertmanagerConfiguration(context.Background(), req)
		require.NoError(t, err)
		require.Equal(t, newConfig, req.Result.AlertmanagerConfiguration)
		require.Equal(t, newConfigMD5, req.Result.ConfigurationHash)
	})

	t.Run("When passing the wrong hash the update should error", func(t *testing.T) {
		config, configMD5 := setupConfig(t, "my-config", store)
		req := &models.GetLatestAlertmanagerConfigurationQuery{
			OrgID: 1,
		}
		err := store.GetLatestAlertmanagerConfiguration(context.Background(), req)
		require.NoError(t, err)
		require.Equal(t, configMD5, req.Result.ConfigurationHash)
		err = store.UpdateAlertmanagerConfiguration(context.Background(), &models.SaveAlertmanagerConfigurationCmd{
			AlertmanagerConfiguration: config,
			FetchedConfigurationHash:  "the-wrong-hash",
			ConfigurationVersion:      "v1",
			Default:                   false,
			OrgID:                     1,
		})
		require.Error(t, err)
		require.EqualError(t, ErrVersionLockedObjectNotFound, err.Error())
	})
}

func TestIntegrationAlertManagerConfigCleanup(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	sqlStore := db.InitTestDB(t)
	store := &DBstore{
		SQLStore: sqlStore,
		Logger:   log.NewNopLogger(),
	}
	t.Run("when calling the cleanup with less records than the limit all recrods should stay", func(t *testing.T) {
		var orgID int64 = 3
		oldestConfig, _ := setupConfig(t, "oldest-record", store)
		err := store.SaveAlertmanagerConfiguration(context.Background(), &models.SaveAlertmanagerConfigurationCmd{
			AlertmanagerConfiguration: oldestConfig,
			ConfigurationVersion:      "v1",
			Default:                   false,
			OrgID:                     orgID,
		})
		require.NoError(t, err)

		olderConfig, _ := setupConfig(t, "older-record", store)
		err = store.SaveAlertmanagerConfiguration(context.Background(), &models.SaveAlertmanagerConfigurationCmd{
			AlertmanagerConfiguration: olderConfig,
			ConfigurationVersion:      "v1",
			Default:                   false,
			OrgID:                     orgID,
		})
		require.NoError(t, err)

		config, _ := setupConfig(t, "newest-record", store)
		err = store.SaveAlertmanagerConfiguration(context.Background(), &models.SaveAlertmanagerConfigurationCmd{
			AlertmanagerConfiguration: config,
			ConfigurationVersion:      "v1",
			Default:                   false,
			OrgID:                     orgID,
		})
		require.NoError(t, err)

		rowsAffacted, err := store.deleteOldConfigurations(context.Background(), orgID, 100)
		require.Equal(t, int64(0), rowsAffacted)
		require.NoError(t, err)

		req := &models.GetLatestAlertmanagerConfigurationQuery{
			OrgID: orgID,
		}
		err = store.GetLatestAlertmanagerConfiguration(context.Background(), req)
		require.NoError(t, err)
		require.Equal(t, "newest-record", req.Result.AlertmanagerConfiguration)
	})
	t.Run("when calling the cleanup only the oldest records surpassing the limit should be deleted", func(t *testing.T) {
		var orgID int64 = 2
		oldestConfig, _ := setupConfig(t, "oldest-record", store)
		err := store.SaveAlertmanagerConfiguration(context.Background(), &models.SaveAlertmanagerConfigurationCmd{
			AlertmanagerConfiguration: oldestConfig,
			ConfigurationVersion:      "v1",
			Default:                   false,
			OrgID:                     orgID,
		})
		require.NoError(t, err)

		olderConfig, _ := setupConfig(t, "older-record", store)
		err = store.SaveAlertmanagerConfiguration(context.Background(), &models.SaveAlertmanagerConfigurationCmd{
			AlertmanagerConfiguration: olderConfig,
			ConfigurationVersion:      "v1",
			Default:                   false,
			OrgID:                     orgID,
		})
		require.NoError(t, err)

		config, _ := setupConfig(t, "newest-record", store)
		err = store.SaveAlertmanagerConfiguration(context.Background(), &models.SaveAlertmanagerConfigurationCmd{
			AlertmanagerConfiguration: config,
			ConfigurationVersion:      "v1",
			Default:                   false,
			OrgID:                     orgID,
		})
		require.NoError(t, err)

		rowsAffacted, err := store.deleteOldConfigurations(context.Background(), orgID, 1)
		require.Equal(t, int64(2), rowsAffacted)
		require.NoError(t, err)

		req := &models.GetLatestAlertmanagerConfigurationQuery{
			OrgID: orgID,
		}
		err = store.GetLatestAlertmanagerConfiguration(context.Background(), req)
		require.NoError(t, err)
		require.Equal(t, "newest-record", req.Result.AlertmanagerConfiguration)
	})
	t.Run("limit set to 0 should fail", func(t *testing.T) {
		_, err := store.deleteOldConfigurations(context.Background(), 1, 0)
		require.Error(t, err)
	})
	t.Run("limit set to negative should fail", func(t *testing.T) {
		_, err := store.deleteOldConfigurations(context.Background(), 1, -1)
		require.Error(t, err)
	})
}

func setupConfig(t *testing.T, config string, store *DBstore) (string, string) {
	t.Helper()
	config, configMD5 := config, fmt.Sprintf("%x", md5.Sum([]byte(config)))
	err := store.SaveAlertmanagerConfiguration(context.Background(), &models.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration: config,
		ConfigurationVersion:      "v1",
		Default:                   false,
		OrgID:                     1,
	})
	require.NoError(t, err)
	return config, configMD5
}

package store

import (
	"context"
	"crypto/md5"
	"fmt"
	"sort"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestIntegrationAlertmanagerStore(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	sqlStore := db.InitTestDB(t)
	store := &DBstore{
		SQLStore: sqlStore,
		Logger:   log.NewNopLogger(),
	}

	t.Run("GetLatestAlertmanagerConfiguration for org that doesn't exist returns error", func(t *testing.T) {
		_, _ = setupConfig(t, "my-config", store)
		req := &models.GetLatestAlertmanagerConfigurationQuery{
			OrgID: 1234,
		}

		config, err := store.GetLatestAlertmanagerConfiguration(context.Background(), req)

		require.ErrorIs(t, err, ErrNoAlertmanagerConfiguration)
		require.Nil(t, config)
	})

	t.Run("GetLatestAlertmanagerConfiguration return the right config", func(t *testing.T) {
		_, configMD5 := setupConfig(t, "my-config", store)
		req := &models.GetLatestAlertmanagerConfigurationQuery{
			OrgID: 1,
		}

		config, err := store.GetLatestAlertmanagerConfiguration(context.Background(), req)

		require.NoError(t, err)
		require.NotNil(t, config)
		require.Equal(t, "my-config", config.AlertmanagerConfiguration)
		require.Equal(t, configMD5, config.ConfigurationHash)
	})

	t.Run("GetLatestAlertmanagerConfiguration after saving multiple times should return the latest config", func(t *testing.T) {
		_, _ = setupConfig(t, "my-config1", store)
		_, _ = setupConfig(t, "my-config2", store)
		_, configMD5 := setupConfig(t, "my-config3", store)
		req := &models.GetLatestAlertmanagerConfigurationQuery{
			OrgID: 1,
		}

		config, err := store.GetLatestAlertmanagerConfiguration(context.Background(), req)

		require.NoError(t, err)
		require.NotNil(t, config)
		require.Equal(t, "my-config3", config.AlertmanagerConfiguration)
		require.Equal(t, configMD5, config.ConfigurationHash)
	})

	t.Run("GetAllLatestAlertmanagerConfiguration gets latest config for all orgs", func(t *testing.T) {
		_, _ = setupConfigInOrg(t, "my-config1", 1, store)
		_, _ = setupConfigInOrg(t, "my-config2", 1, store)
		_, _ = setupConfigInOrg(t, "my-config3", 1, store)
		_, _ = setupConfigInOrg(t, "my-config1", 2, store)
		_, _ = setupConfigInOrg(t, "my-config1", 3, store)

		res, err := store.GetAllLatestAlertmanagerConfiguration(context.Background())

		require.NoError(t, err)
		require.Len(t, res, 3)
		sort.Slice(res, func(i, j int) bool {
			return res[i].OrgID < res[j].OrgID
		})
		require.Equal(t, int64(1), res[0].OrgID)
		require.Equal(t, int64(2), res[1].OrgID)
		require.Equal(t, int64(3), res[2].OrgID)
		require.Equal(t, "my-config3", res[0].AlertmanagerConfiguration)
		require.Equal(t, "my-config1", res[1].AlertmanagerConfiguration)
		require.Equal(t, "my-config1", res[2].AlertmanagerConfiguration)
	})

	t.Run("SaveAlertmanagerConfigurationWithCallback calls callback", func(t *testing.T) {
		called := false
		callback := func() error { called = true; return nil }
		cmd := buildSaveConfigCmd(t, "my-config", 1)

		err := store.SaveAlertmanagerConfigurationWithCallback(context.Background(), &cmd, callback)

		require.NoError(t, err)
		require.True(t, called)
	})

	t.Run("SaveAlertmanagerConfigurationWithCallback rolls back if callback returns error", func(t *testing.T) {
		_, _ = setupConfigInOrg(t, "my-config", 1, store)
		callback := func() error { return fmt.Errorf("callback failed") }
		cmd := buildSaveConfigCmd(t, "my-config-changed", 1)

		err := store.SaveAlertmanagerConfigurationWithCallback(context.Background(), &cmd, callback)

		require.ErrorContains(t, err, "callback failed")
		// Assert that we rolled back the transaction.
		get := &models.GetLatestAlertmanagerConfigurationQuery{OrgID: 1}
		config, err := store.GetLatestAlertmanagerConfiguration(context.Background(), get)
		require.NoError(t, err)
		require.Equal(t, config.AlertmanagerConfiguration, "my-config")
	})

	t.Run("UpdateAlertmanagerConfiguration returns error if existing config does not exist", func(t *testing.T) {
		cmd := buildSaveConfigCmd(t, "my-config", 1234)
		cmd.FetchedConfigurationHash = fmt.Sprintf("%x", md5.Sum([]byte("my-config")))
		err := store.UpdateAlertmanagerConfiguration(context.Background(), &cmd)

		require.ErrorIs(t, err, ErrVersionLockedObjectNotFound)
	})
}

func TestIntegrationAlertmanagerHash(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	sqlStore := db.InitTestDB(t)
	store := &DBstore{
		SQLStore: sqlStore,
		Logger:   log.NewNopLogger(),
	}

	t.Run("When passing the right hash the config should be updated", func(t *testing.T) {
		_, configMD5 := setupConfig(t, "my-config", store)
		req := &models.GetLatestAlertmanagerConfigurationQuery{
			OrgID: 1,
		}
		config, err := store.GetLatestAlertmanagerConfiguration(context.Background(), req)
		require.NoError(t, err)
		require.Equal(t, configMD5, config.ConfigurationHash)
		newConfig, newConfigMD5 := "my-config-new", fmt.Sprintf("%x", md5.Sum([]byte("my-config-new")))
		err = store.UpdateAlertmanagerConfiguration(context.Background(), &models.SaveAlertmanagerConfigurationCmd{
			AlertmanagerConfiguration: newConfig,
			FetchedConfigurationHash:  configMD5,
			ConfigurationVersion:      "v1",
			Default:                   false,
			OrgID:                     1,
		})
		require.NoError(t, err)
		config, err = store.GetLatestAlertmanagerConfiguration(context.Background(), req)
		require.NoError(t, err)
		require.Equal(t, newConfig, config.AlertmanagerConfiguration)
		require.Equal(t, newConfigMD5, config.ConfigurationHash)
	})

	t.Run("When passing the wrong hash the update should error", func(t *testing.T) {
		config, configMD5 := setupConfig(t, "my-config", store)
		req := &models.GetLatestAlertmanagerConfigurationQuery{
			OrgID: 1,
		}
		amConfig, err := store.GetLatestAlertmanagerConfiguration(context.Background(), req)
		require.NoError(t, err)
		require.Equal(t, configMD5, amConfig.ConfigurationHash)
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

func TestIntegrationAlertmanagerConfigCleanup(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	sqlStore := db.InitTestDB(t)
	store := &DBstore{
		SQLStore: sqlStore,
		Logger:   log.NewNopLogger(),
	}
	t.Run("when calling the cleanup with fewer records than the limit all records should stay", func(t *testing.T) {
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

		rowsAffected, err := store.deleteOldConfigurations(context.Background(), orgID, 100)
		require.Equal(t, int64(0), rowsAffected)
		require.NoError(t, err)

		req := &models.GetLatestAlertmanagerConfigurationQuery{
			OrgID: orgID,
		}
		amConfig, err := store.GetLatestAlertmanagerConfiguration(context.Background(), req)
		require.NoError(t, err)
		require.Equal(t, "newest-record", amConfig.AlertmanagerConfiguration)
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
		amConfig, err := store.GetLatestAlertmanagerConfiguration(context.Background(), req)
		require.NoError(t, err)
		require.Equal(t, "newest-record", amConfig.AlertmanagerConfiguration)
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

func TestIntegrationMarkConfigurationAsApplied(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	sqlStore := db.InitTestDB(t)
	store := &DBstore{
		SQLStore: sqlStore,
		Logger:   log.NewNopLogger(),
	}

	t.Run("attempting to mark a non existent config as applied shouldn't fail", func(tt *testing.T) {
		cmd := models.MarkConfigurationAsAppliedCmd{
			OrgID:             10,
			ConfigurationHash: "test",
		}
		err := store.MarkConfigurationAsApplied(context.Background(), &cmd)
		require.NoError(tt, err)
	})

	t.Run("marking an existent config should succeed", func(tt *testing.T) {
		const orgID = 1
		limit := 10
		ctx := context.Background()

		config, _ := setupConfig(t, "test", store)
		err := store.SaveAlertmanagerConfiguration(ctx, &models.SaveAlertmanagerConfigurationCmd{
			AlertmanagerConfiguration: config,
			ConfigurationVersion:      "v1",
			Default:                   false,
			OrgID:                     orgID,
		})
		require.NoError(tt, err)

		// Config should be saved but not marked as applied yet.
		configs, err := store.GetAppliedConfigurations(ctx, orgID, limit)
		require.NoError(tt, err)
		require.Len(tt, configs, 0)

		query := models.GetLatestAlertmanagerConfigurationQuery{
			OrgID: orgID,
		}
		amConfig, err := store.GetLatestAlertmanagerConfiguration(ctx, &query)
		require.NoError(tt, err)

		cmd := models.MarkConfigurationAsAppliedCmd{
			OrgID:             orgID,
			ConfigurationHash: amConfig.ConfigurationHash,
		}
		err = store.MarkConfigurationAsApplied(ctx, &cmd)
		require.NoError(tt, err)

		// Config should now be saved and marked as successfully applied.
		configs, err = store.GetAppliedConfigurations(ctx, orgID, limit)
		require.NoError(tt, err)
		require.Len(tt, configs, 1)
	})
}

func TestIntegrationGetAppliedConfigurations(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	sqlStore := db.InitTestDB(t)
	store := &DBstore{
		SQLStore: sqlStore,
		Logger:   log.NewNopLogger(),
	}

	t.Run("no configurations = empty slice", func(tt *testing.T) {
		configs, err := store.GetAppliedConfigurations(context.Background(), 10, 10)
		require.NoError(tt, err)
		require.NotNil(tt, configs)
		require.Len(tt, configs, 0)
	})

	t.Run("saved configurations marked as applied should be returned", func(tt *testing.T) {
		ctx := context.Background()
		var org int64 = 1
		limit := 10
		unmarkedConfig, _ := setupConfig(t, "unmarked", store)

		// Save four configurations for the same org.
		for i := 0; i < 4; i++ {
			config, _ := setupConfig(t, fmt.Sprintf("test-%d", i+1), store)
			cmd := &models.SaveAlertmanagerConfigurationCmd{
				AlertmanagerConfiguration: config,
				ConfigurationVersion:      "v1",
				Default:                   false,
				OrgID:                     org,
				LastApplied:               time.Now().UTC().Unix(),
			}

			// Don't mark the third config, that way we have 2 marked, 1 unmarked, 1 marked.
			if i == 2 {
				cmd.LastApplied = 0
				cmd.AlertmanagerConfiguration = unmarkedConfig
			}

			err := store.SaveAlertmanagerConfiguration(ctx, cmd)
			require.NoError(tt, err)
		}

		// Save some configs for other orgs.
		for i := 0; i < 4; i++ {
			config, _ := setupConfig(t, fmt.Sprintf("test-%d", i+1), store)
			cmd := &models.SaveAlertmanagerConfigurationCmd{
				AlertmanagerConfiguration: config,
				ConfigurationVersion:      "v1",
				Default:                   false,
				OrgID:                     int64(i) + org + 1, // This way we avoid saving more configs for the same org.
				LastApplied:               time.Now().UTC().Unix(),
			}

			err := store.SaveAlertmanagerConfiguration(ctx, cmd)
			require.NoError(tt, err)
		}

		configs, err := store.GetAppliedConfigurations(ctx, org, limit)
		require.NoError(tt, err)
		require.Len(tt, configs, 3)

		var lastID int64
		for _, config := range configs {
			// Check that the returned configurations are the ones that we're expecting.
			require.NotEqual(tt, config.AlertConfiguration.AlertmanagerConfiguration, unmarkedConfig)

			// Configs should only belong to the queried org.
			require.Equal(tt, org, config.OrgID)

			// LastApplied must not be zero.
			require.NotZero(tt, config.LastApplied)

			// Configs should be returned in descending order (id).
			if lastID != 0 {
				require.LessOrEqual(tt, config.AlertConfiguration.ID, lastID)
			}
			lastID = config.AlertConfiguration.ID
		}

		// The limit should be considered by the store.
		// The only record returned should be the latest one (highest id).
		highestID := configs[0].ID
		configs, err = store.GetAppliedConfigurations(ctx, org, 1)
		require.NoError(tt, err)
		require.Len(tt, configs, 1)
		require.Equal(tt, configs[0].ID, highestID)
	})
}

func TestIntegrationGetHistoricalConfiguration(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	sqlStore := db.InitTestDB(t)
	store := &DBstore{
		SQLStore: sqlStore,
		Logger:   log.NewNopLogger(),
	}

	t.Run("no configurations = error", func(tt *testing.T) {
		_, err := store.GetHistoricalConfiguration(context.Background(), 10, 10)
		require.Error(tt, err)
	})

	t.Run("correct configurations should be returned", func(tt *testing.T) {
		ctx := context.Background()
		var org int64 = 1
		config, _ := setupConfig(t, "test", store)
		cmd := &models.SaveAlertmanagerConfigurationCmd{
			AlertmanagerConfiguration: config,
			ConfigurationVersion:      "v1",
			Default:                   false,
			OrgID:                     org,
			LastApplied:               time.Now().UTC().Unix(),
		}
		err := store.SaveAlertmanagerConfiguration(ctx, cmd)
		require.NoError(tt, err)

		cfg, err := store.GetHistoricalConfiguration(ctx, org, 1)
		require.NoError(tt, err)

		// Check that the returned configuration is the ones that we're expecting.
		require.Equal(tt, cfg.AlertConfiguration.AlertmanagerConfiguration, cfg.AlertmanagerConfiguration)
	})
}

func setupConfig(t *testing.T, config string, store *DBstore) (string, string) {
	t.Helper()
	return setupConfigInOrg(t, config, 1, store)
}

func setupConfigInOrg(t *testing.T, config string, org int64, store *DBstore) (string, string) {
	t.Helper()
	config, configMD5 := config, fmt.Sprintf("%x", md5.Sum([]byte(config)))
	cmd := buildSaveConfigCmd(t, config, org)
	err := store.SaveAlertmanagerConfiguration(context.Background(), &cmd)
	require.NoError(t, err)
	return config, configMD5
}

func buildSaveConfigCmd(t *testing.T, config string, org int64) models.SaveAlertmanagerConfigurationCmd {
	t.Helper()
	return models.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration: config,
		ConfigurationVersion:      "v1",
		Default:                   false,
		OrgID:                     org,
	}
}

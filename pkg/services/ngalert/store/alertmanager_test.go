//go:build integration
// +build integration

package store

import (
	"context"
	"crypto/md5"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/require"
)

func TestIntegrationAlertManagerHash(t *testing.T) {
	sqlStore := sqlstore.InitTestDB(t)
	store := &DBstore{
		SQLStore: sqlStore,
	}
	setupConfig := func(t *testing.T, config string) (string, string) {
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
	t.Run("After saving the DB should return the right hash", func(t *testing.T) {
		_, configMD5 := setupConfig(t, "my-config")
		req := &models.GetLatestAlertmanagerConfigurationQuery{
			OrgID: 1,
		}
		err := store.GetLatestAlertmanagerConfiguration(context.Background(), req)
		require.NoError(t, err)
		require.Equal(t, configMD5, req.Result.ConfigurationHash)
	})

	t.Run("When passing the right hash the config should be updated", func(t *testing.T) {
		_, configMD5 := setupConfig(t, "my-config")
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
		config, configMD5 := setupConfig(t, "my-config")
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

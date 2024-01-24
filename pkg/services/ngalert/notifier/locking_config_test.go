package notifier

import (
	"context"
	"crypto/md5"
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	api "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestAlertmanagerConfigStore_GetLockingConfig(t *testing.T) {
	t.Run("should read the latest config for given organization", func(t *testing.T) {
		cfg := setting.GetAlertmanagerDefaultConfiguration()
		hash := fmt.Sprintf("%x", md5.Sum([]byte(cfg)))
		cfgStore := fakes.NewFakeAlertmanagerConfigStore(cfg)
		versionedStore := &LockingConfigStore{Store: cfgStore}

		expectedCfg := api.PostableUserConfig{}
		require.NoError(t, json.Unmarshal([]byte(cfg), &expectedCfg))

		revision, err := versionedStore.GetLockingConfig(context.Background(), 1)
		require.NoError(t, err)

		require.Equal(t, "v1", revision.ConfigVersion)
		require.Equal(t, hash, revision.ConfigHash)
		require.Equal(t, expectedCfg, *revision.Config)
	})

	t.Run("propagate errors", func(t *testing.T) {
		t.Run("when underlying store fails", func(t *testing.T) {
			expectedErr := errors.New("test-err")

			cfgStore := &fakes.FakeAlertmanagerConfigStore{}
			cfgStore.GetFn = func(ctx context.Context, orgID int64) (*models.AlertConfiguration, error) {
				return nil, expectedErr
			}
			versionedStore := &LockingConfigStore{Store: cfgStore}

			_, err := versionedStore.GetLockingConfig(context.Background(), 1)
			require.ErrorIs(t, err, expectedErr)
		})

		t.Run("return ErrNoAlertmanagerConfiguration when no configuration is found", func(t *testing.T) {
			cfgStore := &fakes.FakeAlertmanagerConfigStore{}
			cfgStore.GetFn = func(ctx context.Context, orgID int64) (*models.AlertConfiguration, error) {
				return nil, nil
			}
			versionedStore := &LockingConfigStore{Store: cfgStore}

			_, err := versionedStore.GetLockingConfig(context.Background(), 1)
			require.ErrorIs(t, err, store.ErrNoAlertmanagerConfiguration)
		})

		t.Run("when the configuration is invalid", func(t *testing.T) {
			cfgStore := &fakes.FakeAlertmanagerConfigStore{}
			cfgStore.Config.AlertmanagerConfiguration = "{invalid-json"
			versionedStore := &LockingConfigStore{Store: cfgStore}

			_, err := versionedStore.GetLockingConfig(context.Background(), 1)
			require.ErrorIs(t, err, ErrBadAlertmanagerConfiguration)
		})
	})
}

func TestAlertmanagerConfigStore_SaveLockingConfig(t *testing.T) {
	var orgID int64 = 1
	cfgBytes := []byte(setting.GetAlertmanagerDefaultConfiguration())
	cfgHash := fmt.Sprintf("%x", md5.Sum(cfgBytes))
	cfg := api.PostableUserConfig{}
	require.NoError(t, json.Unmarshal(cfgBytes, &cfg))

	expectedCfg, err := json.Marshal(cfg)
	require.NoError(t, err)

	rev := &AlertmanagerLockedConfig{
		Config:        &cfg,
		ConfigHash:    cfgHash,
		ConfigVersion: "v1",
	}

	t.Run("should save the configuration", func(t *testing.T) {
		cfgStore := &fakes.FakeAlertmanagerConfigStore{}
		cfgStore.UpdateFn = func(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error {
			require.Equal(t, orgID, cmd.OrgID)
			require.Equal(t, string(expectedCfg), cmd.AlertmanagerConfiguration)
			require.Equal(t, rev.ConfigVersion, cmd.ConfigurationVersion)
			require.Equal(t, rev.ConfigHash, cmd.FetchedConfigurationHash)
			require.Equal(t, false, cmd.Default)
			return nil
		}
		versionedStore := &LockingConfigStore{Store: cfgStore}

		err := versionedStore.SaveLockingConfig(context.Background(), orgID, rev)
		require.NoError(t, err)
	})

	t.Run("propagate errors", func(t *testing.T) {
		expectedErr := errors.New("test-err")

		cfgStore := &fakes.FakeAlertmanagerConfigStore{}
		cfgStore.UpdateFn = func(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error {
			return expectedErr
		}
		versionedStore := &LockingConfigStore{Store: cfgStore}

		err := versionedStore.SaveLockingConfig(context.Background(), orgID, rev)
		require.ErrorIs(t, err, expectedErr)
	})
}

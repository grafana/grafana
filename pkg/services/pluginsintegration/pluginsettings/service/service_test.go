package service

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

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
			JSONData:       map[string]any{},
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
			JSONData:       map[string]any{},
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

func TestIntegrationPluginSettings(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	store := db.InitTestDB(t)
	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	psService := ProvideService(store, secretsService)

	t.Run("Existing plugin settings", func(t *testing.T) {
		secureJsonData, err := secretsService.EncryptJsonData(context.Background(), map[string]string{"secureKey": "secureValue"}, secrets.WithoutScope())
		require.NoError(t, err)

		existing := pluginsettings.PluginSetting{
			OrgId:    1,
			PluginId: "existing",
			Enabled:  false,
			Pinned:   false,
			JsonData: map[string]any{
				"key": "value",
			},
			SecureJsonData: secureJsonData,
			PluginVersion:  "1.0.0",
			Created:        time.Now(),
			Updated:        time.Now(),
		}

		err = store.WithTransactionalDbSession(context.Background(), func(sess *db.Session) error {
			affectedRows, innerErr := sess.Insert(&existing)
			require.Equal(t, int64(1), affectedRows)
			return innerErr
		})

		require.NoError(t, err)
		require.Greater(t, existing.Id, int64(0))

		t.Run("GetPluginSettings with orgID=0 should return all existing plugin settings", func(t *testing.T) {
			pluginSettings, err := psService.GetPluginSettings(context.Background(), &pluginsettings.GetArgs{OrgID: 0})
			require.NoError(t, err)
			require.Len(t, pluginSettings, 1)
			ps := pluginSettings[0]
			require.Equal(t, existing.OrgId, ps.OrgID)
			require.Equal(t, existing.PluginId, ps.PluginID)
			require.False(t, ps.Enabled)
		})

		t.Run("GetPluginSettings with orgID=1 should return all existing plugin settings", func(t *testing.T) {
			pluginSettings, err := psService.GetPluginSettings(context.Background(), &pluginsettings.GetArgs{OrgID: 1})
			require.NoError(t, err)
			require.Len(t, pluginSettings, 1)
			ps := pluginSettings[0]
			require.Equal(t, existing.OrgId, ps.OrgID)
			require.Equal(t, existing.PluginId, ps.PluginID)
			require.False(t, ps.Enabled)
		})

		t.Run("GetPluginSettingById should return existing plugin settings", func(t *testing.T) {
			query := &pluginsettings.GetByPluginIDArgs{
				OrgID:    existing.OrgId,
				PluginID: existing.PluginId,
			}
			ps, err := psService.GetPluginSettingByPluginID(context.Background(), query)
			require.NoError(t, err)
			require.NotNil(t, ps)
			require.Equal(t, existing.OrgId, ps.OrgID)
			require.Equal(t, existing.PluginId, ps.PluginID)
			require.False(t, ps.Enabled)
			require.NotNil(t, ps.JSONData)
			require.Equal(t, existing.JsonData, ps.JSONData)
			require.NotNil(t, ps.SecureJSONData)
			require.Equal(t, existing.SecureJsonData, ps.SecureJSONData)
		})

		t.Run("UpdatePluginSetting should update existing plugin settings and publish PluginStateChangedEvent", func(t *testing.T) {
			var pluginStateChangedEvent *pluginsettings.PluginStateChangedEvent
			store.Bus().AddEventListener(func(_ context.Context, evt *pluginsettings.PluginStateChangedEvent) error {
				pluginStateChangedEvent = evt
				return nil
			})

			cmd := &pluginsettings.UpdateArgs{
				OrgID:         existing.OrgId,
				PluginID:      existing.PluginId,
				Enabled:       true,
				PluginVersion: "1.0.1",
				JSONData: map[string]any{
					"key2": "value2",
				},
				SecureJSONData: map[string]string{
					"secureKey":  "secureValue",
					"secureKey2": "secureValue2",
				},
				Pinned: true,
			}
			err := psService.UpdatePluginSetting(context.Background(), cmd)

			require.NoError(t, err)
			require.NotNil(t, pluginStateChangedEvent)
			require.Equal(t, existing.OrgId, pluginStateChangedEvent.OrgId)
			require.Equal(t, existing.PluginId, pluginStateChangedEvent.PluginId)
			require.True(t, pluginStateChangedEvent.Enabled)

			err = psService.UpdatePluginSettingPluginVersion(context.Background(), &pluginsettings.UpdatePluginVersionArgs{
				OrgID:         cmd.OrgID,
				PluginID:      cmd.PluginID,
				PluginVersion: "1.0.2",
			})
			require.NoError(t, err)

			t.Run("GetPluginSettingById should return updated plugin settings", func(t *testing.T) {
				query := &pluginsettings.GetByPluginIDArgs{
					OrgID:    existing.OrgId,
					PluginID: existing.PluginId,
				}
				ps, err := psService.GetPluginSettingByPluginID(context.Background(), query)
				require.NoError(t, err)
				require.NotNil(t, ps)
				require.Equal(t, existing.OrgId, ps.OrgID)
				require.Equal(t, existing.PluginId, ps.PluginID)
				require.True(t, ps.Enabled)
				require.NotNil(t, ps.JSONData)
				require.Equal(t, cmd.JSONData, ps.JSONData)
				require.NotNil(t, ps.SecureJSONData)
				require.Equal(t, cmd.SecureJSONData, psService.DecryptedValues(ps))
				require.Equal(t, "1.0.2", ps.PluginVersion)
				require.True(t, ps.Pinned)
			})
		})
	})

	t.Run("Non-existing plugin settings", func(t *testing.T) {
		t.Run("UpdatePluginSetting should insert plugin settings and publish PluginStateChangedEvent", func(t *testing.T) {
			var pluginStateChangedEvent *pluginsettings.PluginStateChangedEvent
			store.Bus().AddEventListener(func(_ context.Context, evt *pluginsettings.PluginStateChangedEvent) error {
				pluginStateChangedEvent = evt
				return nil
			})

			cmd := &pluginsettings.UpdateArgs{
				PluginID:      "test",
				Enabled:       true,
				OrgID:         1,
				PluginVersion: "1.0.0",
				JSONData: map[string]any{
					"key": "value",
				},
				SecureJSONData: map[string]string{
					"secureKey": "secureValue",
				},
			}
			err := psService.UpdatePluginSetting(context.Background(), cmd)

			require.NoError(t, err)
			require.NotNil(t, pluginStateChangedEvent)
			require.Equal(t, cmd.OrgID, pluginStateChangedEvent.OrgId)
			require.Equal(t, cmd.PluginID, pluginStateChangedEvent.PluginId)
			require.True(t, pluginStateChangedEvent.Enabled)

			t.Run("GetPluginSettingById should return inserted plugin settings", func(t *testing.T) {
				query := &pluginsettings.GetByPluginIDArgs{
					OrgID:    cmd.OrgID,
					PluginID: cmd.PluginID,
				}
				ps, err := psService.GetPluginSettingByPluginID(context.Background(), query)
				require.NoError(t, err)
				require.NotNil(t, ps)
				require.Equal(t, cmd.OrgID, ps.OrgID)
				require.Equal(t, cmd.PluginID, ps.PluginID)
				require.True(t, ps.Enabled)
				require.NotNil(t, ps.JSONData)
				require.Equal(t, cmd.JSONData, ps.JSONData)
				require.NotNil(t, ps.SecureJSONData)
				require.Equal(t, cmd.PluginVersion, ps.PluginVersion)
				require.False(t, ps.Pinned)
			})
		})
	})
}

//go:build integration
// +build integration

package sqlstore

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/require"
)

func TestIntegrationPluginSettings(t *testing.T) {
	store := InitTestDB(t)

	t.Run("Existing plugin settings", func(t *testing.T) {
		existing := models.PluginSetting{
			OrgId:    1,
			PluginId: "existing",
			Enabled:  false,
			Pinned:   false,
			JsonData: map[string]interface{}{
				"key": "value",
			},
			SecureJsonData: map[string][]byte{
				"secureKey": []byte("secureValue"),
			},
			PluginVersion: "1.0.0",
			Created:       time.Now(),
			Updated:       time.Now(),
		}

		err := store.WithTransactionalDbSession(context.Background(), func(sess *DBSession) error {
			affectedRows, innerErr := sess.Insert(&existing)
			require.Equal(t, int64(1), affectedRows)
			return innerErr
		})

		require.NoError(t, err)
		require.Greater(t, existing.Id, int64(0))

		t.Run("GetPluginSettings with orgID=0 should return all existing plugin settings", func(t *testing.T) {
			pluginSettings, err := store.GetPluginSettings(context.Background(), 0)
			require.NoError(t, err)
			require.Len(t, pluginSettings, 1)
			ps := pluginSettings[0]
			require.Equal(t, existing.OrgId, ps.OrgId)
			require.Equal(t, existing.PluginId, ps.PluginId)
			require.False(t, ps.Enabled)
			require.Nil(t, ps.JsonData)
			require.Nil(t, ps.SecureJsonData)
		})

		t.Run("GetPluginSettings with orgID=1 should return all existing plugin settings", func(t *testing.T) {
			pluginSettings, err := store.GetPluginSettings(context.Background(), 1)
			require.NoError(t, err)
			require.Len(t, pluginSettings, 1)
			ps := pluginSettings[0]
			require.Equal(t, existing.OrgId, ps.OrgId)
			require.Equal(t, existing.PluginId, ps.PluginId)
			require.False(t, ps.Enabled)
			require.Nil(t, ps.JsonData)
			require.Nil(t, ps.SecureJsonData)
		})

		t.Run("GetPluginSettingById should return existing plugin settings", func(t *testing.T) {
			query := &models.GetPluginSettingByIdQuery{
				OrgId:    existing.OrgId,
				PluginId: existing.PluginId,
			}
			err := store.GetPluginSettingById(context.Background(), query)
			require.NoError(t, err)
			ps := query.Result
			require.NotNil(t, ps)
			require.Equal(t, existing.OrgId, ps.OrgId)
			require.Equal(t, existing.PluginId, ps.PluginId)
			require.False(t, ps.Enabled)
			require.NotNil(t, ps.JsonData)
			require.Equal(t, existing.JsonData, ps.JsonData)
			require.NotNil(t, ps.SecureJsonData)
			require.Equal(t, existing.SecureJsonData, ps.SecureJsonData)
		})

		t.Run("UpdatePluginSetting should update existing plugin settings and publish PluginStateChangedEvent", func(t *testing.T) {
			var pluginStateChangedEvent *models.PluginStateChangedEvent
			bus.AddEventListener(func(_ context.Context, evt *models.PluginStateChangedEvent) error {
				pluginStateChangedEvent = evt
				return nil
			})

			cmd := &models.UpdatePluginSettingCmd{
				OrgId:         existing.OrgId,
				PluginId:      existing.PluginId,
				Enabled:       true,
				PluginVersion: "1.0.1",
				JsonData: map[string]interface{}{
					"key2": "value2",
				},
				EncryptedSecureJsonData: map[string][]byte{
					"secureKey":  []byte("secureValue"),
					"secureKey2": []byte("secureValue2"),
				},
				Pinned: true,
			}
			err := store.UpdatePluginSetting(context.Background(), cmd)

			require.NoError(t, err)
			require.NotNil(t, pluginStateChangedEvent)
			require.Equal(t, existing.OrgId, pluginStateChangedEvent.OrgId)
			require.Equal(t, existing.PluginId, pluginStateChangedEvent.PluginId)
			require.True(t, pluginStateChangedEvent.Enabled)

			err = store.UpdatePluginSettingVersion(context.Background(), &models.UpdatePluginSettingVersionCmd{
				OrgId:         cmd.OrgId,
				PluginId:      cmd.PluginId,
				PluginVersion: "1.0.2",
			})
			require.NoError(t, err)

			t.Run("GetPluginSettingById should return updated plugin settings", func(t *testing.T) {
				query := &models.GetPluginSettingByIdQuery{
					OrgId:    existing.OrgId,
					PluginId: existing.PluginId,
				}
				err := store.GetPluginSettingById(context.Background(), query)
				require.NoError(t, err)
				ps := query.Result
				require.NotNil(t, ps)
				require.Equal(t, existing.OrgId, ps.OrgId)
				require.Equal(t, existing.PluginId, ps.PluginId)
				require.True(t, ps.Enabled)
				require.NotNil(t, ps.JsonData)
				require.Equal(t, cmd.JsonData, ps.JsonData)
				require.NotNil(t, ps.SecureJsonData)
				require.Equal(t, cmd.EncryptedSecureJsonData, ps.SecureJsonData)
				require.Equal(t, "1.0.2", ps.PluginVersion)
				require.True(t, ps.Pinned)
			})
		})
	})

	t.Run("Non-existing plugin settings", func(t *testing.T) {
		t.Run("UpdatePluginSetting should insert plugin settings and publish PluginStateChangedEvent", func(t *testing.T) {
			var pluginStateChangedEvent *models.PluginStateChangedEvent
			bus.AddEventListener(func(_ context.Context, evt *models.PluginStateChangedEvent) error {
				pluginStateChangedEvent = evt
				return nil
			})

			cmd := &models.UpdatePluginSettingCmd{
				PluginId:      "test",
				Enabled:       true,
				OrgId:         1,
				PluginVersion: "1.0.0",
				JsonData: map[string]interface{}{
					"key": "value",
				},
				EncryptedSecureJsonData: map[string][]byte{
					"secureKey": []byte("secureValue"),
				},
			}
			err := store.UpdatePluginSetting(context.Background(), cmd)

			require.NoError(t, err)
			require.NotNil(t, pluginStateChangedEvent)
			require.Equal(t, cmd.OrgId, pluginStateChangedEvent.OrgId)
			require.Equal(t, cmd.PluginId, pluginStateChangedEvent.PluginId)
			require.True(t, pluginStateChangedEvent.Enabled)

			t.Run("GetPluginSettingById should return inserted plugin settings", func(t *testing.T) {
				query := &models.GetPluginSettingByIdQuery{
					OrgId:    cmd.OrgId,
					PluginId: cmd.PluginId,
				}
				err := store.GetPluginSettingById(context.Background(), query)
				require.NoError(t, err)
				ps := query.Result
				require.NotNil(t, ps)
				require.Equal(t, cmd.OrgId, ps.OrgId)
				require.Equal(t, cmd.PluginId, ps.PluginId)
				require.True(t, ps.Enabled)
				require.NotNil(t, ps.JsonData)
				require.Equal(t, cmd.JsonData, ps.JsonData)
				require.NotNil(t, ps.SecureJsonData)
				require.Equal(t, cmd.EncryptedSecureJsonData, ps.SecureJsonData)
				require.Equal(t, cmd.PluginVersion, ps.PluginVersion)
				require.False(t, ps.Pinned)
			})
		})
	})
}

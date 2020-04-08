package models

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/securejsondata"
)

func TestPluginSettingDecryptionCache(t *testing.T) {
	t.Run("When plugin settings hasn't been updated, encrypted JSON should be fetched from cache", func(t *testing.T) {
		ClearPluginSettingDecryptionCache()

		ps := PluginSetting{
			Id:       1,
			JsonData: map[string]interface{}{},
			SecureJsonData: securejsondata.GetEncryptedJsonData(map[string]string{
				"password": "password",
			}),
		}

		// Populate cache
		password, ok := ps.DecryptedValue("password")
		require.Equal(t, "password", password)
		require.True(t, ok)

		ps.SecureJsonData = securejsondata.GetEncryptedJsonData(map[string]string{
			"password": "",
		})

		require.Equal(t, "password", password)
		require.True(t, ok)
	})

	t.Run("When plugin settings is updated, encrypted JSON should not be fetched from cache", func(t *testing.T) {
		ClearPluginSettingDecryptionCache()

		ps := PluginSetting{
			Id:       1,
			JsonData: map[string]interface{}{},
			SecureJsonData: securejsondata.GetEncryptedJsonData(map[string]string{
				"password": "password",
			}),
		}

		// Populate cache
		password, ok := ps.DecryptedValue("password")
		require.Equal(t, "password", password)
		require.True(t, ok)

		ps.SecureJsonData = securejsondata.GetEncryptedJsonData(map[string]string{
			"password": "",
		})
		ps.Updated = time.Now()

		password, ok = ps.DecryptedValue("password")
		require.Empty(t, password)
		require.True(t, ok)
	})
}

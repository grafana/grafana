package models

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/securejsondata"
)

// clearPluginSettingDecryptionCache clears the datasource decryption cache.
func clearPluginSettingDecryptionCache() {
	pluginSettingDecryptionCache.Lock()
	defer pluginSettingDecryptionCache.Unlock()

	pluginSettingDecryptionCache.cache = make(map[int64]cachedDecryptedJSON)
}

func TestPluginSettingDecryptionCache(t *testing.T) {
	t.Run("When plugin settings hasn't been updated, encrypted JSON should be fetched from cache", func(t *testing.T) {
		clearPluginSettingDecryptionCache()

		ps := PluginSetting{
			Id:       1,
			JsonData: map[string]interface{}{},
			SecureJsonData: securejsondata.GetEncryptedJsonData(map[string]string{
				"password": "password",
			}),
		}

		// Populate cache
		password, ok := ps.DecryptedValues()["password"]
		require.Equal(t, "password", password)
		require.True(t, ok)

		ps.SecureJsonData = securejsondata.GetEncryptedJsonData(map[string]string{
			"password": "",
		})

		require.Equal(t, "password", password)
		require.True(t, ok)
	})

	t.Run("When plugin settings is updated, encrypted JSON should not be fetched from cache", func(t *testing.T) {
		clearPluginSettingDecryptionCache()

		ps := PluginSetting{
			Id:       1,
			JsonData: map[string]interface{}{},
			SecureJsonData: securejsondata.GetEncryptedJsonData(map[string]string{
				"password": "password",
			}),
		}

		// Populate cache
		password, ok := ps.DecryptedValues()["password"]
		require.Equal(t, "password", password)
		require.True(t, ok)

		ps.SecureJsonData = securejsondata.GetEncryptedJsonData(map[string]string{
			"password": "",
		})
		ps.Updated = time.Now()

		password, ok = ps.DecryptedValues()["password"]
		require.Empty(t, password)
		require.True(t, ok)
	})
}

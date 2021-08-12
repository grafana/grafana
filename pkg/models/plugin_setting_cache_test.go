package models

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/util"

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
	encr := util.Encrypt
	decr := util.Decrypt

	defer func() {
		util.Encrypt = encr
		util.Decrypt = decr
	}()

	util.Encrypt = func(payload []byte, opt util.EncryptionOption) ([]byte, error) {
		return payload, nil
	}

	util.Decrypt = func(payload []byte) ([]byte, error) {
		return payload, nil
	}

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

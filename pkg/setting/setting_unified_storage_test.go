package setting

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestCfg_setUnifiedStorageConfig(t *testing.T) {
	t.Run("read unified_storage configs", func(t *testing.T) {
		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../", Config: "../../conf/defaults.ini"})
		assert.NoError(t, err)

		s, err := cfg.Raw.NewSection("unified_storage.playlists.playlist.grafana.app")
		assert.NoError(t, err)

		_, err = s.NewKey("dualWriterMode", "2")
		assert.NoError(t, err)

		_, err = s.NewKey("dualWriterPeriodicDataSyncJobEnabled", "true")
		assert.NoError(t, err)

		_, err = s.NewKey("dataSyncerRecordsLimit", "1001")
		assert.NoError(t, err)

		_, err = s.NewKey("dataSyncerInterval", "10m")
		assert.NoError(t, err)

		// Add unified_storage section for index settings
		unifiedStorageSection, err := cfg.Raw.NewSection("unified_storage")
		assert.NoError(t, err)

		_, err = unifiedStorageSection.NewKey("index_min_count", "5")
		assert.NoError(t, err)

		cfg.setUnifiedStorageConfig()

		value, exists := cfg.UnifiedStorage["playlists.playlist.grafana.app"]

		assert.Equal(t, exists, true)
		assert.Equal(t, value, UnifiedStorageConfig{
			DualWriterMode:                       2,
			DualWriterPeriodicDataSyncJobEnabled: true,
			DataSyncerRecordsLimit:               1001,
			DataSyncerInterval:                   time.Minute * 10,
		})

		// Test that index settings are correctly parsed
		assert.Equal(t, 5, cfg.IndexMinCount)
	})

	t.Run("read unified_storage configs with defaults", func(t *testing.T) {
		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../", Config: "../../conf/defaults.ini"})
		assert.NoError(t, err)

		// Don't add any custom index settings, test defaults
		cfg.setUnifiedStorageConfig()

		// Test that default index settings are applied
		assert.Equal(t, 1, cfg.IndexMinCount)
	})
}

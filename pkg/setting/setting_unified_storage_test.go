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

		// Validate that migrated resources are enforced to mode 5
		for _, migratedResource := range MigratedUnifiedResources {
			sectionName := "unified_storage." + migratedResource
			section, err := cfg.Raw.NewSection(sectionName)
			assert.NoError(t, err)
			_, err = section.NewKey("dualWriterMode", "0") // will be changed to 5 in setUnifiedStorageConfig
			assert.NoError(t, err)
		}

		s, err := cfg.Raw.NewSection("unified_storage.resource.not_migrated.grafana.app")
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

		value, exists := cfg.UnifiedStorage["resource.not_migrated.grafana.app"]

		assert.Equal(t, exists, true)
		assert.Equal(t, value, UnifiedStorageConfig{
			DualWriterMode:                       2,
			DualWriterPeriodicDataSyncJobEnabled: true,
			DataSyncerRecordsLimit:               1001,
			DataSyncerInterval:                   time.Minute * 10,
		})

		for _, migratedResource := range MigratedUnifiedResources {
			value, exists := cfg.UnifiedStorage[migratedResource]
			assert.Equal(t, exists, true)
			assert.Equal(t, value, UnifiedStorageConfig{
				DualWriterMode:                      5,
				DualWriterMigrationDataSyncDisabled: true,
			})
		}

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

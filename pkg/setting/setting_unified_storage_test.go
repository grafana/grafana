package setting

import (
	"testing"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/stretchr/testify/assert"
)

func TestCfg_setUnifiedStorageConfig(t *testing.T) {
	t.Run("read unified_storage configs", func(t *testing.T) {
		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../", Config: "../../conf/defaults.ini"})
		assert.NoError(t, err)

		setSectionKey := func(sectionName, key, value string) {
			section := cfg.Raw.Section(sectionName) // Gets existing or creates new
			_, err := section.NewKey(key, value)
			assert.NoError(t, err)
		}

		setMigratedResourceKey := func(key, value string) {
			for migratedResource := range MigratedUnifiedResources {
				setSectionKey("unified_storage."+migratedResource, key, value)
			}
		}

		validateMigratedResources := func(optIn bool) {
			for migratedResource, enabled := range MigratedUnifiedResources {
				resourceCfg, exists := cfg.UnifiedStorage[migratedResource]

				isEnabled := enabled
				if optIn {
					isEnabled = true
				}

				if !isEnabled {
					if exists {
						assert.Equal(t, rest.DualWriterMode(1), resourceCfg.DualWriterMode, migratedResource)
					}
					continue
				}
				assert.Equal(t, exists, true, migratedResource)

				assert.Equal(t, UnifiedStorageConfig{
					DualWriterMode:  5,
					EnableMigration: isEnabled,
				}, resourceCfg, migratedResource)
			}
		}

		setMigratedResourceKey("dualWriterMode", "1") // migrated resources enabled by default will change to 5 in setUnifiedStorageConfig

		setSectionKey("unified_storage.resource.not_migrated.grafana.app", "dualWriterMode", "2")

		// Add unified_storage section for index settings
		setSectionKey("unified_storage", "index_min_count", "5")

		cfg.setUnifiedStorageConfig()

		value, exists := cfg.UnifiedStorage["resource.not_migrated.grafana.app"]

		assert.Equal(t, exists, true)
		assert.Equal(t, value, UnifiedStorageConfig{
			DualWriterMode:         2,
			AutoMigrationThreshold: 0,
		})

		validateMigratedResources(false)

		setMigratedResourceKey("enableMigration", "true") // will be changed to 5 in setUnifiedStorageConfig

		cfg.setUnifiedStorageConfig()

		validateMigratedResources(true)

		// Test that index settings are correctly parsed
		assert.Equal(t, 5, cfg.IndexMinCount)
	})

	t.Run("search_inject_failures_percent", func(t *testing.T) {
		setSectionKey := func(cfg *Cfg, key, value string) {
			section := cfg.Raw.Section("unified_storage")
			_, err := section.NewKey(key, value)
			assert.NoError(t, err)
		}

		t.Run("defaults to 0", func(t *testing.T) {
			cfg := NewCfg()
			err := cfg.Load(CommandLineArgs{HomePath: "../../", Config: "../../conf/defaults.ini"})
			assert.NoError(t, err)
			cfg.setUnifiedStorageConfig()
			assert.Equal(t, 0, cfg.SearchInjectFailuresPercent)
		})

		t.Run("reads configured value", func(t *testing.T) {
			cfg := NewCfg()
			err := cfg.Load(CommandLineArgs{HomePath: "../../", Config: "../../conf/defaults.ini"})
			assert.NoError(t, err)
			setSectionKey(cfg, "search_inject_failures_percent", "50")
			cfg.setUnifiedStorageConfig()
			assert.Equal(t, 50, cfg.SearchInjectFailuresPercent)
		})

		t.Run("clamps negative to 0", func(t *testing.T) {
			cfg := NewCfg()
			err := cfg.Load(CommandLineArgs{HomePath: "../../", Config: "../../conf/defaults.ini"})
			assert.NoError(t, err)
			setSectionKey(cfg, "search_inject_failures_percent", "-10")
			cfg.setUnifiedStorageConfig()
			assert.Equal(t, 0, cfg.SearchInjectFailuresPercent)
		})

		t.Run("clamps over 100 to 100", func(t *testing.T) {
			cfg := NewCfg()
			err := cfg.Load(CommandLineArgs{HomePath: "../../", Config: "../../conf/defaults.ini"})
			assert.NoError(t, err)
			setSectionKey(cfg, "search_inject_failures_percent", "200")
			cfg.setUnifiedStorageConfig()
			assert.Equal(t, 100, cfg.SearchInjectFailuresPercent)
		})
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

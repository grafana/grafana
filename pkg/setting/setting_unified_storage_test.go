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

				expectedThreshold := 0
				if AutoMigratedUnifiedResources[migratedResource] {
					expectedThreshold = DefaultAutoMigrationThreshold
				}

				assert.Equal(t, UnifiedStorageConfig{
					DualWriterMode:         5,
					EnableMigration:        isEnabled,
					AutoMigrationThreshold: expectedThreshold,
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

	t.Run("force mode 5 for mode5-only resources when migration disabled", func(t *testing.T) {
		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../", Config: "../../conf/defaults.ini"})
		assert.NoError(t, err)

		setSectionKey := func(sectionName, key, value string) {
			section := cfg.Raw.Section(sectionName)
			_, err := section.NewKey(key, value)
			assert.NoError(t, err)
		}

		setSectionKey("unified_storage", "disable_data_migrations", "true")
		setSectionKey("unified_storage."+PlaylistResource, "dualWriterMode", "1")
		setSectionKey("unified_storage."+PlaylistResource, "enableMigration", "false")

		cfg.setUnifiedStorageConfig()

		resourceCfg, exists := cfg.UnifiedStorage[PlaylistResource]
		assert.True(t, exists)
		assert.Equal(t, UnifiedStorageConfig{
			DualWriterMode:         rest.Mode5,
			EnableMigration:        true,
			AutoMigrationThreshold: 0,
		}, resourceCfg)
	})

	t.Run("force mode 5 for mode5-only resources when storage type is legacy", func(t *testing.T) {
		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../", Config: "../../conf/defaults.ini"})
		assert.NoError(t, err)

		setSectionKey := func(sectionName, key, value string) {
			section := cfg.Raw.Section(sectionName)
			_, err := section.NewKey(key, value)
			assert.NoError(t, err)
		}

		setSectionKey("grafana-apiserver", "storage_type", "legacy")
		setSectionKey("unified_storage."+PlaylistResource, "dualWriterMode", "4")
		setSectionKey("unified_storage."+PlaylistResource, "enableMigration", "false")

		cfg.setUnifiedStorageConfig()

		resourceCfg, exists := cfg.UnifiedStorage[PlaylistResource]
		assert.True(t, exists)
		assert.Equal(t, UnifiedStorageConfig{
			DualWriterMode:         rest.Mode5,
			EnableMigration:        true,
			AutoMigrationThreshold: 0,
		}, resourceCfg)
	})

	t.Run("force mode 5 for mode5-only resources when mode is manually set to non-5", func(t *testing.T) {
		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../", Config: "../../conf/defaults.ini"})
		assert.NoError(t, err)

		setSectionKey := func(sectionName, key, value string) {
			section := cfg.Raw.Section(sectionName)
			_, err := section.NewKey(key, value)
			assert.NoError(t, err)
		}

		setSectionKey("grafana-apiserver", "storage_type", "unified")
		setSectionKey("unified_storage."+PlaylistResource, "dualWriterMode", "4")
		setSectionKey("unified_storage."+PlaylistResource, "enableMigration", "false")

		cfg.setUnifiedStorageConfig()

		resourceCfg, exists := cfg.UnifiedStorage[PlaylistResource]
		assert.True(t, exists)
		assert.Equal(t, UnifiedStorageConfig{
			DualWriterMode:         rest.Mode5,
			EnableMigration:        true,
			AutoMigrationThreshold: 0,
		}, resourceCfg)
	})

	t.Run("all mode5-only resources are also migrated resources", func(t *testing.T) {
		for resource := range Mode5OnlyResources {
			assert.True(t, MigratedUnifiedResources[resource], resource)
		}
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

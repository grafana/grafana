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

	t.Run("env vars create unified_storage resource sections without ini file", func(t *testing.T) {
		// Set env vars for a resource that has NO ini section defined.
		t.Setenv("GF_UNIFIED_STORAGE_DASHBOARDS_DASHBOARD_GRAFANA_APP_DUALWRITERMODE", "3")
		t.Setenv("GF_UNIFIED_STORAGE_DASHBOARDS_DASHBOARD_GRAFANA_APP_ENABLEMIGRATION", "false")
		t.Setenv("GF_UNIFIED_STORAGE_DASHBOARDS_DASHBOARD_GRAFANA_APP_AUTOMIGRATIONTHRESHOLD", "5")

		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../", Config: "../../conf/defaults.ini"})
		assert.NoError(t, err)

		cfg.setUnifiedStorageConfig()

		value, exists := cfg.UnifiedStorage[DashboardResource]
		assert.True(t, exists, "dashboards.dashboard.grafana.app should exist from env var")
		// Note: enforceMigrationToUnifiedConfigs may override dualWriterMode to 5
		// for migrated resources. We test the enableMigration was correctly parsed as false.
		assert.Equal(t, false, value.EnableMigration)
		assert.Equal(t, 5, value.AutoMigrationThreshold)
	})

	t.Run("env vars work for unknown resource names", func(t *testing.T) {
		// A resource not in MigratedUnifiedResources, configured purely via env vars.
		t.Setenv("GF_UNIFIED_STORAGE_WIDGETS_WIDGET_CUSTOM_IO_DUALWRITERMODE", "2")

		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../", Config: "../../conf/defaults.ini"})
		assert.NoError(t, err)

		cfg.setUnifiedStorageConfig()

		value, exists := cfg.UnifiedStorage["widgets.widget.custom.io"]
		assert.True(t, exists, "widgets.widget.custom.io should exist from env var")
		assert.Equal(t, rest.DualWriterMode(2), value.DualWriterMode)
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

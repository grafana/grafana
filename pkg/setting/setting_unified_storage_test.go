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

	t.Run("env vars create unified_storage resource sections without ini file", func(t *testing.T) {
		// Set env vars for a resource that has NO ini section defined.
		t.Setenv("GF_UNIFIED_STORAGE_DASHBOARDS_DASHBOARD_GRAFANA_APP_DUALWRITERMODE", "3")
		t.Setenv("GF_UNIFIED_STORAGE_DASHBOARDS_DASHBOARD_GRAFANA_APP_ENABLEMIGRATION", "false")

		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../", Config: "../../conf/defaults.ini"})
		assert.NoError(t, err)

		cfg.setUnifiedStorageConfig()

		value, exists := cfg.UnifiedStorage[DashboardResource]
		assert.True(t, exists, "dashboards.dashboard.grafana.app should exist from env var")
		// Note: enforceMigrationToUnifiedConfigs may override dualWriterMode to 5
		// for migrated resources. We test the enableMigration was correctly parsed as false.
		assert.Equal(t, false, value.EnableMigration)
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

	t.Run("env vars populate bare [unified_storage] section keys", func(t *testing.T) {
		// These env vars target keys in the bare [unified_storage] section
		// that are not pre-defined in defaults.ini.
		t.Setenv("GF_UNIFIED_STORAGE_MIGRATION_CACHE_SIZE_KB", "2000000")
		t.Setenv("GF_UNIFIED_STORAGE_MIGRATION_PARQUET_BUFFER", "true")
		t.Setenv("GF_UNIFIED_STORAGE_INDEX_WORKERS", "3")

		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../", Config: "../../conf/defaults.ini"})
		assert.NoError(t, err)

		cfg.setUnifiedStorageConfig()

		assert.Equal(t, 2000000, cfg.MigrationCacheSizeKB)
		assert.True(t, cfg.MigrationParquetBuffer)
		assert.Equal(t, 3, cfg.IndexWorkers)
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

func TestApplyMigrationEnforcements(t *testing.T) {
	newCfg := func(t *testing.T) *Cfg {
		t.Helper()
		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../", Config: "../../conf/defaults.ini"})
		assert.NoError(t, err)
		cfg.UnifiedStorage = make(map[string]UnifiedStorageConfig)
		return cfg
	}

	enableMigrations := func(cfg *Cfg) {
		cfg.Target = []string{"all"}
		// storage_type defaults to "unified", no need to set it
	}

	disableMigrations := func(cfg *Cfg) {
		cfg.Target = []string{"backend"}
	}

	t.Run("enforces EnableSearch when migrations run and search is disabled", func(t *testing.T) {
		cfg := newCfg(t)
		enableMigrations(cfg)
		cfg.EnableSearch = false

		cfg.applyMigrationEnforcements()

		assert.True(t, cfg.EnableSearch)
	})

	t.Run("keeps EnableSearch true when migrations run", func(t *testing.T) {
		cfg := newCfg(t)
		enableMigrations(cfg)
		cfg.EnableSearch = true

		cfg.applyMigrationEnforcements()

		assert.True(t, cfg.EnableSearch)
	})

	t.Run("enforces mode 5 for default-enabled migrated resources", func(t *testing.T) {
		cfg := newCfg(t)
		enableMigrations(cfg)

		cfg.applyMigrationEnforcements()

		for resource, enabledByDefault := range MigratedUnifiedResources {
			if !enabledByDefault {
				continue
			}
			resourceCfg, exists := cfg.UnifiedStorage[resource]
			assert.True(t, exists, resource)
			assert.Equal(t, rest.DualWriterMode(5), resourceCfg.DualWriterMode, resource)
			assert.True(t, resourceCfg.EnableMigration, resource)
		}
	})

	t.Run("skips resources with migration explicitly disabled", func(t *testing.T) {
		cfg := newCfg(t)
		enableMigrations(cfg)
		cfg.UnifiedStorage[DashboardResource] = UnifiedStorageConfig{
			DualWriterMode:  1,
			EnableMigration: false,
		}

		cfg.applyMigrationEnforcements()

		resourceCfg := cfg.UnifiedStorage[DashboardResource]
		assert.Equal(t, rest.DualWriterMode(1), resourceCfg.DualWriterMode)
		assert.False(t, resourceCfg.EnableMigration)
	})

	t.Run("disables local search when migrations disabled and shouldProxySearchRemotely", func(t *testing.T) {
		cfg := newCfg(t)
		disableMigrations(cfg)
		cfg.EnableSearch = true
		cfg.Raw.Section("grafana-apiserver").Key("search_server_address").SetValue("localhost:10000")

		cfg.applyMigrationEnforcements()

		assert.False(t, cfg.EnableSearch)
	})

	t.Run("keeps local search on search-server target even with search_server_address set", func(t *testing.T) {
		cfg := newCfg(t)
		disableMigrations(cfg)
		cfg.Target = []string{"search-server"}
		cfg.EnableSearch = true
		cfg.Raw.Section("grafana-apiserver").Key("search_server_address").SetValue("localhost:10000")

		cfg.applyMigrationEnforcements()

		assert.True(t, cfg.EnableSearch)
	})

	t.Run("disables local search on storage-server target with search_server_address set", func(t *testing.T) {
		cfg := newCfg(t)
		disableMigrations(cfg)
		cfg.Target = []string{"storage-server"}
		cfg.EnableSearch = true
		cfg.Raw.Section("grafana-apiserver").Key("search_server_address").SetValue("localhost:10000")

		cfg.applyMigrationEnforcements()

		assert.False(t, cfg.EnableSearch)
	})

	t.Run("keeps local search when migrations disabled and no search_server_address", func(t *testing.T) {
		cfg := newCfg(t)
		disableMigrations(cfg)
		cfg.EnableSearch = true

		cfg.applyMigrationEnforcements()

		assert.True(t, cfg.EnableSearch)
	})
}

func TestParseCommaSeparatedList(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []string
	}{
		{name: "empty string", input: "", expected: nil},
		{name: "single value", input: "dashboard.grafana.app/dashboards", expected: []string{"dashboard.grafana.app/dashboards"}},
		{name: "multiple values", input: "dashboard.grafana.app/dashboards,folder.grafana.app/folders", expected: []string{"dashboard.grafana.app/dashboards", "folder.grafana.app/folders"}},
		{name: "with whitespace", input: " dashboard.grafana.app/dashboards , folder.grafana.app/folders ", expected: []string{"dashboard.grafana.app/dashboards", "folder.grafana.app/folders"}},
		{name: "trailing comma", input: "dashboard.grafana.app/dashboards,", expected: []string{"dashboard.grafana.app/dashboards"}},
		{name: "only commas", input: ",,", expected: []string{}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, parseCommaSeparatedList(tt.input))
		})
	}
}

func TestIsTargetEligibleForMigrations(t *testing.T) {
	tests := []struct {
		name     string
		targets  []string
		expected bool
	}{
		{name: "all target", targets: []string{"all"}, expected: true},
		{name: "core target", targets: []string{"core"}, expected: true},
		{name: "all among multiple targets", targets: []string{"storage-server", "all"}, expected: true},
		{name: "core among multiple targets", targets: []string{"storage-server", "core"}, expected: true},
		{name: "storage-server only", targets: []string{"storage-server"}, expected: false},
		{name: "empty targets", targets: []string{}, expected: false},
		{name: "other target", targets: []string{"search-server-distributor"}, expected: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, isTargetEligibleForMigrations(tt.targets))
		})
	}
}

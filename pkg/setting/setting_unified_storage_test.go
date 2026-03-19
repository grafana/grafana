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
		cfg.DisableDataMigrations = false
		// storage_type defaults to "unified", no need to set it
	}

	disableMigrations := func(cfg *Cfg) {
		cfg.DisableDataMigrations = true
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

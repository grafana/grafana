package setting

import (
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/util/osutil"
)

var MigratedUnifiedResources = []string{
	"playlists.playlist.grafana.app",
	"folders.folder.grafana.app",
	"dashboards.dashboard.grafana.app",
}

// read storage configs from ini file. They look like:
// [unified_storage.<group>.<resource>]
// <field> = <value>
// e.g.
// [unified_storage.playlists.playlist.grafana.app]
// dualWriterMode = 2
func (cfg *Cfg) setUnifiedStorageConfig() {
	storageConfig := make(map[string]UnifiedStorageConfig)
	sections := cfg.Raw.Sections()
	for _, section := range sections {
		sectionName := section.Name()
		if !strings.HasPrefix(sectionName, "unified_storage.") {
			continue
		}
		// the resource name is the part after the first dot
		resourceName := strings.SplitAfterN(sectionName, ".", 2)[1]

		// parse dualWriter modes from the section
		dualWriterMode := section.Key("dualWriterMode").MustInt(0)

		// parse dualWriter periodic data syncer config
		dualWriterPeriodicDataSyncJobEnabled := section.Key("dualWriterPeriodicDataSyncJobEnabled").MustBool(false)

		// parse dualWriter migration data sync disabled from resource section
		dualWriterMigrationDataSyncDisabled := section.Key("dualWriterMigrationDataSyncDisabled").MustBool(false)

		// parse dataSyncerRecordsLimit from resource section
		dataSyncerRecordsLimit := section.Key("dataSyncerRecordsLimit").MustInt(1000)

		// parse dataSyncerInterval from resource section
		dataSyncerInterval := section.Key("dataSyncerInterval").MustDuration(time.Hour)

		storageConfig[resourceName] = UnifiedStorageConfig{
			DualWriterMode:                       rest.DualWriterMode(dualWriterMode),
			DualWriterPeriodicDataSyncJobEnabled: dualWriterPeriodicDataSyncJobEnabled,
			DualWriterMigrationDataSyncDisabled:  dualWriterMigrationDataSyncDisabled,
			DataSyncerRecordsLimit:               dataSyncerRecordsLimit,
			DataSyncerInterval:                   dataSyncerInterval,
		}
	}
	cfg.UnifiedStorage = storageConfig

	// Set indexer config for unified storage
	section := cfg.Raw.Section("unified_storage")
	cfg.DisableDataMigrations = section.Key("disable_data_migrations").MustBool(false)
	if !cfg.DisableDataMigrations && cfg.getUnifiedStorageType() == "unified" {
		// Helper log to find instances running migrations in the future
		cfg.Logger.Info("Unified migration configs enforced")
		cfg.enforceMigrationToUnifiedConfigs()
	} else {
		// Helper log to find instances disabling migration
		cfg.Logger.Info("Unified migration configs enforcement disabled", "storage_type", cfg.getUnifiedStorageType(), "disable_data_migrations", cfg.DisableDataMigrations)
	}
	cfg.EnableSearch = section.Key("enable_search").MustBool(false)
	cfg.MaxPageSizeBytes = section.Key("max_page_size_bytes").MustInt(0)
	cfg.IndexPath = section.Key("index_path").String()
	cfg.IndexWorkers = section.Key("index_workers").MustInt(10)
	cfg.IndexRebuildWorkers = section.Key("index_rebuild_workers").MustInt(5)
	cfg.EnableSharding = section.Key("enable_sharding").MustBool(false)
	cfg.QOSEnabled = section.Key("qos_enabled").MustBool(false)
	cfg.QOSNumberWorker = section.Key("qos_num_worker").MustInt(16)
	cfg.QOSMaxSizePerTenant = section.Key("qos_max_size_per_tenant").MustInt(1000)
	cfg.MemberlistBindAddr = section.Key("memberlist_bind_addr").String()
	cfg.MemberlistAdvertiseAddr = section.Key("memberlist_advertise_addr").String()
	cfg.MemberlistAdvertisePort = section.Key("memberlist_advertise_port").MustInt(7946)
	cfg.MemberlistJoinMember = section.Key("memberlist_join_member").String()
	cfg.MemberlistClusterLabel = section.Key("memberlist_cluster_label").String()
	cfg.MemberlistClusterLabelVerificationDisabled = section.Key("memberlist_cluster_label_verification_disabled").MustBool(false)
	cfg.SearchRingReplicationFactor = section.Key("search_ring_replication_factor").MustInt(1)
	cfg.InstanceID = section.Key("instance_id").String()
	cfg.IndexFileThreshold = section.Key("index_file_threshold").MustInt(10)
	cfg.IndexMinCount = section.Key("index_min_count").MustInt(1)
	// default to 24 hours because usage insights summarizes the data every 24 hours
	cfg.IndexRebuildInterval = section.Key("index_rebuild_interval").MustDuration(24 * time.Hour)
	cfg.IndexCacheTTL = section.Key("index_cache_ttl").MustDuration(10 * time.Minute)
	cfg.IndexMinUpdateInterval = section.Key("index_min_update_interval").MustDuration(0)
	cfg.SprinklesApiServer = section.Key("sprinkles_api_server").String()
	cfg.SprinklesApiServerPageLimit = section.Key("sprinkles_api_server_page_limit").MustInt(10000)
	cfg.CACertPath = section.Key("ca_cert_path").String()
	cfg.HttpsSkipVerify = section.Key("https_skip_verify").MustBool(false)
	cfg.ResourceServerJoinRingTimeout = section.Key("resource_server_join_ring_timeout").MustDuration(10 * time.Second)

	// quotas/limits config
	cfg.OverridesFilePath = section.Key("overrides_path").String()
	cfg.OverridesReloadInterval = section.Key("overrides_reload_period").MustDuration(30 * time.Second)

	cfg.MaxFileIndexAge = section.Key("max_file_index_age").MustDuration(0)
	cfg.MinFileIndexBuildVersion = section.Key("min_file_index_build_version").MustString("")
}

// enforceMigrationToUnifiedConfigs enforces configurations required to run migrated resources in mode 5
// All migrated resources in MigratedUnifiedResources are set to mode 5 and unified search is enabled
func (cfg *Cfg) enforceMigrationToUnifiedConfigs() {
	section := cfg.Raw.Section("unified_storage")
	cfg.EnableSearch = section.Key("enable_search").MustBool(true)
	if !cfg.EnableSearch {
		cfg.Logger.Info("Enforcing enable_search for unified storage")
		section.Key("enable_search").SetValue("true")
		cfg.EnableSearch = true
	}
	for _, resource := range MigratedUnifiedResources {
		cfg.Logger.Info("Enforcing mode 5 for resource in unified storage", "resource", resource)
		if oldCfg, ok := cfg.UnifiedStorage[resource]; ok {
			cfg.Logger.Info("Overriding unified storage config for migrated resource", "resource", resource, "old_config", oldCfg)
		}
		cfg.UnifiedStorage[resource] = UnifiedStorageConfig{
			DualWriterMode:                      5,
			DualWriterMigrationDataSyncDisabled: true,
		}
	}
}

// getUnifiedStorageType returns the configured storage type without creating or mutating keys.
// Precedence: env > ini > default ("unified").
// Used to decide unified storage behavior early without side effects.
func (cfg *Cfg) getUnifiedStorageType() string {
	const (
		grafanaAPIServerSectionName = "grafana-apiserver"
		storageTypeKeyName          = "storage_type"
		defaultStorageType          = "unified"
	)
	if envStorageType := (osutil.RealEnv{}).Getenv(EnvKey(grafanaAPIServerSectionName, storageTypeKeyName)); envStorageType != "" {
		return envStorageType
	}
	if cfg.Raw.Section(grafanaAPIServerSectionName).HasKey(storageTypeKeyName) {
		return cfg.Raw.Section(grafanaAPIServerSectionName).Key(storageTypeKeyName).Value()
	}
	return defaultStorageType
}

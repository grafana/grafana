package setting

import (
	"fmt"
	"os"
	"slices"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/util/osutil"
)

// knownUnifiedStorageKeys maps uppercased env-var-style key suffixes to their
// actual camelCase ini key names used in [unified_storage.*] sections.
var knownUnifiedStorageKeys = map[string]string{
	"DUALWRITERMODE":  "dualWriterMode",
	"ENABLEMIGRATION": "enableMigration",
}

const (
	PlaylistResource         = "playlists.playlist.grafana.app"
	FolderResource           = "folders.folder.grafana.app"
	DashboardResource        = "dashboards.dashboard.grafana.app"
	ShortURLResource         = "shorturls.shorturl.grafana.app"
	SnapshotResource         = "snapshots.dashboard.grafana.app"
	StarsResource            = "stars.collections.grafana.app"
	DataSourceResources      = "datasources.datasource.grafana.app" // All datasources
	QueryCacheConfigResource = "querycacheconfigs.querycaching.grafana.app"
)

// MigratedUnifiedResources maps resources to a boolean indicating if migration is enabled by default
var MigratedUnifiedResources = map[string]bool{
	PlaylistResource:         true,  // Only Mode5!
	FolderResource:           true,  // Only Mode5!
	DashboardResource:        true,  // Only Mode5!
	ShortURLResource:         false, // Requires kubernetesShortURLs to be enabled by default
	SnapshotResource:         false, // Requires kubernetesSnapshots to be enabled by default
	StarsResource:            false,
	DataSourceResources:      false,
	QueryCacheConfigResource: false,
}

// applyUnifiedStorageEnvOverrides scans environment variables matching
// GF_UNIFIED_STORAGE_<resource>_<key> and creates the corresponding ini
// sections and keys. This allows users to configure unified_storage resource
// sections purely via environment variables without pre-defining them in an
// ini file.
//
// Storage configs in the ini file look like:
//
//	[unified_storage.{resource}.{group}]
//	<field> = <value>
//
// For example:
//
//	[unified_storage.playlists.playlist.grafana.app]
//	dualWriterMode = 2
//
// Kubernetes resource names (e.g., "dashboards.dashboard.grafana.app") never
// contain underscores — only dots and lowercase alphanumerics — so every
// underscore in the resource portion of the env var name maps unambiguously
// back to a dot. The key names are matched from a known list
// ([knownUnifiedStorageKeys]) to preserve their original camelCase.
//
// Env vars that do not match a known camelCase resource suffix are treated
// as keys on the bare [unified_storage] section (lowercased snake_case),
// e.g. GF_UNIFIED_STORAGE_MIGRATION_CACHE_SIZE_KB → migration_cache_size_kb.
func (cfg *Cfg) applyUnifiedStorageEnvOverrides() {
	envPrefix := EnvSectionPrefix("unified_storage")

	for _, env := range os.Environ() {
		if !strings.HasPrefix(env, envPrefix) {
			continue
		}
		eqIdx := strings.IndexByte(env, '=')
		if eqIdx < 0 {
			continue
		}
		envKey := env[:eqIdx]
		envValue := env[eqIdx+1:]
		if envValue == "" {
			continue
		}

		remainder := envKey[len(envPrefix):]

		// Try to match a known key suffix. The key is always the last component
		// after the final underscore that matches a known key name.
		matched := false
		for envKeySuffix, iniKeyName := range knownUnifiedStorageKeys {
			suffix := "_" + envKeySuffix
			if !strings.HasSuffix(remainder, suffix) {
				continue
			}
			resourceEnv := remainder[:len(remainder)-len(suffix)]
			if resourceEnv == "" {
				continue
			}
			// Reconstruct the resource name: lowercase with underscores → dots.
			resourceName := strings.ToLower(strings.ReplaceAll(resourceEnv, "_", "."))
			sectionName := "unified_storage." + resourceName
			cfg.Raw.Section(sectionName).Key(iniKeyName).SetValue(envValue)
			cfg.appliedEnvOverrides = append(cfg.appliedEnvOverrides,
				fmt.Sprintf("%s=%s", envKey, RedactedValue(envKey, envValue)))
			matched = true
			break
		}
		if matched {
			continue
		}

		// Fallback: bare [unified_storage] section key (lowercased snake_case).
		keyName := strings.ToLower(remainder)
		if keyName == "" {
			continue
		}
		cfg.Raw.Section("unified_storage").Key(keyName).SetValue(envValue)
		cfg.appliedEnvOverrides = append(cfg.appliedEnvOverrides,
			fmt.Sprintf("%s=%s", envKey, RedactedValue(envKey, envValue)))
	}
}

// read storage configs from ini file. They look like:
// [unified_storage.<group>.<resource>]
// <field> = <value>
// e.g.
// [unified_storage.playlists.playlist.grafana.app]
// dualWriterMode = 2
func (cfg *Cfg) setUnifiedStorageConfig() {
	// Pre-create sections from GF_UNIFIED_STORAGE_* env vars so that
	// resource sections can be configured purely via environment variables.
	cfg.applyUnifiedStorageEnvOverrides()

	storageConfig := make(map[string]UnifiedStorageConfig)
	sections := cfg.Raw.Sections()
	for _, section := range sections {
		sectionName := section.Name()
		if !strings.HasPrefix(sectionName, "unified_storage.") {
			continue
		}
		// the resource name is the part after the first dot
		resourceName := strings.SplitAfterN(sectionName, ".", 2)[1]

		// The resource specific settings do not apply
		if MigratedUnifiedResources[resourceName] {
			cfg.Logger.Warn("Unified storage config has no effect for fully migrated resources", "resource", resourceName)
		}

		// parse dualWriter modes from the section
		dualWriterMode := section.Key("dualWriterMode").MustInt(0)

		// parse EnableMigration from resource section
		enableMigration := MigratedUnifiedResources[resourceName]
		if section.HasKey("enableMigration") {
			enableMigration = section.Key("enableMigration").MustBool(MigratedUnifiedResources[resourceName])
		}

		storageConfig[resourceName] = UnifiedStorageConfig{
			DualWriterMode:  rest.DualWriterMode(dualWriterMode),
			EnableMigration: enableMigration,
		}
	}
	cfg.UnifiedStorage = storageConfig

	// Set indexer config for unified storage
	section := cfg.Raw.Section("unified_storage")
	cfg.MigrationCacheSizeKB = section.Key("migration_cache_size_kb").MustInt(1000000)
	cfg.MigrationParquetBuffer = section.Key("migration_parquet_buffer").MustBool(false)
	cfg.DisableLegacyTableRename = section.Key("disable_legacy_table_rename").MustBool(false)
	cfg.RenameWaitDeadline = section.Key("rename_wait_deadline").MustDuration(time.Minute)
	cfg.SearchInjectFailuresPercent = section.Key("search_inject_failures_percent").MustInt(0)
	if cfg.SearchInjectFailuresPercent < 0 {
		cfg.SearchInjectFailuresPercent = 0
	} else if cfg.SearchInjectFailuresPercent > 100 {
		cfg.SearchInjectFailuresPercent = 100
	}
	cfg.EnableSearch = section.Key("enable_search").MustBool(true)
	cfg.EnableVectorBackend = section.Key("vector_backend").MustBool(false)
	cfg.applyMigrationEnforcements()
	cfg.EnableSearchClient = section.Key("enable_search_client").MustBool(false)
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
	cfg.IndexModificationCacheTTL = section.Key("index_modification_cache_ttl").MustDuration(0)
	cfg.SprinklesApiServer = section.Key("sprinkles_api_server").String()
	cfg.SprinklesApiServerPageLimit = section.Key("sprinkles_api_server_page_limit").MustInt(10000)
	cfg.CACertPath = section.Key("ca_cert_path").String()
	cfg.HttpsSkipVerify = section.Key("https_skip_verify").MustBool(false)
	cfg.ResourceServerJoinRingTimeout = section.Key("resource_server_join_ring_timeout").MustDuration(10 * time.Second)

	// quotas/limits config
	cfg.OverridesFilePath = section.Key("overrides_path").String()
	cfg.OverridesReloadInterval = section.Key("overrides_reload_period").MustDuration(30 * time.Second)
	cfg.EnforcedQuotaResources = parseCommaSeparatedList(section.Key("enforce_quotas_resources").MustString(""))
	cfg.QuotasErrorMessageSupportInfo = section.Key("quotas_error_message_support_info").MustString("Please contact your administrator to increase it.")

	// tenant watcher
	cfg.TenantApiServerAddress = section.Key("tenant_api_server_address").String()
	cfg.TenantWatcherAllowInsecureTLS = section.Key("tenant_watcher_allow_insecure_tls").MustBool(false)
	cfg.TenantWatcherCAFile = section.Key("tenant_watcher_ca_file").String()
	cfg.TenantWatcherUsePolling = section.Key("tenant_watcher_use_polling").MustBool(false)
	cfg.TenantWatcherPollInterval = section.Key("tenant_watcher_poll_interval").MustDuration(1 * time.Hour)

	// tenant deleter
	cfg.EnableTenantDeleter = section.Key("tenant_deleter_enabled").MustBool(false)
	cfg.TenantDeleterDryRun = section.Key("tenant_deleter_dry_run").MustBool(true)
	cfg.TenantDeleterInterval = section.Key("tenant_deleter_interval").MustDuration(1 * time.Hour)

	// garbage collection
	cfg.EnableGarbageCollection = section.Key("garbage_collection_enabled").MustBool(false)
	cfg.GarbageCollectionDryRun = section.Key("garbage_collection_dry_run").MustBool(true)
	cfg.GarbageCollectionInterval = section.Key("garbage_collection_interval").MustDuration(15 * time.Minute)
	cfg.GarbageCollectionBatchSize = section.Key("garbage_collection_batch_size").MustInt(100)
	cfg.GarbageCollectionBatchWait = section.Key("garbage_collection_batch_wait").MustDuration(1 * time.Second)
	cfg.GarbageCollectionMaxAge = section.Key("garbage_collection_max_age").MustDuration(24 * time.Hour)
	cfg.DashboardsGarbageCollectionMaxAge = section.Key("dashboards_garbage_collection_max_age").MustDuration(365 * 24 * time.Hour)

	cfg.EventRetentionPeriod = section.Key("event_retention_period").MustDuration(1 * time.Hour)
	cfg.EventPruningInterval = section.Key("event_pruning_interval").MustDuration(5 * time.Minute)
	cfg.SearchLookback = section.Key("search_lookback").MustDuration(1 * time.Second)
	cfg.NotifierSettleDelay = section.Key("notifier_settle_delay").MustDuration(3 * time.Second)
	cfg.ResourceVersionBatchTransactionTimeout = section.Key("resource_version_batch_transaction_timeout").MustDuration(5 * time.Second)

	// TTL for caching statusReader results in the dynamic dualwrite service. 0 = no expiration.
	cfg.StorageModeCacheTTL = section.Key("storage_mode_cache_ttl").MustDuration(5 * time.Second)

	// use sqlkv (resource/sqlkv) instead of the sql backend (sql/backend) as the StorageServer
	cfg.EnableSQLKVBackend = section.Key("enable_sqlkv_backend").MustBool(false)
	// enable sqlkv backwards compatibility mode with sql/backend
	cfg.EnableSQLKVCompatibilityMode = section.Key("enable_sqlkv_compatibility_mode").MustBool(true)

	cfg.MaxFileIndexAge = section.Key("max_file_index_age").MustDuration(0)
	cfg.MinFileIndexBuildVersion = section.Key("min_file_index_build_version").MustString("")

	// Index snapshot settings
	cfg.IndexSnapshotEnabled = section.Key("index_snapshot_enabled").MustBool(false)
	cfg.IndexSnapshotBucketURL = section.Key("index_snapshot_bucket_url").String()
	cfg.IndexSnapshotThreshold = section.Key("index_snapshot_threshold").MustInt(5000)
	if cfg.IndexSnapshotThreshold < cfg.IndexFileThreshold {
		cfg.Logger.Warn("index_snapshot_threshold is smaller than index_file_threshold, overriding", "configured", cfg.IndexSnapshotThreshold, "index_file_threshold", cfg.IndexFileThreshold)
		cfg.IndexSnapshotThreshold = cfg.IndexFileThreshold
	}
	cfg.IndexSnapshotMaxAge = section.Key("index_snapshot_max_age").MustDuration(7 * 24 * time.Hour)
	if cfg.IndexSnapshotMaxAge < cfg.MaxFileIndexAge {
		cfg.Logger.Warn("index_snapshot_max_age is smaller than max_file_index_age, overriding", "configured", cfg.IndexSnapshotMaxAge, "max_file_index_age", cfg.MaxFileIndexAge)
		cfg.IndexSnapshotMaxAge = cfg.MaxFileIndexAge
	}
	cfg.IndexSnapshotCleanupGracePeriod = section.Key("index_snapshot_cleanup_grace_period").MustDuration(30 * time.Minute)

	// Vector storage (separate pgvector database)
	vectorSection := cfg.Raw.Section("database_vector")
	cfg.VectorDBHost = vectorSection.Key("db_host").String()
	cfg.VectorDBPort = vectorSection.Key("db_port").MustString("5432")
	cfg.VectorDBName = vectorSection.Key("db_name").String()
	cfg.VectorDBUser = vectorSection.Key("db_user").String()
	cfg.VectorDBPassword = vectorSection.Key("db_password").String()
	cfg.VectorDBSSLMode = vectorSection.Key("db_sslmode").MustString("disable")
	cfg.VectorPromotionThreshold = vectorSection.Key("promotion_threshold").MustInt(9999999) // effectively disabled by default
	cfg.VectorPromoterInterval = vectorSection.Key("promoter_interval").MustDuration(1 * time.Hour)
}

// applyMigrationEnforcements enforces unified storage migration configs when migrations should run,
// or disables local search when a remote search server is configured.
func (cfg *Cfg) applyMigrationEnforcements() {
	if !cfg.ShouldRunMigrations() {
		cfg.Logger.Info("Unified migration configs enforcement disabled", "storage_type", cfg.UnifiedStorageType(), "target", cfg.Target)
		if cfg.shouldProxySearchRemotely() {
			cfg.EnableSearch = false
		}
		return
	}

	cfg.Logger.Info("Unified migration configs enforced", "storage_type", cfg.UnifiedStorageType(), "target", cfg.Target)

	section := cfg.Raw.Section("unified_storage")
	if !cfg.EnableSearch {
		cfg.Logger.Info("Enforcing enable_search for unified storage")
		section.Key("enable_search").SetValue("true")
		cfg.EnableSearch = true
	}
	for resource, enabledByDefault := range MigratedUnifiedResources {
		resourceCfg, ok := cfg.UnifiedStorage[resource]
		if ok {
			if !resourceCfg.EnableMigration {
				cfg.Logger.Info("Resource migration disabled", "resource", resource)
				continue
			}
			cfg.Logger.Info("Overriding unified storage config for migrated resource", "resource", resource, "old_config", resourceCfg)
		} else if !enabledByDefault {
			continue
		}
		cfg.Logger.Info("Enforcing mode 5 for resource in unified storage", "resource", resource)
		cfg.UnifiedStorage[resource] = UnifiedStorageConfig{
			DualWriterMode:         5,
			EnableMigration:        true,
			AutoMigrationThreshold: resourceCfg.AutoMigrationThreshold,
		}
	}
}

func isTargetEligibleForMigrations(targets []string) bool {
	return slices.Contains(targets, "all") || slices.Contains(targets, "core")
}

// shouldProxySearchRemotely reports whether local search should be disabled in
// favor of a remote search server. This is true when a search_server_address is
// configured and the current target is not a dedicated search-server (which
// needs local indexing to serve search RPCs).
func (cfg *Cfg) shouldProxySearchRemotely() bool {
	apiserverCfg := cfg.SectionWithEnvOverrides("grafana-apiserver")
	return apiserverCfg.Key("search_server_address").MustString("") != "" &&
		!slices.Contains(cfg.Target, "search-server")
}

// ShouldRunMigrations reports whether data migrations to unified storage should run.
func (cfg *Cfg) ShouldRunMigrations() bool {
	return cfg.UnifiedStorageType() == "unified" &&
		isTargetEligibleForMigrations(cfg.Target)
}

func parseCommaSeparatedList(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}

// UnifiedStorageType returns the configured storage type without creating or mutating keys.
// Precedence: env > ini > default ("unified").
// Used to decide unified storage behavior early without side effects.
func (cfg *Cfg) UnifiedStorageType() string {
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

// UnifiedStorageConfig returns the UnifiedStorageConfig for a resource.
func (cfg *Cfg) UnifiedStorageConfig(resource string) UnifiedStorageConfig {
	if cfg.UnifiedStorage == nil {
		return UnifiedStorageConfig{}
	}
	return cfg.UnifiedStorage[resource]
}

// EnableMode5 enables migration and sets mode 5 for a resource.
func (cfg *Cfg) EnableMode5(resource string) {
	if cfg.UnifiedStorage == nil {
		cfg.UnifiedStorage = make(map[string]UnifiedStorageConfig)
	}
	config := cfg.UnifiedStorage[resource]
	config.DualWriterMode = rest.Mode5
	config.EnableMigration = true
	cfg.UnifiedStorage[resource] = config
}

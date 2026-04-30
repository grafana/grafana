package setting

import (
	"strings"
	"time"
)

const (
	ProviderPrefix        = "secrets_manager.encryption."
	MisconfiguredProvider = "misconfigured"
)

type SecretsManagerSettings struct {
	// Which encryption provider to use to encrypt any new secrets
	CurrentEncryptionProvider string

	// The time to live for decrypted data keys in memory
	DataKeysCacheTTL time.Duration
	// The interval to remove expired data keys from the cache
	DataKeysCacheCleanupInterval time.Duration
	// Whether to use a Redis cache for data keys instead of the in-memory cache
	DataKeysCacheUseRedis bool
	// DataKeysCacheEncryptionKey is used to encrypt data keys before storing them in the cache.
	// If empty, a random key will be generated for each Grafana process at startup.
	// If running in HA mode (i.e. with Redis cache enabled), this value must be set to the same value for all Grafana processes.
	DataKeysCacheEncryptionKey string
	// DataKeysRedisURL is the Redis connection URL for the data key cache.
	DataKeysRedisURL string
	// DataKeysRedisPrefix is the key prefix for DEK entries in that Redis.
	DataKeysRedisPrefix string

	// Whether to use a Redis cache for secure value metadata reads.
	SecureValueMetadataCacheUseRedis bool
	// The time to live for cached secure value metadata entries.
	SecureValueMetadataCacheTTL time.Duration
	// SecureValueMetadataCacheRedisURL is the Redis connection URL for the secure value metadata cache.
	SecureValueMetadataCacheRedisURL string
	// SecureValueMetadataCacheRedisPrefix is the key prefix for secure value metadata entries in Redis.
	SecureValueMetadataCacheRedisPrefix string

	// ConfiguredKMSProviders is a map of KMS providers found in the config file. The keys are in the format of <provider>.<keyName>, and the values are a map of the properties in that section
	// In OSS, the provider type can only be "secret_key". In Enterprise, it can additionally be one of: "aws_kms", "azure_keyvault", "google_kms", "hashicorp_vault"
	ConfiguredKMSProviders map[string]map[string]string

	GrpcClientEnable        bool   // Whether to enable the gRPC client. If disabled, it will use the in-process services implementations.
	GrpcClientLoadBalancing bool   // Whether to enable gRPC client-side load balancing
	GrpcServerUseTLS        bool   // Whether to use TLS when communicating with the gRPC server
	GrpcServerTLSSkipVerify bool   // Whether to skip TLS verification when communicating with the gRPC server
	GrpcServerTLSServerName string // Server name to use for TLS verification
	GrpcServerAddress       string // Address for gRPC secrets server
	GrpcGrafanaServiceName  string // Service name to use for background grafana decryption/inline

	// Used for testing. Set to false to disable the control loop.
	GCWorkerEnabled bool
	// Max number of inactive secure values to fetch from the database.
	GCWorkerMaxBatchSize uint16
	// Max number of tasks to delete secure values that can be inflight at a time.
	GCWorkerMaxConcurrentCleanups uint16
	// How long to wait for between fetching inactive secure values for cleanup.
	GCWorkerPollInterval time.Duration
	// How long to wait for the process to clean up a secure value to complete.
	GCWorkerPerSecureValueCleanupTimeout time.Duration
	// Max number of times the worker tries to clean up a secure value before giving up on it.
	GCWorkerMaxAttemptsPerSecureValue int

	// Whether to register the MT CRUD API
	RegisterAPIServer bool
	// Whether to create the MT secrets management database
	RunSecretsDBMigrations bool
	// Whether to run the data key id migration. Requires that RunSecretsDBMigrations is also true.
	RunDataKeyMigration bool

	// AWS Keeper
	AWSKeeperAccessKeyID     string
	AWSKeeperSecretAccessKey string
}

func (cfg *Cfg) readSecretsManagerSettings() {
	secretsMgmt := cfg.Raw.Section("secrets_manager")
	cfg.SecretsManagement.CurrentEncryptionProvider = secretsMgmt.Key("encryption_provider").MustString(MisconfiguredProvider)

	cfg.SecretsManagement.GrpcClientEnable = secretsMgmt.Key("grpc_client_enable").MustBool(false)
	cfg.SecretsManagement.GrpcClientLoadBalancing = secretsMgmt.Key("grpc_client_load_balancing").MustBool(false)
	cfg.SecretsManagement.GrpcServerUseTLS = secretsMgmt.Key("grpc_server_use_tls").MustBool(false)
	cfg.SecretsManagement.GrpcServerTLSSkipVerify = secretsMgmt.Key("grpc_server_tls_skip_verify").MustBool(false)
	cfg.SecretsManagement.GrpcServerTLSServerName = valueAsString(secretsMgmt, "grpc_server_tls_server_name", "")
	cfg.SecretsManagement.GrpcServerAddress = valueAsString(secretsMgmt, "grpc_server_address", "")
	cfg.SecretsManagement.GrpcGrafanaServiceName = valueAsString(secretsMgmt, "grpc_grafana_service_name", "")

	cfg.SecretsManagement.GCWorkerEnabled = secretsMgmt.Key("gc_worker_enabled").MustBool(true)
	cfg.SecretsManagement.GCWorkerMaxBatchSize = uint16(secretsMgmt.Key("gc_worker_batch_size").MustUint(16))
	cfg.SecretsManagement.GCWorkerMaxConcurrentCleanups = uint16(secretsMgmt.Key("gc_worker_max_concurrency").MustUint(16))
	cfg.SecretsManagement.GCWorkerPollInterval = secretsMgmt.Key("gc_worker_poll_interval").MustDuration(1 * time.Minute)
	cfg.SecretsManagement.GCWorkerPerSecureValueCleanupTimeout = secretsMgmt.Key("gc_worker_per_request_timeout").MustDuration(5 * time.Second)
	cfg.SecretsManagement.GCWorkerMaxAttemptsPerSecureValue = int(secretsMgmt.Key("gc_worker_max_attempts_per_secure_value").MustUint(16))

	cfg.SecretsManagement.RegisterAPIServer = secretsMgmt.Key("register_api_server").MustBool(true)
	cfg.SecretsManagement.RunSecretsDBMigrations = secretsMgmt.Key("run_secrets_db_migrations").MustBool(true)
	cfg.SecretsManagement.RunDataKeyMigration = secretsMgmt.Key("run_data_key_migration").MustBool(true)

	cfg.SecretsManagement.AWSKeeperAccessKeyID = secretsMgmt.Key("aws_access_key_id").MustString("")
	cfg.SecretsManagement.AWSKeeperSecretAccessKey = secretsMgmt.Key("aws_secret_access_key").MustString("")

	cfg.SecretsManagement.DataKeysCacheUseRedis = secretsMgmt.Key("data_keys_cache_use_redis").MustBool(false)
	cfg.SecretsManagement.DataKeysCacheTTL = secretsMgmt.Key("data_keys_cache_ttl").MustDuration(15 * time.Minute)
	cfg.SecretsManagement.DataKeysCacheCleanupInterval = secretsMgmt.Key("data_keys_cache_cleanup_interval").MustDuration(1 * time.Minute)
	// Required when Redis cache is enabled. If empty, the OSS cache will generate a random key at startup.
	cfg.SecretsManagement.DataKeysCacheEncryptionKey = secretsMgmt.Key("data_keys_cache_encryption_key").MustString("")
	cfg.SecretsManagement.DataKeysRedisURL = secretsMgmt.Key("data_keys_redis_url").MustString("redis://127.0.0.1:6379/0")
	cfg.SecretsManagement.DataKeysRedisPrefix = secretsMgmt.Key("data_keys_redis_prefix").MustString("gsm")

	if cfg.SecretsManagement.DataKeysCacheUseRedis && cfg.SecretsManagement.DataKeysCacheEncryptionKey == "" {
		cfg.Logger.Error("DataKeysCacheEncryptionKey must be set when using Redis cache for data keys. Falling back to the OSS cache.")
		cfg.SecretsManagement.DataKeysCacheUseRedis = false
	}

	cfg.SecretsManagement.SecureValueMetadataCacheUseRedis = secretsMgmt.Key("secure_value_metadata_cache_use_redis").MustBool(false)
	cfg.SecretsManagement.SecureValueMetadataCacheTTL = secretsMgmt.Key("secure_value_metadata_cache_ttl").MustDuration(15 * time.Minute)
	cfg.SecretsManagement.SecureValueMetadataCacheRedisURL = secretsMgmt.Key("secure_value_metadata_cache_redis_url").MustString("redis://127.0.0.1:6379/0")
	cfg.SecretsManagement.SecureValueMetadataCacheRedisPrefix = secretsMgmt.Key("secure_value_metadata_cache_redis_prefix").MustString("gsm")

	if cfg.SecretsManagement.SecureValueMetadataCacheUseRedis && cfg.SecretsManagement.SecureValueMetadataCacheTTL <= 0 {
		cfg.Logger.Error("SecureValueMetadataCacheTTL must be > 0 when using Redis cache for secure value metadata. Disabling the cache.")
		cfg.SecretsManagement.SecureValueMetadataCacheUseRedis = false
	}

	// Extract available KMS providers from configuration sections
	providers := make(map[string]map[string]string)
	for _, section := range cfg.Raw.Sections() {
		sectionName := section.Name()
		if strings.HasPrefix(sectionName, ProviderPrefix) {
			// Extract the provider name (everything after the prefix)
			providerName := strings.TrimPrefix(sectionName, ProviderPrefix)
			if providerName != "" {
				providers[providerName] = section.KeysHash()
			}
		}
	}
	cfg.SecretsManagement.ConfiguredKMSProviders = providers
}

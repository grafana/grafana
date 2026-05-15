package annotation

import (
	"time"

	"github.com/spf13/pflag"

	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	// cleanupInterval is how often the background cleanup runs
	cleanupInterval = 24 * time.Hour
	// defaultRetentionTTL is the default retention period for annotations
	// TODO: determine appropriate default TTL
	defaultRetentionTTL = 90 * 24 * time.Hour
)

// Config holds the store backend configuration for the annotation app.
type Config struct {
	StoreBackend string

	// General lifecycle configuration
	RetentionTTL time.Duration

	// gRPC store configuration
	GRPCAddress       string
	GRPCUseTLS        bool
	GRPCTLSCAFile     string
	GRPCTLSSkipVerify bool

	// Postgres store configuration
	PostgresConnStrings        []string
	PostgresMetadataConnString string
	PostgresMaxConnections     int
	PostgresMaxIdleConns       int
	PostgresConnMaxLifetime    time.Duration
	PostgresTagCacheTTL        time.Duration
	PostgresTagCacheSize       int

	// CleanupSettings configures annotation pruning for the SQL backend's LifecycleManager.
	// Zero value (all limits unset) disables cleanup. Not used by memory or gRPC backends.
	CleanupSettings annotations.CleanupSettings
}

func (c *Config) AddFlags(flags *pflag.FlagSet) {
	// TODO: add cleanup flags when the SQL backend is supported in MT.
	flags.StringVar(&c.StoreBackend, "annotation.store-backend", "memory", "Annotation store backend: memory, grpc, postgres, legacy-sql")

	// General lifecycle flags
	flags.DurationVar(&c.RetentionTTL, "annotation.retention-ttl", defaultRetentionTTL, "Retention TTL for annotations (old data will be cleaned up)")

	// gRPC flags
	flags.StringVar(&c.GRPCAddress, "annotation.grpc-address", "", "gRPC server address for the annotation store")
	flags.BoolVar(&c.GRPCUseTLS, "annotation.grpc-use-tls", false, "Enable TLS for the annotation gRPC connection")
	flags.StringVar(&c.GRPCTLSCAFile, "annotation.grpc-tls-ca-file", "", "CA certificate file for the annotation gRPC connection")
	flags.BoolVar(&c.GRPCTLSSkipVerify, "annotation.grpc-tls-skip-verify", false, "Skip TLS verification for the annotation gRPC connection (insecure)")

	// Postgres flags
	flags.StringSliceVar(&c.PostgresConnStrings, "annotation.postgres-connection-strings", nil, "Comma-separated PostgreSQL connection strings, one per shard (ordered by shard index)")
	flags.StringVar(&c.PostgresMetadataConnString, "annotation.postgres-metadata-connection-string", "", "PostgreSQL connection string for the metadata database")
	flags.IntVar(&c.PostgresMaxConnections, "annotation.postgres-max-connections", defaultMaxConnections, "Maximum number of connections per shard in the Postgres pool")
	flags.IntVar(&c.PostgresMaxIdleConns, "annotation.postgres-max-idle-conns", defaultMaxIdleConns, "Maximum number of idle connections per shard in the Postgres pool")
	flags.DurationVar(&c.PostgresConnMaxLifetime, "annotation.postgres-conn-max-lifetime", defaultConnMaxLifetime, "Maximum lifetime of a connection in the Postgres pool")
	flags.DurationVar(&c.PostgresTagCacheTTL, "annotation.postgres-tag-cache-ttl", defaultTagCacheTTL, "TTL for tag query cache per shard")
	flags.IntVar(&c.PostgresTagCacheSize, "annotation.postgres-tag-cache-size", defaultTagCacheSize, "Size of the tag query cache per shard")
}

func newConfigFromSettings(cfg *setting.Cfg) Config {
	retentionTTL := cfg.AnnotationAppPlatform.RetentionTTL
	if retentionTTL == 0 {
		retentionTTL = defaultRetentionTTL
	}

	return Config{
		StoreBackend: cfg.AnnotationAppPlatform.StoreBackend,
		RetentionTTL: retentionTTL,

		GRPCAddress:       cfg.AnnotationAppPlatform.GRPCAddress,
		GRPCUseTLS:        cfg.AnnotationAppPlatform.GRPCUseTLS,
		GRPCTLSCAFile:     cfg.AnnotationAppPlatform.GRPCTLSCAFile,
		GRPCTLSSkipVerify: cfg.AnnotationAppPlatform.GRPCTLSSkipVerify,

		PostgresConnStrings:        cfg.AnnotationAppPlatform.PostgresConnStrings,
		PostgresMetadataConnString: cfg.AnnotationAppPlatform.PostgresMetadataConnString,
		PostgresMaxConnections:     cfg.AnnotationAppPlatform.PostgresMaxConnections,
		PostgresMaxIdleConns:       cfg.AnnotationAppPlatform.PostgresMaxIdleConns,
		PostgresConnMaxLifetime:    cfg.AnnotationAppPlatform.PostgresConnMaxLifetime,
		PostgresTagCacheTTL:        cfg.AnnotationAppPlatform.PostgresTagCacheTTL,
		PostgresTagCacheSize:       cfg.AnnotationAppPlatform.PostgresTagCacheSize,

		CleanupSettings: annotations.CleanupSettings{
			Alerting:  cfg.AlertingAnnotationCleanupSetting,
			API:       cfg.APIAnnotationCleanupSettings,
			Dashboard: cfg.DashboardAnnotationCleanupSettings,
		},
	}
}

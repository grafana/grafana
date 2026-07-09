package setting

import (
	"fmt"
	"time"

	"gopkg.in/ini.v1"
)

type AnnotationAppPlatformSettings struct {
	Enabled      bool
	StoreBackend string        // "legacy-sql" (default), "grpc", or "postgres"
	RetentionTTL time.Duration // Retention TTL for annotations

	GRPCAddress       string // gRPC server address (e.g., "localhost:9090")
	GRPCUseTLS        bool   // Enable TLS for gRPC connection (default: false)
	GRPCTLSCAFile     string // Path to CA certificate file (optional)
	GRPCTLSSkipVerify bool   // Skip TLS verification (insecure, for testing)

	// Postgres store configuration
	PostgresConnectionString string        // PostgreSQL connection string
	PostgresMaxConnections   int           // Maximum number of connections in the pool
	PostgresMaxIdleConns     int           // Maximum number of idle connections
	PostgresConnMaxLifetime  time.Duration // Maximum lifetime of a connection
	PostgresTagCacheTTL      time.Duration // TTL for tag query cache
	PostgresTagCacheSize     int           // Size of the tag query cache

	// EnableLegacyID controls whether a grafana.app/legacyID label is generated
	// for new annotations.
	EnableLegacyID bool

	// MaxScopeCount caps how many scopes may be attached to a single
	// annotation. 0 means no scopes are allowed. Negative values are
	// rejected at load time. Default 5.
	MaxScopeCount int

	// APIMigrationPhase controls legacy API proxy behavior.
	// Values: "off" (default), "proxy-writes", "proxy-all".
	APIMigrationPhase string

	// APIServerURL is the URL of the standalone annotation API server.
	// Empty means proxy is disabled regardless of APIMigrationPhase.
	APIServerURL string
}

const (
	AnnotationAPIMigrationPhaseOff         = "off"
	AnnotationAPIMigrationPhaseProxyWrites = "proxy-writes"
	AnnotationAPIMigrationPhaseProxyAll    = "proxy-all"
)

func (s AnnotationAppPlatformSettings) ProxyEnabled() bool {
	return s.APIMigrationPhase == AnnotationAPIMigrationPhaseProxyWrites || s.APIMigrationPhase == AnnotationAPIMigrationPhaseProxyAll
}

func (s AnnotationAppPlatformSettings) ProxyAll() bool {
	return s.APIMigrationPhase == AnnotationAPIMigrationPhaseProxyAll
}

func loadAnnotationAppPlatformSettings(cfg *ini.File) (AnnotationAppPlatformSettings, error) {
	appPlatformSection := cfg.Section("annotations.app_platform")
	settings := AnnotationAppPlatformSettings{
		Enabled:           appPlatformSection.Key("enabled").MustBool(false),
		StoreBackend:      appPlatformSection.Key("store_backend").MustString("legacy-sql"),
		RetentionTTL:      appPlatformSection.Key("retention_ttl").MustDuration(2160 * time.Hour),
		EnableLegacyID:    appPlatformSection.Key("enable_legacy_id").MustBool(false),
		MaxScopeCount:     appPlatformSection.Key("max_scope_count").MustInt(5),
		APIMigrationPhase: appPlatformSection.Key("api_migration_phase").MustString(AnnotationAPIMigrationPhaseOff),
		APIServerURL:      appPlatformSection.Key("api_server_url").MustString(""),

		GRPCAddress:       appPlatformSection.Key("grpc_address").MustString("localhost:9090"),
		GRPCUseTLS:        appPlatformSection.Key("grpc_use_tls").MustBool(false),
		GRPCTLSCAFile:     appPlatformSection.Key("grpc_tls_ca_file").MustString(""),
		GRPCTLSSkipVerify: appPlatformSection.Key("grpc_tls_skip_verify").MustBool(false),

		// Postgres configuration
		PostgresConnectionString: appPlatformSection.Key("postgres_connection_string").MustString(""),
		PostgresMaxConnections:   appPlatformSection.Key("postgres_max_connections").MustInt(10),
		PostgresMaxIdleConns:     appPlatformSection.Key("postgres_max_idle_conns").MustInt(5),
		PostgresConnMaxLifetime:  appPlatformSection.Key("postgres_conn_max_lifetime").MustDuration(time.Hour),
		PostgresTagCacheTTL:      appPlatformSection.Key("postgres_tag_cache_ttl").MustDuration(60 * time.Second),
		PostgresTagCacheSize:     appPlatformSection.Key("postgres_tag_cache_size").MustInt(1000),
	}

	if settings.MaxScopeCount < 0 {
		return AnnotationAppPlatformSettings{}, fmt.Errorf("[annotations.app_platform.max_scope_count] must not be negative")
	}

	return settings, nil
}

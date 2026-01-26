package sql

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/authlib/types"
	"github.com/grafana/dskit/services"

	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	secrets "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	inlinesecurevalue "github.com/grafana/grafana/pkg/registry/apis/secret/inline"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/storage/unified/sql/rvmanager"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type QOSEnqueueDequeuer interface {
	services.Service
	Enqueue(ctx context.Context, tenantID string, runnable func()) error
	Dequeue(ctx context.Context) (func(), error)
}

// SearchServerOptions contains the options for creating a new SearchServer
type SearchServerOptions struct {
	ServerOptions
	SearchOptions resource.SearchOptions
	IndexMetrics  *resource.BleveIndexMetrics
	OwnsIndexFn   func(key resource.NamespacedResource) (bool, error)
}

// StorageServerOptions contains the options for creating a storage-only server (without search)
type StorageServerOptions struct {
	ServerOptions
	OverridesService *resource.OverridesService
	StorageMetrics   *resource.StorageMetrics
	QOSQueue         QOSEnqueueDequeuer
	SecureValues     secrets.InlineSecureValueSupport
	SearchOptions    *resource.SearchOptions // Deprecated: use NewSearchServer for search capabilities
	// Minimum time between index updates. This is also used as a delay after a successful write operation, to guarantee
	// that subsequent search will observe the effect of the writing.
	IndexMinUpdateInterval time.Duration
}

type ResourceServerOptions struct {
	// Common options
	ServerOptions
	// Storage
	OverridesService *resource.OverridesService
	StorageMetrics   *resource.StorageMetrics
	QOSQueue         QOSEnqueueDequeuer
	SecureValues     secrets.InlineSecureValueSupport

	// Search
	SearchOptions *resource.SearchOptions // Deprecated: use NewSearchServer for search capabilities
	IndexMetrics  *resource.BleveIndexMetrics
	OwnsIndexFn   func(key resource.NamespacedResource) (bool, error)
}

type ServerOptions struct {
	Backend       resource.StorageBackend
	DB            infraDB.DB
	Cfg           *setting.Cfg
	Tracer        trace.Tracer
	Reg           prometheus.Registerer
	AccessClient  types.AccessClient
	EnableStorage bool
	EnableSearch  bool
}

// NewSearchServer creates a new SearchServer with the given options.
func NewSearchServer(opts SearchServerOptions) (resource.SearchServer, error) {
	blobConfig, err := getBlobConfig(opts.Cfg)
	if err != nil {
		return nil, err
	}

	var blobStore resource.BlobSupport
	if blobConfig.URL != "" {
		blobStore, err = resource.NewBlobSupport(context.Background(), opts.Reg, blobConfig)
		if err != nil {
			return nil, err
		}
	} else {
		blobStore, _ = opts.Backend.(resource.BlobSupport)
	}

	backend := opts.Backend
	if backend == nil {
		eDB, err := dbimpl.ProvideResourceDB(opts.DB, opts.Cfg, opts.Tracer)
		if err != nil {
			return nil, err
		}

		isHA := isHighAvailabilityEnabled(opts.Cfg.SectionWithEnvOverrides("database"),
			opts.Cfg.SectionWithEnvOverrides("resource_api"))

		b, err := NewBackend(BackendOptions{
			DBProvider:           eDB,
			Reg:                  opts.Reg,
			IsHA:                 isHA,
			LastImportTimeMaxAge: opts.SearchOptions.MaxIndexAge,
			EnableSearch:         true,
		})
		if err != nil {
			return nil, err
		}

		// Initialize the backend before creating search server
		if err := b.Init(context.Background()); err != nil {
			return nil, fmt.Errorf("failed to initialize backend: %w", err)
		}
		backend = b
	}

	search, err := resource.NewSearchServer(opts.SearchOptions, backend, opts.AccessClient, blobStore, opts.IndexMetrics, opts.OwnsIndexFn)
	if err != nil {
		return nil, fmt.Errorf("failed to create search server: %w", err)
	}

	if err := search.Init(context.Background()); err != nil {
		return nil, fmt.Errorf("failed to initialize search server: %w", err)
	}

	return search, nil
}

// NewStorageServer creates a storage-only server without search capabilities.
func NewStorageServer(opts *StorageServerOptions) (resource.StorageServer, error) {
	blobConfig, err := getBlobConfig(opts.Cfg)
	if err != nil {
		return nil, err
	}

	secureValues, err := initSecureValues(opts.Cfg, opts.Tracer, opts.SecureValues)
	if err != nil {
		return nil, fmt.Errorf("failed to create inline secure value service: %w", err)
	}

	serverOptions := resource.StorageServerOptions{
		Blob:                   blobConfig,
		Reg:                    opts.Reg,
		SecureValues:           secureValues,
		StorageMetrics:         opts.StorageMetrics,
		IndexMinUpdateInterval: opts.IndexMinUpdateInterval,
		AccessClient:           wrapAccessClient(opts.AccessClient, opts.Reg),
		MaxPageSizeBytes:       getMaxPageSizeBytes(opts.Cfg),
		QOSQueue:               opts.QOSQueue,
		OverridesService:       opts.OverridesService,
	}

	if opts.Backend != nil {
		serverOptions.Backend = opts.Backend
	} else {
		if opts.Cfg.EnableSQLKVBackend {
			kvBackend, err := newSQLKVBackend(opts.ServerOptions)
			if err != nil {
				return nil, fmt.Errorf("error creating kv backend: %s", err)
			}
			serverOptions.Backend = kvBackend
			serverOptions.Diagnostics = kvBackend
		} else {
			opts.EnableStorage = true
			opts.EnableSearch = false
			backend, err := newSQLBackend(opts.ServerOptions, opts.StorageMetrics)
			if err != nil {
				return nil, fmt.Errorf("error creating kv backend: %s", err)
			}
			serverOptions.Backend = backend
			serverOptions.Diagnostics = backend
			serverOptions.Lifecycle = backend
		}
	}

	return resource.NewStorageServer(serverOptions)
}

// NewResourceServer creates a new ResourceServer instance
// Deprecated: use NewStorageServer and NewSearchServer instead
func NewResourceServer(opts *ResourceServerOptions) (resource.ResourceServer, error) {
	blobConfig, err := getBlobConfig(opts.Cfg)
	if err != nil {
		return nil, err
	}

	secureValues, err := initSecureValues(opts.Cfg, opts.Tracer, opts.SecureValues)
	if err != nil {
		return nil, fmt.Errorf("failed to create inline secure value service: %w", err)
	}

	serverOptions := resource.ResourceServerOptions{
		Blob:                   blobConfig,
		Search:                 opts.SearchOptions,
		IndexMetrics:           nil,
		OwnsIndexFn:            opts.OwnsIndexFn,
		OverridesService:       opts.OverridesService,
		WriteHooks:             resource.WriteAccessHooks{},
		AccessClient:           wrapAccessClient(opts.AccessClient, opts.Reg),
		SecureValues:           secureValues,
		Reg:                    opts.Reg,
		StorageMetrics:         opts.StorageMetrics,
		MaxPageSizeBytes:       getMaxPageSizeBytes(opts.Cfg),
		IndexMinUpdateInterval: opts.Cfg.IndexMinUpdateInterval,
		QOSQueue:               opts.QOSQueue,
		QOSConfig:              resource.QueueConfig{},
	}

	if opts.Backend != nil {
		serverOptions.Backend = opts.Backend
	} else {
		if opts.Cfg.EnableSQLKVBackend {
			kvBackend, err := newSQLKVBackend(opts.ServerOptions)
			if err != nil {
				return nil, fmt.Errorf("error creating kv backend: %s", err)
			}
			serverOptions.Backend = kvBackend
			opts.Backend = kvBackend // hack to reuse the backend on search server for monolith grafana
			serverOptions.Diagnostics = kvBackend
		} else {
			opts.EnableStorage = true
			opts.EnableSearch = opts.Cfg.EnableSearch
			backend, err := newSQLBackend(opts.ServerOptions, opts.StorageMetrics)
			if err != nil {
				return nil, fmt.Errorf("error creating kv backend: %s", err)
			}
			serverOptions.Backend = backend
			serverOptions.Diagnostics = backend
			serverOptions.Lifecycle = backend
		}
	}
	return resource.NewResourceServer(serverOptions)
}

func newSQLKVBackend(opts ServerOptions) (resource.KVBackend, error) {
	eDB, err := dbimpl.ProvideResourceDB(opts.DB, opts.Cfg, opts.Tracer)
	if err != nil {
		return nil, err
	}
	isHA := isHighAvailabilityEnabled(opts.Cfg.SectionWithEnvOverrides("database"),
		opts.Cfg.SectionWithEnvOverrides("resource_api"))

	sqlkv, err := resource.NewSQLKV(eDB)
	if err != nil {
		return nil, fmt.Errorf("error creating sqlkv: %s", err)
	}

	kvBackendOpts := resource.KVBackendOptions{
		KvStore:            sqlkv,
		Tracer:             opts.Tracer,
		Reg:                opts.Reg,
		UseChannelNotifier: !isHA,
		Log:                log.New("storage-backend"),
	}

	ctx := context.Background()
	dbConn, err := eDB.Init(ctx)
	if err != nil {
		return nil, fmt.Errorf("error initializing DB: %w", err)
	}

	dialect := sqltemplate.DialectForDriver(dbConn.DriverName())
	if dialect == nil {
		return nil, fmt.Errorf("unsupported database driver: %s", dbConn.DriverName())
	}

	if opts.Cfg.EnableSQLKVCompatibilityMode {
		rvManager, err := rvmanager.NewResourceVersionManager(rvmanager.ResourceManagerOptions{
			Dialect: dialect,
			DB:      dbConn,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create resource version manager: %w", err)
		}

		kvBackendOpts.RvManager = rvManager
	}
	return resource.NewKVStorageBackend(kvBackendOpts)
}

func newSQLBackend(opts ServerOptions, storageMetrics *resource.StorageMetrics) (Backend, error) {
	eDB, err := dbimpl.ProvideResourceDB(opts.DB, opts.Cfg, opts.Tracer)
	if err != nil {
		return nil, err
	}
	isHA := isHighAvailabilityEnabled(opts.Cfg.SectionWithEnvOverrides("database"),
		opts.Cfg.SectionWithEnvOverrides("resource_api"))

	backendOpts := BackendOptions{
		DBProvider:              eDB,
		Reg:                     opts.Reg,
		IsHA:                    isHA,
		storageMetrics:          storageMetrics,
		LastImportTimeMaxAge:    opts.Cfg.MaxFileIndexAge,
		SimulatedNetworkLatency: opts.Cfg.IndexMinUpdateInterval,
		GarbageCollection: GarbageCollectionConfig{
			Enabled:          opts.Cfg.EnableGarbageCollection,
			Interval:         opts.Cfg.GarbageCollectionInterval,
			BatchSize:        opts.Cfg.GarbageCollectionBatchSize,
			MaxAge:           opts.Cfg.GarbageCollectionMaxAge,
			DashboardsMaxAge: opts.Cfg.DashboardsGarbageCollectionMaxAge,
		},
		EnableStorage: opts.EnableStorage,
		EnableSearch:  opts.EnableStorage,
	}
	return NewBackend(backendOpts)
}

// getBlobConfig returns a BlobConfig with local file support
func getBlobConfig(cfg *setting.Cfg) (resource.BlobConfig, error) {
	apiserverCfg := cfg.SectionWithEnvOverrides("grafana-apiserver")
	blobConfig := resource.BlobConfig{
		URL: apiserverCfg.Key("blob_url").MustString(""),
	}

	// Support local file blob
	if strings.HasPrefix(blobConfig.URL, "./data/") {
		dir := strings.Replace(blobConfig.URL, "./data", cfg.DataPath, 1)
		if err := os.MkdirAll(dir, 0700); err != nil {
			return resource.BlobConfig{}, err
		}
		blobConfig.URL = "file:///" + dir
	}
	return blobConfig, nil
}

// initSecureValues initializes SecureValues if needed
func initSecureValues(cfg *setting.Cfg, tracer trace.Tracer, existing secrets.InlineSecureValueSupport) (secrets.InlineSecureValueSupport, error) {
	if existing != nil {
		return existing, nil
	}
	if cfg == nil || !cfg.SecretsManagement.GrpcClientEnable {
		return nil, nil
	}
	return inlinesecurevalue.ProvideInlineSecureValueService(
		cfg,
		tracer,
		nil, // not needed for gRPC client mode
		nil, // not needed for gRPC client mode
	)
}

// wrapAccessClient wraps AccessClient with authz limiter if not nil
func wrapAccessClient(client types.AccessClient, reg prometheus.Registerer) types.AccessClient {
	if client == nil {
		return nil
	}
	return resource.NewAuthzLimitedClient(client, resource.AuthzOptions{Registry: reg})
}

// getMaxPageSizeBytes reads max_page_size_bytes from unified_storage config
func getMaxPageSizeBytes(cfg *setting.Cfg) int {
	unifiedStorageCfg := cfg.SectionWithEnvOverrides("unified_storage")
	return unifiedStorageCfg.Key("max_page_size_bytes").MustInt(0)
}

// isHighAvailabilityEnabled determines if high availability mode should
// be enabled based on database configuration. High availability is enabled
// by default except for SQLite databases.
func isHighAvailabilityEnabled(dbCfg, resourceAPICfg *setting.DynamicSection) bool {
	// If the resource API is using a non-SQLite database, we assume it's in HA mode.
	resourceDBType := resourceAPICfg.Key("db_type").String()
	if resourceDBType != "" && resourceDBType != migrator.SQLite {
		return true
	}

	// Check in the config if HA is enabled - by default we always assume a HA setup.
	isHA := dbCfg.Key("high_availability").MustBool(true)

	// SQLite is not possible to run in HA, so we force it to false.
	databaseType := dbCfg.Key("type").String()
	if databaseType == migrator.SQLite {
		isHA = false
	}

	return isHA
}

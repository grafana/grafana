package sql

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/authlib/types"
	"github.com/grafana/dskit/services"

	infraDB "github.com/grafana/grafana/pkg/infra/db"
	secrets "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	inlinesecurevalue "github.com/grafana/grafana/pkg/registry/apis/secret/inline"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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
	Backend       resource.StorageBackend
	DB            infraDB.DB
	Cfg           *setting.Cfg
	Tracer        trace.Tracer
	Reg           prometheus.Registerer
	AccessClient  types.AccessClient
	SearchOptions resource.SearchOptions
	IndexMetrics  *resource.BleveIndexMetrics
	OwnsIndexFn   func(key resource.NamespacedResource) (bool, error)
}

// StorageServerOptions contains the options for creating a storage-only server (without search)
type StorageServerOptions struct {
	Backend          resource.StorageBackend
	OverridesService *resource.OverridesService
	DB               infraDB.DB
	Cfg              *setting.Cfg
	Tracer           trace.Tracer
	Reg              prometheus.Registerer
	AccessClient     types.AccessClient
	StorageMetrics   *resource.StorageMetrics
	Features         featuremgmt.FeatureToggles
	QOSQueue         QOSEnqueueDequeuer
	SecureValues     secrets.InlineSecureValueSupport
}

// NewSearchServer creates a new SearchServer with the given options.
// This can be used to create a standalone search server or to create a search server
// that will be passed to NewResourceServer.
//
// Important: When running in monolith mode, the backend should be provided by the caller
// to avoid duplicate metrics registration. Only in standalone microservice mode should
// this function create its own backend.
func NewSearchServer(opts SearchServerOptions) (resource.SearchServer, error) {
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

	search, err := resource.NewSearchServer(opts.SearchOptions, backend, opts.AccessClient, nil, opts.IndexMetrics, opts.OwnsIndexFn)
	if err != nil {
		return nil, fmt.Errorf("failed to create search server: %w", err)
	}

	if err := search.Init(context.Background()); err != nil {
		return nil, fmt.Errorf("failed to initialize search server: %w", err)
	}

	return search, nil
}

// NewStorageServer creates a storage-only server without search capabilities.
// Use this when you want to run storage and search as separate services.
//
// Important: When running in monolith mode, the backend should be provided by the caller
// to avoid duplicate metrics registration. Only in standalone microservice mode should
// this function create its own backend.
func NewStorageServer(opts StorageServerOptions) (resource.ResourceServer, error) {
	apiserverCfg := opts.Cfg.SectionWithEnvOverrides("grafana-apiserver")

	if opts.SecureValues == nil && opts.Cfg != nil && opts.Cfg.SecretsManagement.GrpcClientEnable {
		inlineSecureValueService, err := inlinesecurevalue.ProvideInlineSecureValueService(
			opts.Cfg,
			opts.Tracer,
			nil, // not needed for gRPC client mode
			nil, // not needed for gRPC client mode
		)
		if err != nil {
			return nil, fmt.Errorf("failed to create inline secure value service: %w", err)
		}
		opts.SecureValues = inlineSecureValueService
	}

	serverOptions := resource.ResourceServerOptions{
		Blob: resource.BlobConfig{
			URL: apiserverCfg.Key("blob_url").MustString(""),
		},
		Reg:          opts.Reg,
		SecureValues: opts.SecureValues,
	}
	if opts.AccessClient != nil {
		serverOptions.AccessClient = resource.NewAuthzLimitedClient(opts.AccessClient, resource.AuthzOptions{Registry: opts.Reg})
	}
	// Support local file blob
	if strings.HasPrefix(serverOptions.Blob.URL, "./data/") {
		dir := strings.Replace(serverOptions.Blob.URL, "./data", opts.Cfg.DataPath, 1)
		err := os.MkdirAll(dir, 0700)
		if err != nil {
			return nil, err
		}
		serverOptions.Blob.URL = "file:///" + dir
	}

	// This is mostly for testing, being able to influence when we paginate
	// based on the page size during tests.
	unifiedStorageCfg := opts.Cfg.SectionWithEnvOverrides("unified_storage")
	maxPageSizeBytes := unifiedStorageCfg.Key("max_page_size_bytes")
	serverOptions.MaxPageSizeBytes = maxPageSizeBytes.MustInt(0)

	if opts.Backend != nil {
		serverOptions.Backend = opts.Backend
	} else {
		eDB, err := dbimpl.ProvideResourceDB(opts.DB, opts.Cfg, opts.Tracer)
		if err != nil {
			return nil, err
		}

		if opts.Cfg.EnableSQLKVBackend {
			sqlkv, err := resource.NewSQLKV(eDB)
			if err != nil {
				return nil, fmt.Errorf("error creating sqlkv: %s", err)
			}

			kvBackendOpts := resource.KVBackendOptions{
				KvStore: sqlkv,
				Tracer:  opts.Tracer,
				Reg:     opts.Reg,
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

			rvManager, err := rvmanager.NewResourceVersionManager(rvmanager.ResourceManagerOptions{
				Dialect: dialect,
				DB:      dbConn,
			})
			if err != nil {
				return nil, fmt.Errorf("failed to create resource version manager: %w", err)
			}

			kvBackendOpts.RvManager = rvManager
			kvBackend, err := resource.NewKVStorageBackend(kvBackendOpts)
			if err != nil {
				return nil, fmt.Errorf("error creating kv backend: %s", err)
			}

			serverOptions.Backend = kvBackend
			serverOptions.Diagnostics = kvBackend
		} else {
			isHA := isHighAvailabilityEnabled(opts.Cfg.SectionWithEnvOverrides("database"),
				opts.Cfg.SectionWithEnvOverrides("resource_api"))

			backend, err := NewBackend(BackendOptions{
				DBProvider:           eDB,
				Reg:                  opts.Reg,
				IsHA:                 isHA,
				storageMetrics:       opts.StorageMetrics,
				LastImportTimeMaxAge: opts.Cfg.MaxFileIndexAge,
			})
			if err != nil {
				return nil, err
			}
			serverOptions.Backend = backend
			serverOptions.Diagnostics = backend
			serverOptions.Lifecycle = backend
		}
	}

	// Initialize the backend before creating server
	if serverOptions.Lifecycle != nil {
		if err := serverOptions.Lifecycle.Init(context.Background()); err != nil {
			return nil, fmt.Errorf("failed to initialize backend: %w", err)
		}
	}

	serverOptions.QOSQueue = opts.QOSQueue
	serverOptions.OverridesService = opts.OverridesService

	return resource.NewResourceServer(serverOptions)
}

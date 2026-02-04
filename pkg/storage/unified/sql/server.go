package sql

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/authlib/types"
	"github.com/grafana/dskit/services"

	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	secrets "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	inlinesecurevalue "github.com/grafana/grafana/pkg/registry/apis/secret/inline"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/storage/unified/sql/rvmanager"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type QOSEnqueueDequeuer interface {
	services.Service
	Enqueue(ctx context.Context, tenantID string, runnable func()) error
	Dequeue(ctx context.Context) (func(), error)
}

// ServerOptions contains the options for creating a new ResourceServer
type ServerOptions struct {
	Backend          resource.StorageBackend
	OverridesService *resource.OverridesService
	DB               infraDB.DB
	Cfg              *setting.Cfg
	Tracer           trace.Tracer
	Reg              prometheus.Registerer
	AccessClient     types.AccessClient
	SearchOptions    resource.SearchOptions
	SearchClient     resourcepb.ResourceIndexClient
	StorageMetrics   *resource.StorageMetrics
	IndexMetrics     *resource.BleveIndexMetrics
	Features         featuremgmt.FeatureToggles
	QOSQueue         QOSEnqueueDequeuer
	SecureValues     secrets.InlineSecureValueSupport
	OwnsIndexFn      func(key resource.NamespacedResource) (bool, error)

	// DisableStorageServices is used for standalone search server
	DisableStorageServices bool
}

// NewResourceServer creates a new ResourceServer with support for both storage and search capabilities.
func NewResourceServer(opts ServerOptions) (resource.ResourceServer, error) {
	if opts.DisableStorageServices {
		return nil, fmt.Errorf("cannot create ResourceServer with storage services disabled")
	}
	resourceOpts, err := buildResourceServerOptions(&opts,
		withSecureValueService,
		withBlobConfig,
		withAccessClient,
		withMaxPageSizeBytes,
		withBackend,
		withQOSQueue,
		withOverridesService,
		withSearch,
		withSearchClient,
		withQuotaConfig,
	)
	if err != nil {
		return nil, err
	}
	return resource.NewResourceServer(*resourceOpts)
}

// NewSearchServer creates a new SearchServer with only search capabilities enabled.
func NewSearchServer(opts ServerOptions) (resource.SearchServer, error) {
	opts.DisableStorageServices = true
	resourceOpts, err := buildResourceServerOptions(&opts,
		withBlobConfig,
		withAccessClient,
		withBackend,
		withSearch,
	)
	if err != nil {
		return nil, err
	}
	return resource.NewSearchServer(*resourceOpts)
}

type buildResourceServerOpts func(*ServerOptions, *resource.ResourceServerOptions) error

// buildResourceServerOptions builds the resource.ResourceServerOptions from sql.ServerOptions.
func buildResourceServerOptions(opts *ServerOptions, withOpts ...buildResourceServerOpts) (*resource.ResourceServerOptions, error) {
	apiserverCfg := opts.Cfg.SectionWithEnvOverrides("grafana-apiserver")
	serverOptions := &resource.ResourceServerOptions{
		Blob: resource.BlobConfig{
			URL: apiserverCfg.Key("blob_url").MustString(""),
		},
		Reg:          opts.Reg,
		SecureValues: opts.SecureValues,
	}
	for _, optFn := range withOpts {
		if err := optFn(opts, serverOptions); err != nil {
			return nil, err
		}
	}
	return serverOptions, nil
}

func withSecureValueService(opts *ServerOptions, resourceOpts *resource.ResourceServerOptions) error {
	if opts.SecureValues != nil || opts.Cfg == nil || !opts.Cfg.SecretsManagement.GrpcClientEnable {
		return nil
	}
	inlineSecureValueService, err := inlinesecurevalue.ProvideInlineSecureValueService(
		opts.Cfg,
		opts.Tracer,
		nil, // not needed for gRPC client mode
		nil, // not needed for gRPC client mode
	)
	if err != nil {
		return fmt.Errorf("failed to create inline secure value service: %w", err)
	}
	resourceOpts.SecureValues = inlineSecureValueService
	return nil
}

func withAccessClient(opts *ServerOptions, resourceOpts *resource.ResourceServerOptions) error {
	if opts.AccessClient != nil {
		resourceOpts.AccessClient = resource.NewAuthzLimitedClient(opts.AccessClient, resource.AuthzOptions{Registry: opts.Reg})
	}
	return nil
}

func withBlobConfig(opts *ServerOptions, resourceOpts *resource.ResourceServerOptions) error {
	apiserverCfg := opts.Cfg.SectionWithEnvOverrides("grafana-apiserver")
	resourceOpts.Blob = resource.BlobConfig{
		URL: apiserverCfg.Key("blob_url").MustString(""),
	}
	// Support local file blob
	if strings.HasPrefix(resourceOpts.Blob.URL, "./data/") {
		dir := strings.Replace(resourceOpts.Blob.URL, "./data", opts.Cfg.DataPath, 1)
		err := os.MkdirAll(dir, 0700)
		if err != nil {
			return err
		}
		resourceOpts.Blob.URL = "file:///" + dir
	}
	return nil
}

func withMaxPageSizeBytes(opts *ServerOptions, resourceOpts *resource.ResourceServerOptions) error {
	unifiedStorageCfg := opts.Cfg.SectionWithEnvOverrides("unified_storage")
	maxPageSizeBytes := unifiedStorageCfg.Key("max_page_size_bytes")
	resourceOpts.MaxPageSizeBytes = maxPageSizeBytes.MustInt(0)
	return nil
}

func withBackend(opts *ServerOptions, resourceOpts *resource.ResourceServerOptions) error {
	if opts.Backend != nil {
		// TODO: we should probably have a proper interface for diagnostics/lifecycle
		resourceOpts.Backend = opts.Backend
		return nil
	}

	eDB, err := dbimpl.ProvideResourceDB(opts.DB, opts.Cfg, opts.Tracer)
	if err != nil {
		return err
	}

	isHA := isHighAvailabilityEnabled(opts.Cfg.SectionWithEnvOverrides("database"),
		opts.Cfg.SectionWithEnvOverrides("resource_api"))

	if !opts.Cfg.EnableSQLKVBackend {
		backend, err := NewBackend(BackendOptions{
			DBProvider:           eDB,
			Reg:                  opts.Reg,
			IsHA:                 isHA,
			storageMetrics:       opts.StorageMetrics,
			LastImportTimeMaxAge: opts.SearchOptions.MaxIndexAge,
			GarbageCollection: GarbageCollectionConfig{
				Enabled:          opts.Cfg.EnableGarbageCollection,
				Interval:         opts.Cfg.GarbageCollectionInterval,
				BatchSize:        opts.Cfg.GarbageCollectionBatchSize,
				MaxAge:           opts.Cfg.GarbageCollectionMaxAge,
				DashboardsMaxAge: opts.Cfg.DashboardsGarbageCollectionMaxAge,
			},
			DisableStorageServices: opts.DisableStorageServices,
		})
		if err != nil {
			return err
		}
		resourceOpts.Backend = backend
		resourceOpts.Diagnostics = backend
		resourceOpts.Lifecycle = backend
		return nil
	}

	// Initialize database connection first
	ctx := context.Background()
	dbConn, err := eDB.Init(ctx)
	if err != nil {
		return fmt.Errorf("error initializing DB: %w", err)
	}
	dialect := sqltemplate.DialectForDriver(dbConn.DriverName())
	if dialect == nil {
		return fmt.Errorf("unsupported database driver: %s", dbConn.DriverName())
	}

	// Create sqlkv with the standard library DB
	sqlkv, err := kv.NewSQLKV(dbConn.SqlDB(), dbConn.DriverName())
	if err != nil {
		return fmt.Errorf("error creating sqlkv: %s", err)
	}

	kvBackendOpts := resource.KVBackendOptions{
		KvStore:            sqlkv,
		Tracer:             opts.Tracer,
		Reg:                opts.Reg,
		UseChannelNotifier: !isHA,
		Log:                log.New("storage-backend"),
		DBKeepAlive:        eDB,
	}

	if opts.Cfg.EnableSQLKVCompatibilityMode {
		rvManager, err := rvmanager.NewResourceVersionManager(rvmanager.ResourceManagerOptions{
			Dialect: dialect,
			DB:      dbConn,
		})
		if err != nil {
			return fmt.Errorf("failed to create resource version manager: %w", err)
		}

		kvBackendOpts.RvManager = rvManager
	}

	kvBackend, err := resource.NewKVStorageBackend(kvBackendOpts)
	if err != nil {
		return err
	}
	resourceOpts.Backend = kvBackend
	resourceOpts.Diagnostics = kvBackend
	return nil
}

func withSearchClient(opts *ServerOptions, resourceOpts *resource.ResourceServerOptions) error {
	resourceOpts.SearchClient = opts.SearchClient
	return nil
}

func withSearch(opts *ServerOptions, resourceOpts *resource.ResourceServerOptions) error {
	resourceOpts.Search = opts.SearchOptions
	resourceOpts.IndexMetrics = opts.IndexMetrics
	resourceOpts.OwnsIndexFn = opts.OwnsIndexFn
	return nil
}

func withQOSQueue(opts *ServerOptions, resourceOpts *resource.ResourceServerOptions) error {
	resourceOpts.QOSQueue = opts.QOSQueue
	return nil
}

func withOverridesService(opts *ServerOptions, resourceOpts *resource.ResourceServerOptions) error {
	resourceOpts.OverridesService = opts.OverridesService
	return nil
}

func withQuotaConfig(opts *ServerOptions, resourceOpts *resource.ResourceServerOptions) error {
	resourceOpts.QuotasConfig = resource.QuotasConfig{
		EnforceQuotas:  opts.Cfg.EnforceQuotas,
		SupportMessage: opts.Cfg.QuotasErrorMessageSupportInfo,
	}
	return nil
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

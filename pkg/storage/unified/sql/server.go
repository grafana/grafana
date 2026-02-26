package sql

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/grafana/authlib/types"
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"

	secrets "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	inlinesecurevalue "github.com/grafana/grafana/pkg/registry/apis/secret/inline"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
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
		withStorageMetrics,
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
	if opts.Backend == nil {
		return fmt.Errorf("missing storage backend")
	}

	resourceOpts.Backend = opts.Backend
	if diagnostics, ok := opts.Backend.(resourcepb.DiagnosticsServer); ok {
		resourceOpts.Diagnostics = diagnostics
	}
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

func withStorageMetrics(opts *ServerOptions, resourceOpts *resource.ResourceServerOptions) error {
	resourceOpts.StorageMetrics = opts.StorageMetrics
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

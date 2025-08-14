package sql

import (
	"context"
	"os"
	"strings"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/authlib/types"
	"github.com/grafana/dskit/ring"
	"github.com/grafana/dskit/services"
	infraDB "github.com/grafana/grafana/pkg/infra/db"
	secrets "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
)

type QOSEnqueueDequeuer interface {
	services.Service
	Enqueue(ctx context.Context, tenantID string, runnable func()) error
	Dequeue(ctx context.Context) (func(), error)
}

// ServerOptions contains the options for creating a new ResourceServer
type ServerOptions struct {
	DB             infraDB.DB
	Cfg            *setting.Cfg
	Tracer         trace.Tracer
	Reg            prometheus.Registerer
	AccessClient   types.AccessClient
	SearchOptions  resource.SearchOptions
	StorageMetrics *resource.StorageMetrics
	IndexMetrics   *resource.BleveIndexMetrics
	Features       featuremgmt.FeatureToggles
	QOSQueue       QOSEnqueueDequeuer
	SecureValues   secrets.InlineSecureValueSupport
	Ring           *ring.Ring
	RingLifecycler *ring.BasicLifecycler
}

// Creates a new ResourceServer
func NewResourceServer(
	opts ServerOptions,
) (resource.ResourceServer, error) {
	apiserverCfg := opts.Cfg.SectionWithEnvOverrides("grafana-apiserver")
	serverOptions := resource.ResourceServerOptions{
		Tracer: opts.Tracer,
		Blob: resource.BlobConfig{
			URL: apiserverCfg.Key("blob_url").MustString(""),
		},
		Reg:          opts.Reg,
		SecureValues: opts.SecureValues,
	}
	if opts.AccessClient != nil {
		serverOptions.AccessClient = resource.NewAuthzLimitedClient(opts.AccessClient, resource.AuthzOptions{Tracer: opts.Tracer, Registry: opts.Reg})
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

	eDB, err := dbimpl.ProvideResourceDB(opts.DB, opts.Cfg, opts.Tracer)
	if err != nil {
		return nil, err
	}

	isHA := isHighAvailabilityEnabled(opts.Cfg.SectionWithEnvOverrides("database"),
		opts.Cfg.SectionWithEnvOverrides("resource_api"))
	withPruner := opts.Features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageHistoryPruner)

	store, err := NewBackend(BackendOptions{
		DBProvider:     eDB,
		Tracer:         opts.Tracer,
		Reg:            opts.Reg,
		IsHA:           isHA,
		withPruner:     withPruner,
		storageMetrics: opts.StorageMetrics,
	})
	if err != nil {
		return nil, err
	}
	serverOptions.Backend = store
	serverOptions.Diagnostics = store
	serverOptions.Lifecycle = store
	serverOptions.Search = opts.SearchOptions
	serverOptions.IndexMetrics = opts.IndexMetrics
	serverOptions.QOSQueue = opts.QOSQueue
	serverOptions.Ring = opts.Ring
	serverOptions.RingLifecycler = opts.RingLifecycler
	serverOptions.SearchAfterWrite = opts.Features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageSearchAfterWriteExperimentalAPI)

	return resource.NewResourceServer(serverOptions)
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

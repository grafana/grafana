package sql

import (
	"os"
	"strings"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/authlib/types"

	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	apiserveroptions "github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
)

type Options struct {
	DB             infraDB.DB
	Cfg            *setting.Cfg
	Tracer         tracing.Tracer
	Reg            prometheus.Registerer
	Features       featuremgmt.FeatureToggles
	Authzc         types.AccessClient
	SearchOpts     resource.SearchOptions
	StorageMetrics *resource.StorageMetrics
	IndexMetrics   *resource.BleveIndexMetrics
}

// Creates a new ResourceServer
func ProvideSqlBackendResourceServer(opts *Options) (resource.ResourceServer, error) {
	apiserverCfg := opts.Cfg.SectionWithEnvOverrides("grafana-apiserver")
	storageType := apiserveroptions.StorageType(apiserverCfg.Key("storage_type").MustString(string(apiserveroptions.StorageTypeUnified)))

	if storageType == apiserveroptions.StorageTypeUnifiedGrpc {
		return nil, nil
	}

	resourceServerOpts := resource.ResourceServerOptions{
		AccessClient: resource.NewAuthzLimitedClient(opts.Authzc, resource.AuthzOptions{Tracer: opts.Tracer, Registry: opts.Reg}),
		Tracer:       opts.Tracer,
		Blob: resource.BlobConfig{
			URL: apiserverCfg.Key("blob_url").MustString(""),
		},
		Reg: opts.Reg,
	}
	// Support local file blob
	if strings.HasPrefix(resourceServerOpts.Blob.URL, "./data/") {
		dir := strings.Replace(resourceServerOpts.Blob.URL, "./data", opts.Cfg.DataPath, 1)
		err := os.MkdirAll(dir, 0700)
		if err != nil {
			return nil, err
		}
		resourceServerOpts.Blob.URL = "file:///" + dir
	}

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
	resourceServerOpts.Backend = store
	resourceServerOpts.Diagnostics = store
	resourceServerOpts.Lifecycle = store
	resourceServerOpts.Search = opts.SearchOpts
	resourceServerOpts.IndexMetrics = opts.IndexMetrics

	rs, err := resource.NewResourceServer(resourceServerOpts)
	if err != nil {
		return nil, err
	}

	return rs, nil
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

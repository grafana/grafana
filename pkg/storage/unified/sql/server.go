package sql

import (
	"os"
	"strings"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/authlib/types"

	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
)

// Creates a new ResourceServer
func NewResourceServer(db infraDB.DB, cfg *setting.Cfg,
	tracer trace.Tracer, reg prometheus.Registerer, ac types.AccessClient,
	searchOptions resource.SearchOptions, storageMetrics *resource.StorageMetrics,
	indexMetrics *resource.BleveIndexMetrics, features featuremgmt.FeatureToggles) (resource.ResourceServer, error) {
	apiserverCfg := cfg.SectionWithEnvOverrides("grafana-apiserver")
	opts := resource.ResourceServerOptions{
		Tracer: tracer,
		Blob: resource.BlobConfig{
			URL: apiserverCfg.Key("blob_url").MustString(""),
		},
		Reg: reg,
	}
	if ac != nil {
		opts.AccessClient = resource.NewAuthzLimitedClient(ac, resource.AuthzOptions{Tracer: tracer, Registry: reg})
	}
	// Support local file blob
	if strings.HasPrefix(opts.Blob.URL, "./data/") {
		dir := strings.Replace(opts.Blob.URL, "./data", cfg.DataPath, 1)
		err := os.MkdirAll(dir, 0700)
		if err != nil {
			return nil, err
		}
		opts.Blob.URL = "file:///" + dir
	}

	eDB, err := dbimpl.ProvideResourceDB(db, cfg, tracer)
	if err != nil {
		return nil, err
	}

	isHA := isHighAvailabilityEnabled(cfg.SectionWithEnvOverrides("database"),
		cfg.SectionWithEnvOverrides("resource_api"))
	withPruner := features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageHistoryPruner)

	store, err := NewBackend(BackendOptions{
		DBProvider:     eDB,
		Tracer:         tracer,
		Reg:            reg,
		IsHA:           isHA,
		withPruner:     withPruner,
		storageMetrics: storageMetrics,
	})
	if err != nil {
		return nil, err
	}
	opts.Backend = store
	opts.Diagnostics = store
	opts.Lifecycle = store
	opts.Search = searchOptions
	opts.IndexMetrics = indexMetrics

	rs, err := resource.NewResourceServer(opts)
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

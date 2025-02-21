package sql

import (
	"os"
	"strings"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/authlib/types"

	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
)

// Creates a new ResourceServer
func NewResourceServer(db infraDB.DB, cfg *setting.Cfg,
	tracer tracing.Tracer, reg prometheus.Registerer, ac types.AccessClient, searchOptions resource.SearchOptions) (resource.ResourceServer, error) {
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

	dbCfg := cfg.SectionWithEnvOverrides("database")
	// Check in the config if HA is enabled by default we always assume a HA setup.
	isHA := dbCfg.Key("high_availability").MustBool(true)
	// SQLite is not possible to run in HA, so we set it to false.
	databaseType := dbCfg.Key("type").MustString(migrator.SQLite)
	if databaseType == migrator.SQLite {
		isHA = false
	}

	store, err := NewBackend(BackendOptions{DBProvider: eDB, Tracer: tracer, IsHA: isHA})
	if err != nil {
		return nil, err
	}
	opts.Backend = store
	opts.Diagnostics = store
	opts.Lifecycle = store
	opts.Search = searchOptions

	rs, err := resource.NewResourceServer(opts)
	if err != nil {
		return nil, err
	}

	return rs, nil
}

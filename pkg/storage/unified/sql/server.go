package sql

import (
	"go.opentelemetry.io/otel/trace"

	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
)

// Creates a ResourceServer
func ProvideResourceServer(db infraDB.DB, cfg *setting.Cfg, features featuremgmt.FeatureToggles, tracer trace.Tracer) (resource.ResourceServer, error) {
	opts := resource.ResourceServerOptions{
		Tracer: tracer,
	}

	eDB, err := dbimpl.ProvideResourceDB(db, cfg, features, tracer)
	if err != nil {
		return nil, err
	}
	store, err := NewBackend(BackendOptions{DBProvider: eDB, Tracer: tracer})
	if err != nil {
		return nil, err
	}
	opts.Backend = store
	opts.Diagnostics = store
	opts.Lifecycle = store

	return resource.NewResourceServer(opts)
}

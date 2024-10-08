package sql

import (
	"context"

	"github.com/grafana/authlib/claims"
	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
)

// Creates a new ResourceServer
func NewResourceServer(db infraDB.DB, cfg *setting.Cfg, features featuremgmt.FeatureToggles, tracer tracing.Tracer) (resource.ResourceServer, error) {
	opts := resource.ResourceServerOptions{
		Tracer: tracer,
	}

	eDB, err := dbimpl.ProvideResourceDB(db, cfg, tracer)
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

	if features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageSearch) {
		opts.Index = resource.NewResourceIndexServer()
	}

	if features.IsEnabledGlobally(featuremgmt.FlagKubernetesFolders) {
		opts.WriteAccess = resource.WriteAccessHooks{
			Folder: func(ctx context.Context, user claims.AuthInfo, uid string) bool {
				// #TODO build on the logic here
				// #TODO only enable write access when the resource being written in the folder
				// is another folder
				return true
			},
		}
	}

	return resource.NewResourceServer(opts)
}

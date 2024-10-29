package sql

import (
	"context"
	"errors"
	"os"
	"strings"

	"github.com/grafana/authlib/claims"
	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/prometheus/client_golang/prometheus"
)

// Creates a new ResourceServer
func NewResourceServer(ctx context.Context, db infraDB.DB, cfg *setting.Cfg, features featuremgmt.FeatureToggles, tracer tracing.Tracer, reg prometheus.Registerer) (resource.ResourceServer, error) {
	apiserverCfg := cfg.SectionWithEnvOverrides("grafana-apiserver")
	opts := resource.ResourceServerOptions{
		Tracer: tracer,
		Blob: resource.BlobConfig{
			URL: apiserverCfg.Key("blob_url").MustString(""),
		},
		Reg: reg,
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
	store, err := NewBackend(BackendOptions{DBProvider: eDB, Tracer: tracer})
	if err != nil {
		return nil, err
	}
	opts.Backend = store
	opts.Diagnostics = store
	opts.Lifecycle = store

	if features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageSearch) {
		opts.Index = resource.NewResourceIndexServer(cfg, tracer)
		server, err := resource.NewResourceServer(opts)
		if err != nil {
			return nil, err
		}
		// initialze the search index
		indexer, ok := server.(resource.ResourceIndexer)
		if !ok {
			return nil, errors.New("index server does not implement ResourceIndexer")
		}
		_, err = indexer.Index(ctx)
		return server, err
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

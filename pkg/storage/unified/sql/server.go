package sql

import (
	"context"
	"log/slog"
	"os"
	"strings"

	"github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/prometheus/client_golang/prometheus"

	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authz"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
)

// Creates a new ResourceServer
func NewResourceServer(ctx context.Context, db infraDB.DB, cfg *setting.Cfg,
	features featuremgmt.FeatureToggles, docs resource.DocumentBuilderSupplier,
	tracer tracing.Tracer, reg prometheus.Registerer, ac authz.Client) (resource.ResourceServer, error) {
	apiserverCfg := cfg.SectionWithEnvOverrides("grafana-apiserver")
	opts := resource.ResourceServerOptions{
		Tracer: tracer,
		Blob: resource.BlobConfig{
			URL: apiserverCfg.Key("blob_url").MustString(""),
		},
		Reg: reg,
	}
	if ac != nil {
		opts.AccessClient = resource.NewAuthzLimitedClient(ac, resource.AuthzOptions{Tracer: tracer})
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

	// Setup the search server
	if features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageSearch) {
		opts.Search = resource.SearchOptions{
			Backend: search.NewBleveBackend(search.BleveOptions{
				Root:          cfg.IndexPath,
				FileThreshold: int64(cfg.IndexFileThreshold), // fewer than X items will use a memory index
				BatchSize:     cfg.IndexMaxBatchSize,         // This is the batch size for how many objects to add to the index at once
			}, tracer),
			Resources:     docs,
			WorkerThreads: cfg.IndexWorkers,
			InitMinCount:  cfg.IndexMinCount,
		}

		err = reg.Register(resource.NewIndexMetrics(cfg.IndexPath, opts.Search.Backend))
		if err != nil {
			slog.Warn("Failed to register indexer metrics", "error", err)
		}
	}

	rs, err := resource.NewResourceServer(opts)
	if err != nil {
		return nil, err
	}

	return rs, nil
}

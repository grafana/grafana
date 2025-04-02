package search

import (
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func NewSearchOptions(features featuremgmt.FeatureToggles, cfg *setting.Cfg, tracer tracing.Tracer, docs resource.DocumentBuilderSupplier, indexMetrics *resource.BleveIndexMetrics) (resource.SearchOptions, error) {
	// Setup the search server
	if features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageSearch) ||
		features.IsEnabledGlobally(featuremgmt.FlagProvisioning) {
		root := cfg.IndexPath
		if root == "" {
			root = filepath.Join(cfg.DataPath, "unified-search", "bleve")
		}
		err := os.MkdirAll(root, 0750)
		if err != nil {
			return resource.SearchOptions{}, err
		}
		bleve, err := NewBleveBackend(BleveOptions{
			Root:          root,
			FileThreshold: int64(cfg.IndexFileThreshold), // fewer than X items will use a memory index
			BatchSize:     cfg.IndexMaxBatchSize,         // This is the batch size for how many objects to add to the index at once
		}, tracer, features, indexMetrics)

		if err != nil {
			return resource.SearchOptions{}, err
		}

		return resource.SearchOptions{
			Backend:       bleve,
			Resources:     docs,
			WorkerThreads: cfg.IndexWorkers,
			InitMinCount:  cfg.IndexMinCount,
		}, nil
	}
	return resource.SearchOptions{}, nil
}

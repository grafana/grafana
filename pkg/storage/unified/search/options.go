package search

import (
	"os"
	"path/filepath"

	"github.com/Masterminds/semver"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func NewSearchOptions(
	features featuremgmt.FeatureToggles,
	cfg *setting.Cfg,
	tracer trace.Tracer,
	docs resource.DocumentBuilderSupplier,
	indexMetrics *resource.BleveIndexMetrics,
	ownsIndexFn func(key resource.NamespacedResource) (bool, error),
) (resource.SearchOptions, error) {
	if features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageSearch) || features.IsEnabledGlobally(featuremgmt.FlagProvisioning) {
		root := cfg.IndexPath
		if root == "" {
			root = filepath.Join(cfg.DataPath, "unified-search", "bleve")
		}
		err := os.MkdirAll(root, 0750)
		if err != nil {
			return resource.SearchOptions{}, err
		}

		var minVersion *semver.Version
		if cfg.MinFileIndexBuildVersion != "" {
			v, err := semver.NewVersion(cfg.MinFileIndexBuildVersion)
			if err != nil {
				cfg.Logger.Error("Failed to parse min_file_index_build_version, ignoring it.", "version", cfg.MinFileIndexBuildVersion, "err", err)
			} else {
				minVersion = v
			}
		}

		bleve, err := NewBleveBackend(BleveOptions{
			Root:            root,
			FileThreshold:   int64(cfg.IndexFileThreshold), // fewer than X items will use a memory index
			BatchSize:       cfg.IndexMaxBatchSize,         // This is the batch size for how many objects to add to the index at once
			IndexCacheTTL:   cfg.IndexCacheTTL,             // How long to keep the index cache in memory
			BuildVersion:    cfg.BuildVersion,
			MaxFileIndexAge: cfg.MaxFileIndexAge,
			MinBuildVersion: minVersion,
			UseFullNgram:    features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageUseFullNgram),
			OwnsIndex:       ownsIndexFn,
		}, tracer, indexMetrics)

		if err != nil {
			return resource.SearchOptions{}, err
		}

		return resource.SearchOptions{
			Backend:         bleve,
			Resources:       docs,
			WorkerThreads:   cfg.IndexWorkers,
			InitMinCount:    cfg.IndexMinCount,
			RebuildInterval: cfg.IndexRebuildInterval,
		}, nil
	}
	return resource.SearchOptions{}, nil
}

package search

import (
	"os"
	"path/filepath"

	"github.com/Masterminds/semver"
	index "github.com/blevesearch/bleve_index_api"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func NewSearchOptions(
	features featuremgmt.FeatureToggles,
	cfg *setting.Cfg,
	docs resource.DocumentBuilderSupplier,
	indexMetrics *resource.BleveIndexMetrics,
	ownsIndexFn func(key resource.NamespacedResource) (bool, error),
) (resource.SearchOptions, error) {
	//nolint:staticcheck // not yet migrated to OpenFeature
	if cfg.EnableSearch || features.IsEnabledGlobally(featuremgmt.FlagProvisioning) {
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

		scoringModel := index.TFIDFScoring // default
		//nolint:staticcheck // not yet migrated to OpenFeature
		if features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageBM25Scoring) {
			scoringModel = index.BM25Scoring
		}

		bleve, err := NewBleveBackend(BleveOptions{
			Root:                   root,
			FileThreshold:          int64(cfg.IndexFileThreshold), // fewer than X items will use a memory index
			IndexCacheTTL:          cfg.IndexCacheTTL,             // How long to keep the index cache in memory
			BuildVersion:           cfg.BuildVersion,
			OwnsIndex:              ownsIndexFn,
			IndexMinUpdateInterval: cfg.IndexMinUpdateInterval,
			ScoringModel:           scoringModel,
		}, indexMetrics)

		if err != nil {
			return resource.SearchOptions{}, err
		}

		return resource.SearchOptions{
			Backend:                bleve,
			Resources:              docs,
			InitWorkerThreads:      cfg.IndexWorkers,
			IndexRebuildWorkers:    cfg.IndexRebuildWorkers,
			InitMinCount:           cfg.IndexMinCount,
			DashboardIndexMaxAge:   cfg.IndexRebuildInterval,
			MaxIndexAge:            cfg.MaxFileIndexAge,
			MinBuildVersion:        minVersion,
			IndexMinUpdateInterval: cfg.IndexMinUpdateInterval,
		}, nil
	}
	return resource.SearchOptions{
		// it is used for search after write and throttles index updates
		IndexMinUpdateInterval: cfg.IndexMinUpdateInterval,
		MaxIndexAge:            cfg.MaxFileIndexAge,
	}, nil
}

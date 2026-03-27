package search

import (
	"os"
	"path/filepath"
	"time"

	"github.com/Masterminds/semver"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// Default values for index snapshot settings that are not exposed in config.
// These can be overridden in tests via SearchOptions fields.
const (
	// DefaultSnapshotMinDocChanges is the minimum number of document changes
	// since the last snapshot before a new upload is triggered.
	DefaultSnapshotMinDocChanges = 1000
	// DefaultSnapshotUploadInterval is the minimum time between snapshot uploads.
	DefaultSnapshotUploadInterval = 1 * time.Hour
	// DefaultSnapshotCleanupInterval is how often old snapshots are cleaned up.
	DefaultSnapshotCleanupInterval = 6 * time.Hour
	// DefaultSnapshotLockTTL is the TTL for the distributed lock used during upload/cleanup.
	DefaultSnapshotLockTTL = 3 * time.Minute
	// DefaultSnapshotMinKeep is the minimum number of snapshots retained regardless of age.
	DefaultSnapshotMinKeep = 3
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

		bleve, err := NewBleveBackend(BleveOptions{
			Root:                     root,
			FileThreshold:            int64(cfg.IndexFileThreshold), // fewer than X items will use a memory index
			IndexCacheTTL:            cfg.IndexCacheTTL,             // How long to keep the index cache in memory
			BuildVersion:             cfg.BuildVersion,
			OwnsIndex:                ownsIndexFn,
			IndexMinUpdateInterval:   cfg.IndexMinUpdateInterval,
			SelectableFieldsForKinds: resource.SelectableFields(),
		}, indexMetrics)

		if err != nil {
			return resource.SearchOptions{}, err
		}

		return resource.SearchOptions{
			Backend:                   bleve,
			Resources:                 docs,
			InitWorkerThreads:         cfg.IndexWorkers,
			IndexRebuildWorkers:       cfg.IndexRebuildWorkers,
			InitMinCount:              cfg.IndexMinCount,
			DashboardIndexMaxAge:      cfg.IndexRebuildInterval,
			MaxIndexAge:               cfg.MaxFileIndexAge,
			MinBuildVersion:           minVersion,
			IndexMinUpdateInterval:    cfg.IndexMinUpdateInterval,
			IndexModificationCacheTTL: cfg.IndexModificationCacheTTL,
			InjectFailuresPercent:     cfg.SearchInjectFailuresPercent,

			IndexSnapshotEnabled:         cfg.IndexSnapshotEnabled,
			IndexSnapshotBucketURL:       cfg.IndexSnapshotBucketURL,
			IndexSnapshotThreshold:       cfg.IndexSnapshotThreshold,
			IndexSnapshotMaxAge:          cfg.IndexSnapshotMaxAge,
			IndexSnapshotMinDocChanges:   DefaultSnapshotMinDocChanges,
			IndexSnapshotUploadInterval:  DefaultSnapshotUploadInterval,
			IndexSnapshotLockTTL:         DefaultSnapshotLockTTL,
			IndexSnapshotMinKeep:         DefaultSnapshotMinKeep,
			IndexSnapshotCleanupInterval: DefaultSnapshotCleanupInterval,
		}, nil
	}
	return resource.SearchOptions{
		// it is used for search after write and throttles index updates
		IndexMinUpdateInterval:    cfg.IndexMinUpdateInterval,
		IndexModificationCacheTTL: cfg.IndexModificationCacheTTL,
		MaxIndexAge:               cfg.MaxFileIndexAge,
	}, nil
}

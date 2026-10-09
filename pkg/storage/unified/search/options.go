package search

import (
	resourcecontract "github.com/grafana/grafana/pkg/storage/unified/resource/contract"

	searchmetrics "github.com/grafana/grafana/pkg/storage/unified/search/metrics"

	searchmodel "github.com/grafana/grafana/pkg/storage/unified/search/model"

	"os"
	"path/filepath"
	"time"

	"github.com/Masterminds/semver/v3"

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
	// DefaultSnapshotCleanupGracePeriod is the time a newly uploaded snapshot must
	// have existed before its predecessor in the same Grafana-version group is
	// considered eligible for cleanup. Gives in-flight downloads time to converge
	// on the new snapshot before its predecessor disappears.
	DefaultSnapshotCleanupGracePeriod = 30 * time.Minute
)

// NewSearchOptions builds the SearchOptions used by the resource server.
// snapshotStore is optional: index snapshots are only uploaded and
// downloaded when it is non-nil and cfg.IndexSnapshotEnabled is set.
func NewSearchOptions(
	cfg *setting.Cfg,
	docs searchmodel.DocumentBuilderSupplier,
	indexMetrics *searchmetrics.BleveMetrics,
	ownsIndexFn func(key resourcecontract.NamespacedResource) (bool, error),
	snapshotStore RemoteIndexStore,
) (searchmodel.SearchOptions, error) {
	var embeddingConfig *searchmodel.EmbeddingConfigRegistry
	if cfg.EnableSearch || cfg.VectorIndexingEnabled {
		embeddingConfig = searchmodel.NewEmbeddingConfigRegistry(resource.AppManifests())
	}

	// Built here rather than inside the search branch below, because a server that
	// delegates search to another process still decides which selectors it can push
	// into an index, and that decision reads these declarations.
	manifests := searchmodel.MergeManifestsByKind(resource.AppManifests())
	selectableFields, searchFieldsHashes, searchFieldsProviders, err := searchmodel.SearchFieldsForManifests(manifests...)
	if err != nil {
		return searchmodel.SearchOptions{}, err
	}
	// Without a document supplier (some tests) the index has nothing to map, so
	// leave out the mappings and their hashes; the selectable fields stay.
	if docs == nil {
		searchFieldsHashes, searchFieldsProviders = nil, nil
	}
	// One registry holds selectable fields, hashes, and providers, shared by the
	// index backend and the search server so a future live-manifest source can
	// swap them consistently.
	searchFields := searchmodel.NewSearchFieldsRegistry(selectableFields, searchFieldsHashes, searchFieldsProviders)

	if cfg.EnableSearch {
		root := cfg.IndexPath
		if root == "" {
			root = filepath.Join(cfg.DataPath, "unified-search", "bleve")
		}
		err := os.MkdirAll(root, 0750)
		if err != nil {
			return searchmodel.SearchOptions{}, err
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

		var buildVersion *semver.Version
		if cfg.BuildVersion != "" {
			v, err := semver.NewVersion(cfg.BuildVersion)
			if err != nil {
				cfg.Logger.Error("Failed to parse build_version, ignoring it.", "version", cfg.BuildVersion, "err", err)
			} else {
				buildVersion = v
			}
		}

		snapshot := buildSnapshotOptions(cfg, minVersion, snapshotStore)

		bleve, err := NewBleveBackend(BleveOptions{
			Root:                           root,
			FileThreshold:                  int64(cfg.IndexFileThreshold), // fewer than X items will use a memory index
			IndexCacheTTL:                  cfg.IndexCacheTTL,             // How long to keep the index cache in memory
			BuildVersion:                   cfg.BuildVersion,
			OwnsIndex:                      ownsIndexFn,
			IndexMinUpdateInterval:         cfg.IndexMinUpdateInterval,
			SearchFields:                   searchFields,
			Snapshot:                       snapshot,
			DiskCleanupInterval:            cfg.DiskIndexCleanupInterval,
			DiskCleanupGracePeriod:         cfg.DiskIndexCleanupGracePeriod,
			DiskCleanupUnopenedGracePeriod: cfg.DiskIndexCleanupUnopenedGracePeriod,
			PostRankAuthzEnabled:           cfg.SearchPostRankAuthz,
			EnforceSortCapability:          cfg.SearchEnforceSortCapability,
			PostRankAuthz: PostRankAuthzConfig{
				OverFetchFactor: cfg.SearchPostRankAuthzOverFetchFactor,
				MaxWindow:       cfg.SearchPostRankAuthzMaxWindow,
				MaxCandidates:   cfg.SearchPostRankAuthzMaxCandidates,
				FacetSampleSize: cfg.SearchPostRankAuthzFacetSampleSize,
			},
			// From the garbage collection settings, so trash and storage cannot
			// disagree about what is expired.
			TrashRetention: TrashRetentionConfig{
				// Dry run counts what it would remove and deletes nothing, so trash
				// stays restorable and this stays off.
				Enabled:          cfg.EnableGarbageCollection && !cfg.GarbageCollectionDryRun,
				MaxAge:           cfg.GarbageCollectionMaxAge,
				DashboardsMaxAge: cfg.DashboardsGarbageCollectionMaxAge,
			},
		}, indexMetrics)

		if err != nil {
			return searchmodel.SearchOptions{}, err
		}

		return searchmodel.SearchOptions{
			Backend:                   bleve,
			Resources:                 docs,
			InitWorkerThreads:         cfg.IndexWorkers,
			IndexRebuildWorkers:       cfg.IndexRebuildWorkers,
			InitMinCount:              cfg.IndexMinCount,
			DashboardIndexMaxAge:      cfg.IndexRebuildInterval,
			MaxIndexAge:               cfg.MaxFileIndexAge,
			MinBuildVersion:           minVersion,
			BuildVersion:              buildVersion,
			IndexMinUpdateInterval:    cfg.IndexMinUpdateInterval,
			IndexModificationCacheTTL: cfg.IndexModificationCacheTTL,
			InjectFailuresPercent:     cfg.SearchInjectFailuresPercent,
			PostRankAuthzEnabled:      cfg.SearchPostRankAuthz,
			GlobalIndexEnabled:        cfg.GlobalSearchIndexEnabled,

			IndexSnapshotEnabled:            cfg.IndexSnapshotEnabled,
			IndexSnapshotThreshold:          cfg.IndexSnapshotThreshold,
			IndexSnapshotMaxAge:             cfg.IndexSnapshotMaxAge,
			IndexSnapshotMinDocChanges:      DefaultSnapshotMinDocChanges,
			IndexSnapshotUploadInterval:     DefaultSnapshotUploadInterval,
			IndexSnapshotLockTTL:            DefaultSnapshotLockTTL,
			IndexSnapshotCleanupInterval:    DefaultSnapshotCleanupInterval,
			IndexSnapshotCleanupGracePeriod: cleanupGracePeriodOrDefault(cfg.IndexSnapshotCleanupGracePeriod),
			SearchFields:                    searchFields,
			EmbeddingConfig:                 embeddingConfig,
		}, nil
	}
	return searchmodel.SearchOptions{
		EmbeddingConfig: embeddingConfig,
		SearchFields:    searchFields,
		// it is used for search after write and throttles index updates
		IndexMinUpdateInterval:    cfg.IndexMinUpdateInterval,
		IndexModificationCacheTTL: cfg.IndexModificationCacheTTL,
		MaxIndexAge:               cfg.MaxFileIndexAge,
	}, nil
}

// buildSnapshotOptions builds a SnapshotOptions from cfg. Returns a zero
// SnapshotOptions (Store==nil) when snapshots are disabled or no store is
// given, so the backend skips all snapshot work.
func buildSnapshotOptions(cfg *setting.Cfg, minBuildVersion *semver.Version, store RemoteIndexStore) SnapshotOptions {
	if !cfg.IndexSnapshotEnabled || store == nil {
		return SnapshotOptions{}
	}

	return SnapshotOptions{
		Store:              store,
		MinDocCount:        int64(cfg.IndexSnapshotThreshold),
		MaxIndexAge:        cfg.IndexSnapshotMaxAge,
		MinBuildVersion:    minBuildVersion,
		UploadInterval:     DefaultSnapshotUploadInterval,
		MinDocChanges:      DefaultSnapshotMinDocChanges,
		CleanupGracePeriod: cleanupGracePeriodOrDefault(cfg.IndexSnapshotCleanupGracePeriod),
		CleanupInterval:    DefaultSnapshotCleanupInterval,
	}
}

// cleanupGracePeriodOrDefault returns d if positive, otherwise the default.
// Lets a zero value in setting.Cfg fall back to the documented default rather
// than disabling the grace window entirely.
func cleanupGracePeriodOrDefault(d time.Duration) time.Duration {
	if d <= 0 {
		return DefaultSnapshotCleanupGracePeriod
	}
	return d
}

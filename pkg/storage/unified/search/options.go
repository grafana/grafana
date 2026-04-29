package search

import (
	"context"
	"crypto/rand"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/Masterminds/semver"
	"github.com/oklog/ulid/v2"
	"gocloud.dev/blob"

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
	// DefaultSnapshotCleanupGracePeriod is the time a newly uploaded snapshot must
	// have existed before its predecessor in the same Grafana-version group is
	// considered eligible for cleanup. Gives in-flight downloads time to converge
	// on the new snapshot before its predecessor disappears.
	DefaultSnapshotCleanupGracePeriod = 30 * time.Minute
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

		var buildVersion *semver.Version
		if cfg.BuildVersion != "" {
			v, err := semver.NewVersion(cfg.BuildVersion)
			if err != nil {
				cfg.Logger.Error("Failed to parse build_version, ignoring it.", "version", cfg.BuildVersion, "err", err)
			} else {
				buildVersion = v
			}
		}

		snapshot, err := buildSnapshotOptions(cfg, minVersion)
		if err != nil {
			return resource.SearchOptions{}, err
		}

		bleve, err := NewBleveBackend(BleveOptions{
			Root:                     root,
			FileThreshold:            int64(cfg.IndexFileThreshold), // fewer than X items will use a memory index
			IndexCacheTTL:            cfg.IndexCacheTTL,             // How long to keep the index cache in memory
			BuildVersion:             cfg.BuildVersion,
			OwnsIndex:                ownsIndexFn,
			IndexMinUpdateInterval:   cfg.IndexMinUpdateInterval,
			SelectableFieldsForKinds: resource.SelectableFields(),
			Snapshot:                 snapshot,
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
			BuildVersion:              buildVersion,
			IndexMinUpdateInterval:    cfg.IndexMinUpdateInterval,
			IndexModificationCacheTTL: cfg.IndexModificationCacheTTL,
			InjectFailuresPercent:     cfg.SearchInjectFailuresPercent,

			IndexSnapshotEnabled:            cfg.IndexSnapshotEnabled,
			IndexSnapshotBucketURL:          cfg.IndexSnapshotBucketURL,
			IndexSnapshotThreshold:          cfg.IndexSnapshotThreshold,
			IndexSnapshotMaxAge:             cfg.IndexSnapshotMaxAge,
			IndexSnapshotMinDocChanges:      DefaultSnapshotMinDocChanges,
			IndexSnapshotUploadInterval:     DefaultSnapshotUploadInterval,
			IndexSnapshotLockTTL:            DefaultSnapshotLockTTL,
			IndexSnapshotCleanupInterval:    DefaultSnapshotCleanupInterval,
			IndexSnapshotCleanupGracePeriod: cleanupGracePeriodOrDefault(cfg.IndexSnapshotCleanupGracePeriod),
		}, nil
	}
	return resource.SearchOptions{
		// it is used for search after write and throttles index updates
		IndexMinUpdateInterval:    cfg.IndexMinUpdateInterval,
		IndexModificationCacheTTL: cfg.IndexModificationCacheTTL,
		MaxIndexAge:               cfg.MaxFileIndexAge,
	}, nil
}

func snapshotLockHeartbeat(ttl time.Duration) time.Duration {
	hb := ttl / 3
	if hb <= 0 || hb*2 > ttl {
		hb = ttl / 2
	}
	if hb <= 0 {
		hb = time.Second
	}
	return hb
}

// buildSnapshotOptions opens the configured object-storage bucket and wraps it
// as a RemoteIndexStore. Returns a zero SnapshotOptions (Store==nil) when the
// feature is not enabled, so the backend short-circuits all new paths.
func buildSnapshotOptions(cfg *setting.Cfg, minBuildVersion *semver.Version) (SnapshotOptions, error) {
	if !cfg.IndexSnapshotEnabled || cfg.IndexSnapshotBucketURL == "" {
		return SnapshotOptions{}, nil
	}

	bucket, err := blob.OpenBucket(context.Background(), cfg.IndexSnapshotBucketURL)
	if err != nil {
		return SnapshotOptions{}, fmt.Errorf("opening snapshot bucket %q: %w", cfg.IndexSnapshotBucketURL, err)
	}

	lockOpts, err := cdkLockOptionsFromBucket(bucket, cfg.IndexSnapshotBucketURL)
	if err != nil {
		return SnapshotOptions{}, fmt.Errorf("snapshot lock backend options: %w", err)
	}
	lockBackend := newCDKLockBackend(bucket, lockOpts)

	ownerBase := cfg.InstanceID
	if ownerBase == "" {
		ownerBase = cfg.InstanceName
	}
	if ownerBase == "" {
		ownerBase = "unknown-instance"
	}
	lockOwnerSuffix, err := ulid.New(ulid.Now(), rand.Reader)
	if err != nil {
		return SnapshotOptions{}, fmt.Errorf("creating lock owner suffix: %w", err)
	}
	// Include a per-process ULID suffix to avoid owner collisions across instances
	// that share the same configured instance_id/instance_name.
	owner := fmt.Sprintf("%s/%s", ownerBase, lockOwnerSuffix.String())

	lockTTL := DefaultSnapshotLockTTL
	lockHeartbeat := snapshotLockHeartbeat(lockTTL)

	return SnapshotOptions{
		Store:              NewBucketRemoteIndexStore(bucket, lockBackend, owner, lockTTL, lockHeartbeat),
		MinDocCount:        int64(cfg.IndexSnapshotThreshold),
		MaxIndexAge:        cfg.IndexSnapshotMaxAge,
		MinBuildVersion:    minBuildVersion,
		UploadInterval:     DefaultSnapshotUploadInterval,
		MinDocChanges:      DefaultSnapshotMinDocChanges,
		CleanupGracePeriod: cleanupGracePeriodOrDefault(cfg.IndexSnapshotCleanupGracePeriod),
	}, nil
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

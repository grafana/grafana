package search

import (
	"context"
	"crypto/rand"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Masterminds/semver/v3"
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

// NewSearchOptions builds the SearchOptions used by the resource server.
// snapshotStore is optional: when non-nil it replaces the RemoteIndexStore
// that would otherwise be built from cfg.IndexSnapshotBucketURL. Used by
// the SQL wiring layer to inject a KV-backed store.
func NewSearchOptions(
	features featuremgmt.FeatureToggles,
	cfg *setting.Cfg,
	docs resource.DocumentBuilderSupplier,
	indexMetrics *resource.BleveIndexMetrics,
	ownsIndexFn func(key resource.NamespacedResource) (bool, error),
	snapshotStore RemoteIndexStore,
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

		snapshot, err := buildSnapshotOptions(cfg, minVersion, snapshotStore)
		if err != nil {
			return resource.SearchOptions{}, err
		}

		// docs is optional in some tests; only consult it when present so the
		// hash check is a no-op rather than a nil deref. Real callers always
		// pass a non-nil supplier.
		var searchFieldsHashes map[resource.LowerGroupResource]string
		var searchFieldsProviders map[resource.LowerGroupResource]resource.SearchFieldsProvider
		if docs != nil {
			builders, err := docs.GetDocumentBuilders()
			if err != nil {
				return resource.SearchOptions{}, err
			}
			searchFieldsHashes = resource.SearchFieldsHashesForBuilders(builders)
			// Search fields come from the app manifests: every in-tree kind that
			// has custom search fields declares them in its CUE manifest.
			searchFieldsProviders = resource.SearchFieldProviders(resource.AppManifests())
		}

		bleve, err := NewBleveBackend(BleveOptions{
			Root:                           root,
			FileThreshold:                  int64(cfg.IndexFileThreshold), // fewer than X items will use a memory index
			IndexCacheTTL:                  cfg.IndexCacheTTL,             // How long to keep the index cache in memory
			BuildVersion:                   cfg.BuildVersion,
			OwnsIndex:                      ownsIndexFn,
			IndexMinUpdateInterval:         cfg.IndexMinUpdateInterval,
			SelectableFieldsForKinds:       resource.SelectableFields(),
			SearchFieldsHashesForKinds:     searchFieldsHashes,
			SearchFieldsProvidersForKinds:  searchFieldsProviders,
			Snapshot:                       snapshot,
			DiskCleanupInterval:            cfg.DiskIndexCleanupInterval,
			DiskCleanupGracePeriod:         cfg.DiskIndexCleanupGracePeriod,
			DiskCleanupUnopenedGracePeriod: cfg.DiskIndexCleanupUnopenedGracePeriod,
			PostRankAuthzEnabled:           cfg.SearchPostRankAuthz,
			PostRankAuthz: PostRankAuthzConfig{
				OverFetchFactor: cfg.SearchPostRankAuthzOverFetchFactor,
				MaxWindow:       cfg.SearchPostRankAuthzMaxWindow,
				MaxCandidates:   cfg.SearchPostRankAuthzMaxCandidates,
			},
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
			SearchFieldsHashesForKinds:      searchFieldsHashes,
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

// buildSnapshotOptions builds a SnapshotOptions from cfg.
//
// All non-Store fields (MinDocCount, MaxIndexAge, UploadInterval, etc.)
// are taken from cfg regardless. injectedStore overrides only the Store
// field: if non-nil it is used directly; otherwise the function opens
// the object-storage bucket configured in cfg.IndexSnapshotBucketURL
// and wraps it as a BucketRemoteIndexStore. Returns a zero
// SnapshotOptions (Store==nil) when snapshots are disabled, so the
// backend short-circuits all new paths.
func buildSnapshotOptions(cfg *setting.Cfg, minBuildVersion *semver.Version, injectedStore RemoteIndexStore) (SnapshotOptions, error) {
	if !cfg.IndexSnapshotEnabled {
		return SnapshotOptions{}, nil
	}

	store := injectedStore
	if store == nil {
		if cfg.IndexSnapshotBucketURL == "" {
			return SnapshotOptions{}, nil
		}
		var err error
		store, err = buildBucketSnapshotStore(cfg)
		if err != nil {
			return SnapshotOptions{}, err
		}
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
	}, nil
}

// buildBucketSnapshotStore opens the configured object-storage bucket
// and wraps it as a BucketRemoteIndexStore.
func buildBucketSnapshotStore(cfg *setting.Cfg) (RemoteIndexStore, error) {
	bucket, err := blob.OpenBucket(context.Background(), cfg.IndexSnapshotBucketURL)
	if err != nil {
		return nil, fmt.Errorf("opening snapshot bucket %q: %w", cfg.IndexSnapshotBucketURL, err)
	}

	lockBackend, err := snapshotLockBackendForBucket(bucket, cfg.IndexSnapshotBucketURL)
	if err != nil {
		return nil, fmt.Errorf("snapshot lock backend options: %w", err)
	}

	ownerBase := cfg.InstanceID
	if ownerBase == "" {
		ownerBase = cfg.InstanceName
	}
	if ownerBase == "" {
		ownerBase = "unknown-instance"
	}
	lockOwnerSuffix, err := ulid.New(ulid.Now(), rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("creating lock owner suffix: %w", err)
	}
	// Include a per-process ULID suffix to avoid owner collisions across instances
	// that share the same configured instance_id/instance_name.
	owner := fmt.Sprintf("%s/%s", ownerBase, lockOwnerSuffix.String())

	lockTTL := DefaultSnapshotLockTTL
	lockOpts := LockOptions{
		TTL:               lockTTL,
		HeartbeatInterval: snapshotLockHeartbeat(lockTTL),
	}

	return NewBucketRemoteIndexStore(BucketRemoteIndexStoreConfig{
		Bucket:      bucket,
		LockBackend: lockBackend,
		LockOwner:   owner,
		BuildLock:   lockOpts,
		CleanupLock: lockOpts,
	}), nil
}

func snapshotLockBackendForBucket(bucket *blob.Bucket, bucketURL string) (lockBackend, error) {
	ok, err := isFileBucketURL(bucketURL)
	if err != nil {
		return nil, err
	}
	if ok {
		return newLocalLockBackend(), nil
	}

	lockOpts, err := cdkLockOptionsFromBucket(bucket, bucketURL)
	if err != nil {
		return nil, err
	}
	return newCDKLockBackend(bucket, lockOpts), nil
}

func isFileBucketURL(bucketURL string) (bool, error) {
	u, err := url.Parse(bucketURL)
	if err != nil {
		return false, fmt.Errorf("parse bucket URL: %w", err)
	}
	if !strings.EqualFold(u.Scheme, "file") {
		return false, nil
	}
	if err := validatePrefix(u.Query().Get("prefix")); err != nil {
		return false, err
	}

	return true, nil
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

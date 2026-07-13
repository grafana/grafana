package search

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"iter"
	"math"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Masterminds/semver/v3"
	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/analysis/analyzer/standard"
	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/query"
	index "github.com/blevesearch/bleve_index_api"
	"github.com/prometheus/client_golang/prometheus"
	bolterrors "go.etcd.io/bbolt/errors"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"k8s.io/apimachinery/pkg/selection"

	"github.com/grafana/authlib/authz"
	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/log"
	foldermodel "github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	indexStorageMemory = "memory"
	indexStorageFile   = "file"
	boltTimeout        = "1s"
)

// Keys used to store internal data in index.
const (
	internalRVKey                    = "rv"                      // Encoded as big-endian int64
	internalBuildInfoKey             = "build_info"              // Encoded as JSON of buildInfo struct
	internalSnapshotMutationCountKey = "snapshot_mutation_count" // Encoded as big-endian int64
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/storage/unified/search")

var _ resource.SearchBackend = &bleveBackend{}
var _ resource.ResourceIndex = &bleveIndex{}

type BleveOptions struct {
	// The root folder where file objects are saved
	Root string

	// The resource count where values switch from memory to file based
	FileThreshold int64

	// Index cache TTL for bleve indices. 0 disables expiration for in-memory indexes.
	// Also used for file-based indexes, if they are not owned by this instance, and they are not fetched from the cache recently.
	IndexCacheTTL time.Duration

	BuildVersion string

	Logger log.Logger

	// Minimum time between index updates.
	IndexMinUpdateInterval time.Duration

	// This function is called to check whether the index is owned by the current instance.
	// Indexes that are not owned by current instance are eligible for cleanup.
	// If nil, all indexes are owned by the current instance.
	OwnsIndex func(key resource.NamespacedResource) (bool, error)

	// Map "group/kind" -> list of selectable fields. Keys must be lower-case.
	// Only given fields are indexed (have mapping).
	SelectableFieldsForKinds map[string][]string

	// Map "group/resource" -> hash of the SearchFieldDefinition slices
	// registered for that (group, resource), across every version. The
	// value is recorded in each new index's IndexBuildInfo so a future run
	// can detect drift and rebuild. Keys must be lower-case.
	SearchFieldsHashesForKinds map[string]string

	// Map "group/resource" -> SearchFieldsProvider that drives the bleve
	// mapping for that (group, resource). When a provider is registered
	// for a kind, the bleve mapping is built from the provider's
	// SearchFieldDefinitions rather than from the legacy column-definition
	// list carried by SearchableDocumentFields. Keys must be lower-case.
	SearchFieldsProvidersForKinds map[string]resource.SearchFieldsProvider

	// Snapshot configures remote index snapshot download at build time.
	// If Snapshot.Store is nil, the feature is disabled and BuildIndex behaves exactly as before.
	Snapshot SnapshotOptions

	// DiskCleanupInterval is how often the background on-disk cleanup pass runs.
	// The first run after start is jittered uniformly in [0, DiskCleanupInterval)
	// so the sweep doesn't run immediately at startup, when the instance is still
	// busy opening or rebuilding indexes. Zero disables the loop (the goroutine
	// is not started).
	DiskCleanupInterval time.Duration

	// DiskCleanupGracePeriod is the minimum age a candidate directory must have
	// before it is eligible for deletion. Applied as a two-step mtime gate so a
	// directory that is still being written to (active scorch index, in-flight
	// snapshot CopyTo) is always preserved. Only consulted when
	// DiskCleanupInterval > 0.
	DiskCleanupGracePeriod time.Duration

	// DiskCleanupUnopenedGracePeriod is a longer grace period applied only to
	// the newest on-disk index of a resource this pod owns but has not opened
	// in this process. A pod owning a resource it has not been queried for
	// keeps the most recent on-disk index for this duration, so a later
	// BuildIndex call can hand it to findPreviousFileBasedIndex and skip a full
	// rebuild. Older siblings under the same resource still use
	// DiskCleanupGracePeriod. Only consulted when DiskCleanupInterval > 0.
	DiskCleanupUnopenedGracePeriod time.Duration

	// PostRankAuthzEnabled enables the post-filter (post-rank) authorization
	// path. Set from the search_post_rank_authz config option at backend init.
	// When false, the in-searcher permissionScopedQuery path is used.
	PostRankAuthzEnabled bool

	// PostRankAuthz tunes the post-filter authorization path used when
	// PostRankAuthzEnabled is true. Zero values fall back to the defaults in
	// PostRankAuthzConfig.effective().
	PostRankAuthz PostRankAuthzConfig
}

// SnapshotOptions configures remote index snapshot handling in BuildIndex and
// background upload scheduling.
type SnapshotOptions struct {
	// Store is the remote index store. When nil, the snapshot feature is disabled
	// and no remote download/upload is attempted.
	Store RemoteIndexStore

	// MinDocCount is the minimum document count at which a remote snapshot download/upload is attempted.
	// Must be >= FileThreshold to be meaningful; smaller resources are built in-process.
	MinDocCount int64

	// MaxIndexAge is the maximum age of a remote snapshot that can be downloaded.
	// Older snapshots are skipped (hard filter). Zero means "no age limit":
	// snapshots are accepted regardless of age, and cleanup does not delete
	// snapshots based on age (cleanup's per-version-group eviction of
	// superseded snapshots still applies; see selectSnapshotsToDelete).
	MaxIndexAge time.Duration

	// MinBuildVersion, if non-nil, is the preferred lower bound on the Grafana
	// build version of a remote snapshot. Snapshots with a lower version are
	// considered only if no snapshot at or above this version is available.
	MinBuildVersion *semver.Version

	// UploadInterval is the minimum time between consecutive successful uploads
	// for the same resource.
	UploadInterval time.Duration

	// MinDocChanges is the minimum persisted mutation count required before a new
	// upload is attempted after a previous successful upload.
	MinDocChanges int

	// CleanupGracePeriod is the time a newly uploaded snapshot must have existed
	// before its predecessor in the same Grafana-version group is eligible for
	// cleanup. Consumed by the cleanup loop only; no effect on upload/download.
	CleanupGracePeriod time.Duration

	// CleanupInterval is how often the background cleanup pass runs. The first
	// run after start is jittered uniformly in [0, CleanupInterval) to spread
	// listings across replicas deployed together. Zero disables periodic cleanup
	// (the loop is not started).
	CleanupInterval time.Duration
}

type bleveBackend struct {
	log  log.Logger
	opts BleveOptions

	// set from opts.OwnsIndex, always non-nil
	ownsIndexFn func(key resource.NamespacedResource) (bool, error)

	cacheMx sync.RWMutex
	cache   map[resource.NamespacedResource]*bleveIndex

	indexMetrics *resource.BleveIndexMetrics

	selectableFields     map[string][]string
	searchFieldsHashes   map[string]string
	searchFieldsProvider map[string]resource.SearchFieldsProvider

	// Parsed opts.BuildVersion for snapshot tier comparisons. Nil if BuildVersion
	// is empty. Guaranteed non-nil when opts.Snapshot.Store is set.
	runningBuildVersion *semver.Version

	// maxSupportedIndexFormat is the newest Bleve segment format this process can read.
	maxSupportedIndexFormat string

	bgTasksCancel func()
	bgTasksWg     sync.WaitGroup

	uploadTrackingMu sync.Mutex
	lastUploadTime   map[resource.NamespacedResource]time.Time

	// inFlightBuildDirs is a refcount of absolute directory paths that belong
	// to BuildIndex calls (or their helpers) which haven't returned yet.
	// cleanOldIndexes must not delete these. Helpers that allocate or open a
	// directory under resourceDir are responsible for registering the path,
	// and BuildIndex unregisters it after the call completes.
	inFlightBuildDirsMu sync.Mutex
	inFlightBuildDirs   map[string]int
}

func NewBleveBackend(opts BleveOptions, indexMetrics *resource.BleveIndexMetrics) (*bleveBackend, error) {
	if opts.Root == "" {
		return nil, fmt.Errorf("bleve backend missing root folder configuration")
	}
	absRoot, err := filepath.Abs(opts.Root)
	if err != nil {
		return nil, fmt.Errorf("error getting absolute path for bleve root folder %w", err)
	}
	opts.Root = absRoot

	root, err := os.Stat(opts.Root)
	if err != nil {
		return nil, fmt.Errorf("error opening bleve root folder %w", err)
	}
	if !root.IsDir() {
		return nil, fmt.Errorf("bleve root is configured against a file (not folder)")
	}

	var runningBuildVersion *semver.Version
	if opts.BuildVersion != "" {
		// Don't allow storing invalid versions to the index.
		v, err := semver.NewVersion(opts.BuildVersion)
		if err != nil {
			return nil, fmt.Errorf("cannot parse build version %s: %w", opts.BuildVersion, err)
		}
		runningBuildVersion = v
	}

	// Snapshot selection compares against runningBuildVersion, so we require it
	// to be set when the feature is enabled. This keeps the snapshot code free
	// of nil checks.
	if opts.Snapshot.Store != nil && runningBuildVersion == nil {
		return nil, fmt.Errorf("bleve backend requires non-empty BuildVersion when snapshot store is configured")
	}
	maxSupportedFormat := maxSupportedIndexFormat()

	l := opts.Logger
	if l == nil {
		l = log.New("bleve-backend")
	}
	if opts.Snapshot.Store != nil && maxSupportedFormat == "" {
		l.Warn("could not detect bleve index format version; snapshot format compatibility gate disabled")
	}

	ownFn := opts.OwnsIndex
	if ownFn == nil {
		// By default all indexes are owned by this instance.
		ownFn = func(key resource.NamespacedResource) (bool, error) { return true, nil }
	}

	be := &bleveBackend{
		log:                     l,
		cache:                   map[resource.NamespacedResource]*bleveIndex{},
		opts:                    opts,
		ownsIndexFn:             ownFn,
		indexMetrics:            indexMetrics,
		selectableFields:        opts.SelectableFieldsForKinds,
		searchFieldsHashes:      opts.SearchFieldsHashesForKinds,
		searchFieldsProvider:    opts.SearchFieldsProvidersForKinds,
		runningBuildVersion:     runningBuildVersion,
		maxSupportedIndexFormat: maxSupportedFormat,
		lastUploadTime:          map[resource.NamespacedResource]time.Time{},
		inFlightBuildDirs:       map[string]int{},
	}

	ctx, cancel := context.WithCancel(context.Background())
	be.bgTasksCancel = cancel

	be.bgTasksWg.Add(1)
	go be.evictExpiredOrUnownedIndexesPeriodically(ctx)

	be.bgTasksWg.Add(1)
	go be.writeOpenIndexListPeriodically(ctx)

	if opts.Snapshot.Store != nil {
		// Initialise snapshot metric label series only on instances where the
		// feature is actually wired up; ProvideIndexMetrics deliberately skips
		// this so disabled instances stay quiet. See InitSnapshotMetrics for the
		// full rationale.
		be.indexMetrics.InitSnapshotMetrics()

		be.bgTasksWg.Add(1)
		go be.uploadSnapshotsPeriodically(ctx)

		if opts.Snapshot.CleanupInterval > 0 {
			be.bgTasksWg.Add(1)
			go be.cleanupSnapshotsPeriodically(ctx)
		}
	}

	if opts.DiskCleanupInterval > 0 {
		// Same rationale as InitSnapshotMetrics: only emit the
		// index_server_disk_cleanup_* series on instances where the feature is
		// enabled.
		be.indexMetrics.InitDiskCleanupMetrics()
		be.bgTasksWg.Add(1)
		go be.cleanupDiskPeriodically(ctx)
	}

	if be.indexMetrics != nil {
		be.bgTasksWg.Add(1)
		go be.updateIndexSizeMetric(ctx, opts.Root)
	}

	return be, nil
}

// GetIndex will return nil if the key does not exist
func (b *bleveBackend) GetIndex(key resource.NamespacedResource) resource.ResourceIndex {
	idx := b.getCachedIndex(key, time.Now())
	// Avoid returning typed nils.
	if idx == nil {
		return nil
	}
	return idx
}

func (b *bleveBackend) GetOpenIndexes() []resource.NamespacedResource {
	b.cacheMx.RLock()
	defer b.cacheMx.RUnlock()

	result := make([]resource.NamespacedResource, 0, len(b.cache))
	for key := range b.cache {
		result = append(result, key)
	}
	return result
}

func (b *bleveBackend) getCachedIndex(key resource.NamespacedResource, now time.Time) *bleveIndex {
	idx := b.peekCachedIndex(key)
	if idx == nil {
		return nil
	}
	idx.lastFetchedFromCache.Store(now.UnixMilli())
	return idx
}

// peekCachedIndex returns the cached index for key without refreshing its last-fetched
// timestamp. Use this from background scans that should not keep unowned indexes alive
// against eviction in runEvictExpiredOrUnownedIndexes.
func (b *bleveBackend) peekCachedIndex(key resource.NamespacedResource) *bleveIndex {
	b.cacheMx.RLock()
	defer b.cacheMx.RUnlock()
	return b.cache[key]
}

func (b *bleveBackend) closeIndex(idx *bleveIndex, key resource.NamespacedResource) {
	err := idx.stopUpdaterAndCloseIndex()
	if err != nil {
		b.log.Error("failed to close index", "key", key, "err", err)
	}

	if b.indexMetrics != nil {
		b.indexMetrics.OpenIndexes.WithLabelValues(idx.indexStorage).Dec()
	}
}

// This function will periodically evict expired or un-owned indexes from the cache.
func (b *bleveBackend) evictExpiredOrUnownedIndexesPeriodically(ctx context.Context) {
	defer b.bgTasksWg.Done()

	t := time.NewTicker(2 * time.Minute)

	for ctx.Err() == nil {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			b.runEvictExpiredOrUnownedIndexes(time.Now())
		}
	}
}

func (b *bleveBackend) runEvictExpiredOrUnownedIndexes(now time.Time) {
	cacheTTLMillis := b.opts.IndexCacheTTL.Milliseconds()

	// Collect all expired or unowned into this map, and perform the actual closing without holding the lock.
	expired := map[resource.NamespacedResource]*bleveIndex{}
	unowned := map[resource.NamespacedResource]*bleveIndex{}
	ownCheckErrors := map[resource.NamespacedResource]error{}

	b.cacheMx.Lock()
	for key, idx := range b.cache {
		// Check if index has expired.
		if !idx.expiration.IsZero() && now.After(idx.expiration) {
			delete(b.cache, key)
			expired[key] = idx
			continue
		}

		// Check if index is owned by this instance.
		if cacheTTLMillis > 0 {
			owned, err := b.ownsIndexFn(key)
			if err != nil {
				ownCheckErrors[key] = err
			} else if !owned && now.UnixMilli()-idx.lastFetchedFromCache.Load() > cacheTTLMillis {
				delete(b.cache, key)
				unowned[key] = idx
			}
		}
	}
	b.cacheMx.Unlock()

	for key, err := range ownCheckErrors {
		b.log.Warn("failed to check if index belongs to this instance", "key", key, "err", err)
	}

	for key, idx := range unowned {
		b.clearUploadTracking(key)
		b.log.Info("index evicted from cache", "reason", "unowned", "key", key, "storage", idx.indexStorage)
		b.closeIndex(idx, key)
	}

	for key, idx := range expired {
		b.clearUploadTracking(key)
		b.log.Info("index evicted from cache", "reason", "expired", "key", key, "storage", idx.indexStorage)
		b.closeIndex(idx, key)
	}
}

func (b *bleveBackend) shouldUpload(key resource.NamespacedResource, idx *bleveIndex, now time.Time) (bool, error) {
	docCount, err := idx.index.DocCount()
	if err != nil {
		return false, fmt.Errorf("reading document count for %v: %w", key, err)
	}
	if int64(docCount) < b.opts.Snapshot.MinDocCount {
		return false, nil
	}

	lastUploadTime, ok := b.getUploadTracking(key)
	if !ok {
		return true, nil
	}
	if b.opts.Snapshot.UploadInterval > 0 && now.Sub(lastUploadTime) < b.opts.Snapshot.UploadInterval {
		return false, nil
	}

	mutationCount, err := idx.getSnapshotMutationCount()
	if err != nil {
		return false, fmt.Errorf("reading snapshot mutation count for %v: %w", key, err)
	}
	if mutationCount >= int64(b.opts.Snapshot.MinDocChanges) {
		return true, nil
	}

	if b.opts.Snapshot.MaxIndexAge <= 0 {
		return false, nil
	}

	// Refresh stable indexes well before cleanup can age out the remote snapshot.
	refreshInterval := b.opts.Snapshot.MaxIndexAge / 3
	if refreshInterval <= 0 {
		refreshInterval = b.opts.Snapshot.MaxIndexAge
	}
	return now.Sub(lastUploadTime) >= refreshInterval, nil
}

func (b *bleveBackend) setUploadTracking(key resource.NamespacedResource, uploadedAt time.Time) {
	b.uploadTrackingMu.Lock()
	defer b.uploadTrackingMu.Unlock()
	b.lastUploadTime[key] = uploadedAt
}

func (b *bleveBackend) getUploadTracking(key resource.NamespacedResource) (time.Time, bool) {
	b.uploadTrackingMu.Lock()
	defer b.uploadTrackingMu.Unlock()
	t, ok := b.lastUploadTime[key]
	if !ok {
		return time.Time{}, false
	}
	return t, true
}

func (b *bleveBackend) clearUploadTracking(key resource.NamespacedResource) {
	b.uploadTrackingMu.Lock()
	defer b.uploadTrackingMu.Unlock()
	delete(b.lastUploadTime, key)
}

const (
	snapshotUploadCheckInterval          = 5 * time.Minute
	snapshotUploadStatusSuccess          = "success"
	snapshotUploadStatusSkipNoChanges    = "skip_no_changes"
	snapshotUploadStatusSkipLockHeld     = "skip_lock_contention"
	snapshotUploadStatusSkipLockLost     = "skip_lock_lost"
	snapshotUploadStatusSkipRecentRemote = "skip_recent_remote"
	snapshotUploadStatusSkipNotOwner     = "skip_not_owner"
	snapshotUploadStatusError            = "error"
)

func (b *bleveBackend) uploadSnapshotsPeriodically(ctx context.Context) {
	defer b.bgTasksWg.Done()

	t := time.NewTicker(snapshotUploadCheckInterval)
	defer t.Stop()

	for ctx.Err() == nil {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			b.runUploadSnapshots(ctx)
		}
	}
}

func (b *bleveBackend) runUploadSnapshots(ctx context.Context) {
	for _, key := range b.GetOpenIndexes() {
		idx := b.peekCachedIndex(key)
		if idx == nil || idx.indexStorage != indexStorageFile {
			continue
		}

		owned, err := b.ownsIndexFn(key)
		if err != nil {
			b.recordSnapshotUploadStatus(snapshotUploadStatusError)
			b.log.Warn("failed to check if index belongs to this instance", "key", key, "err", err)
			continue
		}
		if !owned {
			b.recordSnapshotUploadStatus(snapshotUploadStatusSkipNotOwner)
			continue
		}

		shouldUpload, err := b.shouldUpload(key, idx, time.Now())
		if err != nil {
			b.recordSnapshotUploadStatus(snapshotUploadStatusError)
			b.log.Warn("failed to evaluate snapshot upload eligibility", "key", key, "err", err)
			continue
		}
		if !shouldUpload {
			b.recordSnapshotUploadStatus(snapshotUploadStatusSkipNoChanges)
			continue
		}

		baselineMutations, err := idx.getSnapshotMutationCount()
		if err != nil {
			b.recordSnapshotUploadStatus(snapshotUploadStatusError)
			b.log.Warn("failed to read snapshot mutation baseline", "key", key, "err", err)
			continue
		}

		start := time.Now()
		if err := b.uploadSnapshot(ctx, key, idx); err != nil {
			switch {
			case errors.Is(err, errLockHeld):
				b.recordSnapshotUploadStatus(snapshotUploadStatusSkipLockHeld)
			case errors.Is(err, errSkipRecentRemote):
				// A recent remote upload covers this resource for the cross-instance
				// dedup window. Update lastUploadTime so this replica's local probe
				// also rate-limits to once per UploadInterval, and don't reset the
				// mutation baseline — we didn't actually take a snapshot.
				b.setUploadTracking(key, time.Now())
				b.recordSnapshotUploadStatus(snapshotUploadStatusSkipRecentRemote)
			default:
				b.recordSnapshotUploadStatus(snapshotUploadStatusError)
				b.log.Warn("snapshot upload failed", "key", key, "err", err)
			}
			continue
		}

		if err := idx.subtractSnapshotMutationCount(baselineMutations); err != nil {
			b.recordSnapshotUploadStatus(snapshotUploadStatusError)
			b.log.Warn("failed to advance snapshot mutation baseline", "key", key, "err", err)
			continue
		}
		b.setUploadTracking(key, time.Now())
		b.recordSnapshotUploadStatus(snapshotUploadStatusSuccess)
		if b.indexMetrics != nil {
			b.indexMetrics.IndexSnapshotUploadDuration.Observe(time.Since(start).Seconds())
		}
	}
}

func (b *bleveBackend) recordSnapshotUploadStatus(status string) {
	if b.indexMetrics == nil {
		return
	}
	b.indexMetrics.IndexSnapshotUploads.WithLabelValues(status).Inc()
}

// updateIndexSizeMetric sets the total size of all file-based indices metric.
func (b *bleveBackend) updateIndexSizeMetric(ctx context.Context, indexPath string) {
	defer b.bgTasksWg.Done()

	for ctx.Err() == nil {
		var totalSize int64

		err := filepath.WalkDir(indexPath, func(path string, info os.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if err = ctx.Err(); err != nil {
				return err
			}
			if !info.IsDir() {
				fileInfo, err := info.Info()
				if err != nil {
					return err
				}
				totalSize += fileInfo.Size()
			}
			return nil
		})

		if err == nil {
			b.indexMetrics.IndexSize.Set(float64(totalSize))
		} else {
			b.log.Error("got error while trying to calculate bleve file index size", "error", err)
		}

		select {
		case <-ctx.Done():
			return
		case <-time.After(60 * time.Second):
			continue
		}
	}
}

// newBleveIndex creates a new bleve index with consistent configuration.
// If path is empty, creates an in-memory index.
// If path is not empty, creates a file-based index at the specified path.
func newBleveIndex(path string, mapper mapping.IndexMapping, buildTime time.Time, buildVersion string, selectableFields []string, searchFieldsHash string) (bleve.Index, error) {
	kvstore := bleve.Config.DefaultKVStore
	if path == "" {
		// use in-memory kvstore
		kvstore = bleve.Config.DefaultMemKVStore
	}
	ix, err := bleve.NewUsing(path, mapper, bleve.Config.DefaultIndexType, kvstore, nil)
	if err != nil {
		return nil, err
	}

	bi := buildInfo{
		BuildTime:        buildTime.Unix(),
		BuildVersion:     buildVersion,
		SelectableFields: selectableFields,
		SearchFieldsHash: searchFieldsHash,
	}

	biBytes, err := json.Marshal(bi)
	if err != nil {
		cErr := ix.Close()
		return nil, errors.Join(fmt.Errorf("failed to store index build info: %w", err), cErr)
	}

	if err = ix.SetInternal([]byte(internalBuildInfoKey), biBytes); err != nil {
		cErr := ix.Close()
		return nil, errors.Join(fmt.Errorf("failed to store index build info: %w", err), cErr)
	}
	return ix, nil
}

type buildInfo struct {
	BuildTime        int64    `json:"build_time"`                   // Unix seconds timestamp of time when the index was built
	BuildVersion     string   `json:"build_version"`                // Grafana version used when building the index
	SelectableFields []string `json:"selectable_fields,omitempty"`  // List of selectable fields used when index was created.
	SearchFieldsHash string   `json:"search_fields_hash,omitempty"` // Hash over the SearchFieldDefinition slices registered for (group, resource) at build time, across every version. Empty when no SearchFieldsProvider was in use.
}

type buildIndexSource int

const (
	buildIndexSourceNew buildIndexSource = iota
	buildIndexSourceExistingFile
	buildIndexSourceDownloadedSnapshot
)

func (s buildIndexSource) needsBuild() bool {
	return s == buildIndexSourceNew
}

// preparedBuildIndex carries the opened index from prepareIndex into the
// build/cache phase. BuildIndex owns every value returned here: it closes index
// on failure, removes cleanupDir on failure, and releases snapshotBuildLock
// after the optional leader upload.
type preparedBuildIndex struct {
	// index is the opened Bleve index. It may be empty, reused from disk, or
	// downloaded from a remote snapshot.
	index bleve.Index
	// indexRV is set only for reusable indexes. BuildIndex copies it into the
	// cached ResourceIndex without running the builder.
	indexRV int64
	// fileIndexName is the resource directory child to keep during old-index
	// cleanup. Empty means an in-memory index.
	fileIndexName string
	// indexStorage is the metric/cache label for this index: memory or file.
	indexStorage string
	// source tells BuildIndex whether the index still needs to be populated, or
	// where a reusable index came from.
	source buildIndexSource
	// cleanupDir is deleted if BuildIndex returns before storing the index in the
	// cache. It is set for newly-created file indexes only.
	cleanupDir string
	// snapshotBuildLock is held when this instance won snapshot build coordination.
	// BuildIndex must keep it through the build and immediate snapshot upload.
	snapshotBuildLock IndexStoreLock
	// snapshotBuildFlow identifies the coordination path that supplied snapshotBuildLock.
	snapshotBuildFlow string
}

// BuildIndex builds an index from scratch or retrieves it from the filesystem.
// If built successfully, the new index replaces the old index in the cache (if there was any).
// Existing index in the file system is reused, if it exists, and lastImportTime
// check passes (if the index was built before lastImportTime, it will be rebuilt).
// The return value of "builder" should be the RV returned from List. This will be stored as the index RV.
//
// maxFreshSnapshotAge is the maximum age (by BuildTime) of a remote snapshot
// that BuildIndex will download instead of rebuilding from scratch on the
// rebuild path. Zero disables the strict same-version fast path; the snapshot
// store, if configured, is still consulted on the initial-startup path via
// pickBestSnapshot.
//
//nolint:gocyclo
func (b *bleveBackend) BuildIndex(
	ctx context.Context,
	key resource.NamespacedResource,
	docCount int64,
	indexBuildReason string,
	builder resource.BuildFn,
	updater resource.UpdateFn,
	rebuild bool,
	lastImportTime time.Time,
	maxFreshSnapshotAge time.Duration,
) (resource.ResourceIndex, error) {
	_, span := tracer.Start(ctx, "search.bleveBackend.BuildIndex")
	defer span.End()

	span.SetAttributes(
		attribute.String("namespace", key.Namespace),
		attribute.String("group", key.Group),
		attribute.String("resource", key.Resource),
		attribute.String("reason", indexBuildReason),
	)

	sfKey := strings.ToLower(fmt.Sprintf("%s/%s", key.Group, key.Resource))
	selectableFields := b.selectableFields[sfKey]
	searchFieldsHash := b.searchFieldsHashes[sfKey]
	searchFieldsProvider := b.searchFieldsProvider[sfKey]

	mapper, err := GetBleveMappings(searchFieldsProvider, key.Group, key.Resource, selectableFields)
	if err != nil {
		return nil, err
	}

	// The kind's custom column fields come from the same provider that drives
	// the mapping, so the index and its result columns stay in agreement.
	fields, err := resource.SearchableFieldsFromProvider(searchFieldsProvider, key.Group, key.Resource)
	if err != nil {
		return nil, err
	}

	// Prepare fields before opening/creating indexes, so that we don't need to deal with closing them in case of errors.
	standardSearchFields := resource.StandardSearchFields()
	allFields, err := getAllFields(standardSearchFields, fields)
	if err != nil {
		return nil, err
	}

	logWithDetails := b.log.FromContext(ctx).New("namespace", key.Namespace, "group", key.Group, "resource", key.Resource, "reason", indexBuildReason)
	resourceDir := b.getResourceDir(key)
	snapshotEnabled := b.opts.Snapshot.Store != nil && docCount >= b.opts.Snapshot.MinDocCount

	prepared, err := b.prepareIndex(ctx, key, snapshotEnabled, mapper, selectableFields, searchFieldsHash, rebuild, lastImportTime, maxFreshSnapshotAge, resourceDir, logWithDetails)
	if err != nil {
		return nil, err
	}

	// prepareIndex's helpers register the working directory before returning;
	// release that registration when BuildIndex returns, regardless of success
	// or failure path. Adaptive promotion can also register a directory while
	// the builder is running, so keep this path mutable.
	var inFlightDir string
	if prepared.fileIndexName != "" {
		inFlightDir = filepath.Join(resourceDir, prepared.fileIndexName)
	}
	defer func() {
		if inFlightDir != "" {
			b.unregisterInFlightBuildDir(inFlightDir)
		}
	}()

	if prepared.snapshotBuildLock != nil {
		defer func() {
			if releaseErr := prepared.snapshotBuildLock.Release(); releaseErr != nil {
				logWithDetails.Warn("Releasing snapshot build lock", "flow", prepared.snapshotBuildFlow, "err", releaseErr)
			}
		}()
	}

	// Close the newly created/opened index by default.
	closeIndex := true
	defer func() {
		if !closeIndex {
			return
		}
		if closeErr := prepared.index.Close(); closeErr != nil {
			logWithDetails.Error("Failed to close index after index build failure", "err", closeErr)
		}
		if prepared.cleanupDir != "" {
			if removeErr := os.RemoveAll(prepared.cleanupDir); removeErr != nil {
				logWithDetails.Error("Failed to remove index directory after index build failure", "err", removeErr)
			}
		}
	}()

	switch prepared.source {
	case buildIndexSourceNew:
		// New indexes are logged by the create/build path; this switch only adds source-specific reuse logs.
	case buildIndexSourceDownloadedSnapshot:
		logWithDetails.Debug("Using index downloaded from remote snapshot", "indexRV", prepared.indexRV, "directory", filepath.Join(resourceDir, prepared.fileIndexName))
	case buildIndexSourceExistingFile:
		logWithDetails.Debug("Existing index found on filesystem", "indexRV", prepared.indexRV, "directory", filepath.Join(resourceDir, prepared.fileIndexName))
	}

	idx := b.newBleveIndex(key, prepared.index, prepared.indexStorage, fields, allFields, standardSearchFields, updater, b.log.New("namespace", key.Namespace, "group", key.Group, "resource", key.Resource))

	if prepared.source.needsBuild() {
		// Type-convert so buildIndexFromScratch can call updateResourceVersion after the builder returns.
		buildTarget := buildResourceIndex(idx)
		var adaptive *adaptiveBuildIndex
		if prepared.indexStorage == indexStorageMemory && b.opts.FileThreshold > 0 {
			adaptive = newAdaptiveBuildIndex(idx, b.opts.FileThreshold, func(delegate *bleveIndex) (*bleveIndex, string, string, error) {
				return b.promoteBuildIndexToFile(delegate, key, resourceDir, fields, allFields, standardSearchFields, updater, logWithDetails)
			})
			buildTarget = adaptive
		}

		buildErr := b.buildIndexFromScratch(buildTarget, indexBuildReason, builder, logWithDetails)
		if adaptive != nil {
			// If the adaptive wrapper promoted the index, copy the final file-backed
			// delegate and directory metadata back into prepared so the normal cache,
			// cleanup, and in-flight unregister paths handle the promoted index.
			idx, prepared.fileIndexName, prepared.cleanupDir = adaptive.finalState()
			prepared.index = idx.index
			prepared.indexStorage = idx.indexStorage
			if prepared.fileIndexName != "" {
				inFlightDir = filepath.Join(resourceDir, prepared.fileIndexName)
			}
		}
		if buildErr != nil {
			return nil, buildErr
		}
		if prepared.snapshotBuildLock != nil {
			b.uploadSnapshotBuildLeader(ctx, key, idx, prepared.snapshotBuildLock, prepared.snapshotBuildFlow, logWithDetails)
		}
	} else {
		logWithDetails.Info("Skipping index build, using existing index")

		idx.resourceVersion.Store(prepared.indexRV)

		if b.indexMetrics != nil {
			b.indexMetrics.IndexBuildSkipped.Inc()
		}
	}

	// Set expiration after building the index. Only expire in-memory indexes.
	if prepared.fileIndexName == "" && b.opts.IndexCacheTTL > 0 {
		idx.expiration = time.Now().Add(b.opts.IndexCacheTTL)
	}

	// Store the index in the cache.
	if idx.expiration.IsZero() {
		logWithDetails.Info("Storing index in cache, with no expiration", "key", key)
	} else {
		logWithDetails.Info("Storing index in cache", "key", key, "expiration", idx.expiration)
	}

	// We're storing index in the cache, so we can't close it.
	closeIndex = false

	b.cacheMx.Lock()
	prev := b.cache[key]
	b.cache[key] = idx
	b.cacheMx.Unlock()

	// If there was a previous index in the cache, close it.
	if prev != nil {
		if b.indexMetrics != nil {
			b.indexMetrics.OpenIndexes.WithLabelValues(prev.indexStorage).Dec()
		}

		err := prev.stopUpdaterAndCloseIndex()
		if err != nil {
			logWithDetails.Error("failed to close previous index", "key", key, "err", err)
		}
	}
	if b.indexMetrics != nil {
		b.indexMetrics.OpenIndexes.WithLabelValues(idx.indexStorage).Inc()
	}

	// Clean up the old index directories. If we have built a new file-based index, the new name is ignored.
	// If we have created in-memory index and fileIndexName is empty, all old directories can be removed.
	//
	// We do the cleanup on the same goroutine as the index building. Using background goroutine could
	// cleanup new index directory that is being built by new call to BuildIndex.
	b.cleanOldIndexes(resourceDir, prepared.fileIndexName)

	return idx, nil
}

// prepareIndex prepares the Bleve index that BuildIndex will cache.
// It may reuse a local file index, download a remote snapshot, coordinate a cold-start build, or create an empty index for the builder to populate.
func (b *bleveBackend) prepareIndex(
	ctx context.Context,
	key resource.NamespacedResource,
	snapshotEnabled bool,
	mapper mapping.IndexMapping,
	selectableFields []string,
	searchFieldsHash string,
	rebuild bool,
	lastImportTime time.Time,
	maxFreshSnapshotAge time.Duration,
	resourceDir string,
	logger log.Logger,
) (preparedBuildIndex, error) {
	cachedIndex := b.getCachedIndex(key, time.Now())

	// We only check for the existing file-based index if we don't already have an open index for this key,
	// and if rebuild flag is not set.
	// This happens on startup, or when memory-based index has expired. (We don't expire file-based indexes)
	// If we do have an unexpired cached index already, or if rebuild is true, we always build a new index from scratch.
	if cachedIndex == nil && !rebuild {
		return b.prepareUncachedFileIndex(ctx, key, resourceDir, mapper, selectableFields, searchFieldsHash, lastImportTime, snapshotEnabled, logger)
	}

	if rebuild && snapshotEnabled && maxFreshSnapshotAge > 0 {
		// Rebuild path: before paying the cost of a from-scratch rebuild, coordinate
		// with same-version replicas and accept only a snapshot fresh enough to serve
		// as a drop-in replacement. There is no tiered fallback here because we
		// already have a working index.
		// coordinateRebuild only returns err on ctx cancellation; propagate it directly.
		idx, name, rv, lock, err := b.coordinateRebuild(ctx, key, resourceDir, lastImportTime, maxFreshSnapshotAge, logger)
		if err != nil {
			return preparedBuildIndex{}, err
		}
		if idx != nil {
			return preparedBuildIndex{
				index:         idx,
				indexRV:       rv,
				fileIndexName: name,
				indexStorage:  indexStorageFile,
				source:        buildIndexSourceDownloadedSnapshot,
			}, nil
		} else if lock != nil {
			prepared, err := b.createEmptyBuildIndex(resourceDir, mapper, selectableFields, searchFieldsHash, logger)
			if err != nil {
				if releaseErr := lock.Release(); releaseErr != nil {
					logger.Warn("Releasing rebuild build lock", "err", releaseErr)
				}
				return preparedBuildIndex{}, err
			}
			prepared.snapshotBuildLock = lock
			prepared.snapshotBuildFlow = snapshotBuildFlowRebuild
			return prepared, nil
		}
	}

	return b.createEmptyBuildIndex(resourceDir, mapper, selectableFields, searchFieldsHash, logger)
}

func (b *bleveBackend) prepareUncachedFileIndex(
	ctx context.Context,
	key resource.NamespacedResource,
	resourceDir string,
	mapper mapping.IndexMapping,
	selectableFields []string,
	searchFieldsHash string,
	lastImportTime time.Time,
	snapshotEnabled bool,
	logger log.Logger,
) (preparedBuildIndex, error) {
	idx, name, rv, err := b.tryReuseFileIndex(resourceDir, lastImportTime, logger)
	if err != nil {
		return preparedBuildIndex{}, err
	}
	if idx != nil {
		return preparedBuildIndex{
			index:         idx,
			indexRV:       rv,
			fileIndexName: name,
			indexStorage:  indexStorageFile,
			source:        buildIndexSourceExistingFile,
		}, nil
	}

	if !snapshotEnabled {
		return b.createEmptyBuildIndex(resourceDir, mapper, selectableFields, searchFieldsHash, logger)
	}

	idx, name, rv, err = b.tryDownloadRemoteSnapshot(ctx, key, resourceDir, logger)
	if err != nil {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return preparedBuildIndex{}, ctxErr
		}
		logger.Warn("Failed to download remote snapshot, will build from scratch", "err", err)
	} else if idx != nil {
		return preparedBuildIndex{
			index:         idx,
			indexRV:       rv,
			fileIndexName: name,
			indexStorage:  indexStorageFile,
			source:        buildIndexSourceDownloadedSnapshot,
		}, nil
	}

	// coordinateColdStartBuild only returns err on ctx cancellation; propagate it directly.
	idx, name, rv, lock, err := b.coordinateColdStartBuild(ctx, key, resourceDir, lastImportTime, logger)
	if err != nil {
		return preparedBuildIndex{}, err
	}
	if idx != nil {
		return preparedBuildIndex{
			index:         idx,
			indexRV:       rv,
			fileIndexName: name,
			indexStorage:  indexStorageFile,
			source:        buildIndexSourceDownloadedSnapshot,
		}, nil
	} else if lock != nil {
		prepared, err := b.createEmptyBuildIndex(resourceDir, mapper, selectableFields, searchFieldsHash, logger)
		if err != nil {
			if releaseErr := lock.Release(); releaseErr != nil {
				logger.Warn("Releasing cold-start build lock", "err", releaseErr)
			}
			return preparedBuildIndex{}, err
		}
		prepared.snapshotBuildLock = lock
		prepared.snapshotBuildFlow = snapshotBuildFlowColdStart
		return prepared, nil
	}

	return b.createEmptyBuildIndex(resourceDir, mapper, selectableFields, searchFieldsHash, logger)
}

func (b *bleveBackend) tryReuseFileIndex(resourceDir string, lastImportTime time.Time, logger log.Logger) (bleve.Index, string, int64, error) {
	idx, name, rv, err := b.findPreviousFileBasedIndex(resourceDir)
	if err != nil || idx == nil || lastImportTime.IsZero() {
		return idx, name, rv, err
	}

	bi, err := getBuildInfo(idx)
	if err != nil {
		logger.Warn("failed to get build info from existing index", "error", err)
		return idx, name, rv, nil
	}
	if bi.BuildTime <= 0 {
		return idx, name, rv, nil
	}

	indexBuildTime := time.Unix(bi.BuildTime, 0)
	if !indexBuildTime.Before(lastImportTime) {
		return idx, name, rv, nil
	}

	logger.Info("File-based index needs rebuild before opening", "buildTime", indexBuildTime, "lastImportTime", lastImportTime)
	_ = idx.Close()
	// Release the registration findPreviousFileBasedIndex installed on this
	// directory: we are discarding the reused index, so cleanOldIndexes is
	// allowed to remove its directory once the rebuild finishes.
	b.unregisterInFlightBuildDir(filepath.Join(resourceDir, name))
	return nil, "", 0, nil
}

func (b *bleveBackend) createEmptyBuildIndex(resourceDir string, mapper mapping.IndexMapping, selectableFields []string, searchFieldsHash string, logger log.Logger) (preparedBuildIndex, error) {
	if b.opts.FileThreshold <= 0 {
		return b.createEmptyFileIndex(resourceDir, mapper, selectableFields, searchFieldsHash, logger)
	}
	return b.createEmptyMemoryIndex(mapper, selectableFields, searchFieldsHash, logger)
}

func (b *bleveBackend) createEmptyFileIndex(resourceDir string, mapper mapping.IndexMapping, selectableFields []string, searchFieldsHash string, logger log.Logger) (preparedBuildIndex, error) {
	for {
		indexDir, fileIndexName, err := b.reserveIndexDir(resourceDir)
		if err != nil {
			return preparedBuildIndex{}, err
		}

		idx, err := newBleveIndex(indexDir, mapper, time.Now(), b.opts.BuildVersion, selectableFields, searchFieldsHash)
		if errors.Is(err, bleve.ErrorIndexPathExists) {
			b.unregisterInFlightBuildDir(indexDir)
			continue
		}
		if err != nil {
			b.unregisterInFlightBuildDir(indexDir)
			return preparedBuildIndex{}, fmt.Errorf("error creating new bleve index: %s %w", indexDir, err)
		}

		logger.Info("Building index using filesystem", "directory", indexDir)
		return preparedBuildIndex{
			index:         idx,
			fileIndexName: fileIndexName,
			indexStorage:  indexStorageFile,
			source:        buildIndexSourceNew,
			cleanupDir:    indexDir,
		}, nil
	}
}

func (b *bleveBackend) createEmptyMemoryIndex(mapper mapping.IndexMapping, selectableFields []string, searchFieldsHash string, logger log.Logger) (preparedBuildIndex, error) {
	idx, err := newBleveIndex("", mapper, time.Now(), b.opts.BuildVersion, selectableFields, searchFieldsHash)
	if err != nil {
		return preparedBuildIndex{}, fmt.Errorf("error creating new in-memory bleve index: %w", err)
	}
	logger.Info("Building index using memory")
	return preparedBuildIndex{
		index:        idx,
		indexStorage: indexStorageMemory,
		source:       buildIndexSourceNew,
	}, nil
}

type buildResourceIndex interface {
	resource.ResourceIndex
	updateResourceVersion(rv int64) error
}

type promoteBuildIndexFunc func(*bleveIndex) (*bleveIndex, string, string, error)

// adaptiveBuildIndex is used only while a from-scratch build is running. It
// starts with a memory-backed delegate and promotes that delegate to a
// filesystem-backed index once the successful build writes enough documents to
// cross FileThreshold. The cached index is the final delegate, not this wrapper,
// so incremental updates never trigger promotion.
type adaptiveBuildIndex struct {
	// Embed the current delegate so this build-only wrapper implements resource.ResourceIndex.
	*bleveIndex

	threshold int64
	promote   promoteBuildIndexFunc

	// mu protects promotion state below. Other ResourceIndex methods are only delegated
	// through the embedded bleveIndex while the builder is running; builders are
	// expected to call BulkIndex only.
	mu            sync.Mutex
	fileIndexName string
	cleanupDir    string
}

var _ resource.ResourceIndex = &adaptiveBuildIndex{}

func newAdaptiveBuildIndex(delegate *bleveIndex, threshold int64, promote promoteBuildIndexFunc) *adaptiveBuildIndex {
	return &adaptiveBuildIndex{
		bleveIndex: delegate,
		threshold:  threshold,
		promote:    promote,
	}
}

func (a *adaptiveBuildIndex) BulkIndex(req *resource.BulkIndexRequest) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	if err := a.bleveIndex.BulkIndex(req); err != nil {
		return err
	}
	if a.fileIndexName != "" {
		return nil
	}

	count, err := a.index.DocCount()
	if err != nil {
		return err
	}
	if int64(count) < a.threshold {
		return nil
	}

	promoted, fileIndexName, cleanupDir, err := a.promote(a.bleveIndex)
	if err != nil {
		return err
	}
	a.bleveIndex = promoted
	a.fileIndexName = fileIndexName
	a.cleanupDir = cleanupDir
	return nil
}

func (a *adaptiveBuildIndex) updateResourceVersion(rv int64) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.bleveIndex.updateResourceVersion(rv)
}

func (a *adaptiveBuildIndex) finalState() (*bleveIndex, string, string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.bleveIndex, a.fileIndexName, a.cleanupDir
}

func (b *bleveBackend) promoteBuildIndexToFile(
	delegate *bleveIndex,
	key resource.NamespacedResource,
	resourceDir string,
	fields resource.SearchableDocumentFields,
	allFields []*resourcepb.ResourceTableColumnDefinition,
	standardSearchFields resource.SearchableDocumentFields,
	updater resource.UpdateFn,
	logger log.Logger,
) (*bleveIndex, string, string, error) {
	copyable, ok := delegate.index.(bleve.IndexCopyable)
	if !ok {
		return nil, "", "", fmt.Errorf("index does not support copy")
	}

	indexDir, fileIndexName, err := b.reserveIndexDir(resourceDir)
	if err != nil {
		return nil, "", "", err
	}
	cleanup := true
	defer func() {
		if cleanup {
			b.unregisterInFlightBuildDir(indexDir)
			if removeErr := os.RemoveAll(indexDir); removeErr != nil {
				logger.Error("Failed to remove promoted index directory after promotion failure", "directory", indexDir, "err", removeErr)
			}
		}
	}()

	if err := copyable.CopyTo(bleve.FileSystemDirectory(indexDir)); err != nil {
		return nil, "", "", fmt.Errorf("copying index to filesystem: %w", err)
	}

	fileIndex, err := bleve.OpenUsing(indexDir, map[string]interface{}{"bolt_timeout": boltTimeout})
	if err != nil {
		return nil, "", "", fmt.Errorf("opening promoted filesystem index: %w", err)
	}

	promoted := b.newBleveIndex(key, fileIndex, indexStorageFile, fields, allFields, standardSearchFields, updater, delegate.logger)
	promoted.resourceVersion.Store(delegate.resourceVersion.Load())
	cleanup = false

	if err := delegate.index.Close(); err != nil {
		logger.Warn("Failed to close memory index after promotion", "err", err)
	}
	logger.Info("Promoted index build to filesystem", "directory", indexDir, "doc_count", countDocsForLog(fileIndex))
	return promoted, fileIndexName, indexDir, nil
}

func countDocsForLog(index bleve.Index) uint64 {
	count, err := index.DocCount()
	if err != nil {
		return 0
	}
	return count
}

func (b *bleveBackend) buildIndexFromScratch(idx buildResourceIndex, indexBuildReason string, builder resource.BuildFn, logger log.Logger) error {
	if b.indexMetrics != nil {
		b.indexMetrics.IndexBuilds.WithLabelValues(indexBuildReason).Inc()
	}

	start := time.Now()
	listRV, err := builder(idx)
	if err != nil {
		logger.Error("Failed to build index", "err", err)
		if b.indexMetrics != nil {
			b.indexMetrics.IndexBuildFailures.Inc()
		}
		return fmt.Errorf("failed to build index: %w", err)
	}
	if err := idx.updateResourceVersion(listRV); err != nil {
		logger.Error("Failed to persist RV to index", "err", err, "rv", listRV)
		return fmt.Errorf("failed to persist RV to index: %w", err)
	}

	elapsed := time.Since(start)
	logger.Info("Finished building index", "elapsed", elapsed, "listRV", listRV)

	if b.indexMetrics != nil {
		b.indexMetrics.IndexCreationTime.WithLabelValues().Observe(elapsed.Seconds())
	}
	return nil
}

// uploadSnapshotBuildLeader uploads a snapshot immediately after this instance
// has rebuilt an index while holding the remote build lock. The upload lets
// other replicas waiting on the same lock download the fresh snapshot instead
// of rebuilding the same index locally.
func (b *bleveBackend) uploadSnapshotBuildLeader(ctx context.Context, key resource.NamespacedResource, idx *bleveIndex, lock IndexStoreLock, flow string, logger log.Logger) {
	if checkSnapshotLock(lock) != nil {
		// Lock lost during the build. Another replica may already be uploading;
		// skip and let the periodic tick reconcile.
		logger.Warn("Snapshot build leader lock lost during build; skipping immediate upload", "flow", flow)
		b.recordSnapshotUploadStatus(snapshotUploadStatusSkipLockLost)
		return
	}

	baselineMutations, mErr := idx.getSnapshotMutationCount()
	if mErr != nil {
		logger.Warn("Failed to read snapshot mutation baseline for leader upload", "flow", flow, "err", mErr)
	}
	uploadKey, uploadRV, upErr := b.snapshotCopyAndUpload(ctx, key, idx, lock)
	if upErr != nil {
		logger.Warn("Snapshot build leader immediate snapshot upload failed", "flow", flow, "err", upErr)
		b.recordSnapshotUploadStatus(snapshotUploadStatusError)
		return
	}

	if mErr == nil {
		if subErr := idx.subtractSnapshotMutationCount(baselineMutations); subErr != nil {
			logger.Warn("Failed to advance snapshot mutation baseline after leader upload", "flow", flow, "err", subErr)
		}
	}
	b.setUploadTracking(key, time.Now())
	b.recordSnapshotUploadStatus(snapshotUploadStatusSuccess)
	logger.Info("Snapshot build leader uploaded freshly-built snapshot", "flow", flow, "snapshot_key", uploadKey.String(), "snapshot_rv", uploadRV)
}

func (b *bleveBackend) getResourceDir(key resource.NamespacedResource) string {
	return filepath.Join(b.opts.Root, resourceSubPath(key))
}

// resourceSubPath returns the namespaced on-disk/object-store path for a resource,
// for example: default/dashboards.dashboard.grafana.app
func resourceSubPath(key resource.NamespacedResource) string {
	return filepath.Join(cleanFileSegment(key.Namespace), cleanFileSegment(fmt.Sprintf("%s.%s", key.Resource, key.Group)))
}

func cleanFileSegment(input string) string {
	input = strings.ReplaceAll(input, string(filepath.Separator), "_")
	input = strings.ReplaceAll(input, "..", "_")
	return input
}

// cleanOldIndexes deletes all subdirectories inside dir, skipping directory with "skipName".
// "skipName" can be empty. Directories belonging to other in-flight BuildIndex
// calls are also skipped: concurrent rebuilds for the same resource each have
// their own working directory, and deleting another build's directory would
// corrupt its index.
//
// MAINTAINER NOTE: any code that allocates or opens a directory under a
// resource's directory before BuildIndex has finished must call
// registerInFlightBuildDir on that absolute path; otherwise a concurrent
// BuildIndex call (for the same key) can wipe it from disk while it is still
// being populated. The matching unregister is owned by BuildIndex (deferred
// after prepareIndex returns successfully) for paths that flow through
// preparedBuildIndex.fileIndexName, and by the helper itself on its own
// failure paths. If you add a new directory-allocating helper, follow the
// same pattern.
func (b *bleveBackend) cleanOldIndexes(resourceDir string, skipName string) {
	entries, err := os.ReadDir(resourceDir)
	if err != nil {
		if os.IsNotExist(err) {
			return
		}
		b.log.Warn("error cleaning folders from", "directory", resourceDir, "error", err)
		return
	}
	for _, entry := range entries {
		if entry.IsDir() && entry.Name() != skipName {
			entryDir := filepath.Join(resourceDir, entry.Name())
			if !isPathWithinRoot(entryDir, b.opts.Root) {
				b.log.Warn("Skipping cleanup of directory", "directory", entryDir)
				continue
			}

			if b.isInFlightBuildDir(entryDir) {
				b.log.Info("Skipping cleanup of in-flight build directory", "directory", entryDir)
				continue
			}

			err = os.RemoveAll(entryDir)
			if err != nil {
				b.log.Error("Unable to remove old index folder", "directory", entryDir, "error", err)
			} else {
				b.log.Info("Removed old index folder", "directory", entryDir)
			}
		}
	}
}

// reserveIndexDir returns an absolute path (and its base name) inside
// resourceDir that does not exist yet. It reserves the not-yet-created path in
// inFlightBuildDirs before returning, and bumps the timestamp if a collision
// happens.
func (b *bleveBackend) reserveIndexDir(resourceDir string) (string, string, error) {
	if err := os.MkdirAll(resourceDir, 0o750); err != nil {
		return "", "", err
	}

	t := time.Now()
	for {
		name := formatIndexName(t)
		dir := filepath.Join(resourceDir, name)
		if !isPathWithinRoot(dir, b.opts.Root) {
			return "", "", fmt.Errorf("invalid path %s", dir)
		}
		if _, err := os.Stat(dir); err != nil {
			if !errors.Is(err, os.ErrNotExist) {
				return "", "", err
			}
			if b.tryReserveInFlightBuildDir(dir) {
				return dir, name, nil
			}
		}
		t = t.Add(time.Second)
	}
}

// registerInFlightBuildDir marks an absolute directory path as actively used
// by an in-flight BuildIndex call. cleanOldIndexes will skip such paths.
// Must be paired with a call to unregisterInFlightBuildDir; the refcount
// allows the same path to be registered more than once if multiple callers
// happen to land on the same name (rare, but cheap insurance).
func (b *bleveBackend) registerInFlightBuildDir(path string) {
	if path == "" {
		return
	}
	b.inFlightBuildDirsMu.Lock()
	defer b.inFlightBuildDirsMu.Unlock()
	b.inFlightBuildDirs[path]++
}

// tryReserveInFlightBuildDir registers path only if no in-process build is
// already using it. It is used before the directory exists on disk.
func (b *bleveBackend) tryReserveInFlightBuildDir(path string) bool {
	if path == "" {
		return false
	}
	b.inFlightBuildDirsMu.Lock()
	defer b.inFlightBuildDirsMu.Unlock()
	if _, ok := b.inFlightBuildDirs[path]; ok {
		return false
	}
	b.inFlightBuildDirs[path] = 1
	return true
}

func (b *bleveBackend) unregisterInFlightBuildDir(path string) {
	if path == "" {
		return
	}
	b.inFlightBuildDirsMu.Lock()
	defer b.inFlightBuildDirsMu.Unlock()
	c, ok := b.inFlightBuildDirs[path]
	if !ok {
		// A missing entry means a registration was never installed for this
		// path, or that the path is being unregistered twice. Both indicate a
		// pairing bug in a helper; log so it surfaces in tests and prod logs.
		b.log.Error("unregisterInFlightBuildDir called with unknown path; missing register or double unregister", "path", path)
		return
	}
	if c > 1 {
		b.inFlightBuildDirs[path] = c - 1
	} else {
		delete(b.inFlightBuildDirs, path)
	}
}

func (b *bleveBackend) isInFlightBuildDir(path string) bool {
	b.inFlightBuildDirsMu.Lock()
	defer b.inFlightBuildDirsMu.Unlock()
	_, ok := b.inFlightBuildDirs[path]
	return ok
}

// isPathWithinRoot verifies that path is within given absoluteRoot.
func isPathWithinRoot(path, absoluteRoot string) bool {
	if path == "" || absoluteRoot == "" {
		return false
	}

	path, err := filepath.Abs(path)
	if err != nil {
		return false
	}
	if !strings.HasPrefix(path, absoluteRoot) {
		return false
	}
	return true
}

// TotalDocs returns the total number of documents across all indices
func (b *bleveBackend) TotalDocs() int64 {
	var totalDocs int64
	// We iterate over keys and call getCachedIndex for each index individually.
	// We do this to avoid keeping a lock for the entire TotalDocs function, since DocCount may be slow (due to disk access).

	now := time.Now()
	for _, key := range b.GetOpenIndexes() {
		idx := b.getCachedIndex(key, now)
		if idx == nil {
			continue
		}
		c, err := idx.index.DocCount()
		if err != nil {
			continue
		}
		totalDocs += int64(c)
	}
	return totalDocs
}

func formatIndexName(now time.Time) string {
	return now.Format("20060102-150405")
}

func (b *bleveBackend) findPreviousFileBasedIndex(resourceDir string) (bleve.Index, string, int64, error) {
	entries, err := os.ReadDir(resourceDir)
	if err != nil {
		return nil, "", 0, nil
	}

	for _, ent := range entries {
		if !ent.IsDir() {
			continue
		}

		indexName := ent.Name()
		indexDir := filepath.Join(resourceDir, indexName)
		idx, err := bleve.OpenUsing(indexDir, map[string]interface{}{"bolt_timeout": boltTimeout})
		if err != nil {
			// On timeout, the file probably is locked by another process.
			// This indicates a setup issue that should be fixed rather than worked around by creating a new index file.
			if errors.Is(err, bolterrors.ErrTimeout) {
				b.log.Error("index is locked by another process", "indexDir", indexDir, "err", err)
				return nil, "", 0, fmt.Errorf("index is locked by another process: indexDir=%s, err=%w", indexDir, err)
			}
			b.log.Error("error opening index", "indexDir", indexDir, "err", err)
			continue
		}

		indexRV, err := getRV(idx)
		if err != nil {
			b.log.Error("error getting rv from index", "indexDir", indexDir, "err", err)
			_ = idx.Close()
			continue
		}

		b.registerInFlightBuildDir(indexDir)
		return idx, indexName, indexRV, nil
	}

	return nil, "", 0, nil
}

// Stop closes all indexes and stops background tasks.
func (b *bleveBackend) Stop() {
	b.bgTasksCancel()
	b.bgTasksWg.Wait()

	// Stop the periodic writer before the final write so shutdown writes one stable list.
	if err := b.WriteOpenIndexStats(time.Now()); err != nil {
		b.log.Warn("failed to write open index stats during shutdown", "err", err)
	}

	b.closeAllIndexes()
}

func (b *bleveBackend) closeAllIndexes() {
	b.cacheMx.Lock()
	defer b.cacheMx.Unlock()

	for key, idx := range b.cache {
		b.clearUploadTracking(key)
		if err := idx.stopUpdaterAndCloseIndex(); err != nil {
			b.log.Error("Failed to close index", "err", err)
		}
		delete(b.cache, key)

		if b.indexMetrics != nil {
			b.indexMetrics.OpenIndexes.WithLabelValues(idx.indexStorage).Dec()
		}
	}
}

type updateRequest struct {
	requestTime time.Time
	callback    chan updateResult
}

type updateResult struct {
	rv  int64
	err error
}

type bleveIndex struct {
	key   resource.NamespacedResource
	index bleve.Index

	// RV returned by last List/ListModifiedSince operation. Updated when updating index.
	resourceVersion atomic.Int64

	// Timestamp when the last update to the index was done (started).
	// Subsequent update requests only trigger new update if minUpdateInterval has elapsed.
	nextUpdateTime time.Time

	standard resource.SearchableDocumentFields
	fields   resource.SearchableDocumentFields

	indexStorage string // memory or file, used when updating metrics

	// When to expire and close the index. Zero value = no expiration.
	// We only expire in-memory indexes.
	expiration time.Time

	// The values returned with all
	allFields []*resourcepb.ResourceTableColumnDefinition
	logger    log.Logger

	updaterFn         resource.UpdateFn
	minUpdateInterval time.Duration

	updaterMu       sync.Mutex
	updaterCond     *sync.Cond         // Used to signal the updater goroutine that there is work to do, or updater is no longer enabled and should stop. Also used by updater itself to stop early if there's no work to be done.
	updaterShutdown bool               // When set to true, index is getting closed and updater is no longer going to update index.
	updaterQueue    []updateRequest    // Queue of requests for next updater iteration.
	updaterCancel   context.CancelFunc // If not nil, the updater goroutine is running with context associated with this cancel function.
	updaterWg       sync.WaitGroup

	indexMetrics     *resource.BleveIndexMetrics
	updateLatency    prometheus.Histogram
	updatedDocuments prometheus.Summary

	// Used to detect if the index can be safely closed, if it no longer belongs to this instance. UnixMilli.
	lastFetchedFromCache atomic.Int64

	// Guards read-modify-write updates of the persisted snapshot mutation count
	// stored in Bleve internal data, so concurrent BulkIndex calls don't lose increments.
	snapshotMutationMu sync.Mutex

	// postRankAuthzEnabled enables the post-ranking authz path. When false,
	// the in-searcher permissionScopedQuery path is used.
	postRankAuthzEnabled bool
	postRankAuthz        PostRankAuthzConfig
}

func (b *bleveBackend) newBleveIndex(
	key resource.NamespacedResource,
	index bleve.Index,
	newIndexType string,
	fields resource.SearchableDocumentFields,
	allFields []*resourcepb.ResourceTableColumnDefinition,
	standardSearchFields resource.SearchableDocumentFields,
	updaterFn resource.UpdateFn,
	logger log.Logger,
) *bleveIndex {
	bi := &bleveIndex{
		key:                  key,
		index:                index,
		indexStorage:         newIndexType,
		fields:               fields,
		allFields:            allFields,
		standard:             standardSearchFields,
		logger:               logger,
		updaterFn:            updaterFn,
		minUpdateInterval:    b.opts.IndexMinUpdateInterval,
		indexMetrics:         b.indexMetrics,
		postRankAuthzEnabled: b.opts.PostRankAuthzEnabled,
		postRankAuthz:        b.opts.PostRankAuthz.effective(),
	}
	bi.updaterCond = sync.NewCond(&bi.updaterMu)
	if b.indexMetrics != nil {
		bi.updateLatency = b.indexMetrics.UpdateLatency
		bi.updatedDocuments = b.indexMetrics.UpdatedDocuments
	}
	return bi
}

// BulkIndex implements resource.ResourceIndex.
func (b *bleveIndex) BulkIndex(req *resource.BulkIndexRequest) error {
	if len(req.Items) == 0 {
		return nil
	}

	batch := b.index.NewBatch()
	var undeclaredFields map[string]struct{}
	for _, item := range req.Items {
		switch item.Action {
		case resource.ActionIndex:
			if item.Doc == nil {
				return fmt.Errorf("missing document")
			}
			doc := item.Doc.UpdateCopyFields()

			// The static fields.* mapping drops values written under an undeclared
			// name; collect them so the loss is logged, not silent.
			for name := range doc.Fields {
				if b.isDeclaredField(name) {
					continue
				}
				if undeclaredFields == nil {
					undeclaredFields = map[string]struct{}{}
				}
				undeclaredFields[name] = struct{}{}
			}

			err := batch.Index(resource.SearchID(doc.Key), doc)
			if err != nil {
				return err
			}
		case resource.ActionDelete:
			batch.Delete(resource.SearchID(item.Key))
		}
	}
	for name := range undeclaredFields {
		b.logger.Warn("search field written to document is not declared for this kind, so it is dropped from the index and cannot be stored or queried", "field", name)
	}

	if err := b.index.Batch(batch); err != nil {
		return err
	}
	return b.addSnapshotMutationCount(int64(len(req.Items)))
}

// isDeclaredField reports whether name is a declared search field for this
// index (per-kind or standard). The fields.* prefix is stripped, so a bare
// doc.Fields key matches.
func (b *bleveIndex) isDeclaredField(name string) bool {
	if b.fields != nil && b.fields.Field(name) != nil {
		return true
	}
	return b.standard != nil && b.standard.Field(name) != nil
}

func (b *bleveIndex) updateResourceVersion(rv int64) error {
	if rv == 0 {
		return nil
	}

	if err := setRV(b.index, rv); err != nil {
		return err
	}

	b.resourceVersion.Store(rv)

	return nil
}

func setRV(index bleve.Index, rv int64) error {
	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, uint64(rv))

	return index.SetInternal([]byte(internalRVKey), buf)
}

func writeSnapshotMutationCount(index bleve.Index, count int64) error {
	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, uint64(count))
	return index.SetInternal([]byte(internalSnapshotMutationCountKey), buf)
}

func readSnapshotMutationCount(index bleve.Index) (int64, error) {
	raw, err := index.GetInternal([]byte(internalSnapshotMutationCountKey))
	if err != nil {
		return 0, err
	}
	if len(raw) < 8 {
		return 0, nil
	}
	return int64(binary.BigEndian.Uint64(raw)), nil
}

func (b *bleveIndex) getSnapshotMutationCount() (int64, error) {
	b.snapshotMutationMu.Lock()
	defer b.snapshotMutationMu.Unlock()
	return readSnapshotMutationCount(b.index)
}

func (b *bleveIndex) addSnapshotMutationCount(delta int64) error {
	b.snapshotMutationMu.Lock()
	defer b.snapshotMutationMu.Unlock()

	current, err := readSnapshotMutationCount(b.index)
	if err != nil {
		return err
	}
	return writeSnapshotMutationCount(b.index, current+delta)
}

func (b *bleveIndex) subtractSnapshotMutationCount(delta int64) error {
	b.snapshotMutationMu.Lock()
	defer b.snapshotMutationMu.Unlock()

	current, err := readSnapshotMutationCount(b.index)
	if err != nil {
		return err
	}
	remaining := current - delta
	if remaining < 0 {
		remaining = 0
	}
	return writeSnapshotMutationCount(b.index, remaining)
}

// getRV will call index.GetInternal to retrieve the RV saved in the index. If index is closed, it will return a
// bleve.ErrorIndexClosed error. If there's no RV saved in the index, or it's invalid format, it will return 0
func getRV(index bleve.Index) (int64, error) {
	raw, err := index.GetInternal([]byte(internalRVKey))
	if err != nil {
		return 0, err
	}

	if len(raw) < 8 {
		return 0, nil
	}

	return int64(binary.BigEndian.Uint64(raw)), nil
}

func getBuildInfo(index bleve.Index) (buildInfo, error) {
	raw, err := index.GetInternal([]byte(internalBuildInfoKey))
	if err != nil {
		return buildInfo{}, err
	}

	if len(raw) == 0 {
		return buildInfo{}, nil
	}

	res := buildInfo{}
	err = json.Unmarshal(raw, &res)
	return res, err
}

func (b *bleveIndex) BuildInfo() (resource.IndexBuildInfo, error) {
	bi, err := getBuildInfo(b.index)
	if err != nil {
		return resource.IndexBuildInfo{}, err
	}

	bt := time.Time{}
	if bi.BuildTime > 0 {
		bt = time.Unix(bi.BuildTime, 0)
	}

	var bv *semver.Version
	if bi.BuildVersion != "" {
		v, err := semver.NewVersion(bi.BuildVersion)
		if err == nil {
			bv = v
		}
	}

	return resource.IndexBuildInfo{
		BuildTime:        bt,
		BuildVersion:     bv,
		SelectableFields: bi.SelectableFields,
		SearchFieldsHash: bi.SearchFieldsHash,
	}, nil
}

func (b *bleveIndex) ListManagedObjects(ctx context.Context, req *resourcepb.ListManagedObjectsRequest, stats *resource.SearchStats) (*resourcepb.ListManagedObjectsResponse, error) {
	if req.NextPageToken != "" {
		return nil, fmt.Errorf("next page not implemented yet")
	}
	if req.Kind == "" {
		return &resourcepb.ListManagedObjectsResponse{
			Error: resource.NewBadRequestError("empty manager kind"),
		}, nil
	}
	if req.Id == "" {
		return &resourcepb.ListManagedObjectsResponse{
			Error: resource.NewBadRequestError("empty manager id"),
		}, nil
	}

	start := time.Now()
	q := bleve.NewBooleanQuery()
	q.AddMust(&query.TermQuery{
		Term:     req.Kind,
		FieldVal: resource.SEARCH_FIELD_MANAGER_KIND,
	})
	q.AddMust(&query.TermQuery{
		Term:     req.Id,
		FieldVal: resource.SEARCH_FIELD_MANAGER_ID,
	})
	stats.AddResultsConversionTime(time.Since(start))

	found, err := b.index.SearchInContext(ctx, &bleve.SearchRequest{
		Query: q,
		Fields: []string{
			resource.SEARCH_FIELD_TITLE,
			resource.SEARCH_FIELD_FOLDER,
			resource.SEARCH_FIELD_MANAGER_KIND,
			resource.SEARCH_FIELD_MANAGER_ID,
			resource.SEARCH_FIELD_SOURCE_PATH,
			resource.SEARCH_FIELD_SOURCE_CHECKSUM,
			resource.SEARCH_FIELD_SOURCE_TIME,
		},
		Sort: search.SortOrder{
			&search.SortField{
				Field: resource.SEARCH_FIELD_SOURCE_PATH,
				Type:  search.SortFieldAsString,
				Desc:  false,
			},
		},
		Size: 1000000000, // big number
		From: 0,          // next page token not yet supported
	})
	if err != nil {
		return nil, err
	}

	stats.AddTotalHits(int(found.Total))
	stats.AddSearchTime(found.Took)
	stats.AddReturnedDocuments(len(found.Hits))

	asString := func(v any) string {
		if v == nil {
			return ""
		}
		str, ok := v.(string)
		if ok {
			return str
		}
		return fmt.Sprintf("%v", v)
	}

	asTime := func(v any) int64 {
		if v == nil {
			return 0
		}
		intV, ok := v.(int64)
		if ok {
			return intV
		}
		floatV, ok := v.(float64)
		if ok {
			return int64(floatV)
		}
		str, ok := v.(string)
		if ok {
			t, _ := time.Parse(time.RFC3339, str)
			return t.UnixMilli()
		}
		return 0
	}

	start = time.Now()
	rsp := &resourcepb.ListManagedObjectsResponse{}
	for _, hit := range found.Hits {
		item := &resourcepb.ListManagedObjectsResponse_Item{
			Object: &resourcepb.ResourceKey{},
			Hash:   asString(hit.Fields[resource.SEARCH_FIELD_SOURCE_CHECKSUM]),
			Path:   asString(hit.Fields[resource.SEARCH_FIELD_SOURCE_PATH]),
			Time:   asTime(hit.Fields[resource.SEARCH_FIELD_SOURCE_TIME]),
			Title:  asString(hit.Fields[resource.SEARCH_FIELD_TITLE]),
			Folder: asString(hit.Fields[resource.SEARCH_FIELD_FOLDER]),
		}
		err := resource.ReadSearchID(item.Object, hit.ID)
		if err != nil {
			return nil, err
		}
		rsp.Items = append(rsp.Items, item)
	}
	stats.AddResultsConversionTime(time.Since(start))
	return rsp, nil
}

func (b *bleveIndex) CountManagedObjects(ctx context.Context, stats *resource.SearchStats) ([]*resourcepb.CountManagedObjectsResponse_ResourceCount, error) {
	found, err := b.index.SearchInContext(ctx, &bleve.SearchRequest{
		Query: bleve.NewMatchAllQuery(),
		Size:  0,
		Facets: bleve.FacetsRequest{
			"count": bleve.NewFacetRequest(resource.SEARCH_FIELD_MANAGED_BY, 1000), // typically less then 5
		},
	})
	if err != nil {
		return nil, err
	}

	stats.AddSearchTime(found.Took)
	stats.AddTotalHits(int(found.Total))
	stats.AddReturnedDocuments(len(found.Hits))

	vals := make([]*resourcepb.CountManagedObjectsResponse_ResourceCount, 0)
	f, ok := found.Facets["count"]
	if ok && f.Terms != nil {
		for _, v := range f.Terms.Terms() {
			val := v.Term
			idx := strings.Index(val, ":")
			if idx > 0 {
				vals = append(vals, &resourcepb.CountManagedObjectsResponse_ResourceCount{
					Kind:     val[0:idx],
					Id:       val[idx+1:],
					Group:    b.key.Group,
					Resource: b.key.Resource,
					Count:    int64(v.Count),
				})
			}
		}
	}
	return vals, nil
}

// Search implements resource.DocumentIndex.
func (b *bleveIndex) Search(
	ctx context.Context,
	access authlib.AccessClient,
	req *resourcepb.ResourceSearchRequest,
	federate []resource.ResourceIndex, // For federated queries, these will match the values in req.federate
	stats *resource.SearchStats,
) (*resourcepb.ResourceSearchResponse, error) {
	ctx, span := tracer.Start(ctx, "search.bleveIndex.Search")
	defer span.End()

	if req.Options == nil || req.Options.Key == nil {
		return &resourcepb.ResourceSearchResponse{
			Error: resource.NewBadRequestError("missing query key"),
		}, nil
	}

	response := &resourcepb.ResourceSearchResponse{
		Error:           b.verifyKey(req.Options.Key),
		ResourceVersion: b.resourceVersion.Load(),
	}
	if response.Error != nil {
		return response, nil
	}

	// Verifies the index federation
	index, err := b.getIndex(ctx, req, federate)
	if err != nil {
		return nil, err
	}

	// postFilter is opt-in via the search_post_rank_authz config option. It
	// covers normal paginated search and federated queries: bleve ranks, the
	// runner authorizes app-side in rank order, and stops once the page is full.
	// Count-only (Limit==0), facet, and SearchBefore requests stay on the
	// in-searcher path (exact totals / exact facets).
	postRank := b.postRankAuthzEnabled && access != nil &&
		req.Limit > 0 && len(req.SearchBefore) == 0 && len(req.Facet) == 0

	conversionStarts := time.Now()
	// convert protobuf request to bleve request
	searchrequest, e := b.toBleveSearchRequest(ctx, req, access, postRank)
	if e != nil {
		response.Error = e
		return response, nil
	}

	if err := b.ensureSearchFields(searchrequest, req); err != nil {
		return nil, err
	}

	// A SearchAfter cursor carries one sort value per field in the sort order
	// that produced it. The post-rank path appends a SortDocID tie-breaker, so
	// its sort order is one longer than the in-searcher path's. A cursor
	// created before the flag was enabled (or after it was turned off) has the
	// wrong length for the current path. runPostFilterAuthz calls
	// SearchInContext directly, so bleve doesn't validate the mismatch before
	// the collector indexes into the shorter cursor. Guard it here: if the
	// cursor doesn't match the post-rank sort order, fall back to the in-searcher
	// path; if it still doesn't match, reject the request.
	if postRank && len(req.SearchAfter) > 0 && len(req.SearchAfter) != len(searchrequest.Sort) {
		postRank = false
		searchrequest, e = b.toBleveSearchRequest(ctx, req, access, postRank)
		if e != nil {
			response.Error = e
			return response, nil
		}
		if err := b.ensureSearchFields(searchrequest, req); err != nil {
			return nil, err
		}
	}
	if len(req.SearchAfter) > 0 && len(req.SearchAfter) != len(searchrequest.Sort) {
		response.Error = resource.NewBadRequestError("search_after cursor does not match the current sort order")
		return response, nil
	}

	// selectFields is the response column list, derived from the caller's
	// requested fields (or the all-fields sentinel when none were requested).
	// It is snapshotted before ensureAuthzFields so the folder field — which
	// bleve loads only to authorize hits — is never returned to the caller.
	// This keeps "fields loaded from bleve" (searchrequest.Fields) separate
	// from "fields returned to the caller" (selectFields).
	selectFields := slices.Clone(searchrequest.Fields)
	if postRank {
		b.ensureAuthzFields(searchrequest)
	}
	stats.AddRequestConversionTime(time.Since(conversionStarts))

	if postRank {
		return b.runPostFilterAuthz(ctx, access, req, index, searchrequest, selectFields, stats, response)
	}

	res, err := index.SearchInContext(ctx, searchrequest)
	if err != nil {
		return nil, err
	}

	response.TotalHits = int64(res.Total)
	response.QueryCost = float64(res.Cost)
	response.MaxScore = res.MaxScore
	stats.AddSearchTime(res.Took)
	stats.AddTotalHits(int(res.Total))
	stats.AddReturnedDocuments(len(res.Hits))

	resultsConversionStart := time.Now()
	response.Results, err = b.hitsToTable(ctx, selectFields, res.Hits, searchrequest.Sort, req.Explain)
	if err != nil {
		return nil, err
	}

	// parse the facet fields
	for k, v := range res.Facets {
		f := newResponseFacet(v)
		if response.Facet == nil {
			response.Facet = make(map[string]*resourcepb.ResourceSearchResponse_Facet)
		}
		response.Facet[k] = f
	}
	stats.AddResultsConversionTime(time.Since(resultsConversionStart))
	return response, nil
}

func (b *bleveIndex) DocCount(ctx context.Context, folder string, stats *resource.SearchStats) (int64, error) {
	ctx, span := tracer.Start(ctx, "search.bleveIndex.DocCount")
	defer span.End()

	if folder == "" {
		count, err := b.index.DocCount()
		return int64(count), err
	}

	req := &bleve.SearchRequest{
		Size:   0, // we just need the count
		Fields: []string{},
		Query: &query.TermQuery{
			Term:     folder,
			FieldVal: resource.SEARCH_FIELD_FOLDER,
		},
	}
	rsp, err := b.index.SearchInContext(ctx, req)
	if rsp == nil {
		return 0, err
	}
	if stats != nil {
		stats.AddTotalHits(int(rsp.Total))
		stats.AddSearchTime(rsp.Took)
	}
	return int64(rsp.Total), err
}

// make sure the request key matches the index
func (b *bleveIndex) verifyKey(key *resourcepb.ResourceKey) *resourcepb.ErrorResult {
	if key.Namespace != b.key.Namespace {
		return resource.NewBadRequestError("namespace mismatch (expected " + b.key.Namespace + ")")
	}
	if key.Group != b.key.Group {
		return resource.NewBadRequestError("group mismatch (expected " + b.key.Group + ")")
	}
	if key.Resource != b.key.Resource {
		return resource.NewBadRequestError("resource mismatch (expected " + b.key.Resource + ")")
	}
	return nil
}

func (b *bleveIndex) getIndex(
	ctx context.Context,
	req *resourcepb.ResourceSearchRequest,
	federate []resource.ResourceIndex,
) (bleve.Index, error) {
	_, span := tracer.Start(ctx, "search.bleveIndex.getIndex")
	defer span.End()

	if len(req.Federated) != len(federate) {
		return nil, fmt.Errorf("federation is misconfigured")
	}

	// Search across resources using
	// https://blevesearch.com/docs/IndexAlias/
	if len(federate) > 0 {
		all := []bleve.Index{b.index}
		for i, extra := range federate {
			typedindex, ok := extra.(*bleveIndex)
			if !ok {
				return nil, fmt.Errorf("federated indexes must be the same type")
			}
			if typedindex.verifyKey(req.Federated[i]) != nil {
				return nil, fmt.Errorf("federated index keys do not match (%v != %v)", typedindex, req.Federated[i])
			}
			all = append(all, typedindex.index)
		}
		return bleve.NewIndexAlias(all...), nil
	}
	return b.index, nil
}

func (b *bleveIndex) toBleveSearchRequest(ctx context.Context, req *resourcepb.ResourceSearchRequest, access authlib.AccessClient, postRankAuthz bool) (*bleve.SearchRequest, *resourcepb.ErrorResult) {
	ctx, span := tracer.Start(ctx, "search.bleveIndex.toBleveSearchRequest") //nolint:staticcheck,ineffassign // SA4006: ctx intentionally kept so future code added to this function inherits the traced span
	defer span.End()

	facets := bleve.FacetsRequest{}
	for _, f := range req.Facet {
		facets[f.Field] = bleve.NewFacetRequest(f.Field, int(f.Limit))
	}

	// Convert resource-specific fields to bleve fields. Any field declared
	// on this index's per-kind SearchableDocumentFields lives under the
	// fields.* sub-document and must be prefixed before the bleve query.
	// Skip inputs that already carry the prefix.
	fields := make([]string, 0, len(req.Fields))
	for _, f := range req.Fields {
		if b.fields != nil && !strings.HasPrefix(f, resource.SEARCH_FIELD_PREFIX) && b.fields.Field(f) != nil {
			f = resource.SEARCH_FIELD_PREFIX + f
		}
		fields = append(fields, f)
	}

	size, err := safeInt64ToInt(req.Limit)
	if err != nil {
		return nil, resource.AsErrorResult(err)
	}
	offset, err := safeInt64ToInt(req.Offset)
	if err != nil {
		return nil, resource.AsErrorResult(err)
	}

	// On the post-filter path bleve returns an unfiltered, bounded ranked window;
	// authorization (and offset handling) happen afterward in bleveIndex.Search.
	// The first window over-fetches via windowSize and pages with SearchAfter.
	// From/offset are applied app-side (over authorized hits), so bleve starts at 0.
	reqSize := size
	reqFrom := offset
	if postRankAuthz {
		reqSize = b.postRankAuthz.windowSize(size)
		reqFrom = 0
	}

	searchrequest := &bleve.SearchRequest{
		Fields:  fields,
		Size:    reqSize,
		From:    reqFrom,
		Explain: req.Explain,
		Facets:  facets,
	}

	if len(req.SearchBefore) > 0 {
		searchrequest.SearchBefore = req.SearchBefore
		searchrequest.From = 0
	}
	if len(req.SearchAfter) > 0 {
		searchrequest.SearchAfter = req.SearchAfter
		searchrequest.From = 0
	}

	// Everything is combined within an AND query: label/field filters plus the
	// optional free-text clause.
	queries, errResult := b.filterQueries(req)
	if errResult != nil {
		return nil, errResult
	}
	if q := b.buildTextQuery(searchrequest, req); q != nil {
		queries = append(queries, q)
	}

	switch len(queries) {
	case 0:
		searchrequest.Query = bleve.NewMatchAllQuery()
	case 1:
		searchrequest.Query = queries[0]
	default:
		searchrequest.Query = bleve.NewConjunctionQuery(queries...) // AND
	}

	// postFilter applies authorization after ranking in runPostFilterAuthz, so
	// skip the in-searcher wrapper here and let bleve return unfiltered ranked hits.
	if access != nil && !postRankAuthz {
		searchrequest.Query = newPermissionScopedQuery(searchrequest.Query, permissionScopedQueryConfig{
			access:    access,
			namespace: b.key.Namespace,
			group:     b.key.Group,
			resources: b.authzResources(req),
		})
	}

	for k, v := range req.Facet {
		if searchrequest.Facets == nil {
			searchrequest.Facets = make(bleve.FacetsRequest)
		}
		searchrequest.Facets[k] = bleve.NewFacetRequest(v.Field, int(v.Limit))
	}

	// Add the sort fields
	sorting := getSortFields(req, b.fields)
	searchrequest.SortBy(sorting)

	// When no sort fields are provided, sort by score if there is a query,
	// otherwise sort by title. Always add name as the final tie-breaker so
	// offset pagination sees a total order.
	if len(sorting) == 0 {
		if req.Query != "" && req.Query != "*" {
			searchrequest.Sort = append(searchrequest.Sort, &search.SortScore{
				Desc: true,
			})
		} else {
			searchrequest.Sort = append(searchrequest.Sort, &search.SortField{
				Field: resource.SEARCH_FIELD_TITLE_PHRASE,
				Desc:  false,
			})
		}
		searchrequest.Sort = append(searchrequest.Sort, &search.SortField{
			Field: resource.SEARCH_FIELD_NAME,
			Desc:  false,
		})
	}

	if postRankAuthz {
		// Total-order tie-breaker for stable SearchAfter cursors. The doc ID
		// {namespace}/{group}/{resource}/{name} is globally unique across a
		// federated alias (dashboards + folders differ by the resource segment),
		// so this guarantees no skips/dupes over the merged result set. (For
		// non-federated queries the name tie-breaker above already gives a total
		// order; the doc ID is still harmless and keeps the cursor shape uniform
		// across federated and non-federated post-rank searches.)
		searchrequest.Sort = append(searchrequest.Sort, &search.SortDocID{})
		// The folder stored field (needed to authorize) is added to the bleve
		// load list in Search, separate from the response column list.
	}

	return searchrequest, nil
}

// filterQueries builds the label and field filter clauses (the AND terms that
// are not the free-text query) for a search request.
func (b *bleveIndex) filterQueries(req *resourcepb.ResourceSearchRequest) ([]query.Query, *resourcepb.ErrorResult) {
	queries := []query.Query{}
	if len(req.Options.Labels) > 0 {
		for _, v := range req.Options.Labels {
			q, err := requirementQuery(v, "labels.")
			if err != nil {
				return nil, err
			}
			queries = append(queries, q)
		}
	}
	if len(req.Options.Fields) > 0 {
		for _, v := range req.Options.Fields {
			// Temporarily expand a root-folder filter so it matches both the
			// legacy empty sentinel ("") and the canonical "general" UID. This
			// keeps results consistent whether the index was written before or
			// after the apistore started stamping "general" on root-parented
			// resources. Done here so every caller stays agnostic of the
			// sentinel used on disk.
			if v.Key == resource.SEARCH_FIELD_FOLDER &&
				(v.Operator == string(selection.Equals) || v.Operator == string(selection.In)) {
				expanded := false
				values := make([]string, 0, len(v.Values)+1)
				for _, val := range v.Values {
					if !foldermodel.IsRootFolderUID(val) {
						values = append(values, val)
						continue
					}
					if !expanded {
						values = append(values, "", foldermodel.GeneralFolderUID)
						expanded = true
					}
				}
				if expanded {
					v.Operator = string(selection.In)
					v.Values = values
				}
			}

			// Fields should already have correct prefix (either "fields." or "selectableFields.")
			q, err := requirementQuery(v, "")
			if err != nil {
				return nil, err
			}
			queries = append(queries, q)
		}
	}
	return queries, nil
}

// buildTextQuery builds the free-text (or wildcard) query clause from req.Query,
// returning nil when the query is too short to search. It may append
// SEARCH_FIELD_SCORE to searchrequest.Fields for free-text relevance scoring.
func (b *bleveIndex) buildTextQuery(searchrequest *bleve.SearchRequest, req *resourcepb.ResourceSearchRequest) query.Query {
	// Queries shorter than NGRAM_MIN_TOKEN can't hit the title_ngram index. Without this
	// rewrite, 1-char queries fell through to MatchAllQuery and 2-char queries usually returned
	// nothing. Treat them as a prefix wildcard ("f" → "f*") so search-as-you-type matches by
	// prefix via the existing wildcard branch. Callers that already passed a wildcard are left
	// alone.
	if q := req.Query; q != "" && len(q) < NGRAM_MIN_TOKEN && !strings.Contains(q, "*") {
		req.Query = q + "*"
	}

	if len(req.Query) <= 1 {
		return nil
	}

	disjoin := bleve.NewDisjunctionQuery()
	if strings.Contains(req.Query, "*") {
		// Wildcard query is expensive, should be used with caution.
		// When QueryFields is set, search across each named field (only Name is
		// used; Type and Boost are ignored because bleve wildcards don't support
		// analyzers or meaningful relevance scoring).
		// When QueryFields is empty, default to title + IAM identity fields
		// (email, login) for backward compatibility with older clients that
		// don't set QueryFields.
		if len(req.QueryFields) > 0 {
			for _, field := range req.QueryFields {
				addWildcardQueries(disjoin, req.Query, field.Name)
			}
		} else {
			// Default: search title and IAM identity fields (email, login).
			// IAM user search wraps queries as "*<query>*" — older clients
			// may not set QueryFields, so we include email/login here for
			// backward compatibility during the deployment gap.
			// TODO: remove email and login fields once IAM only sends requests with QueryFields.
			addWildcardQueries(disjoin, req.Query, resource.SEARCH_FIELD_TITLE)
			addWildcardQueries(disjoin, req.Query, resource.SEARCH_FIELD_PREFIX+"email")
			addWildcardQueries(disjoin, req.Query, resource.SEARCH_FIELD_PREFIX+"login")
		}
		return disjoin
	}

	// Free-text search uses explicit query fields so each title field can use the query type that matches its analyzer.
	searchrequest.Fields = append(searchrequest.Fields, resource.SEARCH_FIELD_SCORE)
	queryFields := req.QueryFields
	if len(queryFields) == 0 {
		queryFields = []*resourcepb.ResourceSearchRequest_QueryField{
			{
				Name:  resource.SEARCH_FIELD_TITLE_PHRASE,
				Type:  resourcepb.QueryFieldType_KEYWORD,
				Boost: 10, // exact title match (case-insensitive via pre-lowered title_phrase)
			}, {
				Name:  resource.SEARCH_FIELD_TITLE,
				Type:  resourcepb.QueryFieldType_TEXT,
				Boost: 2, // standard analyzer (word-level matching)
			}, {
				Name:  resource.SEARCH_FIELD_TITLE_NGRAM,
				Type:  resourcepb.QueryFieldType_TEXT,
				Boost: 1, // ngram analyzer (partial/prefix matching)
			},
		}
	}

	for _, field := range queryFields {
		switch field.Type {
		case resourcepb.QueryFieldType_TEXT, resourcepb.QueryFieldType_DEFAULT:
			q := bleve.NewMatchQuery(removeSmallTerms(req.Query)) // removeSmallTerms should be part of the analyzer
			q.SetBoost(float64(field.Boost))
			q.SetField(field.Name)
			// Match the analyzer used to index each field: the ngram field
			// must be analyzed with TITLE_ANALYZER, not the standard analyzer
			// (which splits on punctuation and drops sub-ngram-length fragments).
			if field.Name == resource.SEARCH_FIELD_TITLE_NGRAM {
				q.Analyzer = TITLE_ANALYZER
			} else {
				q.Analyzer = standard.Name
			}
			q.Operator = query.MatchQueryOperatorAnd // all terms must match
			disjoin.AddQuery(q)

		case resourcepb.QueryFieldType_KEYWORD:
			// Bleve TermQuery is an exact token lookup: it does not analyze or lowercase the query.
			q := bleve.NewTermQuery(strings.ToLower(req.Query))
			q.SetBoost(float64(field.Boost))
			q.SetField(field.Name)
			disjoin.AddQuery(q)

		case resourcepb.QueryFieldType_PHRASE:
			// Bleve phrase queries are different from our title_phrase field: they match adjacent analyzed tokens.
			q := bleve.NewMatchPhraseQuery(req.Query)
			q.SetBoost(float64(field.Boost))
			q.SetField(field.Name)
			q.Analyzer = standard.Name
			disjoin.AddQuery(q)
		}
	}
	return disjoin
}

func removeSmallTerms(query string) string {
	words := strings.Fields(query)
	validWords := make([]string, 0, len(words))

	for _, word := range words {
		if len(word) >= NGRAM_MIN_TOKEN {
			validWords = append(validWords, word)
		}
	}

	if len(validWords) == 0 {
		return query
	}

	return strings.Join(validWords, " ")
}

func (b *bleveIndex) stopUpdaterAndCloseIndex() error {
	// Signal updater to stop. We do this by 1) setting updaterShuttingDown + sending signal, and by 2) calling cancel.
	b.updaterMu.Lock()
	b.updaterShutdown = true
	b.updaterCond.Broadcast()
	// if updater is running, cancel it. (Setting to nil is only done from updater itself in defer.)
	if b.updaterCancel != nil {
		b.updaterCancel()
	}
	b.updaterMu.Unlock()

	b.updaterWg.Wait()
	// Close index only after updater is not working on it anymore.
	return b.index.Close()
}

func (b *bleveIndex) UpdateIndex(ctx context.Context) (int64, error) {
	// We don't have to do anything if the index cannot be updated (typically in tests).
	if b.updaterFn == nil {
		return 0, nil
	}

	// Use chan with buffer size 1 to ensure that we can always send the result back, even if there's no reader anymore.
	req := updateRequest{requestTime: time.Now(), callback: make(chan updateResult, 1)}

	// Make sure that the updater goroutine is running.
	b.updaterMu.Lock()
	if b.updaterShutdown {
		b.updaterMu.Unlock()
		return 0, fmt.Errorf("cannot update index: %w", bleve.ErrorIndexClosed)
	}

	b.updaterQueue = append(b.updaterQueue, req)

	// If updater is not running, start it.
	if b.updaterCancel == nil {
		b.startUpdater()
	}
	b.updaterCond.Broadcast() // If updater is waiting for next batch, wake it up.
	b.updaterMu.Unlock()

	// wait for the update to finish
	select {
	case <-ctx.Done():
		return 0, ctx.Err()
	case ur := <-req.callback:
		return ur.rv, ur.err
	}
}

// Must be called with b.updaterMu lock held.
func (b *bleveIndex) startUpdater() {
	c, cancel := context.WithCancel(context.Background())
	b.updaterCancel = cancel
	b.updaterWg.Add(1)

	go func() {
		defer func() {
			cancel() // Make sure to call this to release resources.

			b.updaterMu.Lock()
			b.updaterCancel = nil
			b.updaterMu.Unlock()

			b.updaterWg.Done()
		}()

		b.runUpdater(c)
	}()
}

const maxWait = 5 * time.Second

func (b *bleveIndex) runUpdater(ctx context.Context) {
	for {
		start := time.Now()
		t := time.AfterFunc(maxWait, b.updaterCond.Broadcast)

		b.updaterMu.Lock()
		for !b.updaterShutdown && ctx.Err() == nil && len(b.updaterQueue) == 0 && time.Since(start) < maxWait {
			// Cond is signaled when updaterShutdown changes, updaterQueue gets new element or when timeout occurs.
			b.updaterCond.Wait()
		}

		shutdown := b.updaterShutdown
		batch := b.updaterQueue
		b.updaterQueue = nil // empty the queue for the next batch
		b.updaterMu.Unlock()

		t.Stop()

		// Nothing to index after maxWait, exit the goroutine.
		if len(batch) == 0 {
			return
		}

		if shutdown {
			for _, req := range batch {
				req.callback <- updateResult{err: fmt.Errorf("cannot update index: %w", bleve.ErrorIndexClosed)}
			}
			return
		}

		// Check if requests arrived before minUpdateInterval since the last update has elapsed, and remove such requests.
		for ix := 0; ix < len(batch); {
			req := batch[ix]
			if req.requestTime.Before(b.nextUpdateTime) {
				req.callback <- updateResult{rv: b.resourceVersion.Load()}
				batch = append(batch[:ix], batch[ix+1:]...)
			} else {
				// Keep in the batch
				ix++
			}
		}

		// If all requests are now handled, don't perform update.
		if len(batch) == 0 {
			continue
		}

		// Bump next update time
		b.nextUpdateTime = time.Now().Add(b.minUpdateInterval)

		var rv int64
		var err = ctx.Err()
		if err == nil {
			rv, err = b.updateIndexWithLatestModifications(ctx, len(batch))
		}
		for _, req := range batch {
			req.callback <- updateResult{rv: rv, err: err}
		}
	}
}

func (b *bleveIndex) updateIndexWithLatestModifications(ctx context.Context, requests int) (int64, error) {
	ctx, span := tracer.Start(ctx, "search.bleveIndex.updateIndexWithLatestModifications")
	defer span.End()

	sinceRV := b.resourceVersion.Load()
	b.logger.Debug("Updating index", "sinceRV", sinceRV, "requests", requests)

	startTime := time.Now()
	listRV, docs, err := b.updaterFn(ctx, b, sinceRV)
	if err == nil && listRV > 0 && listRV != sinceRV {
		err = b.updateResourceVersion(listRV) // updates b.resourceVersion
	}

	elapsed := time.Since(startTime)
	if err == nil {
		b.logger.Debug("Finished updating index", "sinceRV", sinceRV, "listRV", listRV, "duration", elapsed, "docs", docs)

		if b.updateLatency != nil {
			b.updateLatency.Observe(elapsed.Seconds())
		}
		if b.updatedDocuments != nil {
			b.updatedDocuments.Observe(float64(docs))
		}
	} else {
		b.logger.Error("Updating of index finished with error", "duration", elapsed, "err", err)
	}
	return listRV, err
}

func safeInt64ToInt(i64 int64) (int, error) {
	if i64 > math.MaxInt32 || i64 < math.MinInt32 {
		return 0, fmt.Errorf("int64 value %d overflows int", i64)
	}
	return int(i64), nil
}

func getSortFields(req *resourcepb.ResourceSearchRequest, fields resource.SearchableDocumentFields) []string {
	if len(req.SortBy) == 0 {
		return nil
	}

	sorting := make([]string, 0, len(req.SortBy)+1)
	hasNameSort := false
	for _, sort := range req.SortBy {
		input := sort.Field
		if field, ok := textSortFields[input]; ok {
			input = field
		}

		// Per-kind sort fields live under the fields.* sub-document, prefix
		// them by consulting this index's SearchableDocumentFields. Skip
		// inputs that already carry the prefix (Field() would strip it and
		// match again, leading to a double prefix).
		if fields != nil && !strings.HasPrefix(input, resource.SEARCH_FIELD_PREFIX) && fields.Field(input) != nil {
			input = resource.SEARCH_FIELD_PREFIX + input
		}

		hasNameSort = hasNameSort || input == resource.SEARCH_FIELD_NAME
		if sort.Desc {
			input = "-" + input
		}
		sorting = append(sorting, input)
	}
	if !hasNameSort {
		sorting = append(sorting, resource.SEARCH_FIELD_NAME)
	}
	return sorting
}

// fields that we went to sort by the full text
var textSortFields = map[string]string{
	resource.SEARCH_FIELD_TITLE: resource.SEARCH_FIELD_TITLE_PHRASE,
}

const (
	lowerCase            = "phrase"
	whitespaceCharacters = " \t\r\n"
)

// exactTermQueryFields are fields where filters use Bleve TermQuery directly.
var exactTermQueryFields = []string{
	resource.SEARCH_FIELD_OWNER_REFERENCES,
	resource.SEARCH_FIELD_CREATED_BY,
	// FIXME: special case for login and email to use term query only because those fields are using keyword analyzer
	// This should be fixed by using the info from the schema
	"login",
	"email",
}

// Convert a "requirement" into a bleve query
func requirementQuery(req *resourcepb.Requirement, prefix string) (query.Query, *resourcepb.ErrorResult) {
	useExactTermQuery := slices.Contains(exactTermQueryFields, req.Key) || strings.HasPrefix(req.Key, resource.SEARCH_SELECTABLE_FIELDS_PREFIX)
	switch selection.Operator(req.Operator) {
	case selection.DoubleEquals:
		// DoubleEquals does exact matching via TermQuery (single value only).
		// For title, route to the pre-lowered title_phrase field.
		if len(req.Values) == 1 {
			key := req.Key
			value := req.Values[0]
			if key == resource.SEARCH_FIELD_TITLE {
				key = resource.SEARCH_FIELD_TITLE_PHRASE
				value = strings.ToLower(value)
			}
			return exactFieldTermQuery(key, value, prefix), nil
		}

	case selection.Equals:
		return allRequirementValuesQuery(req.Values, func(v string) query.Query {
			if useExactTermQuery {
				return exactFieldTermQuery(req.Key, v, prefix)
			}
			return fieldFilterQuery(req.Key, filterValue(req.Key, v), prefix)
		}), nil

	case selection.In:
		return anyRequirementValueQuery(req.Values, func(v string) query.Query {
			if useExactTermQuery {
				return exactFieldTermQuery(req.Key, v, prefix)
			}
			return fieldFilterQuery(req.Key, filterValue(req.Key, v), prefix)
		}), nil

	case selection.NotIn:
		boolQuery := bleve.NewBooleanQuery()

		var mustNotQueries []query.Query
		for _, value := range req.Values {
			q := fieldFilterQuery(req.Key, filterValue(req.Key, value), prefix)
			mustNotQueries = append(mustNotQueries, q)
		}
		boolQuery.AddMustNot(mustNotQueries...)

		// must still have a value
		notEmptyQuery := bleve.NewMatchAllQuery()
		boolQuery.AddMust(notEmptyQuery)

		return boolQuery, nil

	// will fall through to the BadRequestError
	case selection.NotEquals:
	case selection.DoesNotExist:
	case selection.GreaterThan:
	case selection.LessThan:
	case selection.Exists:
	}
	return nil, resource.NewBadRequestError(
		fmt.Sprintf("unsupported query operation (%s %s %v)", req.Key, req.Operator, req.Values),
	)
}

// allRequirementValuesQuery preserves selector semantics where multiple "=" values are combined with AND.
func allRequirementValuesQuery(values []string, valueQuery func(string) query.Query) query.Query {
	if len(values) == 0 {
		return query.NewMatchAllQuery()
	}
	if len(values) == 1 {
		return valueQuery(values[0])
	}

	queries := make([]query.Query, 0, len(values))
	for _, v := range values {
		queries = append(queries, valueQuery(v))
	}
	return query.NewConjunctionQuery(queries)
}

// anyRequirementValueQuery preserves selector semantics where multiple "in" values are combined with OR.
func anyRequirementValueQuery(values []string, valueQuery func(string) query.Query) query.Query {
	if len(values) == 0 {
		return query.NewMatchAllQuery()
	}
	if len(values) == 1 {
		return valueQuery(values[0])
	}

	queries := make([]query.Query, 0, len(values))
	for _, v := range values {
		queries = append(queries, valueQuery(v))
	}
	return query.NewDisjunctionQuery(queries)
}

// addWildcardQueries adds wildcard queries for the given field to the disjunction.
// When the field is "title", it adds queries for both "title" (standard-analyzed,
// matches word-level wildcards like "hell*") and "title_phrase" (keyword-analyzed,
// matches full-phrase wildcards like "*grafana dev overview*").
func addWildcardQueries(disjoin *query.DisjunctionQuery, pattern string, field string) {
	if field == resource.SEARCH_FIELD_TITLE {
		// Bleve does not analyze wildcard patterns. The title field is lowercased by the standard analyzer,
		// and title_phrase is lowercased when the document is prepared.
		pattern = strings.ToLower(pattern)
	}

	wq := bleve.NewWildcardQuery(pattern)
	wq.SetField(field)
	disjoin.AddQuery(wq)

	if field == resource.SEARCH_FIELD_TITLE {
		wPhrase := bleve.NewWildcardQuery(pattern)
		wPhrase.SetField(resource.SEARCH_FIELD_TITLE_PHRASE)
		disjoin.AddQuery(wPhrase)
	}
}

// fieldFilterQuery builds the query for one field-filter value after requirementQuery has handled the selector operator.
// It applies public field semantics, so a title filter can expand to multiple internal title fields.
func fieldFilterQuery(key string, value string, prefix string) query.Query {
	if key == resource.SEARCH_FIELD_TITLE {
		return titleFieldFilterQuery(value, prefix)
	}
	if value == "*" {
		return bleve.NewMatchAllQuery()
	}
	if strings.Contains(value, "*") {
		return fieldWildcardQuery(key, value, prefix)
	}
	return fieldMatchQuery(key, value, prefix)
}

// titleFieldFilterQuery expands the public title filter across the internal title fields.
func titleFieldFilterQuery(value string, prefix string) query.Query {
	// Title exact matching and partial matching live in separate index fields,
	// but the title filter API predates those internal fields.
	queries := []query.Query{
		exactFieldTermQuery(resource.SEARCH_FIELD_TITLE_PHRASE, strings.ToLower(value), prefix),
		titleFieldTokenQuery(value, prefix),
	}
	// Only use title_ngram for single-token title filters. Multi-word filters are handled by title_phrase/title;
	// adding title_ngram can broaden them after removeSmallTerms drops short words, for example "what\"s up" becomes "what".
	if !strings.ContainsAny(value, whitespaceCharacters) {
		queries = append(queries, titleFieldNgramQuery(value, prefix))
	}
	return bleve.NewDisjunctionQuery(queries...)
}

// titleFieldTokenQuery builds the part of title filtering that targets the standard-analyzed title field.
func titleFieldTokenQuery(value string, prefix string) query.Query {
	if value == "*" {
		return bleve.NewMatchAllQuery()
	}
	if strings.Contains(value, "*") {
		return fieldWildcardQuery(resource.SEARCH_FIELD_TITLE, value, prefix)
	}
	if delimiter, ok := firstTermSeparator(value); ok {
		return fieldAllTokensQuery(resource.SEARCH_FIELD_TITLE, strings.Split(value, delimiter), prefix)
	}
	return fieldMatchQuery(resource.SEARCH_FIELD_TITLE, value, prefix)
}

// titleFieldNgramQuery builds the partial-match part of title filtering against title_ngram.
func titleFieldNgramQuery(value string, prefix string) query.Query {
	q := bleve.NewMatchQuery(removeSmallTerms(splitTermCharacters(value)))
	q.SetField(prefix + resource.SEARCH_FIELD_TITLE_NGRAM)
	q.Analyzer = TITLE_ANALYZER
	q.Operator = query.MatchQueryOperatorAnd
	return q
}

// splitTermCharacters normalizes punctuation separators before sending a title filter value through the ngram analyzer.
func splitTermCharacters(value string) string {
	for _, c := range TermCharacters {
		value = strings.ReplaceAll(value, c, " ")
	}
	return value
}

// fieldWildcardQuery builds a wildcard query against one concrete Bleve field.
func fieldWildcardQuery(key string, value string, prefix string) query.Query {
	// wildcard query is expensive - should be used with caution
	q := bleve.NewWildcardQuery(value)
	q.SetField(prefix + key)
	return q
}

// fieldMatchQuery builds an analyzed match query against one concrete Bleve field.
func fieldMatchQuery(key string, value string, prefix string) query.Query {
	q := bleve.NewMatchQuery(value)
	q.SetField(prefix + key)
	return q
}

// exactFieldTermQuery uses Bleve TermQuery for exact token matching.
// The input must already match how the field was indexed; TermQuery does not run an analyzer.
func exactFieldTermQuery(key string, value string, prefix string) query.Query {
	// won't match with ending space
	value = strings.TrimSuffix(value, " ")

	q := bleve.NewTermQuery(value)
	q.SetField(prefix + key)
	return q
}

// fieldAllTokensQuery requires every token from a split filter value to match the same concrete Bleve field.
func fieldAllTokensQuery(key string, tokens []string, prefix string) query.Query {
	cq := bleve.NewConjunctionQuery()
	for _, token := range tokens {
		if token == "" {
			continue
		}
		_, ok := firstTermSeparator(token)
		if ok {
			tq := bleve.NewTermQuery(token)
			tq.SetField(prefix + key)
			cq.AddQuery(tq)
			continue
		}
		cq.AddQuery(fieldMatchQuery(key, token, prefix))
	}
	return cq
}

// filterValue will convert the value to lower case if the field is a phrase field
func filterValue(field string, v string) string {
	if strings.HasSuffix(field, lowerCase) {
		return strings.ToLower(v)
	}
	return v
}

// hitSortFields builds bleve SearchAfter / SearchBefore cursor values for a hit.
// hit.Sort uses sentinel placeholders (_score); bleve pagination expects decoded
// values (numeric score, doc ID, decoded field values).
func hitSortFields(hit *search.DocumentMatch, sort search.SortOrder) []string {
	if hit == nil {
		return nil
	}
	if len(sort) > 0 {
		fields := make([]string, len(sort))
		for i, ss := range sort {
			switch ss.(type) {
			case *search.SortScore:
				fields[i] = strconv.FormatFloat(hit.Score, 'f', -1, 64)
			case *search.SortDocID:
				fields[i] = hit.ID
			default:
				if i < len(hit.DecodedSort) && hit.DecodedSort[i] != "" {
					fields[i] = hit.DecodedSort[i]
				} else if i < len(hit.Sort) {
					fields[i] = hit.Sort[i]
				}
			}
		}
		return fields
	}
	if len(hit.Sort) == 0 {
		return nil
	}
	fields := make([]string, len(hit.Sort))
	for i, v := range hit.Sort {
		if v == "_score" {
			fields[i] = strconv.FormatFloat(hit.Score, 'f', -1, 64)
		} else if i < len(hit.DecodedSort) && hit.DecodedSort[i] != "" {
			fields[i] = hit.DecodedSort[i]
		} else {
			fields[i] = v
		}
	}
	return fields
}

func (b *bleveIndex) hitsToTable(ctx context.Context, selectFields []string, hits search.DocumentMatchCollection, sort search.SortOrder, explain bool) (*resourcepb.ResourceTable, error) {
	_, span := tracer.Start(ctx, "search.bleveIndex.hitsToTable")
	defer span.End()

	fields := []*resourcepb.ResourceTableColumnDefinition{}
	for _, name := range selectFields {
		if name == resource.SEARCH_FIELD_ALL_FIELDS {
			fields = b.allFields
			break
		}

		f := b.standard.Field(name)
		if f == nil && b.fields != nil {
			f = b.fields.Field(name)
		}
		if f == nil {
			// Labels as a string
			if strings.HasPrefix(name, "labels.") {
				f = &resourcepb.ResourceTableColumnDefinition{
					Name: name,
					Type: resourcepb.ResourceTableColumnDefinition_STRING,
				}
			}

			// return nil, fmt.Errorf("unknown response field: " + name)
			if f == nil {
				continue // OK for now
			}
		}
		fields = append(fields, f)
	}
	if explain {
		fields = append(fields, b.standard.Field(resource.SEARCH_FIELD_EXPLAIN))
	}

	builder, err := resource.NewTableBuilder(fields)
	if err != nil {
		return nil, err
	}
	encoders := builder.Encoders()

	table := &resourcepb.ResourceTable{
		Columns: fields,
		Rows:    make([]*resourcepb.ResourceTableRow, hits.Len()),
	}
	for rowID, match := range hits {
		row := &resourcepb.ResourceTableRow{
			Key:        &resourcepb.ResourceKey{},
			Cells:      make([][]byte, len(fields)),
			SortFields: hitSortFields(match, sort),
		}
		table.Rows[rowID] = row

		err := resource.ReadSearchID(row.Key, match.ID)
		if err != nil {
			return nil, err
		}

		for i, f := range fields {
			var v any
			switch f.Name {
			case resource.SEARCH_FIELD_ID:
				row.Cells[i] = []byte(match.ID)

			case resource.SEARCH_FIELD_SCORE:
				row.Cells[i], err = encoders[i](match.Score)

			case resource.SEARCH_FIELD_EXPLAIN:
				if match.Expl != nil {
					row.Cells[i], err = json.Marshal(match.Expl)
				}
			case resource.SEARCH_FIELD_LEGACY_ID:
				v := match.Fields[resource.SEARCH_FIELD_LABELS+"."+resource.SEARCH_FIELD_LEGACY_ID]
				if v != nil {
					str, ok := v.(string)
					if ok {
						id, _ := strconv.ParseInt(str, 10, 64)
						row.Cells[i], err = encoders[i](id)
					}
				}
			default:
				fieldName := f.Name
				// since the bleve index fields mix common and resource-specific fields, it is possible a conflict can happen
				// if a specific field is named the same as a common field
				v := match.Fields[fieldName]
				// fields that are specific to the resource get stored as fields.<fieldName>, so we need to check for that
				if v == nil {
					v = match.Fields[resource.SEARCH_FIELD_PREFIX+fieldName]
				}
				if v != nil {
					// Encode the value to protobuf
					row.Cells[i], err = encoders[i](v)
				}
			}
			if err != nil {
				return nil, fmt.Errorf("error encoding (row:%d/col:%d) %v %w", rowID, i, v, err)
			}
		}
	}

	return table, nil
}

func getAllFields(standard resource.SearchableDocumentFields, custom resource.SearchableDocumentFields) ([]*resourcepb.ResourceTableColumnDefinition, error) {
	fields := []*resourcepb.ResourceTableColumnDefinition{
		standard.Field(resource.SEARCH_FIELD_ID),
		standard.Field(resource.SEARCH_FIELD_TITLE),
		standard.Field(resource.SEARCH_FIELD_TAGS),
		standard.Field(resource.SEARCH_FIELD_FOLDER),
		standard.Field(resource.SEARCH_FIELD_RV),
		standard.Field(resource.SEARCH_FIELD_CREATED),
		standard.Field(resource.SEARCH_FIELD_LEGACY_ID),
		standard.Field(resource.SEARCH_FIELD_MANAGER_KIND),
	}

	if custom != nil {
		for _, name := range custom.Fields() {
			f := custom.Field(name)
			if f.Priority > 10 {
				continue
			}
			fields = append(fields, f)
		}
	}
	for _, field := range fields {
		if field == nil {
			return nil, fmt.Errorf("invalid all field")
		}
	}
	return fields, nil
}

func newResponseFacet(v *search.FacetResult) *resourcepb.ResourceSearchResponse_Facet {
	f := &resourcepb.ResourceSearchResponse_Facet{
		Field:   v.Field,
		Total:   int64(v.Total),
		Missing: int64(v.Missing),
	}
	if v.Terms != nil {
		for _, t := range v.Terms.Terms() {
			f.Terms = append(f.Terms, &resourcepb.ResourceSearchResponse_TermFacet{
				Term:  t.Term,
				Count: int64(t.Count),
			})
		}
	}
	return f
}

type permissionScopedQuery struct {
	query.Query
	access    authlib.AccessClient
	namespace string
	group     string
	resources map[string]string // resource -> verb mapping
	log       log.Logger
}

type permissionScopedQueryConfig struct {
	access    authlib.AccessClient
	namespace string
	group     string
	resources map[string]string // resource -> verb mapping
}

func newPermissionScopedQuery(q query.Query, cfg permissionScopedQueryConfig) *permissionScopedQuery {
	return &permissionScopedQuery{
		Query:     q,
		access:    cfg.access,
		namespace: cfg.namespace,
		group:     cfg.group,
		resources: cfg.resources,
		log:       log.New("search_permissions"),
	}
}

func (q *permissionScopedQuery) Searcher(ctx context.Context, i index.IndexReader, m mapping.IndexMapping, options search.SearcherOptions) (search.Searcher, error) {
	searcher, err := q.Query.Searcher(ctx, i, m, options)
	if err != nil {
		return nil, err
	}

	dvReader, err := i.DocValueReader([]string{"folder"})
	if err != nil {
		return nil, err
	}

	return newBatchAuthzSearcher(ctx, searcher, i, dvReader, q.access, q.namespace, q.group, q.resources, q.log.FromContext(ctx)), nil
}

// docInfo holds document information for authorization
type docInfo struct {
	doc          *search.DocumentMatch
	namespace    string
	group        string
	resourceType string
	name         string
	folder       string
	verb         string
}

// batchAuthzSearcher implements a batch-aware authorization filtering searcher
// using FilterAuthorized with iter.Pull2 for efficient batched authorization
type batchAuthzSearcher struct {
	ctx         context.Context
	searcher    search.Searcher
	indexReader index.IndexReader
	dvReader    index.DocValueReader
	access      authlib.AccessClient
	namespace   string
	group       string
	resources   map[string]string // resource -> verb mapping
	log         log.Logger

	// Traces the authz-filtered scan and records how many candidate documents
	// were considered vs. how many survived authorization. Ended in Close.
	span       trace.Span
	candidates atomic.Int64
	authorized atomic.Int64

	// Pull iterator state (lazily initialized)
	searchCtx *search.SearchContext
	next      func() (docInfo, error, bool)
	stop      func()
}

func newBatchAuthzSearcher(
	ctx context.Context,
	searcher search.Searcher,
	indexReader index.IndexReader,
	dvReader index.DocValueReader,
	access authlib.AccessClient,
	namespace string,
	group string,
	resources map[string]string,
	logger log.Logger,
) *batchAuthzSearcher {
	ctx, span := tracer.Start(ctx, "search.batchAuthzSearcher", trace.WithAttributes(
		attribute.String("namespace", namespace),
		attribute.String("group", group),
	))

	return &batchAuthzSearcher{
		ctx:         ctx,
		span:        span,
		searcher:    searcher,
		indexReader: indexReader,
		dvReader:    dvReader,
		access:      access,
		namespace:   namespace,
		group:       group,
		resources:   resources,
		log:         logger,
	}
}

func (s *batchAuthzSearcher) Next(searchCtx *search.SearchContext) (*search.DocumentMatch, error) {
	// Lazy initialization of pull iterator
	if s.next == nil {
		s.searchCtx = searchCtx
		s.initPullIterator()
	}

	info, err, ok := s.next()
	if !ok {
		return nil, nil // No more documents
	}
	if err != nil {
		return nil, err
	}
	return info.doc, nil
}

// initPullIterator sets up the FilterAuthorized iterator as a pull iterator
func (s *batchAuthzSearcher) initPullIterator() {
	var iterErr error

	candidates := func(yield func(docInfo) bool) {
		for {
			doc, err := s.searcher.Next(s.searchCtx)
			if err != nil {
				s.log.Debug("Error getting next document", "error", err)
				iterErr = err
				return
			}
			if doc == nil {
				return // No more documents
			}

			info, ok := s.parseDocInfo(doc)
			if !ok {
				continue // Skip invalid documents
			}
			s.candidates.Add(1)

			if !yield(info) {
				return
			}
		}
	}

	extractFn := func(info docInfo) authz.BatchCheckItem {
		return authz.BatchCheckItem{
			Name:      info.name,
			Folder:    info.folder,
			Verb:      info.verb,
			Group:     info.group,
			Resource:  info.resourceType,
			Namespace: info.namespace,
		}
	}

	// WithTracer makes FilterAuthorized emit a span around the batched
	// BatchCheck loop, so the authz phase is visible as a child of this
	// searcher's span instead of an opaque gap.
	authzIter := authz.FilterAuthorized(s.ctx, s.access, candidates, extractFn, authz.WithTracer(tracer))

	s.next, s.stop = iter.Pull2(func(yield func(docInfo, error) bool) {
		for item, err := range authzIter {
			if err == nil {
				s.authorized.Add(1)
			}
			if !yield(item, err) {
				return
			}
		}
		if iterErr != nil {
			var zero docInfo
			yield(zero, iterErr)
		}
	})
}

// parseDocInfo extracts document information needed for authorization
// The doc ID has the format: <namespace>/<group>/<resourceType>/<name>
// IndexInternalID will be the same as the doc ID when using an in-memory index, but when using a file-based
// index it becomes a binary encoded number that has some other internal meaning. Using ExternalID() will get the
// correct doc ID regardless of the index type.
func (s *batchAuthzSearcher) parseDocInfo(doc *search.DocumentMatch) (docInfo, bool) {
	// Get external ID
	externalID, err := s.indexReader.ExternalID(doc.IndexInternalID)
	if err != nil {
		s.log.Debug("Error getting external ID", "error", err)
		return docInfo{}, false
	}
	doc.ID = externalID

	// Parse doc ID: <namespace>/<group>/<resourceType>/<name>
	parts := strings.Split(doc.ID, "/")
	if len(parts) != 4 {
		s.log.Debug("Unexpected document ID format", "id", doc.ID)
		return docInfo{}, false
	}

	namespace := parts[0]
	group := parts[1]
	resourceType := parts[2]
	name := parts[3]

	// Get folder from doc values
	folder := ""
	err = s.dvReader.VisitDocValues(doc.IndexInternalID, func(field string, value []byte) {
		if field == "folder" {
			folder = string(value)
		}
	})
	if err != nil {
		s.log.Debug("Error reading doc values", "error", err)
		return docInfo{}, false
	}

	// Check if we have a verb for this resource type
	verb, ok := s.resources[resourceType]
	if !ok {
		s.log.Debug("No verb found for resource", "resource", resourceType)
		return docInfo{}, false
	}

	return docInfo{
		doc:          doc,
		namespace:    namespace,
		group:        group,
		resourceType: resourceType,
		name:         name,
		folder:       folder,
		verb:         verb,
	}, true
}

func (s *batchAuthzSearcher) Advance(searchCtx *search.SearchContext, ID index.IndexInternalID) (*search.DocumentMatch, error) {
	return s.searcher.Advance(searchCtx, ID)
}

func (s *batchAuthzSearcher) Close() error {
	if s.stop != nil {
		s.stop()
	}
	if s.span != nil {
		s.span.SetAttributes(
			attribute.Int64("search.candidates", s.candidates.Load()),
			attribute.Int64("search.authorized", s.authorized.Load()),
		)
		s.span.End()
	}
	return s.searcher.Close()
}

func (s *batchAuthzSearcher) Size() int {
	return s.searcher.Size()
}

func (s *batchAuthzSearcher) DocumentMatchPoolSize() int {
	return s.searcher.DocumentMatchPoolSize()
}

func (s *batchAuthzSearcher) Min() int {
	return s.searcher.Min()
}

func (s *batchAuthzSearcher) Count() uint64 {
	return s.searcher.Count()
}

func (s *batchAuthzSearcher) SetQueryNorm(qnorm float64) {
	s.searcher.SetQueryNorm(qnorm)
}

func (s *batchAuthzSearcher) Weight() float64 {
	return s.searcher.Weight()
}

// firstTermSeparator returns the first configured separator found in v.
// Title filters use the returned separator to preserve legacy token-by-token matching for values like "foo-bar".
func firstTermSeparator(v string) (string, bool) {
	for _, c := range TermCharacters {
		if strings.Contains(v, c) {
			return c, true
		}
	}
	return "", false
}

// TermCharacters characters that will be used to determine if a value is split into tokens
var TermCharacters = []string{
	" ", "-", "_", ".", ",", ":", ";", "?", "!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "+",
	"=", "{", "}", "[", "]", "|", "\\", "/", "<", ">", "~", "`",
	"'", "\"",
}

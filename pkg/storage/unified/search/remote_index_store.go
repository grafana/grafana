package search

import (
	resourcecontract "github.com/grafana/grafana/pkg/storage/unified/resource/contract"

	searchmodel "github.com/grafana/grafana/pkg/storage/unified/search/model"

	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/grafana/dskit/backoff"
	"github.com/oklog/ulid/v2"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

const (
	// snapshotManifestFile is the name of the manifest object written at the
	// root of each index snapshot prefix. It is uploaded last and serves as the
	// completion signal: its presence means the snapshot is fully uploaded.
	// Named with a grafana- prefix to avoid confusion with Bleve's own
	// index_meta.json that lives alongside it inside the snapshot.
	snapshotManifestFile = "grafana-index-snapshot.json"
	// maxSnapshotManifestSize is the maximum allowed size for a snapshot
	// manifest file (1 MiB).
	maxSnapshotManifestSize = 1 << 20
)

const (
	snapshotStoreOpUploadFile                       = "upload_file"
	snapshotStoreOpUploadManifest                   = "upload_manifest"
	snapshotStoreOpDownloadFile                     = "download_file"
	snapshotStoreOpReadManifest                     = "read_manifest"
	snapshotStoreOpListIndexKeys                    = "list_index_keys"
	snapshotStoreOpListIndexKeysIncludingIncomplete = "list_index_keys_including_incomplete"
	snapshotStoreOpListNamespaces                   = "list_namespaces"
	snapshotStoreOpListNamespaceResources           = "list_namespace_resources"
	snapshotStoreOpDeleteIndex                      = "delete_index"
)

// snapshotStoreRetryBackoffConfig covers the per-file transfers, which only retry
// on transient errors (see isRetryableSnapshotStoreError). Up to 10s each. Files
// are fetched one after another, so a snapshot whose every file keeps failing costs
// this once per file.
var snapshotStoreRetryBackoffConfig = backoff.Config{
	MinBackoff: 100 * time.Millisecond,
	MaxBackoff: 4 * time.Second,
	// dskit/backoff counts retries after the initial attempt, so this is seven tries.
	MaxRetries: 6,
}

// snapshotStoreMetadataRetryBackoffConfig covers listing and manifest reads, which
// run a few times per download rather than once per file. Failing them leaves no
// candidate and the caller builds from scratch, which costs far more than waiting,
// so these get about 30s against 10s for a file.
var snapshotStoreMetadataRetryBackoffConfig = backoff.Config{
	MinBackoff: 200 * time.Millisecond,
	MaxBackoff: 5 * time.Second,
	MaxRetries: 10,
}

// remoteIndexStoreRetryLogger is used only when callers do not have a contextual logger to pass in.
var remoteIndexStoreRetryLogger = log.New("remote-index-store-retry")

// errLockHeld means another owner has the lock, so a caller waiting for a leader
// keeps waiting.
var errLockHeld = errors.New("lock is held by another owner")

// ErrNonRegularFile is returned when a non-regular file (symlink, pipe, socket, device) is found during index upload.
var ErrNonRegularFile = errors.New("non-regular file found in index directory")

// ErrSnapshotNotFound is returned when the snapshot manifest for the given
// index key does not exist (e.g. the snapshot was deleted, or the upload is
// still in progress and the manifest hasn't been written yet).
var ErrSnapshotNotFound = errors.New("snapshot not found")

// ErrInvalidManifest is returned when the snapshot manifest exists but is
// structurally invalid (oversized, unparseable, empty file list, or
// non-canonical paths). Distinct from ErrSnapshotNotFound (manifest absent)
// and from transient download errors.
var ErrInvalidManifest = errors.New("invalid manifest")

// IndexMeta contains metadata about a remote index snapshot.
type IndexMeta struct {
	// BuildVersion is the version of Grafana that built this index.
	BuildVersion string `json:"build_version"`
	// UploadTimestamp is when the snapshot was uploaded.
	UploadTimestamp time.Time `json:"upload_timestamp"`
	// BuildTime is when the bleve index was originally created (start of
	// the from-scratch build that produced it). Persisted across periodic
	// re-uploads of the same index, so it always describes the underlying
	// data, not the most recent upload.
	//
	// Zero-value means "unknown"; readers must not treat it as a freshness
	// signal.
	BuildTime time.Time `json:"build_time,omitempty"`
	// IndexFormat identifies the Bleve segment format that wrote this snapshot
	// (for example, "zap/16"). Empty on legacy snapshots means "unknown, assume compatible".
	IndexFormat string `json:"index_format,omitempty"`
	// Features are the index features the snapshot was built with, letting selection
	// skip a snapshot missing a feature this instance requires instead of finding out
	// after downloading it. Only meaningful when FeaturesRecorded is set.
	Features []searchmodel.IndexFeature `json:"features,omitempty"`
	// FeaturesRecorded distinguishes "no features" from "not recorded", which the
	// Features field alone cannot. False for a snapshot uploaded before this field
	// existed, and for one whose index predates index features.
	FeaturesRecorded bool `json:"features_recorded,omitempty"`
	// ReaderRequirements are the features an instance must understand before using
	// this snapshot. Selection skips a snapshot declaring one it does not recognise.
	// Empty on snapshots uploaded before this field existed.
	ReaderRequirements []searchmodel.IndexFeature `json:"reader_requirements,omitempty"`
	// LatestResourceVersion is the latest resource version included in the index.
	LatestResourceVersion int64 `json:"latest_resource_version"`
	// DocCount is the number of documents in the index at upload time. Recorded
	// for debugging and troubleshooting only; there is no reader that relies on
	// it. Zero-value means "unknown" (legacy snapshot uploaded before this field
	// was added).
	DocCount uint64 `json:"doc_count,omitempty"`
	// Files maps relative file paths to their sizes in bytes.
	Files map[string]int64 `json:"files"`
}

// IndexStoreLock represents a distributed lock used to coordinate index store operations.
type IndexStoreLock interface {
	// Release stops renewing the lock and attempts to delete the lock object.
	// After Lost is signaled, Release is best-effort cleanup; a nil return does
	// not mean this caller retained ownership until release.
	Release() error
	Lost() <-chan struct{}
}

// RemoteIndexStore manages index snapshots on remote storage.
//
// Index keys are immutable ULIDs generated by the caller (typically UploadIndexSnapshot).
// The interface is intentionally small: high-level operations like uploading
// a directory or downloading a snapshot live as package-level helpers
// (UploadIndexSnapshot, DownloadIndexSnapshot, ReadIndexSnapshotManifest, ListIndexSnapshots,
// CleanupIncompleteIndexSnapshots) that drive the interface via the per-file
// primitives below. Backends implement only what genuinely differs
// between storage shapes.
type RemoteIndexStore interface {
	// LockBuildIndex acquires a distributed build/upload lock for namespace/group/resource.
	// buildVersion scopes contention to replicas running the same exact Grafana version.
	// When another replica holds the lock, the returned error must match errLockHeld:
	// build coordination relies on that to keep waiting instead of building alone.
	LockBuildIndex(ctx context.Context, nsResource resourcecontract.NamespacedResource, buildVersion string) (IndexStoreLock, error)

	// LockNamespaceForCleanup acquires a distributed cleanup lock for a namespace.
	// Uses a different lock key than LockBuildIndex so cleanup never blocks an
	// in-flight upload for any resource in the namespace.
	// When another replica holds the lock, the returned error must match errLockHeld.
	LockNamespaceForCleanup(ctx context.Context, namespace string) (IndexStoreLock, error)

	// WriteSnapshotFile writes one data file at relPath under the snapshot
	// identified by (nsResource, indexKey). Backends that need the file size
	// (e.g. to plan chunked writes) can obtain it via src.Stat(). The
	// manifest is not written through this method — use
	// WriteSnapshotManifest, whose presence is the completion signal.
	WriteSnapshotFile(ctx context.Context, nsResource resourcecontract.NamespacedResource, indexKey ulid.ULID, relPath string, src *os.File) error

	// ReadSnapshotFile streams the contents of one data file in the snapshot
	// at (nsResource, indexKey) into dst. expectedSize is the size declared
	// in the manifest; backends must fail if the stored object exceeds it,
	// so a misadvertised or grown-out-of-band object cannot transfer
	// unbounded data to disk. Returns ErrSnapshotNotFound if the snapshot
	// or file does not exist.
	ReadSnapshotFile(ctx context.Context, nsResource resourcecontract.NamespacedResource, indexKey ulid.ULID, relPath string, dst *os.File, expectedSize int64) error

	// WriteSnapshotManifest writes the snapshot manifest for
	// (nsResource, indexKey). It is written last during upload and serves as
	// the completion signal: a snapshot is considered complete once its
	// manifest exists. The well-known filename used for storage is a backend
	// detail and callers never name it.
	WriteSnapshotManifest(ctx context.Context, nsResource resourcecontract.NamespacedResource, indexKey ulid.ULID, manifest []byte) error

	// ReadSnapshotManifest returns the raw manifest bytes for
	// (nsResource, indexKey). Returns ErrSnapshotNotFound if the manifest
	// does not exist, or an error wrapping ErrInvalidManifest if the stored
	// manifest exceeds the backend's enforced size cap.
	ReadSnapshotManifest(ctx context.Context, nsResource resourcecontract.NamespacedResource, indexKey ulid.ULID) ([]byte, error)

	// ListNamespaces returns the namespaces currently known to the store.
	ListNamespaces(ctx context.Context) ([]string, error)

	// ListNamespaceResources returns the resources currently known under the
	// given namespace. It does not list the snapshots themselves; callers
	// follow up with ListIndexKeys (or the ListIndexSnapshots helper) for each
	// returned NamespacedResource.
	ListNamespaceResources(ctx context.Context, namespace string) ([]resourcecontract.NamespacedResource, error)

	// ListIndexKeys returns the ULID keys of all index snapshots known
	// under nsResource. Implementations may include or exclude incomplete
	// uploads (data files written without a manifest) based on what is
	// cheap on the backend; callers that need to confirm a particular key
	// is backed by a valid manifest follow up with ReadIndexSnapshotManifest.
	// Callers that must see incomplete uploads — notably
	// CleanupIncompleteIndexSnapshots — use ListIndexKeysIncludingIncomplete
	// instead. Ordering is unspecified.
	ListIndexKeys(ctx context.Context, nsResource resourcecontract.NamespacedResource) ([]ulid.ULID, error)

	// ListIndexKeysIncludingIncomplete is like ListIndexKeys but is
	// required to include incomplete uploads (snapshots that have data
	// files on storage but no manifest). May be more expensive than
	// ListIndexKeys on backends that must scan extra storage to detect
	// partial uploads. Ordering is unspecified.
	ListIndexKeysIncludingIncomplete(ctx context.Context, nsResource resourcecontract.NamespacedResource) ([]ulid.ULID, error)

	// DeleteIndex deletes all files for an index snapshot.
	DeleteIndex(ctx context.Context, nsResource resourcecontract.NamespacedResource, indexKey ulid.ULID) error
}

// LockOptions controls the timing and shutdown behaviour of a lock created by
// a RemoteIndexStore. Zero values fall back to the store's defaults.
type LockOptions struct {
	TTL                  time.Duration
	ReleaseDeleteTimeout time.Duration
}

func retryRemoteIndexStore(ctx context.Context, operation string, logger log.Logger, fn func() error) error {
	_, err := retryRemoteIndexStoreValue(ctx, operation, logger, func() (struct{}, error) {
		return struct{}{}, fn()
	})
	return err
}

func retryRemoteIndexStoreValue[T any](ctx context.Context, operation string, logger log.Logger, fn func() (T, error)) (T, error) {
	return retryRemoteIndexStoreValueWithBackoff(ctx, snapshotStoreRetryBackoffConfig, operation, logger, fn)
}

// retryMetadataRemoteIndexStoreValue retries with the longer metadata budget.
func retryMetadataRemoteIndexStoreValue[T any](ctx context.Context, operation string, logger log.Logger, fn func() (T, error)) (T, error) {
	return retryRemoteIndexStoreValueWithBackoff(ctx, snapshotStoreMetadataRetryBackoffConfig, operation, logger, fn)
}

func retryRemoteIndexStoreValueWithBackoff[T any](ctx context.Context, cfg backoff.Config, operation string, logger log.Logger, fn func() (T, error)) (T, error) {
	if logger == nil {
		logger = remoteIndexStoreRetryLogger
	}

	bo := backoff.New(ctx, cfg)
	for {
		result, err := fn()
		if err == nil || !isRetryableSnapshotStoreError(ctx, err) {
			return result, err
		}
		if !bo.Ongoing() {
			return result, err
		}

		logger.Warn("remote index store operation failed; retrying", "operation", operation, "attempt", bo.NumRetries()+1, "err", err)
		bo.Wait()
		if ctxErr := ctx.Err(); ctxErr != nil {
			var zero T
			return zero, ctxErr
		}
	}
}

func isRetryableSnapshotStoreError(ctx context.Context, err error) bool {
	if err == nil || ctx.Err() != nil {
		return false
	}
	if errors.Is(err, ErrSnapshotNotFound) || errors.Is(err, ErrInvalidManifest) || errors.Is(err, resource.ErrWriteLimitExceeded) {
		return false
	}

	// kv.ErrRetryable marks transient errors from KV backends (e.g. gRPC
	// status codes, retryable filesystem errors) wrapped by KVRemoteIndexStore.
	if errors.Is(err, kv.ErrRetryable) {
		return true
	}

	var timeoutErr interface{ Timeout() bool }
	if errors.As(err, &timeoutErr) && timeoutErr.Timeout() {
		return true
	}
	var temporaryErr interface{ Temporary() bool }
	if errors.As(err, &temporaryErr) && temporaryErr.Temporary() {
		return true
	}
	return errors.Is(err, io.ErrUnexpectedEOF)
}

func versionLockSegment(buildVersion string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(buildVersion))
}

// UploadIndexSnapshot uploads a local directory as a new index snapshot. It generates
// a fresh ULID, walks localDir, writes each regular file via
// store.WriteSnapshotFile, and finally writes the JSON-encoded snapshot
// manifest (whose presence is the completion signal). On any error before
// the manifest is written, the partial upload is cleaned up via
// store.DeleteIndex; CleanupIncompleteIndexSnapshots is the fallback.
//
// Caller should hold a build lock (store.LockBuildIndex) so multiple
// Grafana instances don't redundantly build and upload the same index.
// Uploads themselves don't conflict — each one generates a unique ULID
// — but the lock avoids wasted CPU and store writes. logger is used to
// warn if the partial-upload cleanup itself fails; the caller's logger
// context (namespace, resource, etc.) is preserved on those logs.
func UploadIndexSnapshot(ctx context.Context, store RemoteIndexStore, nsResource resourcecontract.NamespacedResource, localDir string, meta IndexMeta, logger log.Logger) (_ ulid.ULID, retErr error) {
	indexKey, err := ulid.New(ulid.Timestamp(time.Now()), rand.Reader)
	if err != nil {
		return ulid.ULID{}, fmt.Errorf("generating index key: %w", err)
	}
	meta.UploadTimestamp = ulid.Time(indexKey.Time())

	absLocalDir, err := filepath.Abs(localDir)
	if err != nil {
		return ulid.ULID{}, fmt.Errorf("resolving local dir: %w", err)
	}

	localRoot, err := os.OpenRoot(absLocalDir)
	if err != nil {
		return ulid.ULID{}, fmt.Errorf("opening local index dir: %w", err)
	}
	defer func() { _ = localRoot.Close() }()

	meta.Files = make(map[string]int64)
	var relPaths []string
	err = fs.WalkDir(localRoot.FS(), ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		if !d.Type().IsRegular() {
			return fmt.Errorf("%w: %s (mode: %s)", ErrNonRegularFile, path, d.Type())
		}
		// Skip the snapshot manifest — we generate our own and uploading a
		// pre-existing one would cause a size mismatch on round-trip.
		if d.Name() == snapshotManifestFile {
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return err
		}
		// fs.WalkDir yields paths that are root-relative, forward-slash, and
		// canonical (without leading "./" or ".." segments), per the fs.FS contract.
		// That's the format the manifest's Files keys require, so we can store
		// the path as-is.
		meta.Files[path] = info.Size()
		relPaths = append(relPaths, path)
		return nil
	})
	if err != nil {
		return ulid.ULID{}, fmt.Errorf("walking local dir: %w", err)
	}
	if len(relPaths) == 0 {
		return ulid.ULID{}, fmt.Errorf("no files to upload in %s", localDir)
	}

	// On any failure before the manifest is written, drop the partial
	// upload. Uses a cancel-detached context because the parent context may
	// already be cancelled by the time we get here.
	defer func() {
		if retErr != nil {
			cleanupCtx := context.WithoutCancel(ctx)
			if delErr := retryRemoteIndexStore(cleanupCtx, snapshotStoreOpDeleteIndex, logger, func() error {
				return store.DeleteIndex(cleanupCtx, nsResource, indexKey)
			}); delErr != nil {
				logger.Warn("failed to clean up partial upload", "key", indexKey.String(), "err", delErr)
			}
		}
	}()

	// Stream each file via WriteSnapshotFile.
	for _, rel := range relPaths {
		if err := uploadSnapshotFileFromDisk(ctx, store, nsResource, indexKey, rel, localRoot, logger); err != nil {
			return ulid.ULID{}, fmt.Errorf("uploading %s: %w", rel, err)
		}
	}

	// Write the manifest last — its presence is the completion signal.
	metaBytes, err := json.Marshal(meta)
	if err != nil {
		return ulid.ULID{}, fmt.Errorf("marshaling snapshot manifest: %w", err)
	}
	if err := retryRemoteIndexStore(ctx, snapshotStoreOpUploadManifest, logger, func() error {
		return store.WriteSnapshotManifest(ctx, nsResource, indexKey, metaBytes)
	}); err != nil {
		return ulid.ULID{}, fmt.Errorf("uploading snapshot manifest: %w", err)
	}

	return indexKey, nil
}

func uploadSnapshotFileFromDisk(ctx context.Context, store RemoteIndexStore, ns resourcecontract.NamespacedResource, indexKey ulid.ULID, relSlash string, root *os.Root, logger log.Logger) error {
	return retryRemoteIndexStore(ctx, snapshotStoreOpUploadFile, logger, func() error {
		f, err := root.Open(filepath.FromSlash(relSlash))
		if err != nil {
			return err
		}
		defer func() { _ = f.Close() }()
		return store.WriteSnapshotFile(ctx, ns, indexKey, relSlash, f)
	})
}

// DownloadIndexSnapshot downloads an existing snapshot to destDir, which must not
// exist. Streams files into a staging directory and atomic-renames into
// destDir on success; cleans up the staging directory on error.
func DownloadIndexSnapshot(ctx context.Context, store RemoteIndexStore, nsResource resourcecontract.NamespacedResource, indexKey ulid.ULID, destDir string) (*IndexMeta, error) {
	meta, err := ReadIndexSnapshotManifest(ctx, store, nsResource, indexKey)
	if err != nil {
		return nil, err
	}

	// Fail if destDir already exists.
	absDest, err := filepath.Abs(destDir)
	if err != nil {
		return nil, fmt.Errorf("resolving dest dir: %w", err)
	}
	if _, err := os.Stat(absDest); err == nil {
		return nil, fmt.Errorf("destination already exists: %s", absDest)
	} else if !os.IsNotExist(err) {
		return nil, fmt.Errorf("checking destination: %w", err)
	}

	// Stage into a temp dir, then atomic-rename to destDir on success.
	if err := os.MkdirAll(filepath.Dir(absDest), 0750); err != nil {
		return nil, fmt.Errorf("creating parent dir: %w", err)
	}
	tmpDir, err := os.MkdirTemp(filepath.Dir(absDest), ".dl-*")
	if err != nil {
		return nil, fmt.Errorf("creating staging dir: %w", err)
	}
	defer func() {
		if tmpDir != "" {
			_ = os.RemoveAll(tmpDir)
		}
	}()

	stagingRoot, err := os.OpenRoot(tmpDir)
	if err != nil {
		return nil, fmt.Errorf("opening staging dir: %w", err)
	}
	defer func() { _ = stagingRoot.Close() }()

	for relPath, expectedSize := range meta.Files {
		relLocal := filepath.FromSlash(relPath)
		if dir := filepath.Dir(relLocal); dir != "." {
			if err := stagingRoot.MkdirAll(dir, 0750); err != nil {
				return nil, fmt.Errorf("creating directory for %s: %w", relPath, err)
			}
		}
		if err := downloadSnapshotFileToDisk(ctx, store, nsResource, indexKey, relPath, stagingRoot, expectedSize); err != nil {
			return nil, fmt.Errorf("downloading %s: %w", relPath, err)
		}
		// Validate against what was actually written. This catches both
		// short reads (the store returned fewer bytes than advertised) and
		// any cap discrepancy.
		info, err := stagingRoot.Stat(relLocal)
		if err != nil {
			return nil, fmt.Errorf("stat downloaded %s: %w", relPath, err)
		}
		if info.Size() != expectedSize {
			return nil, fmt.Errorf("size mismatch for %s: expected %d, got %d", relPath, expectedSize, info.Size())
		}
	}

	// Atomically move the staging dir to the final destination.
	if err := os.Rename(tmpDir, absDest); err != nil {
		return nil, fmt.Errorf("moving staged download to destination: %w", err)
	}
	tmpDir = "" // prevent deferred cleanup of the now-renamed directory
	return meta, nil
}

// downloadSnapshotFileToDisk creates relPath under root and streams the remote
// object into it. The size cap is the backend's responsibility (it gets
// expectedSize and must refuse to transfer more than that). The post-write
// Stat check in DownloadIndexSnapshot still verifies the final on-disk size
// as belt-and-braces.
func downloadSnapshotFileToDisk(ctx context.Context, store RemoteIndexStore, ns resourcecontract.NamespacedResource, indexKey ulid.ULID, relPath string, root *os.Root, expectedSize int64) error {
	return retryRemoteIndexStore(ctx, snapshotStoreOpDownloadFile, nil, func() error {
		f, err := root.Create(filepath.FromSlash(relPath))
		if err != nil {
			return err
		}
		if err := store.ReadSnapshotFile(ctx, ns, indexKey, relPath, f, expectedSize); err != nil {
			_ = f.Close()
			return err
		}
		return f.Close()
	})
}

// ReadIndexSnapshotManifest reads and validates the snapshot manifest for a single index.
// Returns ErrSnapshotNotFound if the manifest does not exist, or an error
// wrapping ErrInvalidManifest if the manifest is structurally invalid
// (oversized, unparseable, empty file list, or non-canonical paths).
func ReadIndexSnapshotManifest(ctx context.Context, store RemoteIndexStore, nsResource resourcecontract.NamespacedResource, indexKey ulid.ULID) (*IndexMeta, error) {
	manifest, err := retryMetadataRemoteIndexStoreValue(ctx, snapshotStoreOpReadManifest, nil, func() ([]byte, error) {
		return store.ReadSnapshotManifest(ctx, nsResource, indexKey)
	})
	if err != nil {
		if errors.Is(err, ErrSnapshotNotFound) || errors.Is(err, ErrInvalidManifest) {
			return nil, err
		}
		return nil, fmt.Errorf("reading snapshot manifest: %w", err)
	}
	var meta IndexMeta
	if err := json.Unmarshal(manifest, &meta); err != nil {
		return nil, fmt.Errorf("%w: parsing snapshot manifest: %v", ErrInvalidManifest, err)
	}
	if err := ValidateIndexSnapshotManifest(&meta); err != nil {
		return nil, err
	}
	return &meta, nil
}

// ValidateIndexSnapshotManifest checks the structural invariants of an IndexMeta as a
// snapshot manifest: non-empty file list, paths canonical and not escaping
// the snapshot prefix. Returns an error wrapping ErrInvalidManifest on
// failure.
func ValidateIndexSnapshotManifest(meta *IndexMeta) error {
	if len(meta.Files) == 0 {
		return fmt.Errorf("%w: empty file manifest", ErrInvalidManifest)
	}
	for relPath := range meta.Files {
		clean := filepath.ToSlash(filepath.Clean(filepath.FromSlash(relPath)))
		if clean != relPath {
			return fmt.Errorf("%w: non-canonical path %q (canonical: %q)", ErrInvalidManifest, relPath, clean)
		}
		if clean == "." || clean == ".." || filepath.IsAbs(clean) || strings.HasPrefix(clean, "../") {
			return fmt.Errorf("%w: invalid path %q", ErrInvalidManifest, relPath)
		}
	}
	return nil
}

// ListIndexSnapshots returns the manifest for every complete snapshot under
// nsResource. Snapshots whose manifest is missing or invalid are skipped;
// invalid manifests are logged at warn level on logger, missing manifests
// (in-progress uploads, or a concurrent cleanup pass deleting a snapshot
// between the key listing and the manifest read) are silent.
//
// Note: snapshots may be deleted between listing and subsequent operations
// (e.g. by a concurrent cleanup pass); callers acting on the returned
// snapshots must handle ErrSnapshotNotFound from follow-up calls.
func ListIndexSnapshots(ctx context.Context, store RemoteIndexStore, nsResource resourcecontract.NamespacedResource, logger log.Logger) (map[ulid.ULID]*IndexMeta, error) {
	keys, err := retryMetadataRemoteIndexStoreValue(ctx, snapshotStoreOpListIndexKeys, logger, func() ([]ulid.ULID, error) {
		return store.ListIndexKeys(ctx, nsResource)
	})
	if err != nil {
		return nil, fmt.Errorf("listing index keys: %w", err)
	}
	result := make(map[ulid.ULID]*IndexMeta, len(keys))
	for _, key := range keys {
		meta, err := ReadIndexSnapshotManifest(ctx, store, nsResource, key)
		if err != nil {
			// ErrSnapshotNotFound is the normal in-progress-upload case
			// (data files written, manifest not yet) and a race with
			// concurrent cleanup. Both are expected and silent. Other
			// errors (invalid manifest, transient read failures) are
			// logged but don't fail the whole listing — one bad snapshot
			// must not block selection or cleanup of the rest.
			if !errors.Is(err, ErrSnapshotNotFound) {
				logger.Warn("skipping index snapshot due to manifest read error", "key", key.String(), "err", err)
			}
			continue
		}
		result[key] = meta
	}
	return result, nil
}

// CleanupIncompleteIndexSnapshots deletes snapshot prefixes whose manifest
// is missing or invalid and whose key (a ULID) is older than olderThan.
// Returns the number of prefixes deleted. Each cleanup event is logged on
// logger.
//
// Taking olderThan as a wall-clock time rather than a duration relative to
// now keeps the function free of an internal time.Now() call and lets
// tests pin the cutoff explicitly.
//
// Caller should hold a namespace-level cleanup lock
// (store.LockNamespaceForCleanup) to avoid concurrent cleanup by different
// instances.
func CleanupIncompleteIndexSnapshots(ctx context.Context, store RemoteIndexStore, nsResource resourcecontract.NamespacedResource, olderThan time.Time, logger log.Logger) (int, error) {
	keys, err := retryRemoteIndexStoreValue(ctx, snapshotStoreOpListIndexKeysIncludingIncomplete, logger, func() ([]ulid.ULID, error) {
		return store.ListIndexKeysIncludingIncomplete(ctx, nsResource)
	})
	if err != nil {
		return 0, fmt.Errorf("listing index keys: %w", err)
	}
	cleaned := 0
	for _, key := range keys {
		// Skip recent prefixes that may still be uploading.
		if ulid.Time(key.Time()).After(olderThan) {
			continue
		}
		_, err := ReadIndexSnapshotManifest(ctx, store, nsResource, key)
		switch {
		case err == nil:
			continue // valid manifest, prefix is complete
		case errors.Is(err, ErrSnapshotNotFound), errors.Is(err, ErrInvalidManifest):
			// fall through to delete
		default:
			// Transient error. Defer to next pass.
			logger.Warn("skipping prefix due to manifest read error", "key", key.String(), "err", err)
			continue
		}
		logger.Info("cleaning up incomplete upload", "key", key.String())
		if err := retryRemoteIndexStore(ctx, snapshotStoreOpDeleteIndex, logger, func() error {
			return store.DeleteIndex(ctx, nsResource, key)
		}); err != nil {
			return cleaned, fmt.Errorf("deleting %s: %w", key, err)
		}
		cleaned++
	}
	return cleaned, nil
}

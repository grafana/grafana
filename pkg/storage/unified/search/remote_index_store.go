package search

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/oklog/ulid/v2"
	"gocloud.dev/blob"
	"gocloud.dev/gcerrors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
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
	// GrafanaBuildVersion is the version of Grafana that built this index.
	GrafanaBuildVersion string `json:"grafana_build_version"`
	// UploadTimestamp is when the snapshot was uploaded.
	UploadTimestamp time.Time `json:"upload_timestamp"`
	// LatestResourceVersion is the latest resource version included in the index.
	LatestResourceVersion int64 `json:"latest_resource_version"`
	// Files maps relative file paths to their sizes in bytes.
	Files map[string]int64 `json:"files"`
}

// IndexStoreLock represents a distributed lock used to coordinate index store operations.
type IndexStoreLock interface {
	Release() error
	Lost() <-chan struct{}
}

// RemoteIndexStore manages index snapshots on remote storage.
// Index keys are immutable: each snapshot uses a unique ULID key.
type RemoteIndexStore interface {
	// LockBuildIndex acquires a distributed build lock for namespace/group/resource.
	LockBuildIndex(ctx context.Context, nsResource resource.NamespacedResource) (IndexStoreLock, error)

	// LockNamespaceForCleanup acquires a distributed cleanup lock for a namespace.
	// Uses a different lock key than LockBuildIndex so cleanup never blocks an
	// in-flight upload for any resource in the namespace.
	LockNamespaceForCleanup(ctx context.Context, namespace string) (IndexStoreLock, error)

	// UploadIndex uploads a local index directory to remote storage.
	// It generates a unique, lexicographically sortable ULID key and returns it.
	// Caller should hold LockBuildIndex to avoid concurrent build and upload of the index.
	UploadIndex(ctx context.Context, nsResource resource.NamespacedResource, localDir string, meta IndexMeta) (ulid.ULID, error)

	// DownloadIndex downloads a remote index to a local directory.
	// destDir must not exist; it will be created atomically on success.
	DownloadIndex(ctx context.Context, nsResource resource.NamespacedResource, indexKey ulid.ULID, destDir string) (*IndexMeta, error)

	// ListNamespaces returns the namespaces currently known to the store.
	ListNamespaces(ctx context.Context) ([]string, error)

	// ListNamespaceIndexes returns the resources currently known under the given
	// namespace. It does not list the snapshots themselves; callers follow up
	// with ListIndexes for each returned NamespacedResource.
	ListNamespaceIndexes(ctx context.Context, namespace string) ([]resource.NamespacedResource, error)

	// ListIndexes lists all complete index snapshots for a namespaced resource.
	// Note: indexes may be deleted between listing and subsequent operations.
	ListIndexes(ctx context.Context, nsResource resource.NamespacedResource) (map[ulid.ULID]*IndexMeta, error)

	// ListIndexKeys returns the ULID keys of all index snapshots under the
	// given namespaced resource. The returned list may include incomplete
	// uploads (snapshots whose manifest has not yet been written); callers
	// that need to distinguish complete from incomplete snapshots should
	// follow up with GetIndexMeta. Ordering is unspecified.
	ListIndexKeys(ctx context.Context, nsResource resource.NamespacedResource) ([]ulid.ULID, error)

	// GetIndexMeta returns the manifest for a single index snapshot. It
	// returns ErrSnapshotNotFound if no manifest exists for the given key,
	// or an error wrapping ErrInvalidManifest if the manifest exists but is
	// structurally invalid (oversized, unparseable, empty file list, or
	// non-canonical paths).
	GetIndexMeta(ctx context.Context, nsResource resource.NamespacedResource, indexKey ulid.ULID) (*IndexMeta, error)

	// DeleteIndex deletes all files for an index snapshot.
	DeleteIndex(ctx context.Context, nsResource resource.NamespacedResource, indexKey ulid.ULID) error

	// CleanupIncompleteUploads removes incomplete uploads older than minAge.
	// Returns the number of cleaned prefixes.
	// Caller should hold a namespace-level cleanup lock to avoid concurrent cleanup by different instances.
	CleanupIncompleteUploads(ctx context.Context, nsResource resource.NamespacedResource, minAge time.Duration) (int, error)
}

// LockOptions controls the timing and shutdown behaviour of an
// objectStorageLock created by BucketRemoteIndexStore. Zero values fall back
// to the defaults documented in objectStorageLockConfig.
type LockOptions struct {
	TTL                    time.Duration
	HeartbeatInterval      time.Duration
	HeartbeatUpdateTimeout time.Duration
	ReleaseDeleteTimeout   time.Duration
}

// BucketRemoteIndexStoreConfig configures NewBucketRemoteIndexStore. Build and
// cleanup locks have separate option blocks so they can diverge: build locks
// are per-snapshot and benefit from a tight shutdown budget, while cleanup
// locks run on a 6h cadence and can tolerate longer waits.
type BucketRemoteIndexStoreConfig struct {
	Bucket      resource.CDKBucket
	LockBackend lockBackend
	LockOwner   string
	BuildLock   LockOptions
	CleanupLock LockOptions
}

// BucketRemoteIndexStore implements RemoteIndexStore using a CDKBucket.
//
// Object storage layout:
//
//	/<namespace>/<resource>.<group>/<index-key>/index_meta.json   <- Bleve's own metadata, part of the index
//	/<namespace>/<resource>.<group>/<index-key>/store/root.bolt
//	/<namespace>/<resource>.<group>/<index-key>/store/*.zap
//	/<namespace>/<resource>.<group>/<index-key>/grafana-index-snapshot.json  <- uploaded last, signals complete upload
//
// grafana-index-snapshot.json is uploaded last during upload and deleted first
// during delete, serving as the completion signal.
type BucketRemoteIndexStore struct {
	bucket          resource.CDKBucket
	lockBackend     lockBackend
	lockOwner       string
	buildLockOpts   LockOptions
	cleanupLockOpts LockOptions
	log             log.Logger
}

// NewBucketRemoteIndexStore creates a new RemoteIndexStore backed by the given bucket.
func NewBucketRemoteIndexStore(cfg BucketRemoteIndexStoreConfig) *BucketRemoteIndexStore {
	return &BucketRemoteIndexStore{
		bucket:          cfg.Bucket,
		lockBackend:     cfg.LockBackend,
		lockOwner:       cfg.LockOwner,
		buildLockOpts:   cfg.BuildLock,
		cleanupLockOpts: cfg.CleanupLock,
		log:             log.New("bucket-remote-index-store"),
	}
}

// indexPrefix returns the object storage prefix for a namespaced resource + index key.
func indexPrefix(ns resource.NamespacedResource, indexKey string) string {
	return fmt.Sprintf("%s/%s/", resourceSubPath(ns), indexKey)
}

// nsPrefix returns the object storage prefix for a namespaced resource (without index key).
func nsPrefix(ns resource.NamespacedResource) string {
	return fmt.Sprintf("%s/", resourceSubPath(ns))
}

func buildIndexLockKey(ns resource.NamespacedResource) string {
	return fmt.Sprintf("%s/locks/build", resourceSubPath(ns))
}

// cleanupLockKey returns the object-storage lock key used to serialise cleanup
// passes within a namespace. It is intentionally distinct from
// buildIndexLockKey so cleanup never blocks ongoing uploads.
func cleanupLockKey(namespace string) string {
	return fmt.Sprintf("%s/locks/cleanup", cleanFileSegment(namespace))
}

func (s *BucketRemoteIndexStore) LockBuildIndex(ctx context.Context, nsResource resource.NamespacedResource) (IndexStoreLock, error) {
	l, err := newObjectStorageLock(s.lockConfig(buildIndexLockKey(nsResource), s.buildLockOpts))
	if err != nil {
		return nil, fmt.Errorf("creating build lock: %w", err)
	}
	if err := l.Acquire(ctx); err != nil {
		return nil, err
	}
	return l, nil
}

func (s *BucketRemoteIndexStore) LockNamespaceForCleanup(ctx context.Context, namespace string) (IndexStoreLock, error) {
	l, err := newObjectStorageLock(s.lockConfig(cleanupLockKey(namespace), s.cleanupLockOpts))
	if err != nil {
		return nil, fmt.Errorf("creating cleanup lock: %w", err)
	}
	if err := l.Acquire(ctx); err != nil {
		return nil, err
	}
	return l, nil
}

// lockConfig folds a LockOptions block into the shared per-store backend/owner
// fields. Zero-valued LockOptions fields are passed through to
// newObjectStorageLock, which applies its own defaults.
func (s *BucketRemoteIndexStore) lockConfig(key string, opts LockOptions) objectStorageLockConfig {
	return objectStorageLockConfig{
		Backend:                s.lockBackend,
		Key:                    key,
		Owner:                  s.lockOwner,
		TTL:                    opts.TTL,
		HeartbeatInterval:      opts.HeartbeatInterval,
		HeartbeatUpdateTimeout: opts.HeartbeatUpdateTimeout,
		ReleaseDeleteTimeout:   opts.ReleaseDeleteTimeout,
	}
}

func (s *BucketRemoteIndexStore) UploadIndex(ctx context.Context, nsResource resource.NamespacedResource, localDir string, meta IndexMeta) (_ ulid.ULID, retErr error) {
	indexKey, err := ulid.New(ulid.Timestamp(time.Now()), rand.Reader)
	if err != nil {
		return ulid.ULID{}, fmt.Errorf("generating index key: %w", err)
	}
	pfx := indexPrefix(nsResource, indexKey.String())
	meta.UploadTimestamp = ulid.Time(indexKey.Time())

	absLocalDir, err := filepath.Abs(localDir)
	if err != nil {
		return ulid.ULID{}, fmt.Errorf("resolving local dir: %w", err)
	}

	meta.Files = make(map[string]int64)
	var relPaths []string
	err = filepath.WalkDir(absLocalDir, func(path string, d fs.DirEntry, err error) error {
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
		rel, err := filepath.Rel(absLocalDir, path)
		if err != nil {
			return err
		}
		info, err := d.Info()
		if err != nil {
			return err
		}
		meta.Files[filepath.ToSlash(rel)] = info.Size()
		relPaths = append(relPaths, rel)
		return nil
	})
	if err != nil {
		return ulid.ULID{}, fmt.Errorf("walking local dir: %w", err)
	}
	if len(relPaths) == 0 {
		return ulid.ULID{}, fmt.Errorf("no files to upload in %s", localDir)
	}

	// Best-effort cleanup of all objects under the prefix on failure.
	defer func() {
		if retErr != nil {
			s.cleanupPrefix(context.WithoutCancel(ctx), pfx)
		}
	}()

	// Upload each file using streaming.
	for _, rel := range relPaths {
		objectKey := pfx + filepath.ToSlash(rel)
		if err := s.uploadFile(ctx, objectKey, filepath.Join(absLocalDir, rel)); err != nil {
			return ulid.ULID{}, fmt.Errorf("uploading %s: %w", rel, err)
		}
	}

	// Upload the snapshot manifest last — its presence signals a complete upload.
	metaBytes, err := json.Marshal(meta)
	if err != nil {
		return ulid.ULID{}, fmt.Errorf("marshaling snapshot manifest: %w", err)
	}
	if err := s.bucket.WriteAll(ctx, pfx+snapshotManifestFile, metaBytes, nil); err != nil {
		return ulid.ULID{}, fmt.Errorf("uploading snapshot manifest: %w", err)
	}

	return indexKey, nil
}

// cleanupPrefix performs best-effort deletion of all objects under the given prefix.
// Errors are logged but not returned, since this runs during error recovery.
func (s *BucketRemoteIndexStore) cleanupPrefix(ctx context.Context, pfx string) {
	iter := s.bucket.List(&blob.ListOptions{Prefix: pfx})
	for {
		obj, err := iter.Next(ctx)
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			s.log.Warn("failed to list objects for cleanup", "prefix", pfx, "err", err)
			return
		}
		if err := s.bucket.Delete(ctx, obj.Key); err != nil {
			s.log.Warn("failed to clean up partially uploaded object", "key", obj.Key, "err", err)
		}
	}
}

func (s *BucketRemoteIndexStore) uploadFile(ctx context.Context, objectKey, localPath string) error {
	f, err := os.Open(localPath) //nolint:gosec // path is under the server-controlled bleve index directory
	if err != nil {
		return err
	}
	defer func() { _ = f.Close() }()

	return s.bucket.Upload(ctx, objectKey, f, &blob.WriterOptions{
		ContentType: "application/octet-stream",
	})
}

func (s *BucketRemoteIndexStore) DownloadIndex(ctx context.Context, nsResource resource.NamespacedResource, indexKey ulid.ULID, destDir string) (_ *IndexMeta, retErr error) {
	pfx := indexPrefix(nsResource, indexKey.String())

	meta, err := s.GetIndexMeta(ctx, nsResource, indexKey)
	if err != nil {
		return nil, err
	}

	// fail if destDir already exist
	absDest, err := filepath.Abs(destDir)
	if err != nil {
		return nil, fmt.Errorf("resolving dest dir: %w", err)
	}
	if _, err := os.Stat(absDest); err == nil {
		return nil, fmt.Errorf("destination already exists: %s", absDest)
	} else if !os.IsNotExist(err) {
		return nil, fmt.Errorf("checking destination: %w", err)
	}

	// Download into a staging dir, then rename to absDest
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

	for relPath, expectedSize := range meta.Files {
		objectKey := pfx + relPath
		localPath := filepath.Join(tmpDir, filepath.FromSlash(relPath))

		if err := os.MkdirAll(filepath.Dir(localPath), 0750); err != nil {
			return nil, fmt.Errorf("creating directory for %s: %w", relPath, err)
		}
		if err := s.downloadFile(ctx, objectKey, localPath, expectedSize); err != nil {
			return nil, fmt.Errorf("downloading %s: %w", relPath, err)
		}

		// Validate size against what was actually written.
		info, err := os.Stat(localPath)
		if err != nil {
			return nil, fmt.Errorf("stat downloaded %s: %w", relPath, err)
		}
		if info.Size() != expectedSize {
			return nil, fmt.Errorf("size mismatch for %s: expected %d, got %d", relPath, expectedSize, info.Size())
		}
	}

	// Atomically move staging dir to final destination.
	if err := os.Rename(tmpDir, absDest); err != nil {
		return nil, fmt.Errorf("moving staged download to destination: %w", err)
	}
	tmpDir = "" // prevent deferred cleanup of the now-renamed directory

	return meta, nil
}

// validateManifestPaths rejects manifest entries that are not already in canonical form.
func validateManifestPaths(files map[string]int64) error {
	for relPath := range files {
		clean := filepath.ToSlash(filepath.Clean(filepath.FromSlash(relPath)))
		if clean != relPath {
			return fmt.Errorf("non-canonical path %q (canonical: %q)", relPath, clean)
		}
		if clean == "." || clean == ".." || filepath.IsAbs(clean) || strings.HasPrefix(clean, "../") {
			return fmt.Errorf("invalid path %q", relPath)
		}
	}
	return nil
}

// downloadFile creates localPath and streams the remote object into it,
// capping the transfer at expectedSize+1 bytes so a misadvertised manifest
// size or a bucket object that's grown out of band fails fast before we
// transfer unbounded data. The snapshot manifest uses the same pattern.
func (s *BucketRemoteIndexStore) downloadFile(ctx context.Context, objectKey, localPath string, expectedSize int64) error {
	f, err := os.Create(localPath) //nolint:gosec // path is under a Grafana-controlled staging directory
	if err != nil {
		return err
	}

	lw := &resource.LimitedWriter{W: f, N: expectedSize + 1}
	if err := s.bucket.Download(ctx, objectKey, lw, nil); err != nil {
		_ = f.Close()
		if errors.Is(err, resource.ErrWriteLimitExceeded) {
			return fmt.Errorf("remote object exceeds expected size %d: %w", expectedSize, err)
		}
		return err
	}
	return f.Close()
}

// ListIndexKeys lists the ULID-keyed snapshot subdirectories under the
// namespaced-resource prefix using a delimited list, without reading any
// manifest bodies. Non-ULID subdirectories (e.g. the sibling `locks/` prefix)
// are skipped silently.
func (s *BucketRemoteIndexStore) ListIndexKeys(ctx context.Context, nsResource resource.NamespacedResource) ([]ulid.ULID, error) {
	pfx := nsPrefix(nsResource)
	iter := s.bucket.List(&blob.ListOptions{Prefix: pfx, Delimiter: "/"})
	var keys []ulid.ULID
	for {
		obj, err := iter.Next(ctx)
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("listing index keys: %w", err)
		}
		if !obj.IsDir {
			continue
		}
		rel := strings.TrimSuffix(strings.TrimPrefix(obj.Key, pfx), "/")
		key, err := ulid.Parse(rel)
		if err != nil {
			continue // skip non-ULID subdirs (e.g. /locks)
		}
		keys = append(keys, key)
	}
	return keys, nil
}

// GetIndexMeta fetches and validates the manifest for a single snapshot.
// Returns ErrSnapshotNotFound if the manifest is missing (incomplete upload
// or already deleted).
func (s *BucketRemoteIndexStore) GetIndexMeta(ctx context.Context, nsResource resource.NamespacedResource, indexKey ulid.ULID) (*IndexMeta, error) {
	manifestKey := indexPrefix(nsResource, indexKey.String()) + snapshotManifestFile
	var buf bytes.Buffer
	if err := s.bucket.Download(ctx, manifestKey, &resource.LimitedWriter{W: &buf, N: maxSnapshotManifestSize}, nil); err != nil {
		if gcerrors.Code(err) == gcerrors.NotFound {
			return nil, ErrSnapshotNotFound
		}
		if errors.Is(err, resource.ErrWriteLimitExceeded) {
			return nil, fmt.Errorf("%w: oversized snapshot manifest: %v", ErrInvalidManifest, err)
		}
		return nil, fmt.Errorf("reading snapshot manifest: %w", err)
	}
	var meta IndexMeta
	if err := json.Unmarshal(buf.Bytes(), &meta); err != nil {
		return nil, fmt.Errorf("%w: parsing snapshot manifest: %v", ErrInvalidManifest, err)
	}
	if len(meta.Files) == 0 {
		return nil, fmt.Errorf("%w: empty file manifest for index %q", ErrInvalidManifest, indexKey)
	}
	if err := validateManifestPaths(meta.Files); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidManifest, err)
	}
	return &meta, nil
}

func (s *BucketRemoteIndexStore) ListIndexes(ctx context.Context, nsResource resource.NamespacedResource) (map[ulid.ULID]*IndexMeta, error) {
	nsPfx := nsPrefix(nsResource)
	result := make(map[ulid.ULID]*IndexMeta)

	// List all objects under the namespace prefix, looking for snapshot manifest files
	iter := s.bucket.List(&blob.ListOptions{Prefix: nsPfx})
	for {
		obj, err := iter.Next(ctx)
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("failed to list objects: %w", err)
		}

		// We only care about snapshot manifest files
		if !strings.HasSuffix(obj.Key, "/"+snapshotManifestFile) {
			continue
		}

		// Extract index key from: <nsPfx><indexKey>/<snapshotManifestFile>
		rel := strings.TrimPrefix(obj.Key, nsPfx)
		keyStr := strings.TrimSuffix(rel, "/"+snapshotManifestFile)
		if keyStr == "" || strings.Contains(keyStr, "/") {
			continue // skip nested or malformed paths
		}
		indexKey, err := ulid.Parse(keyStr)
		if err != nil {
			s.log.Warn("skipping index snapshot with non-ULID key", "key", keyStr, "err", err)
			continue
		}

		meta, err := s.GetIndexMeta(ctx, nsResource, indexKey)
		if err != nil {
			s.log.Warn("skipping index snapshot with invalid manifest", "key", obj.Key, "err", err)
			continue
		}
		result[indexKey] = meta
	}

	return result, nil
}

// ListNamespaces returns the namespaces currently known to the store.
func (s *BucketRemoteIndexStore) ListNamespaces(ctx context.Context) ([]string, error) {
	iter := s.bucket.List(&blob.ListOptions{Delimiter: "/"})
	var namespaces []string
	for {
		obj, err := iter.Next(ctx)
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("listing namespaces: %w", err)
		}
		if !obj.IsDir {
			continue
		}
		ns := strings.TrimSuffix(obj.Key, "/")
		if ns == "" {
			continue
		}
		namespaces = append(namespaces, ns)
	}
	return namespaces, nil
}

// ListNamespaceIndexes returns the resources currently known under the given
// namespace.
func (s *BucketRemoteIndexStore) ListNamespaceIndexes(ctx context.Context, namespace string) ([]resource.NamespacedResource, error) {
	pfx := cleanFileSegment(namespace) + "/"
	iter := s.bucket.List(&blob.ListOptions{Prefix: pfx, Delimiter: "/"})
	var resources []resource.NamespacedResource
	for {
		obj, err := iter.Next(ctx)
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("listing namespace indexes: %w", err)
		}
		if !obj.IsDir {
			continue
		}
		rel := strings.TrimSuffix(strings.TrimPrefix(obj.Key, pfx), "/")
		// `<resource>.<group>` — split on the first dot only; group may contain
		// further dots (e.g. `dashboard.grafana.app`). Anything without a dot
		// (e.g. the `locks` sibling) is not a resource directory.
		dot := strings.Index(rel, ".")
		if dot <= 0 || dot == len(rel)-1 {
			continue
		}
		resources = append(resources, resource.NamespacedResource{
			Namespace: namespace,
			Resource:  rel[:dot],
			Group:     rel[dot+1:],
		})
	}
	return resources, nil
}

func (s *BucketRemoteIndexStore) DeleteIndex(ctx context.Context, nsResource resource.NamespacedResource, indexKey ulid.ULID) error {
	pfx := indexPrefix(nsResource, indexKey.String())

	// Delete the snapshot manifest first
	if err := s.bucket.Delete(ctx, pfx+snapshotManifestFile); err != nil && gcerrors.Code(err) != gcerrors.NotFound {
		return fmt.Errorf("failed to delete snapshot manifest: %w", err)
	}

	// List all objects under this prefix and delete them
	iter := s.bucket.List(&blob.ListOptions{Prefix: pfx})
	for {
		obj, err := iter.Next(ctx)
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return fmt.Errorf("failed to list objects for deletion: %w", err)
		}
		if err := s.bucket.Delete(ctx, obj.Key); err != nil {
			return fmt.Errorf("failed to delete %s: %w", obj.Key, err)
		}
	}

	return nil
}

func (s *BucketRemoteIndexStore) CleanupIncompleteUploads(ctx context.Context, nsResource resource.NamespacedResource, minAge time.Duration) (int, error) {
	nsPfx := nsPrefix(nsResource)

	// First pass: collect all keys grouped by index prefix, recording the
	// snapshot manifest key if present.
	type prefixInfo struct {
		keys    []string
		metaKey string // empty = no snapshot manifest seen
	}
	prefixes := make(map[string]*prefixInfo)

	iter := s.bucket.List(&blob.ListOptions{Prefix: nsPfx})
	for {
		obj, err := iter.Next(ctx)
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return 0, fmt.Errorf("listing objects: %w", err)
		}

		rel := strings.TrimPrefix(obj.Key, nsPfx)
		slashIdx := strings.Index(rel, "/")
		if slashIdx < 0 {
			continue
		}
		keyStr := rel[:slashIdx]
		parsedKey, err := ulid.Parse(keyStr)
		if err != nil {
			continue // skip non-ULID prefixes
		}
		// Skip recent prefixes that may still be uploading.
		if time.Since(ulid.Time(parsedKey.Time())) < minAge {
			continue
		}

		info := prefixes[keyStr]
		if info == nil {
			info = &prefixInfo{}
			prefixes[keyStr] = info
		}
		info.keys = append(info.keys, obj.Key)
		if strings.HasSuffix(obj.Key, "/"+snapshotManifestFile) {
			info.metaKey = obj.Key
		}
	}

	// Second pass: delete incomplete prefixes.
	// A prefix is incomplete if it has no snapshot manifest, or if the manifest
	// is positively known to be invalid (unparseable or empty file list).
	cleaned := 0
	for keyStr, info := range prefixes {
		if info.metaKey != "" {
			// keyStr was produced by ulid.Parse on the way in, so re-parsing
			// here is infallible.
			indexKey, err := ulid.Parse(keyStr)
			if err != nil {
				continue
			}
			_, err = s.GetIndexMeta(ctx, nsResource, indexKey)
			switch {
			case err == nil:
				continue // valid manifest, prefix is complete
			case errors.Is(err, ErrInvalidManifest):
				// fall through to delete
			default:
				// Transient error or ErrSnapshotNotFound (manifest deleted
				// between list and read — race; defer to next pass).
				s.log.Warn("skipping prefix due to manifest read error", "key", keyStr, "err", err)
				continue
			}
		}
		s.log.Info("cleaning up incomplete upload", "key", keyStr, "objects", len(info.keys))
		for _, key := range info.keys {
			if err := s.bucket.Delete(ctx, key); err != nil && gcerrors.Code(err) != gcerrors.NotFound {
				return cleaned, fmt.Errorf("deleting %s: %w", key, err)
			}
		}
		cleaned++
	}

	return cleaned, nil
}


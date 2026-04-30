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
	metaJSONFile = "meta.json"
	// maxMetaJSONSize is the maximum allowed size for a meta.json file (1 MiB).
	maxMetaJSONSize = 1 << 20
)

// ErrNonRegularFile is returned when a non-regular file (symlink, pipe, socket, device) is found during index upload.
var ErrNonRegularFile = errors.New("non-regular file found in index directory")

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

	// DeleteIndex deletes all files for an index snapshot.
	DeleteIndex(ctx context.Context, nsResource resource.NamespacedResource, indexKey ulid.ULID) error

	// CleanupIncompleteUploads removes incomplete uploads older than minAge.
	// Returns the number of cleaned prefixes.
	// Caller should hold a namespace-level cleanup lock to avoid concurrent cleanup by different instances.
	CleanupIncompleteUploads(ctx context.Context, nsResource resource.NamespacedResource, minAge time.Duration) (int, error)
}

// BucketRemoteIndexStore implements RemoteIndexStore using a CDKBucket.
//
// Object storage layout:
//
//	/<namespace>/<resource>.<group>/<index-key>/index_meta.json
//	/<namespace>/<resource>.<group>/<index-key>/store/root.bolt
//	/<namespace>/<resource>.<group>/<index-key>/store/*.zap
//	/<namespace>/<resource>.<group>/<index-key>/meta.json  <- uploaded last, signals complete upload
//
// meta.json is uploaded last during upload and deleted first during delete,
// serving as the completion signal.
type BucketRemoteIndexStore struct {
	bucket                resource.CDKBucket
	lockBackend           lockBackend
	lockOwner             string
	lockTTL               time.Duration
	lockHeartbeatInterval time.Duration
	log                   log.Logger
}

// NewBucketRemoteIndexStore creates a new RemoteIndexStore backed by the given bucket.
func NewBucketRemoteIndexStore(bucket resource.CDKBucket, lockBackend lockBackend, lockOwner string, lockTTL, lockHeartbeatInterval time.Duration) *BucketRemoteIndexStore {
	return &BucketRemoteIndexStore{
		bucket:                bucket,
		lockBackend:           lockBackend,
		lockOwner:             lockOwner,
		lockTTL:               lockTTL,
		lockHeartbeatInterval: lockHeartbeatInterval,
		log:                   log.New("bucket-remote-index-store"),
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
	l, err := newObjectStorageLock(objectStorageLockConfig{
		Backend:           s.lockBackend,
		Key:               buildIndexLockKey(nsResource),
		Owner:             s.lockOwner,
		TTL:               s.lockTTL,
		HeartbeatInterval: s.lockHeartbeatInterval,
	})
	if err != nil {
		return nil, fmt.Errorf("creating build lock: %w", err)
	}
	if err := l.Acquire(ctx); err != nil {
		return nil, err
	}
	return l, nil
}

func (s *BucketRemoteIndexStore) LockNamespaceForCleanup(ctx context.Context, namespace string) (IndexStoreLock, error) {
	l, err := newObjectStorageLock(objectStorageLockConfig{
		Backend:           s.lockBackend,
		Key:               cleanupLockKey(namespace),
		Owner:             s.lockOwner,
		TTL:               s.lockTTL,
		HeartbeatInterval: s.lockHeartbeatInterval,
	})
	if err != nil {
		return nil, fmt.Errorf("creating cleanup lock: %w", err)
	}
	if err := l.Acquire(ctx); err != nil {
		return nil, err
	}
	return l, nil
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
		// Skip meta.json — we generate our own manifest and uploading a pre-existing
		// one would cause a size mismatch on round-trip.
		if d.Name() == metaJSONFile {
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

	// Upload meta.json last — its presence signals a complete upload.
	metaBytes, err := json.Marshal(meta)
	if err != nil {
		return ulid.ULID{}, fmt.Errorf("marshaling meta: %w", err)
	}
	if err := s.bucket.WriteAll(ctx, pfx+metaJSONFile, metaBytes, nil); err != nil {
		return ulid.ULID{}, fmt.Errorf("uploading meta.json: %w", err)
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

	// Download and parse meta.json with a size limit to avoid OOM on malicious files.
	var metaBuf bytes.Buffer
	if err := s.bucket.Download(ctx, pfx+metaJSONFile, &resource.LimitedWriter{W: &metaBuf, N: maxMetaJSONSize}, nil); err != nil {
		return nil, fmt.Errorf("reading meta.json: %w", err)
	}
	var meta IndexMeta
	if err := json.Unmarshal(metaBuf.Bytes(), &meta); err != nil {
		return nil, fmt.Errorf("parsing meta.json: %w", err)
	}
	if len(meta.Files) == 0 {
		return nil, fmt.Errorf("meta.json has empty file manifest for index %q", indexKey)
	}
	if err := validateManifestPaths(meta.Files); err != nil {
		return nil, fmt.Errorf("invalid manifest: %w", err)
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
		if err := s.downloadFile(ctx, objectKey, localPath); err != nil {
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

	return &meta, nil
}

// validateManifestPaths rejects manifest entries that are not already in canonical form.
func validateManifestPaths(files map[string]int64) error {
	for relPath := range files {
		clean := filepath.ToSlash(filepath.Clean(filepath.FromSlash(relPath)))
		if clean != relPath {
			return fmt.Errorf("non-canonical path %q (canonical: %q)", relPath, clean)
		}
		if clean == "." || filepath.IsAbs(clean) || strings.HasPrefix(clean, "..") {
			return fmt.Errorf("invalid path %q", relPath)
		}
	}
	return nil
}

// downloadFile creates localPath and streams the remote object into it.
func (s *BucketRemoteIndexStore) downloadFile(ctx context.Context, objectKey, localPath string) error {
	f, err := os.Create(localPath) //nolint:gosec // path is under a Grafana-controlled staging directory
	if err != nil {
		return err
	}

	if err := s.bucket.Download(ctx, objectKey, f, nil); err != nil {
		_ = f.Close()
		return err
	}
	return f.Close()
}

func (s *BucketRemoteIndexStore) ListIndexes(ctx context.Context, nsResource resource.NamespacedResource) (map[ulid.ULID]*IndexMeta, error) {
	nsPfx := nsPrefix(nsResource)
	result := make(map[ulid.ULID]*IndexMeta)

	// List all objects under the namespace prefix, looking for meta.json files
	iter := s.bucket.List(&blob.ListOptions{Prefix: nsPfx})
	for {
		obj, err := iter.Next(ctx)
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("failed to list objects: %w", err)
		}

		// We only care about meta.json files
		if !strings.HasSuffix(obj.Key, "/"+metaJSONFile) {
			continue
		}

		// Extract index key from: <nsPfx><indexKey>/meta.json
		rel := strings.TrimPrefix(obj.Key, nsPfx)
		keyStr := strings.TrimSuffix(rel, "/"+metaJSONFile)
		if keyStr == "" || strings.Contains(keyStr, "/") {
			continue // skip nested or malformed paths
		}
		indexKey, err := ulid.Parse(keyStr)
		if err != nil {
			s.log.Warn("skipping index with non-ULID key", "key", keyStr, "err", err)
			continue
		}

		// Fetch and parse meta.json with a size limit.
		var metaBuf bytes.Buffer
		if err := s.bucket.Download(ctx, obj.Key, &resource.LimitedWriter{W: &metaBuf, N: maxMetaJSONSize}, nil); err != nil {
			s.log.Error("failed to read meta.json", "key", obj.Key, "err", err)
			continue
		}
		var meta IndexMeta
		if err := json.Unmarshal(metaBuf.Bytes(), &meta); err != nil {
			s.log.Error("failed to parse meta.json", "key", obj.Key, "err", err)
			continue
		}
		if len(meta.Files) == 0 || validateManifestPaths(meta.Files) != nil {
			s.log.Warn("skipping index with invalid manifest", "key", obj.Key)
			continue
		}
		result[indexKey] = &meta
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

	// Delete meta.json first
	if err := s.bucket.Delete(ctx, pfx+metaJSONFile); err != nil && gcerrors.Code(err) != gcerrors.NotFound {
		return fmt.Errorf("failed to delete meta.json: %w", err)
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

	// First pass: collect all keys grouped by index prefix, recording the meta.json key if present.
	type prefixInfo struct {
		keys    []string
		metaKey string // empty = no meta.json seen
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
		if strings.HasSuffix(obj.Key, "/"+metaJSONFile) {
			info.metaKey = obj.Key
		}
	}

	// Second pass: delete incomplete prefixes.
	// A prefix is incomplete if it has no meta.json, or if the meta.json is
	// positively known to be invalid (unparseable or empty file manifest).
	cleaned := 0
	for keyStr, info := range prefixes {
		if info.metaKey != "" {
			valid, err := s.isValidManifest(ctx, info.metaKey)
			if err != nil {
				s.log.Warn("skipping prefix due to manifest read error", "key", keyStr, "err", err)
				continue
			}
			if valid {
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

// isValidManifest downloads and parses a meta.json object with a size limit.
// Returns (true, nil) for a valid manifest, (false, nil) for a positively
// invalid one (oversized, corrupt JSON, or empty Files), and (false, err) for
// transient download errors.
func (s *BucketRemoteIndexStore) isValidManifest(ctx context.Context, metaKey string) (bool, error) {
	var buf bytes.Buffer
	if err := s.bucket.Download(ctx, metaKey, &resource.LimitedWriter{W: &buf, N: maxMetaJSONSize}, nil); err != nil {
		if errors.Is(err, resource.ErrWriteLimitExceeded) {
			return false, nil // positively invalid: oversized
		}
		return false, err // transient download error, skip this prefix
	}
	var meta IndexMeta
	if err := json.Unmarshal(buf.Bytes(), &meta); err != nil {
		return false, nil // positively invalid
	}
	if len(meta.Files) == 0 || validateManifestPaths(meta.Files) != nil {
		return false, nil
	}
	return true, nil
}

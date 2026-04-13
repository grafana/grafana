package search

import (
	"context"
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

const metaJSONFile = "meta.json"

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

// RemoteIndexStore manages index snapshots on remote object storage.
//
// Callers must hold a distributed lock to prevent interleaved writes.
// Index keys are immutable and each snapshot must use a unique key.
//
// Object storage layout:
//
//	/<namespace>/<group>.<resource>/<index-key>/store/root.bolt
//	/<namespace>/<group>.<resource>/<index-key>/*.zap
//	/<namespace>/<group>.<resource>/<index-key>/meta.json  <- uploaded last, signals complete upload
type RemoteIndexStore interface {
	// UploadIndex uploads a local index directory to remote storage.
	// It generates a unique, lexicographically sortable ULID key and returns it.
	// The meta.json is uploaded last to signal a complete upload.
	// Callers must hold a distributed lock to prevent concurrent uploads to the same prefix.
	UploadIndex(ctx context.Context, nsResource resource.NamespacedResource, localDir string, meta IndexMeta) (ulid.ULID, error)

	// DownloadIndex downloads a remote index to a local directory.
	// Validates completeness against the manifest in meta.json.
	DownloadIndex(ctx context.Context, nsResource resource.NamespacedResource, indexKey ulid.ULID, destDir string) (*IndexMeta, error)

	// ListIndexes lists all complete index snapshots for a namespaced resource.
	// Note: indexes may be deleted between listing and subsequent operations.
	// Callers should handle NotFound errors gracefully when acting on listed keys.
	ListIndexes(ctx context.Context, nsResource resource.NamespacedResource) (map[ulid.ULID]*IndexMeta, error)

	// DeleteIndex deletes all files for an index snapshot.
	// The meta.json is deleted first to signal it an incomplete index.
	// Callers must hold a distributed lock to prevent concurrent modifications.
	DeleteIndex(ctx context.Context, nsResource resource.NamespacedResource, indexKey ulid.ULID) error

	// CleanupIncompleteUploads removes index prefixes that have files but no meta.json,
	// indicating a failed or interrupted upload. Returns the number of cleaned prefixes.
	CleanupIncompleteUploads(ctx context.Context, nsResource resource.NamespacedResource) (int, error)
}

// remoteIndexStore implements RemoteIndexStore using a CDKBucket.
type remoteIndexStore struct {
	bucket resource.CDKBucket
	log    log.Logger
}

// NewRemoteIndexStore creates a new RemoteIndexStore backed by the given bucket.
func NewRemoteIndexStore(bucket resource.CDKBucket) RemoteIndexStore {
	return &remoteIndexStore{
		bucket: bucket,
		log:    log.New("remote-index-store"),
	}
}

// indexPrefix returns the object storage prefix for a namespaced resource + index key.
func indexPrefix(ns resource.NamespacedResource, indexKey string) string {
	return fmt.Sprintf("%s/%s.%s/%s/", ns.Namespace, ns.Group, ns.Resource, indexKey)
}

// nsPrefix returns the object storage prefix for a namespaced resource (without index key).
func nsPrefix(ns resource.NamespacedResource) string {
	return fmt.Sprintf("%s/%s.%s/", ns.Namespace, ns.Group, ns.Resource)
}

func (s *remoteIndexStore) UploadIndex(ctx context.Context, nsResource resource.NamespacedResource, localDir string, meta IndexMeta) (_ ulid.ULID, retErr error) {
	indexKey := ulid.Make()
	pfx := indexPrefix(nsResource, indexKey.String())
	meta.UploadTimestamp = ulid.Time(indexKey.Time())

	absLocalDir, err := filepath.Abs(localDir)
	if err != nil {
		return ulid.ULID{}, fmt.Errorf("resolving local dir: %w", err)
	}
	// Resolve symlinks so WalkDir enters the real directory.
	absLocalDir, err = filepath.EvalSymlinks(absLocalDir)
	if err != nil {
		return ulid.ULID{}, fmt.Errorf("resolving local dir symlinks: %w", err)
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

	// Best-effort cleanup of uploaded objects on failure.
	var uploaded []string
	defer func() {
		if retErr != nil {
			s.cleanupObjects(context.WithoutCancel(ctx), uploaded)
		}
	}()

	// Upload each file using streaming.
	for _, rel := range relPaths {
		objectKey := pfx + filepath.ToSlash(rel)
		if err := s.uploadFile(ctx, objectKey, filepath.Join(absLocalDir, rel)); err != nil {
			return ulid.ULID{}, fmt.Errorf("uploading %s: %w", rel, err)
		}
		uploaded = append(uploaded, objectKey)
	}

	// Upload meta.json last — its presence signals a complete upload.
	// Add it to uploaded first so deferred cleanup covers the case where
	// WriteAll fails ambiguously (object committed but response error).
	metaBytes, err := json.Marshal(meta)
	if err != nil {
		return ulid.ULID{}, fmt.Errorf("marshaling meta: %w", err)
	}
	metaKey := pfx + metaJSONFile
	uploaded = append(uploaded, metaKey)
	if err := s.bucket.WriteAll(ctx, metaKey, metaBytes, nil); err != nil {
		return ulid.ULID{}, fmt.Errorf("uploading meta.json: %w", err)
	}

	return indexKey, nil
}

// cleanupObjects performs best-effort deletion of the given object keys.
// Errors are logged but not returned, since this runs during error recovery.
func (s *remoteIndexStore) cleanupObjects(ctx context.Context, keys []string) {
	for _, key := range keys {
		if err := s.bucket.Delete(ctx, key); err != nil {
			s.log.Warn("failed to clean up partially uploaded object", "key", key, "err", err)
		}
	}
}

func (s *remoteIndexStore) uploadFile(ctx context.Context, objectKey, localPath string) error {
	// Lstat the path first — reject symlinks before opening.
	linfo, err := os.Lstat(localPath)
	if err != nil {
		return err
	}
	if !linfo.Mode().IsRegular() {
		return fmt.Errorf("not a regular file (mode %s): %s", linfo.Mode().Type(), localPath)
	}

	f, err := os.Open(localPath) //nolint:gosec // path validated by Lstat+SameFile above
	if err != nil {
		return err
	}
	defer func() { _ = f.Close() }()

	// Verify the opened fd matches the file we lstat'd by comparing device+inode.
	// This detects a swap to symlink between the Lstat and Open calls.
	finfo, err := f.Stat()
	if err != nil {
		return fmt.Errorf("stat after open: %w", err)
	}
	if !os.SameFile(linfo, finfo) {
		return fmt.Errorf("file changed between check and open (possible symlink swap): %s", localPath)
	}

	return s.bucket.Upload(ctx, objectKey, f, &blob.WriterOptions{
		ContentType: "application/octet-stream",
	})
}

func (s *remoteIndexStore) DownloadIndex(ctx context.Context, nsResource resource.NamespacedResource, indexKey ulid.ULID, destDir string) (_ *IndexMeta, retErr error) {
	pfx := indexPrefix(nsResource, indexKey.String())

	// Read meta.json first
	metaBytes, err := s.bucket.ReadAll(ctx, pfx+metaJSONFile)
	if err != nil {
		return nil, fmt.Errorf("reading meta.json: %w", err)
	}
	var meta IndexMeta
	if err := json.Unmarshal(metaBytes, &meta); err != nil {
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

	// Resolve the staging dir to its real path
	realTmpDir, err := filepath.EvalSymlinks(tmpDir)
	if err != nil {
		return nil, fmt.Errorf("resolving staging dir: %w", err)
	}
	for relPath, expectedSize := range meta.Files {
		objectKey := pfx + relPath
		localPath := filepath.Join(realTmpDir, filepath.FromSlash(relPath))

		safePath, err := safeDownloadPath(localPath, realTmpDir, relPath)
		if err != nil {
			return nil, err
		}

		if err := s.downloadFile(ctx, objectKey, safePath); err != nil {
			return nil, fmt.Errorf("downloading %s: %w", relPath, err)
		}

		// Validate size against what was actually written.
		info, err := os.Stat(safePath)
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

// safeDownloadPath validates that localPath stays inside realDest after resolving
// symlinks in both the parent directory and the leaf file. It creates intermediate
// directories as needed and returns the resolved safe path to write to.
func safeDownloadPath(localPath, realDest, relPath string) (string, error) {
	// Lexical check catches obvious traversal like "../".
	cleanDest := realDest + string(os.PathSeparator)
	if !strings.HasPrefix(filepath.Clean(localPath), cleanDest) {
		return "", fmt.Errorf("path traversal detected in manifest entry %q: resolved to %s which is outside %s", relPath, filepath.Clean(localPath), realDest)
	}

	if err := os.MkdirAll(filepath.Dir(localPath), 0750); err != nil {
		return "", fmt.Errorf("failed to create directory for %s: %w", relPath, err)
	}

	realParent, err := filepath.EvalSymlinks(filepath.Dir(localPath))
	if err != nil {
		return "", fmt.Errorf("failed to resolve parent symlinks for %s: %w", relPath, err)
	}
	if !strings.HasPrefix(realParent, cleanDest) && realParent != realDest {
		return "", fmt.Errorf("parent directory symlink escapes destination for %q: %s resolves outside %s", relPath, filepath.Dir(localPath), realDest)
	}
	safePath := filepath.Join(realParent, filepath.Base(localPath))

	// Check if the leaf file itself is a pre-existing symlink.
	if linfo, err := os.Lstat(safePath); err == nil {
		if linfo.Mode()&os.ModeSymlink != 0 {
			return "", fmt.Errorf("destination file is a symlink for %q: %s", relPath, safePath)
		}
	}

	return safePath, nil
}

// downloadFile creates localPath and streams the remote object into it.
func (s *remoteIndexStore) downloadFile(ctx context.Context, objectKey, localPath string) error {
	f, err := os.Create(localPath) //nolint:gosec // path validated by safeDownloadPath
	if err != nil {
		return err
	}

	if err := s.bucket.Download(ctx, objectKey, f, nil); err != nil {
		_ = f.Close()
		return err
	}
	return f.Close()
}

func (s *remoteIndexStore) ListIndexes(ctx context.Context, nsResource resource.NamespacedResource) (map[ulid.ULID]*IndexMeta, error) {
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

		// Fetch and parse meta.json
		metaBytes, err := s.bucket.ReadAll(ctx, obj.Key)
		if err != nil {
			if gcerrors.Code(err) != gcerrors.NotFound {
				s.log.Error("failed to read meta.json", "key", obj.Key, "err", err)
			}
			continue
		}
		var meta IndexMeta
		if err := json.Unmarshal(metaBytes, &meta); err != nil {
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

func (s *remoteIndexStore) DeleteIndex(ctx context.Context, nsResource resource.NamespacedResource, indexKey ulid.ULID) error {
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

func (s *remoteIndexStore) CleanupIncompleteUploads(ctx context.Context, nsResource resource.NamespacedResource) (int, error) {
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
		if _, err := ulid.Parse(keyStr); err != nil {
			continue // skip non-ULID prefixes
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

// isValidManifest reads and parses a meta.json object.
// Returns (true, nil) for a valid manifest, (false, nil) for a positively
// invalid one (corrupt JSON or empty Files), and (false, err) for read errors.
func (s *remoteIndexStore) isValidManifest(ctx context.Context, metaKey string) (bool, error) {
	data, err := s.bucket.ReadAll(ctx, metaKey)
	if err != nil {
		return false, err
	}
	var meta IndexMeta
	if err := json.Unmarshal(data, &meta); err != nil {
		return false, nil
	}
	return len(meta.Files) > 0, nil
}

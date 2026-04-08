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

	"gocloud.dev/blob"
	"gocloud.dev/gcerrors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

const metaJSONFile = "meta.json"

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
	// The meta.json is uploaded last to signal a complete upload.
	// Callers must hold a distributed lock to prevent concurrent uploads to the same prefix.
	UploadIndex(ctx context.Context, nsResource resource.NamespacedResource, indexKey string, localDir string, meta IndexMeta) error

	// DownloadIndex downloads a remote index to a local directory.
	// Validates completeness against the manifest in meta.json.
	DownloadIndex(ctx context.Context, nsResource resource.NamespacedResource, indexKey string, destDir string) (*IndexMeta, error)

	// ListIndexes lists all complete index snapshots for a namespaced resource.
	ListIndexes(ctx context.Context, nsResource resource.NamespacedResource) (map[string]*IndexMeta, error)

	// DeleteIndex deletes all files for an index snapshot.
	// The meta.json is deleted first to signal it an incomplete index.
	// Callers must hold a distributed lock to prevent concurrent modifications.
	DeleteIndex(ctx context.Context, nsResource resource.NamespacedResource, indexKey string) error
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

// validateIndexKey ensures the index key is a flat name without path separators.
func validateIndexKey(key string) error {
	if key == "" || strings.ContainsAny(key, "/\\") || key == "." || key == ".." {
		return fmt.Errorf("invalid index key: %q", key)
	}
	return nil
}

// indexPrefix returns the object storage prefix for a namespaced resource + index key.
func indexPrefix(ns resource.NamespacedResource, indexKey string) string {
	return fmt.Sprintf("%s/%s.%s/%s/", ns.Namespace, ns.Group, ns.Resource, indexKey)
}

// nsPrefix returns the object storage prefix for a namespaced resource (without index key).
func nsPrefix(ns resource.NamespacedResource) string {
	return fmt.Sprintf("%s/%s.%s/", ns.Namespace, ns.Group, ns.Resource)
}

func (s *remoteIndexStore) UploadIndex(ctx context.Context, nsResource resource.NamespacedResource, indexKey string, localDir string, meta IndexMeta) error {
	if err := validateIndexKey(indexKey); err != nil {
		return err
	}
	pfx := indexPrefix(nsResource, indexKey)

	// Index keys are immutable. Reject uploads to existing keys.
	_, err := s.bucket.Attributes(ctx, pfx+metaJSONFile)
	if err == nil {
		return fmt.Errorf("index %q already exists", indexKey)
	}
	if gcerrors.Code(err) != gcerrors.NotFound {
		return fmt.Errorf("checking index existence: %w", err)
	}

	absLocalDir, err := filepath.Abs(localDir)
	if err != nil {
		return fmt.Errorf("resolving local dir: %w", err)
	}

	meta.Files = make(map[string]int64)
	var relPaths []string
	err = filepath.WalkDir(absLocalDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() || !d.Type().IsRegular() {
			return nil
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
		return fmt.Errorf("walking local dir: %w", err)
	}
	if len(relPaths) == 0 {
		return fmt.Errorf("no files to upload in %s", localDir)
	}

	// Upload each file using streaming.
	for _, rel := range relPaths {
		objectKey := pfx + filepath.ToSlash(rel)
		if err := s.uploadFile(ctx, objectKey, filepath.Join(absLocalDir, rel)); err != nil {
			return fmt.Errorf("uploading %s: %w", rel, err)
		}
	}

	// Upload meta.json last — its presence signals a complete upload
	metaBytes, err := json.Marshal(meta)
	if err != nil {
		return fmt.Errorf("marshaling meta: %w", err)
	}
	if err := s.bucket.WriteAll(ctx, pfx+metaJSONFile, metaBytes, nil); err != nil {
		return fmt.Errorf("uploading meta.json: %w", err)
	}

	return nil
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

func (s *remoteIndexStore) DownloadIndex(ctx context.Context, nsResource resource.NamespacedResource, indexKey string, destDir string) (*IndexMeta, error) {
	if err := validateIndexKey(indexKey); err != nil {
		return nil, err
	}
	pfx := indexPrefix(nsResource, indexKey)

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

	// Ensure the destination directory exists before resolving symlinks,
	// so callers can pass a fresh path without pre-creating it.
	absDest, err := filepath.Abs(destDir)
	if err != nil {
		return nil, fmt.Errorf("resolving dest dir: %w", err)
	}
	if err := os.MkdirAll(absDest, 0750); err != nil {
		return nil, fmt.Errorf("creating dest dir: %w", err)
	}
	realDest, err := filepath.EvalSymlinks(absDest)
	if err != nil {
		return nil, fmt.Errorf("resolving dest dir symlinks: %w", err)
	}
	for relPath, expectedSize := range meta.Files {
		objectKey := pfx + relPath
		localPath := filepath.Join(realDest, filepath.FromSlash(relPath))

		safePath, err := safeDownloadPath(localPath, realDest, relPath)
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

	return &meta, nil
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
// Note: there is a residual TOCTOU window between safeDownloadPath's symlink
// check and os.Create. This is mitigated by the destination always being the
// Grafana-controlled bleve cache directory (cfg.IndexPath), not a user-writable
// location, so an attacker cannot inject symlinks between the check and create.
func (s *remoteIndexStore) downloadFile(ctx context.Context, objectKey, localPath string) error {
	f, err := os.Create(localPath) //nolint:gosec // path validated by safeDownloadPath
	if err != nil {
		return err
	}

	if err := s.bucket.Download(ctx, objectKey, f, nil); err != nil {
		_ = f.Close()
		_ = os.Remove(localPath) // clean up partial file
		return err
	}
	return f.Close()
}

func (s *remoteIndexStore) ListIndexes(ctx context.Context, nsResource resource.NamespacedResource) (map[string]*IndexMeta, error) {
	nsPfx := nsPrefix(nsResource)
	result := make(map[string]*IndexMeta)

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
		indexKey := strings.TrimSuffix(rel, "/"+metaJSONFile)
		if indexKey == "" || strings.Contains(indexKey, "/") {
			continue // skip nested or malformed paths
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
		result[indexKey] = &meta
	}

	return result, nil
}

func (s *remoteIndexStore) DeleteIndex(ctx context.Context, nsResource resource.NamespacedResource, indexKey string) error {
	if err := validateIndexKey(indexKey); err != nil {
		return err
	}
	pfx := indexPrefix(nsResource, indexKey)

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

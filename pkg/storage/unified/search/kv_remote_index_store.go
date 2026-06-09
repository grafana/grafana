package search

import (
	"bytes"
	"cmp"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"slices"
	"strings"
	"time"

	"github.com/oklog/ulid/v2"

	"github.com/grafana/grafana/pkg/apimachinery/validation"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
)

const (
	// IndexSnapshotManifestSection is the KV section under which
	// KVRemoteIndexStore stores snapshot manifests. Separate from the
	// data section so listing complete snapshots only requires scanning
	// manifest keys (one per snapshot) rather than every data file key.
	IndexSnapshotManifestSection = kv.SearchSnapshotManifestSection

	// IndexSnapshotDataSection is the KV section under which
	// KVRemoteIndexStore stores per-file snapshot data.
	IndexSnapshotDataSection = kv.SearchSnapshotDataSection

	// defaultKVLockTTL matches BucketRemoteIndexStore's default lock TTL.
	defaultKVLockTTL = 3 * time.Minute

	// defaultKVReleaseTimeout bounds the lease release call when the caller
	// invokes Release() on an IndexStoreLock without an explicit timeout.
	defaultKVReleaseTimeout = 30 * time.Second

	// kvDeleteBatchSize matches kv.MaxBatchOps. BatchDelete itself is not
	// atomic on most backends, but we still chunk to keep individual calls
	// small.
	kvDeleteBatchSize = kv.MaxBatchOps

	// defaultKVChunkSize bounds the size of a single value written to the
	// underlying KV. 10 MiB sits well under the per-value limit on every
	// supported KV backend.
	defaultKVChunkSize int64 = 10 * 1024 * 1024

	// minKVChunkSize / maxKVChunkSize bound user-supplied ChunkSize
	// values. The bounds are sanity guards: anything in this range works
	// correctly, but values far from typical (a few MiB) are unlikely to
	// be intentional. The upper bound stays under every backend's
	// per-value cap with margin.
	minKVChunkSize int64 = 1024 * 1024
	maxKVChunkSize int64 = 1024 * 1024 * 1024

	// kvChunkSuffixFormat zero-pads the chunk index so listing returns
	// chunks in numeric order. Six digits supports up to a million chunks
	// per file, which is comfortable headroom even at the minimum chunk
	// size.
	kvChunkSuffixFormat = "%06d"
)

// KVRemoteIndexStoreConfig configures NewKVRemoteIndexStore.
type KVRemoteIndexStoreConfig struct {
	// KV is the store used for snapshot data and manifests. Required.
	KV kv.KV

	// LeaseManager is used to acquire build and cleanup locks. The store does
	// not own the manager: callers wire a single manager per process and pass
	// it in here. Required.
	LeaseManager *lease.Manager

	// BuildLock / CleanupLock control the lease TTL and shutdown timing of
	// build and cleanup locks. Zero values fall back to defaults.
	BuildLock   LockOptions
	CleanupLock LockOptions

	// ChunkSize bounds the size (in bytes) of a single KV value used to
	// store snapshot file data. Files larger than ChunkSize are split into
	// numbered chunks; readers recover the chunk size from chunk 0's actual
	// length, so writers can change ChunkSize between deployments without
	// breaking existing snapshots. Zero falls back to defaultKVChunkSize.
	ChunkSize int64
}

// KVRemoteIndexStore implements RemoteIndexStore on top of a kv.KV.
//
// Data and manifests live in separate KV sections
// (IndexSnapshotManifestSection and IndexSnapshotDataSection). The
// manifest section holds one value per complete snapshot; its presence is
// the completion signal. The data section holds one value per chunk of
// each snapshot file.
//
// Layout:
//
//	IndexSnapshotManifestSection
//	    <namespace>/<resource>/<group>/<index-key>
//	    One value per snapshot; written last.
//
//	IndexSnapshotDataSection
//	    <namespace>/<resource>/<group>/<index-key>/<relPath>/<NNNNN>
//	    One value per chunk; NNNNN is the zero-padded chunk index.
//
// '/' is the only character that's always reserved by the apimachinery
// validators, so it's the natural separator between every field. Namespaces,
// resources, and groups are validated at every public entry point against
// the same rules used elsewhere in the codebase.
//
// Locks live in kv.LeasesSection (managed by lease.Manager), so snapshot
// keys and lease keys never overlap.
//
// Each snapshot file is split into one or more fixed-size chunks. Even
// small files get one chunk at index 000000, so read and write paths
// don't need a separate non-chunked code path. ChunkSize is recoverable
// at read time from the observed size of chunk 0, so the writer's choice
// of ChunkSize is not part of the persistent format and can change
// between deployments.
//
// ListNamespaces and ListNamespaceResources scan the data section so
// namespaces and resources whose only on-disk state is an incomplete
// upload (data written without a manifest) remain visible to the cleanup
// pass. ListIndexKeys stays on the cheap manifest-only scan and so does
// not surface incomplete uploads; the cleanup pass uses
// ListIndexKeysIncludingIncomplete to get that wider view.
type KVRemoteIndexStore struct {
	store           kv.KV
	leaseMgr        *lease.Manager
	buildLockOpts   LockOptions
	cleanupLockOpts LockOptions
	chunkSize       int64
	log             log.Logger
}

// NewKVRemoteIndexStore creates a KVRemoteIndexStore from cfg. Returns an
// error if any required field is missing.
func NewKVRemoteIndexStore(cfg KVRemoteIndexStoreConfig) (*KVRemoteIndexStore, error) {
	if cfg.KV == nil {
		return nil, fmt.Errorf("kv store is required")
	}
	if cfg.LeaseManager == nil {
		return nil, fmt.Errorf("lease manager is required")
	}
	chunkSize := cmp.Or(cfg.ChunkSize, defaultKVChunkSize)
	if chunkSize < minKVChunkSize || chunkSize > maxKVChunkSize {
		return nil, fmt.Errorf("chunk size %d out of range [%d, %d]", chunkSize, minKVChunkSize, maxKVChunkSize)
	}
	return &KVRemoteIndexStore{
		store:           cfg.KV,
		leaseMgr:        cfg.LeaseManager,
		buildLockOpts:   cfg.BuildLock,
		cleanupLockOpts: cfg.CleanupLock,
		chunkSize:       chunkSize,
		log:             log.New("kv-remote-index-store"),
	}, nil
}

// kvResourceSubPath returns the per-resource path used as a prefix in both
// snapshot KV sections. Unlike the bucket store's resourceSubPath (which
// applies cleanFileSegment for filesystem safety), this version preserves
// the input verbatim so namespaces, resources, and groups round-trip
// exactly through listing. Inputs are guarded by validateNsResource at the
// public boundary, which delegates to the apimachinery validators.
func kvResourceSubPath(ns resource.NamespacedResource) string {
	return ns.Namespace + "/" + ns.Resource + "/" + ns.Group
}

// kvDataPrefix returns the data-section key prefix shared by all files of a
// single snapshot.
func kvDataPrefix(ns resource.NamespacedResource, indexKey ulid.ULID) string {
	return kvResourceSubPath(ns) + "/" + indexKey.String() + "/"
}

// kvResourcePrefix returns the key prefix (used in either section) under
// which all snapshots for a namespaced resource live.
func kvResourcePrefix(ns resource.NamespacedResource) string {
	return kvResourceSubPath(ns) + "/"
}

// kvNamespacePrefix returns the key prefix (used in either section) under
// which all resources for a namespace live.
func kvNamespacePrefix(namespace string) string {
	return namespace + "/"
}

// dataKeyPrefix returns the per-file prefix under which all chunks of a
// single snapshot file live. The trailing slash makes prefix-based listing
// return only this file's chunks.
func (s *KVRemoteIndexStore) dataKeyPrefix(ns resource.NamespacedResource, indexKey ulid.ULID, relPath string) string {
	return kvDataPrefix(ns, indexKey) + relPath + "/"
}

// dataChunkKey returns the KV key for one chunk of a snapshot file.
func (s *KVRemoteIndexStore) dataChunkKey(ns resource.NamespacedResource, indexKey ulid.ULID, relPath string, chunkIdx int64) string {
	return s.dataKeyPrefix(ns, indexKey, relPath) + fmt.Sprintf(kvChunkSuffixFormat, chunkIdx)
}

// manifestKey returns the key for a snapshot's manifest in the manifest
// section. Note: no `/manifest` suffix is needed because the manifest
// section stores one value per snapshot.
func (s *KVRemoteIndexStore) manifestKey(ns resource.NamespacedResource, indexKey ulid.ULID) string {
	return kvResourceSubPath(ns) + "/" + indexKey.String()
}

// validateNamespace ensures namespace is safe to embed as a KV path
// segment. Delegates to apimachinery validation.IsValidNamespace, which
// rejects '/', '~', and any other character outside the Grafana name
// alphabet — plus length bounds. The empty namespace is explicitly
// rejected here because apimachinery permits it (for cluster-scoped
// resources), but a snapshot key with an empty namespace segment would
// produce an ambiguous path.
func validateNamespace(namespace string) error {
	if namespace == "" {
		return fmt.Errorf("namespace must not be empty")
	}
	if errs := validation.IsValidNamespace(namespace); len(errs) > 0 {
		return fmt.Errorf("invalid namespace %q: %s", namespace, errs[0])
	}
	return nil
}

// validateNsResource ensures the namespaced resource fields can be embedded
// in KV keys with exact round-trip. Delegates to the apimachinery validators
// for namespace, resource, and group, which between them disallow any
// character that would confuse the path parser ('/', '~') or collide with
// reserved values elsewhere.
func validateNsResource(ns resource.NamespacedResource) error {
	if err := validateNamespace(ns.Namespace); err != nil {
		return err
	}
	if errs := validation.IsValidResource(ns.Resource); len(errs) > 0 {
		return fmt.Errorf("invalid resource %q: %s", ns.Resource, errs[0])
	}
	if errs := validation.IsValidGroup(ns.Group); len(errs) > 0 {
		return fmt.Errorf("invalid group %q: %s", ns.Group, errs[0])
	}
	return nil
}

// WriteSnapshotFile splits src into chunks of at most chunkSize bytes and
// writes each chunk to a separate KV value under the per-file prefix. Empty
// files are not supported because all KV backends reject zero-byte values,
// but snapshot files produced by Bleve are always non-empty in practice.
func (s *KVRemoteIndexStore) WriteSnapshotFile(ctx context.Context, nsResource resource.NamespacedResource, indexKey ulid.ULID, relPath string, src *os.File) error {
	if err := validateNsResource(nsResource); err != nil {
		return err
	}
	stat, err := src.Stat()
	if err != nil {
		return fmt.Errorf("stat snapshot file %s: %w", relPath, err)
	}
	size := stat.Size()
	if size == 0 {
		return fmt.Errorf("snapshot file %s is empty", relPath)
	}
	numChunks := (size + s.chunkSize - 1) / s.chunkSize

	for chunkIdx := range numChunks {
		offset := chunkIdx * s.chunkSize
		length := s.chunkSize
		if remaining := size - offset; remaining < length {
			length = remaining
		}
		section := io.NewSectionReader(src, offset, length)
		if err := s.writeChunk(ctx, nsResource, indexKey, relPath, chunkIdx, section); err != nil {
			return err
		}
	}
	return nil
}

// writeChunk uploads a single chunk to its KV key. The reader is fully
// drained or an error is returned.
func (s *KVRemoteIndexStore) writeChunk(ctx context.Context, ns resource.NamespacedResource, indexKey ulid.ULID, relPath string, chunkIdx int64, src io.Reader) error {
	key := s.dataChunkKey(ns, indexKey, relPath, chunkIdx)
	w, err := s.store.Save(ctx, IndexSnapshotDataSection, key)
	if err != nil {
		return fmt.Errorf("opening kv writer for %s chunk %d: %w", relPath, chunkIdx, err)
	}
	if _, err := io.Copy(w, src); err != nil {
		_ = w.Close()
		return fmt.Errorf("writing %s chunk %d: %w", relPath, chunkIdx, err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("closing kv writer for %s chunk %d: %w", relPath, chunkIdx, err)
	}
	return nil
}

// ReadSnapshotFile reassembles a snapshot file by reading chunks 0..N-1 in
// order, where N is recovered from chunk 0's actual size and the advertised
// expectedSize. Returns ErrSnapshotNotFound if chunk 0 is missing, and
// wraps resource.ErrWriteLimitExceeded if the assembled file would exceed
// expectedSize.
func (s *KVRemoteIndexStore) ReadSnapshotFile(ctx context.Context, nsResource resource.NamespacedResource, indexKey ulid.ULID, relPath string, dst *os.File, expectedSize int64) error {
	if err := validateNsResource(nsResource); err != nil {
		return err
	}

	// Chunk 0's cap is expectedSize+1: either the whole file fits in one
	// chunk, or we'll observe the writer's chunk size as len(chunk0) and
	// fetch the remaining chunks from there.
	n0, err := s.readChunk(ctx, nsResource, indexKey, relPath, 0, dst, expectedSize+1)
	if err != nil {
		if errors.Is(err, kv.ErrNotFound) {
			return ErrSnapshotNotFound
		}
		return err
	}
	switch {
	case n0 > expectedSize:
		return fmt.Errorf("remote object %s exceeds expected size %d: %w", relPath, expectedSize, resource.ErrWriteLimitExceeded)
	case n0 == expectedSize:
		// Single-chunk file fully covered by chunk 0.
		return nil
	case n0 == 0:
		// Multi-chunk file with an empty chunk 0 would never make
		// progress and we have no chunk size to derive. Treat it as
		// corruption.
		return fmt.Errorf("chunk 0 of %s is empty but expected size %d", relPath, expectedSize)
	}

	// Chunk 0 covered some but not all of the file, so its size IS the
	// writer's chunk size; fetch the rest accordingly.
	chunkSize := n0
	written := n0
	for chunkIdx := int64(1); written < expectedSize; chunkIdx++ {
		// Cap each subsequent chunk at chunkSize+1 to detect over-read
		// without buffering the whole chunk first.
		n, err := s.readChunk(ctx, nsResource, indexKey, relPath, chunkIdx, dst, chunkSize+1)
		if err != nil {
			if errors.Is(err, kv.ErrNotFound) {
				return fmt.Errorf("chunk %d of %s missing: %w", chunkIdx, relPath, err)
			}
			return err
		}
		if n == 0 {
			return fmt.Errorf("chunk %d of %s is empty", chunkIdx, relPath)
		}
		written += n
		if written > expectedSize {
			return fmt.Errorf("remote object %s exceeds expected size %d: %w", relPath, expectedSize, resource.ErrWriteLimitExceeded)
		}
	}
	return nil
}

// readChunk fetches one chunk into dst, capped at maxBytes to detect
// over-sized values. Returns the number of bytes written. Propagates
// kv.ErrNotFound unwrapped so callers can distinguish a missing chunk.
func (s *KVRemoteIndexStore) readChunk(ctx context.Context, ns resource.NamespacedResource, indexKey ulid.ULID, relPath string, chunkIdx int64, dst io.Writer, maxBytes int64) (int64, error) {
	key := s.dataChunkKey(ns, indexKey, relPath, chunkIdx)
	rc, err := s.store.Get(ctx, IndexSnapshotDataSection, key)
	if err != nil {
		if errors.Is(err, kv.ErrNotFound) {
			return 0, err
		}
		return 0, fmt.Errorf("reading %s chunk %d: %w", relPath, chunkIdx, err)
	}
	defer func() { _ = rc.Close() }()
	n, err := io.Copy(dst, io.LimitReader(rc, maxBytes))
	if err != nil {
		return n, fmt.Errorf("copying %s chunk %d: %w", relPath, chunkIdx, err)
	}
	return n, nil
}

// WriteSnapshotManifest stores the manifest as a single KV value in the
// manifest section. Its presence is the snapshot completion signal.
func (s *KVRemoteIndexStore) WriteSnapshotManifest(ctx context.Context, nsResource resource.NamespacedResource, indexKey ulid.ULID, manifest []byte) error {
	if err := validateNsResource(nsResource); err != nil {
		return err
	}
	w, err := s.store.Save(ctx, IndexSnapshotManifestSection, s.manifestKey(nsResource, indexKey))
	if err != nil {
		return fmt.Errorf("opening kv writer for manifest: %w", err)
	}
	if _, err := w.Write(manifest); err != nil {
		_ = w.Close()
		return fmt.Errorf("writing manifest: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("closing kv writer for manifest: %w", err)
	}
	return nil
}

// ReadSnapshotManifest returns the manifest bytes for the given snapshot.
// Returns ErrSnapshotNotFound if the manifest is absent, or an error
// wrapping ErrInvalidManifest if it exceeds maxSnapshotManifestSize.
func (s *KVRemoteIndexStore) ReadSnapshotManifest(ctx context.Context, nsResource resource.NamespacedResource, indexKey ulid.ULID) ([]byte, error) {
	if err := validateNsResource(nsResource); err != nil {
		return nil, err
	}
	rc, err := s.store.Get(ctx, IndexSnapshotManifestSection, s.manifestKey(nsResource, indexKey))
	if err != nil {
		if errors.Is(err, kv.ErrNotFound) {
			return nil, ErrSnapshotNotFound
		}
		return nil, fmt.Errorf("reading manifest: %w", err)
	}
	defer func() { _ = rc.Close() }()

	var buf bytes.Buffer
	n, err := io.Copy(&buf, io.LimitReader(rc, maxSnapshotManifestSize+1))
	if err != nil {
		return nil, fmt.Errorf("copying manifest: %w", err)
	}
	if n > maxSnapshotManifestSize {
		return nil, fmt.Errorf("%w: oversized snapshot manifest (>%d bytes)", ErrInvalidManifest, maxSnapshotManifestSize)
	}
	return buf.Bytes(), nil
}

// ListNamespaces returns the distinct namespaces that have any snapshot
// data, complete or incomplete. Scans the data section so the cleanup
// pass can reach a namespace whose only snapshots are partial uploads.
func (s *KVRemoteIndexStore) ListNamespaces(ctx context.Context) ([]string, error) {
	return listDistinctValues(ctx, s.store, IndexSnapshotDataSection, "", func(rest string) (string, bool) {
		ns, _, _ := strings.Cut(rest, "/")
		return ns, ns != ""
	})
}

// ListNamespaceResources returns the resources under the given namespace
// that have any snapshot data, complete or incomplete. Scans the data
// section so the cleanup pass can reach a resource whose only snapshots
// are partial uploads.
func (s *KVRemoteIndexStore) ListNamespaceResources(ctx context.Context, namespace string) ([]resource.NamespacedResource, error) {
	if err := validateNamespace(namespace); err != nil {
		return nil, err
	}
	return listDistinctValues(ctx, s.store, IndexSnapshotDataSection, kvNamespacePrefix(namespace), func(rest string) (resource.NamespacedResource, bool) {
		// Layout under prefix: "<resource>/<group>/<ULID>/<relPath>/<NNNNN>".
		res, after, ok := strings.Cut(rest, "/")
		if !ok || res == "" {
			return resource.NamespacedResource{}, false
		}
		group, _, ok := strings.Cut(after, "/")
		if !ok || group == "" {
			return resource.NamespacedResource{}, false
		}
		return resource.NamespacedResource{Namespace: namespace, Resource: res, Group: group}, true
	})
}

// ListIndexKeys returns the ULID keys of complete snapshots under
// nsResource. The manifest section is scanned via a cheap one-key-per-
// snapshot listing; incomplete uploads (data files written without a
// manifest) are not surfaced. Callers that need to see incomplete
// uploads — notably CleanupIncompleteIndexSnapshots — use
// ListIndexKeysIncludingIncomplete instead. Order is unspecified.
func (s *KVRemoteIndexStore) ListIndexKeys(ctx context.Context, nsResource resource.NamespacedResource) ([]ulid.ULID, error) {
	if err := validateNsResource(nsResource); err != nil {
		return nil, err
	}
	return listDistinctValues(ctx, s.store, IndexSnapshotManifestSection, kvResourcePrefix(nsResource), parseULIDFromSegment(s.log))
}

// ListIndexKeysIncludingIncomplete returns the ULID keys of all
// snapshots under nsResource, including incomplete uploads (data
// written without a manifest). The data-section scan walks every chunk
// key, so this is O(snapshots × files × chunks) and noticeably more
// expensive than ListIndexKeys; only the cleanup pass needs the wider
// view. Results are deduplicated on ULID; order is unspecified.
func (s *KVRemoteIndexStore) ListIndexKeysIncludingIncomplete(ctx context.Context, nsResource resource.NamespacedResource) ([]ulid.ULID, error) {
	if err := validateNsResource(nsResource); err != nil {
		return nil, err
	}
	prefix := kvResourcePrefix(nsResource)
	parseULID := parseULIDFromSegment(s.log)

	// Manifest section: one key per complete snapshot.
	manifests, err := listDistinctValues(ctx, s.store, IndexSnapshotManifestSection, prefix, parseULID)
	if err != nil {
		return nil, err
	}
	// Data section: many keys per snapshot. Surfaces incomplete uploads
	// (data written without a manifest).
	datas, err := listDistinctValues(ctx, s.store, IndexSnapshotDataSection, prefix, parseULID)
	if err != nil {
		return nil, err
	}

	// Sort+Compact removes ULIDs that appeared in both sections.
	all := slices.Concat(manifests, datas)
	slices.SortFunc(all, ulid.ULID.Compare)
	return slices.Compact(all), nil
}

// parseULIDFromSegment returns a parse function for listDistinctValues
// that extracts a ULID from the first '/'-separated segment of the path
// remainder. Both the manifest layout (`<ULID>`) and the data layout
// (`<ULID>/<relPath>/<NNNNN>`) yield the ULID. Non-ULID segments are
// logged at warn level and skipped.
func parseULIDFromSegment(logger log.Logger) func(rest string) (ulid.ULID, bool) {
	return func(rest string) (ulid.ULID, bool) {
		seg, _, _ := strings.Cut(rest, "/")
		u, err := ulid.Parse(seg)
		if err != nil {
			logger.Warn("skipping non-ULID key segment", "seg", seg, "err", err)
			return ulid.ULID{}, false
		}
		return u, true
	}
}

// listDistinctValues scans keys in section under prefix and returns the
// distinct values produced by parse from the path remainder after prefix.
// Entries for which parse returns ok=false are dropped. Order is the order
// the values first appear in the scan.
func listDistinctValues[T comparable](ctx context.Context, store kv.KV, section, prefix string, parse func(rest string) (T, bool)) ([]T, error) {
	opts := kv.ListOptions{StartKey: prefix}
	if prefix != "" {
		opts.EndKey = kv.PrefixRangeEnd(prefix)
	}

	seen := make(map[T]struct{})
	var result []T
	for key, err := range store.Keys(ctx, section, opts) {
		if err != nil {
			return nil, err
		}
		v, ok := parse(strings.TrimPrefix(key, prefix))
		if !ok {
			continue
		}
		if _, dup := seen[v]; dup {
			continue
		}
		seen[v] = struct{}{}
		result = append(result, v)
	}
	return result, nil
}

// DeleteIndex deletes the manifest first (so the snapshot stops being
// listed as complete by ListIndexKeys), then batch-deletes the data files.
func (s *KVRemoteIndexStore) DeleteIndex(ctx context.Context, nsResource resource.NamespacedResource, indexKey ulid.ULID) error {
	if err := validateNsResource(nsResource); err != nil {
		return err
	}
	if err := s.store.Delete(ctx, IndexSnapshotManifestSection, s.manifestKey(nsResource, indexKey)); err != nil {
		return fmt.Errorf("deleting snapshot manifest: %w", err)
	}

	prefix := kvDataPrefix(nsResource, indexKey)
	end := kv.PrefixRangeEnd(prefix)

	// Collect all data-file keys first; iterating and deleting at the same
	// time would invalidate the iterator on some backends.
	var keys []string
	for key, err := range s.store.Keys(ctx, IndexSnapshotDataSection, kv.ListOptions{StartKey: prefix, EndKey: end}) {
		if err != nil {
			return fmt.Errorf("listing keys for delete: %w", err)
		}
		keys = append(keys, key)
	}

	for batch := range slices.Chunk(keys, kvDeleteBatchSize) {
		if err := s.store.BatchDelete(ctx, IndexSnapshotDataSection, batch); err != nil {
			return fmt.Errorf("batch deleting snapshot files: %w", err)
		}
	}
	return nil
}

// --- Locking ---

// LockBuildIndex acquires the build/upload lease for the given resource and
// build version. The lease is automatically renewed in the background while
// it is held; if renewal fails (e.g. another holder takes over), Lost() is
// signaled and Release() returns ErrLeaseLost.
func (s *KVRemoteIndexStore) LockBuildIndex(ctx context.Context, nsResource resource.NamespacedResource, buildVersion string) (IndexStoreLock, error) {
	if err := validateNsResource(nsResource); err != nil {
		return nil, err
	}
	if buildVersion == "" {
		return nil, fmt.Errorf("build version must not be empty")
	}
	return s.acquireLock(ctx, kvBuildLeaseName(nsResource, buildVersion), s.buildLockOpts)
}

// LockNamespaceForCleanup acquires the cleanup lease for the given namespace.
// Uses a distinct key from LockBuildIndex so cleanup never blocks an in-flight
// upload for any resource in the namespace.
func (s *KVRemoteIndexStore) LockNamespaceForCleanup(ctx context.Context, namespace string) (IndexStoreLock, error) {
	if err := validateNamespace(namespace); err != nil {
		return nil, err
	}
	return s.acquireLock(ctx, kvCleanupLeaseName(namespace), s.cleanupLockOpts)
}

// Lease names use prefixes that identify what each lease is for. Listing
// lease.Manager's section shows snapshot leases distinctly from other
// users of the same KV (e.g. the storage backend's per-resource write
// leases).
const (
	kvBuildLeasePrefix   = "index-snapshot-build"
	kvCleanupLeasePrefix = "index-snapshot-cleanup"
)

// kvBuildLeaseName returns the lease name for a build/upload lock. The
// build version is base64-encoded so version strings containing '/' or
// other unusual characters don't break the lease-name shape.
func kvBuildLeaseName(ns resource.NamespacedResource, buildVersion string) string {
	return kvBuildLeasePrefix + "/" + kvResourceSubPath(ns) + "/" + versionLockSegment(buildVersion)
}

// kvCleanupLeaseName returns the lease name for a per-namespace cleanup lock.
func kvCleanupLeaseName(namespace string) string {
	return kvCleanupLeasePrefix + "/" + namespace
}

func (s *KVRemoteIndexStore) acquireLock(ctx context.Context, name string, opts LockOptions) (IndexStoreLock, error) {
	ttl := cmp.Or(opts.TTL, defaultKVLockTTL)
	releaseTimeout := cmp.Or(opts.ReleaseDeleteTimeout, defaultKVReleaseTimeout)

	l, err := s.leaseMgr.Acquire(ctx, name, lease.WithTTL(ttl), lease.WithAutoRenew())
	if err != nil {
		return nil, fmt.Errorf("acquiring lease %q: %w", name, err)
	}
	return &kvIndexStoreLock{
		mgr:            s.leaseMgr,
		lease:          l,
		releaseTimeout: releaseTimeout,
	}, nil
}

// kvIndexStoreLock adapts *lease.Lease to the IndexStoreLock interface.
//
// Release uses a bounded background context so cancellation of the original
// acquire context does not prevent a best-effort tombstone of the lease.
// Lost() is forwarded directly from the underlying lease, which signals when
// the lease has been observed as taken by another holder during auto-renew
// or when the TTL has elapsed without successful renewal.
type kvIndexStoreLock struct {
	mgr            *lease.Manager
	lease          *lease.Lease
	releaseTimeout time.Duration
}

// Release stops the auto-renewal goroutine and tombstones the underlying
// lease. After Lost() has been signaled, Release is best-effort cleanup; a
// nil return does not mean the caller retained ownership until release.
// Callers that care about the lost-lease case can branch on
// lease.ErrLeaseLost via errors.Is.
func (l *kvIndexStoreLock) Release() error {
	ctx, cancel := context.WithTimeout(context.Background(), l.releaseTimeout)
	defer cancel()
	if err := l.mgr.Release(ctx, l.lease); err != nil {
		return fmt.Errorf("releasing lease: %w", err)
	}
	return nil
}

func (l *kvIndexStoreLock) Lost() <-chan struct{} {
	return l.lease.Lost()
}

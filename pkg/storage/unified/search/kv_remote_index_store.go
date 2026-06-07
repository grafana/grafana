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
	IndexSnapshotManifestSection = "index-snapshot-manifest"

	// IndexSnapshotDataSection is the KV section under which
	// KVRemoteIndexStore stores per-file snapshot data.
	IndexSnapshotDataSection = "index-snapshot-data"

	// defaultKVLockTTL matches BucketRemoteIndexStore's default lock TTL.
	defaultKVLockTTL = 3 * time.Minute

	// defaultKVReleaseTimeout bounds the lease release call when the caller
	// invokes Release() on an IndexStoreLock without an explicit timeout.
	defaultKVReleaseTimeout = 30 * time.Second

	// kvDeleteBatchSize matches kv.MaxBatchOps. BatchDelete itself is not
	// atomic on most backends, but we still chunk to keep individual calls
	// small.
	kvDeleteBatchSize = kv.MaxBatchOps
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
}

// KVRemoteIndexStore implements RemoteIndexStore on top of a kv.KV.
//
// Data and manifests live in separate KV sections
// (IndexSnapshotManifestSection and IndexSnapshotDataSection) so that
// per-resource listing of complete snapshots (ListIndexKeys) can scan one
// key per snapshot rather than every data-file key. Discovery of
// namespaces and resources (ListNamespaces, ListNamespaceResources)
// still scans the data section so namespaces or resources whose only
// snapshots are incomplete uploads remain visible to the cleanup pass.
//
// Layout:
//
//	IndexSnapshotManifestSection
//	    <namespace>/<resource>/<group>/<index-key>
//	    One value per snapshot; written last. Its presence is the
//	    snapshot completion signal, matching BucketRemoteIndexStore's
//	    contract.
//
//	IndexSnapshotDataSection
//	    <namespace>/<resource>/<group>/<index-key>/<relPath>
//	    One value per data file.
//
// '/' is the only character that's always reserved by the apimachinery
// validators, so it's the natural separator between every field. Namespaces,
// resources, and groups are validated at every public entry point against
// the same rules used elsewhere in the codebase.
//
// Locks live in kv.LeasesSection (managed by lease.Manager), so snapshot
// keys and lease keys never overlap.
//
// Each data file is stored as a single KV value. Transparent chunking for
// files larger than the backend's per-value limit is not yet implemented.
//
// Known limitation: because ListIndexKeys lists only the manifest section,
// CleanupIncompleteIndexSnapshots cannot detect incomplete uploads (data
// files written without a manifest) on this backend. Detection of incomplete
// uploads will eventually move into the backend so the helper can work
// correctly here too.
type KVRemoteIndexStore struct {
	store           kv.KV
	leaseMgr        *lease.Manager
	buildLockOpts   LockOptions
	cleanupLockOpts LockOptions
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
	return &KVRemoteIndexStore{
		store:           cfg.KV,
		leaseMgr:        cfg.LeaseManager,
		buildLockOpts:   cfg.BuildLock,
		cleanupLockOpts: cfg.CleanupLock,
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

func (s *KVRemoteIndexStore) dataKey(ns resource.NamespacedResource, indexKey ulid.ULID, relPath string) string {
	return kvDataPrefix(ns, indexKey) + relPath
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

// WriteSnapshotFile streams src into a single KV value at the per-file key
// in the data section. Chunking for large files is not yet implemented.
func (s *KVRemoteIndexStore) WriteSnapshotFile(ctx context.Context, nsResource resource.NamespacedResource, indexKey ulid.ULID, relPath string, src *os.File) error {
	if err := validateNsResource(nsResource); err != nil {
		return err
	}
	w, err := s.store.Save(ctx, IndexSnapshotDataSection, s.dataKey(nsResource, indexKey, relPath))
	if err != nil {
		return fmt.Errorf("opening kv writer for %s: %w", relPath, err)
	}
	if _, err := io.Copy(w, src); err != nil {
		_ = w.Close()
		return fmt.Errorf("writing snapshot file %s: %w", relPath, err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("closing kv writer for %s: %w", relPath, err)
	}
	return nil
}

// ReadSnapshotFile streams the KV value at the per-file key in the data
// section into dst, capping the transfer at expectedSize+1 bytes so a
// misadvertised size cannot transfer unbounded data. Returns
// ErrSnapshotNotFound if the key is absent.
func (s *KVRemoteIndexStore) ReadSnapshotFile(ctx context.Context, nsResource resource.NamespacedResource, indexKey ulid.ULID, relPath string, dst *os.File, expectedSize int64) error {
	if err := validateNsResource(nsResource); err != nil {
		return err
	}
	rc, err := s.store.Get(ctx, IndexSnapshotDataSection, s.dataKey(nsResource, indexKey, relPath))
	if err != nil {
		if errors.Is(err, kv.ErrNotFound) {
			return ErrSnapshotNotFound
		}
		return fmt.Errorf("reading snapshot file %s: %w", relPath, err)
	}
	defer func() { _ = rc.Close() }()

	// Read one extra byte so we can detect oversized objects without a
	// second round trip.
	n, err := io.Copy(dst, io.LimitReader(rc, expectedSize+1))
	if err != nil {
		return fmt.Errorf("copying snapshot file %s: %w", relPath, err)
	}
	if n > expectedSize {
		return fmt.Errorf("remote object %s exceeds expected size %d: %w", relPath, expectedSize, resource.ErrWriteLimitExceeded)
	}
	return nil
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
	return listDistinctSegments(ctx, s.store, IndexSnapshotDataSection, "", func(seg string) (string, bool) {
		return seg, seg != ""
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
	prefix := kvNamespacePrefix(namespace)
	end := kv.PrefixRangeEnd(prefix)

	seen := make(map[resource.NamespacedResource]struct{})
	var result []resource.NamespacedResource
	for key, err := range s.store.Keys(ctx, IndexSnapshotDataSection, kv.ListOptions{StartKey: prefix, EndKey: end}) {
		if err != nil {
			return nil, err
		}
		// Layout under prefix: "<resource>/<group>/<ULID>/<relPath>".
		rest := strings.TrimPrefix(key, prefix)
		res, after, ok := strings.Cut(rest, "/")
		if !ok || res == "" {
			continue
		}
		group, _, ok := strings.Cut(after, "/")
		if !ok || group == "" {
			continue
		}
		nr := resource.NamespacedResource{Namespace: namespace, Resource: res, Group: group}
		if _, dup := seen[nr]; dup {
			continue
		}
		seen[nr] = struct{}{}
		result = append(result, nr)
	}
	return result, nil
}

// ListIndexKeys returns the ULID keys of all complete snapshots under
// nsResource. Scans the manifest section directly, so incomplete uploads
// (data files written without a manifest) are not surfaced.
//
// Note: this is a deliberate divergence from the contract documented on
// RemoteIndexStore.ListIndexKeys ("may include incomplete uploads"). As a
// consequence, CleanupIncompleteIndexSnapshots cannot detect incomplete
// uploads on this backend until incomplete-upload detection is moved into
// the backend itself.
func (s *KVRemoteIndexStore) ListIndexKeys(ctx context.Context, nsResource resource.NamespacedResource) ([]ulid.ULID, error) {
	if err := validateNsResource(nsResource); err != nil {
		return nil, err
	}
	prefix := kvResourcePrefix(nsResource)
	end := kv.PrefixRangeEnd(prefix)

	var result []ulid.ULID
	for key, err := range s.store.Keys(ctx, IndexSnapshotManifestSection, kv.ListOptions{StartKey: prefix, EndKey: end}) {
		if err != nil {
			return nil, err
		}
		// Manifest keys are flat: `<resourceSubPath>/<ULID>`, no trailing path.
		ulidStr := strings.TrimPrefix(key, prefix)
		u, err := ulid.Parse(ulidStr)
		if err != nil {
			// Shouldn't occur in practice; log so it doesn't disappear silently.
			s.log.Warn("skipping non-ULID key in manifest section", "key", key, "err", err)
			continue
		}
		result = append(result, u)
	}
	return result, nil
}

// listDistinctSegments scans the given KV section for keys with the given
// prefix and returns the distinct first path segment after prefix,
// transformed via parse. Entries for which parse returns ok=false are
// dropped.
func listDistinctSegments[T any](ctx context.Context, store kv.KV, section, prefix string, parse func(seg string) (T, bool)) ([]T, error) {
	opts := kv.ListOptions{StartKey: prefix}
	if prefix != "" {
		opts.EndKey = kv.PrefixRangeEnd(prefix)
	}

	seen := make(map[string]struct{})
	var result []T
	for key, err := range store.Keys(ctx, section, opts) {
		if err != nil {
			return nil, err
		}
		rest := strings.TrimPrefix(key, prefix)
		seg, _, _ := strings.Cut(rest, "/")
		if seg == "" {
			continue
		}
		if _, ok := seen[seg]; ok {
			continue
		}
		seen[seg] = struct{}{}
		v, ok := parse(seg)
		if !ok {
			continue
		}
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

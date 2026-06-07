package search

import (
	"context"
	"io/fs"
	"math/rand/v2"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// Disk cleanup outcomes and kinds. Mirror the snapshot cleanup labels so
// operators have a consistent vocabulary across the two cleanup loops.
const (
	diskCleanupOutcomeSuccess = "success"
	diskCleanupOutcomeError   = "error"

	diskCleanupKindIndex           = "index"
	diskCleanupKindSnapshotStaging = "snapshot_staging"
)

// cleanupDiskPeriodically runs runDiskCleanup on a fixed DiskCleanupInterval,
// with a uniformly jittered initial delay in [0, DiskCleanupInterval). The
// delay keeps the sweep from running immediately at startup, when the pod is
// still busy opening or rebuilding indexes.
func (b *bleveBackend) cleanupDiskPeriodically(ctx context.Context) {
	defer b.bgTasksWg.Done()

	// Caller (NewBleveBackend) only starts this goroutine when DiskCleanupInterval > 0.
	interval := b.opts.DiskCleanupInterval
	initialDelay := time.Duration(rand.Int64N(int64(interval)))
	select {
	case <-ctx.Done():
		return
	case <-time.After(initialDelay):
	}

	b.runDiskCleanup(ctx)

	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			b.runDiskCleanup(ctx)
		}
	}
}

// diskCleanupStats is the per-run counter set, used for the structured log
// line and trace attributes. Per-decision breakdown lives here rather than in
// metrics to keep cardinality low.
type diskCleanupStats struct {
	scanned         int
	deletedIndex    int
	deletedSnapshot int
	keptInFlight    int
	keptActive      int
	keptGrace       int
	deleteFailures  int
	ownershipErrors int
	errors          int
}

// runDiskCleanup walks the on-disk bleve root once and deletes folders that
// are not owned by this pod and not in use by an in-flight BuildIndex call.
// Decision order per candidate directory: in-flight refcount first (never
// touched), then the active-index check and the cold-start reuse selection
// in sweepResource, then the two-step mtime gate in hasFreshActivity
// (safety net) with the per-candidate grace chosen by sweepResource.
//
// All filesystem access is anchored through an os.Root opened on b.opts.Root,
// so the sweep cannot escape its configured root (symlinks, "..", or
// otherwise). That removes the need for the isPathWithinRoot string-prefix
// guard used elsewhere in this package.
func (b *bleveBackend) runDiskCleanup(ctx context.Context) {
	ctx, span := tracer.Start(ctx, "search.disk_cleanup")
	defer span.End()

	start := time.Now()

	b.log.Info("Disk index cleanup started")

	root, err := os.OpenRoot(b.opts.Root)
	if err != nil {
		span.RecordError(err)
		b.recordDiskCleanupRun(diskCleanupOutcomeError)
		b.log.Warn("Disk index cleanup failed: opening root", "root", b.opts.Root, "err", err)
		return
	}
	defer func() { _ = root.Close() }()

	stats := diskCleanupStats{}
	entries, err := fs.ReadDir(root.FS(), ".")
	if err != nil {
		stats.errors++
		span.RecordError(err)
		b.recordDiskCleanupRun(diskCleanupOutcomeError)
		b.log.Warn("Disk index cleanup failed: reading root", "root", b.opts.Root, "err", err)
		return
	}

	for _, entry := range entries {
		if ctx.Err() != nil {
			break
		}
		if !entry.IsDir() {
			continue
		}
		if entry.Name() == snapshotsDirName {
			b.sweepSnapshotsTree(ctx, root, snapshotsDirName, &stats)
			continue
		}
		b.sweepNamespace(ctx, root, entry.Name(), &stats)
	}

	outcome := diskCleanupOutcomeSuccess
	if stats.errors > 0 {
		outcome = diskCleanupOutcomeError
	}
	b.recordDiskCleanupRun(outcome)
	span.SetAttributes(
		attribute.String("outcome", outcome),
		attribute.Int("dirs_scanned", stats.scanned),
		attribute.Int("dirs_deleted_index", stats.deletedIndex),
		attribute.Int("dirs_deleted_snapshot_staging", stats.deletedSnapshot),
		attribute.Int("dirs_kept_in_flight", stats.keptInFlight),
		attribute.Int("dirs_kept_active", stats.keptActive),
		attribute.Int("dirs_kept_grace", stats.keptGrace),
		attribute.Int("delete_failures", stats.deleteFailures),
		attribute.Int("ownership_errors", stats.ownershipErrors),
	)
	b.log.Info("Disk index cleanup completed",
		"elapsed", time.Since(start),
		"outcome", outcome,
		"dirs_scanned", stats.scanned,
		"dirs_deleted_index", stats.deletedIndex,
		"dirs_deleted_snapshot_staging", stats.deletedSnapshot,
		"dirs_kept_in_flight", stats.keptInFlight,
		"dirs_kept_active", stats.keptActive,
		"dirs_kept_grace", stats.keptGrace,
		"delete_failures", stats.deleteFailures,
		"ownership_errors", stats.ownershipErrors,
	)
}

// iterDirs reads the directory children of rel relative to root. Files and
// other non-directory entries are filtered out. Missing rel is treated as
// empty (no error, no stat bump). Any other read error is logged and bumps
// stats.errors so the run's outcome flips to error. Entries are returned in
// fs.ReadDir order, i.e. sorted by filename.
func (b *bleveBackend) iterDirs(root *os.Root, rel string, stats *diskCleanupStats) []fs.DirEntry {
	entries, err := fs.ReadDir(root.FS(), rel)
	if err != nil {
		if !os.IsNotExist(err) {
			b.log.Warn("Disk index cleanup: reading dir", "dir", joinRoot(root, rel), "err", err)
			stats.errors++
		}
		return nil
	}
	dirs := make([]fs.DirEntry, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() {
			dirs = append(dirs, e)
		}
	}
	return dirs
}

// tryRemoveCandidate is the shared gate-and-delete sequence used by every
// candidate directory:
//
//  1. in-flight refcount — reservations from BuildIndex or
//     newSnapshotStagingDir are never touched;
//  2. mtime gate — protects writes whose timing we can't infer from
//     structure alone;
//  3. RemoveAll — deletes the directory and updates metrics tagged with kind.
//
// kind controls the metric label and which `deleted*` counter is bumped.
// The grace value lets callers vary how strict the mtime gate is per
// candidate (e.g. sweepResource hands the newest unopened index a longer
// grace than the older siblings under the same resource).
//
// Race note: the in-flight check is best-effort. BuildIndex and
// newSnapshotStagingDir both register their directories "as soon as they
// own them" (immediately after bleve.OpenUsing / os.MkdirTemp), but there
// is a tiny window where the directory is open or just-created and not yet
// registered. The mtime gate covers that window in practice — a freshly
// opened bolt store or just-created MkdirTemp dir has fresh mtimes. The
// re-check immediately before RemoveAll narrows the already-narrow window
// further: anything registered between the first check and the syscall is
// honoured.
func (b *bleveBackend) tryRemoveCandidate(root *os.Root, rel, kind string, grace time.Duration, stats *diskCleanupStats) {
	abs := joinRoot(root, rel)
	if b.isInFlightBuildDir(abs) {
		stats.keptInFlight++
		return
	}
	if hasFreshActivity(root, rel, time.Now(), grace) {
		stats.keptGrace++
		return
	}
	// Re-check after the (potentially slow) mtime gate. A BuildIndex that
	// started while hasFreshActivity was walking the candidate has had time
	// to register by now; honour that.
	if b.isInFlightBuildDir(abs) {
		stats.keptInFlight++
		return
	}
	if err := root.RemoveAll(rel); err != nil {
		b.log.Warn("Disk index cleanup: removing dir", "kind", kind, "dir", abs, "err", err)
		b.recordDiskCleanupDirsDeleted(kind, diskCleanupOutcomeError)
		stats.deleteFailures++
		stats.errors++
		return
	}
	b.log.Info("Disk index cleanup: removed dir", "kind", kind, "dir", abs)
	b.recordDiskCleanupDirsDeleted(kind, diskCleanupOutcomeSuccess)
	switch kind {
	case diskCleanupKindIndex:
		stats.deletedIndex++
	case diskCleanupKindSnapshotStaging:
		stats.deletedSnapshot++
	}
}

// sweepNamespace processes <root>/<namespace>/ and tries to remove empty
// <resource>.<group> children plus the namespace dir itself after their last
// content is gone. namespace is both the root-relative path (it is always a
// top-level child of the root) and the value used to build the per-resource
// ownership key.
func (b *bleveBackend) sweepNamespace(ctx context.Context, root *os.Root, namespace string, stats *diskCleanupStats) {
	for _, resEntry := range b.iterDirs(root, namespace, stats) {
		if ctx.Err() != nil {
			return
		}
		resName := resEntry.Name()
		res, group, ok := splitResourceGroup(resName)
		if !ok {
			// Doesn't match <resource>.<group>; leave it alone rather than risk
			// deleting something we don't recognise.
			continue
		}
		resGroupRel := path.Join(namespace, resName)
		key := resource.NamespacedResource{Namespace: namespace, Resource: res, Group: group}
		b.sweepResource(ctx, root, resGroupRel, key, stats)
		b.tryRemoveIfEmpty(root, resGroupRel, stats)
	}
	b.tryRemoveIfEmpty(root, namespace, stats)
}

// splitResourceGroup splits a "<resource>.<group>" directory name into its
// components. The resource short name (e.g. "dashboards") does not contain
// dots, so the split point is the first '.'.
func splitResourceGroup(name string) (string, string, bool) {
	idx := strings.IndexByte(name, '.')
	if idx <= 0 || idx == len(name)-1 {
		return "", "", false
	}
	return name[:idx], name[idx+1:], true
}

// sweepResource dispatches each timestamp directory inside one resource
// folder into one of three buckets:
//
//   - active index (owned + currently cached): always kept, no gate.
//   - newest sibling we own but haven't opened: gated with the longer
//     unopened-grace so a later BuildIndex can reuse it on cold start.
//   - everything else (older siblings, anything under an unowned resource):
//     gated with the normal grace.
//
// Failures are best-effort: we log and continue so one bad directory doesn't
// block the rest of the sweep.
func (b *bleveBackend) sweepResource(ctx context.Context, root *os.Root, resourceRel string, key resource.NamespacedResource, stats *diskCleanupStats) {
	entries := b.iterDirs(root, resourceRel, stats)
	if len(entries) == 0 {
		return
	}

	// Snapshot ownership and the cached active index name once per resource.
	owned, ownErr := b.ownsIndexFn(key)
	if ownErr != nil {
		// Fail safe: keep every candidate in this resource until the next pass
		// resolves ownership. Mirrors how findPreviousFileBasedIndex treats
		// transient open errors.
		b.log.Warn("Disk index cleanup: ownership probe failed", "key", key, "err", ownErr)
		stats.ownershipErrors++
		stats.errors++
		return
	}

	// iterDirs returns entries sorted by filename. Bleve timestamp names
	// (YYYYMMDD-HHMMSS) sort chronologically, so the last entry is the newest
	// sibling.
	newest := entries[len(entries)-1].Name()

	for _, ent := range entries {
		if ctx.Err() != nil {
			return
		}
		name := ent.Name()
		candidateRel := path.Join(resourceRel, name)
		stats.scanned++

		// Re-read on every iteration so a BuildIndex that completes
		// mid-sweep — promoting a new index into the cache and then
		// unregistering its in-flight dir — still gets the active-index
		// keep on the subsequent candidates.
		cachedName := b.cachedFileIndexName(key)

		// Active index: the directory we currently have open. Keep
		// unconditionally — deleting it would close-and-lose the live index.
		if owned && cachedName != "" && name == cachedName {
			stats.keptActive++
			continue
		}

		// Newest sibling of an owned resource we haven't opened: use the
		// longer unopened-grace so cold-start BuildIndex can still pick it up.
		// Older siblings under the same resource fall through to the normal
		// grace below. Unowned resources never get the longer grace.
		candidateGrace := b.opts.DiskCleanupGracePeriod
		if owned && cachedName == "" && name == newest {
			candidateGrace = b.opts.DiskCleanupUnopenedGracePeriod
		}

		b.tryRemoveCandidate(root, candidateRel, diskCleanupKindIndex, candidateGrace, stats)
	}
}

// cachedFileIndexName returns the basename of the currently cached file-based
// index directory for key, or "" if no file-based index is cached. The bleve
// Index.Name() returns the absolute path passed to NewUsing/OpenUsing, which
// we slice down to the timestamp leaf.
func (b *bleveBackend) cachedFileIndexName(key resource.NamespacedResource) string {
	b.cacheMx.RLock()
	defer b.cacheMx.RUnlock()
	idx := b.cache[key]
	if idx == nil || idx.indexStorage != indexStorageFile {
		return ""
	}
	return filepath.Base(idx.index.Name())
}

// sweepSnapshotsTree handles <root>/snapshots/<ns>/<res>.<group>/upload-*.
// Snapshot staging dirs are never owned and never reused, so the only gates
// are the in-flight refcount installed by newSnapshotStagingDir (defense in
// depth against unreliable mtimes) and the mtime gate that catches
// everything else (in-flight CopyTo writes, recently finished uploads that
// haven't yet been removed by their deferred cleanup).
func (b *bleveBackend) sweepSnapshotsTree(ctx context.Context, root *os.Root, snapshotsRel string, stats *diskCleanupStats) {
	for _, nsEnt := range b.iterDirs(root, snapshotsRel, stats) {
		if ctx.Err() != nil {
			return
		}
		nsRel := path.Join(snapshotsRel, nsEnt.Name())
		for _, resEnt := range b.iterDirs(root, nsRel, stats) {
			if ctx.Err() != nil {
				return
			}
			resourceRel := path.Join(nsRel, resEnt.Name())
			b.sweepSnapshotResource(ctx, root, resourceRel, stats)
			b.tryRemoveIfEmpty(root, resourceRel, stats)
		}
		b.tryRemoveIfEmpty(root, nsRel, stats)
	}
	// Leave snapshotsRel itself in place; newSnapshotStagingDir would just
	// recreate it on the next upload.
}

func (b *bleveBackend) sweepSnapshotResource(ctx context.Context, root *os.Root, resourceRel string, stats *diskCleanupStats) {
	for _, ent := range b.iterDirs(root, resourceRel, stats) {
		if ctx.Err() != nil {
			return
		}
		candidateRel := path.Join(resourceRel, ent.Name())
		stats.scanned++
		b.tryRemoveCandidate(root, candidateRel, diskCleanupKindSnapshotStaging, b.opts.DiskCleanupGracePeriod, stats)
	}
}

// hasFreshActivity reports whether anything inside rel has been written to
// recently enough that we should leave it alone. The check has two steps:
//
// Step 1 (fast path): stat the candidate and its store/ subdir. POSIX-compliant
// filesystems bump directory mtime when entries are added or removed, which
// covers scorch segment churn and snapshot CopyTo — the common cases.
//
// Step 2 (slow path): if both stats above are stale, walk the candidate and
// short-circuit on the first file or directory entry whose mtime is fresh.
// File mtime is universally bumped by write(2), so the slow path's
// correctness does not depend on directory mtime semantics.
//
// grace <= 0 disables the gate. The caller never passes 0 in production (the
// goroutine is only started when DiskCleanupInterval > 0 and we configure a
// non-zero default), but tests find the explicit short-circuit useful.
func hasFreshActivity(root *os.Root, rel string, now time.Time, grace time.Duration) bool {
	if grace <= 0 {
		return false
	}
	fresh := func(info os.FileInfo) bool {
		return info != nil && now.Sub(info.ModTime()) <= grace
	}
	if info, err := root.Stat(rel); err == nil && fresh(info) {
		return true
	}
	if info, err := root.Stat(path.Join(rel, "store")); err == nil && fresh(info) {
		return true
	}

	found := false
	_ = fs.WalkDir(root.FS(), rel, func(_ string, d fs.DirEntry, err error) error {
		if err != nil {
			// Transient errors don't tell us anything about freshness; keep
			// walking. If the directory has truly disappeared we'll exit
			// naturally.
			return nil
		}
		info, infoErr := d.Info()
		if infoErr != nil {
			return nil
		}
		if fresh(info) {
			found = true
			return fs.SkipAll
		}
		return nil
	})
	return found
}

// tryRemoveIfEmpty removes rel within root if it has no children. It is the
// best-effort tail of every sweep: a missing or non-empty directory is fine
// (no-op), while a real failure (permission, IO) is logged and taints the
// run's outcome so it doesn't disappear silently.
func (b *bleveBackend) tryRemoveIfEmpty(root *os.Root, rel string, stats *diskCleanupStats) {
	f, err := root.Open(rel)
	if err != nil {
		if !os.IsNotExist(err) {
			b.log.Warn("Disk index cleanup: removing empty dir", "dir", joinRoot(root, rel), "err", err)
			stats.errors++
		}
		return
	}
	names, _ := f.Readdirnames(1)
	_ = f.Close()
	if len(names) > 0 {
		return
	}
	if err := root.Remove(rel); err != nil && !os.IsNotExist(err) {
		b.log.Warn("Disk index cleanup: removing empty dir", "dir", joinRoot(root, rel), "err", err)
		stats.errors++
	}
}

// joinRoot combines an os.Root with a root-relative path (slash-separated,
// as used by os.Root.FS()) into the OS-native path of that entry. Going
// through root.Name() keeps these strings tied to the FD we are actually
// operating on, instead of re-reading b.opts.Root.
//
// In our flow the returned path is also absolute, because NewBleveBackend
// runs filepath.Abs on opts.Root before opening it. joinRoot does NOT
// re-resolve it: callers that pass the returned path to inFlightBuildDirs
// (which keys on absolute paths) rely on that precondition.
func joinRoot(root *os.Root, rel string) string {
	return filepath.Join(root.Name(), filepath.FromSlash(rel))
}

func (b *bleveBackend) recordDiskCleanupRun(outcome string) {
	if b.indexMetrics == nil {
		return
	}
	b.indexMetrics.IndexDiskCleanupRuns.WithLabelValues(outcome).Inc()
}

func (b *bleveBackend) recordDiskCleanupDirsDeleted(kind, outcome string) {
	if b.indexMetrics == nil {
		return
	}
	b.indexMetrics.IndexDiskCleanupDirsDeleted.WithLabelValues(kind, outcome).Inc()
}

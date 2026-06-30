package search

import (
	"io/fs"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// setupDiskCleanupBackend wires a minimal bleveBackend that runDiskCleanup can
// drive directly, without starting any background goroutines. ownsFn defaults
// to "everything owned" when nil. The unopened-grace defaults to the same
// value as grace; tests that exercise the longer-grace branch override
// b.opts.DiskCleanupUnopenedGracePeriod explicitly.
func setupDiskCleanupBackend(t *testing.T, grace time.Duration, ownsFn func(resource.NamespacedResource) (bool, error)) (*bleveBackend, *resource.BleveIndexMetrics) {
	t.Helper()
	opts := []setupOption{
		withFileThreshold(5),
	}
	if ownsFn != nil {
		opts = append(opts, withOwnsIndexFn(ownsFn))
	}
	b, _ := setupBleveBackend(t, opts...)
	b.opts.DiskCleanupInterval = time.Hour // value is not used; just non-zero for completeness
	b.opts.DiskCleanupGracePeriod = grace
	b.opts.DiskCleanupUnopenedGracePeriod = grace
	// Register the cleanup metric label set the way the production startup
	// path would.
	b.indexMetrics.InitDiskCleanupMetrics()
	return b, b.indexMetrics
}

// mkdirOld creates a directory tree and rewinds every entry's mtime so the
// fast and slow paths of the mtime gate both see it as stale.
func mkdirOld(t *testing.T, root string, parts ...string) string {
	t.Helper()
	dir := filepath.Join(append([]string{root}, parts...)...)
	require.NoError(t, os.MkdirAll(dir, 0o750))
	chtimesRecursive(t, dir, time.Now().Add(-24*time.Hour))
	return dir
}

// chtimesRecursive rewinds the mtime/atime of every entry under dir. It uses
// os.Root-anchored APIs so gosec G122 (which forbids race-prone
// filepath.WalkDir callbacks) is satisfied — same posture the production
// sweep uses.
func chtimesRecursive(t *testing.T, dir string, when time.Time) {
	t.Helper()
	root, err := os.OpenRoot(dir)
	require.NoError(t, err)
	t.Cleanup(func() { _ = root.Close() })
	require.NoError(t, fs.WalkDir(root.FS(), ".", func(p string, _ fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		return root.Chtimes(p, when, when)
	}))
}

// mkdirFresh creates a directory tree and leaves every entry's mtime current
// so the fast path keeps it.
func mkdirFresh(t *testing.T, root string, parts ...string) string {
	t.Helper()
	dir := filepath.Join(append([]string{root}, parts...)...)
	require.NoError(t, os.MkdirAll(dir, 0o750))
	return dir
}

// writeFileOld writes a file under dir and stamps it with an old mtime so the
// slow-path walk also sees stale entries.
func writeFileOld(t *testing.T, dir, name string) {
	t.Helper()
	require.NoError(t, os.MkdirAll(dir, 0o750))
	path := filepath.Join(dir, name)
	require.NoError(t, os.WriteFile(path, []byte("x"), 0o600))
	old := time.Now().Add(-24 * time.Hour)
	require.NoError(t, os.Chtimes(path, old, old))
	require.NoError(t, os.Chtimes(dir, old, old))
}

func TestRunDiskCleanup_UnownedResource_OldDirsDeleted(t *testing.T) {
	owns := func(_ resource.NamespacedResource) (bool, error) { return false, nil }
	b, metrics := setupDiskCleanupBackend(t, time.Minute, owns)

	root := b.opts.Root
	dirA := mkdirOld(t, root, "ns1", "dashboards.dashboard.grafana.app", "20240101-000000")
	writeFileOld(t, dirA, "root.bolt")

	b.runDiskCleanup(t.Context())

	require.NoDirExists(t, dirA)
	// Parent dirs cleared up too (leak cause E).
	require.NoDirExists(t, filepath.Join(root, "ns1", "dashboards.dashboard.grafana.app"))
	require.NoDirExists(t, filepath.Join(root, "ns1"))

	require.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexDiskCleanupDirsDeleted.WithLabelValues("index", "success")))
	require.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexDiskCleanupRuns.WithLabelValues("success")))
}

func TestRunDiskCleanup_UnownedResource_FreshDirKept(t *testing.T) {
	owns := func(_ resource.NamespacedResource) (bool, error) { return false, nil }
	b, metrics := setupDiskCleanupBackend(t, time.Hour, owns)

	root := b.opts.Root
	dir := mkdirFresh(t, root, "ns1", "dashboards.dashboard.grafana.app", "20240101-000000")

	b.runDiskCleanup(t.Context())

	require.DirExists(t, dir)
	require.Equal(t, 0.0, testutil.ToFloat64(metrics.IndexDiskCleanupDirsDeleted.WithLabelValues("index", "success")))
}

func TestRunDiskCleanup_OwnedResource_KeepsCachedActive(t *testing.T) {
	b, _ := setupDiskCleanupBackend(t, time.Minute, nil)

	ns := resource.NamespacedResource{Namespace: "ns1", Group: "dashboard.grafana.app", Resource: "dashboards"}
	resourceDir := b.getResourceDir(ns)
	require.NoError(t, os.MkdirAll(resourceDir, 0o750))

	// The active index is a real bleve index so cachedFileIndexName can read
	// its Name() like it would in production. Sibling "20240101-000000" stays
	// a bare directory — it would normally be a stale leftover that the sweep
	// is meant to clean up.
	mapper, err := GetBleveMappings(nil, "", "", nil)
	require.NoError(t, err)
	activeDir := filepath.Join(resourceDir, "20240301-120000")
	activeIdx, err := newBleveIndex(activeDir, mapper, time.Now(), buildVersion, nil, "")
	require.NoError(t, err)
	t.Cleanup(func() { _ = activeIdx.Close() })
	older := mkdirOld(t, resourceDir, "20240101-000000")
	writeFileOld(t, older, "root.bolt")

	b.cacheMx.Lock()
	b.cache[ns] = &bleveIndex{key: ns, index: activeIdx, indexStorage: indexStorageFile}
	b.cacheMx.Unlock()
	t.Cleanup(func() {
		b.cacheMx.Lock()
		delete(b.cache, ns)
		b.cacheMx.Unlock()
	})

	// Force the active dir to look stale on disk so we know the
	// active-index check — not the mtime gate — is what's saving it.
	chtimesRecursive(t, activeDir, time.Now().Add(-24*time.Hour))

	b.runDiskCleanup(t.Context())

	require.DirExists(t, activeDir)
	require.NoDirExists(t, older)
}

func TestRunDiskCleanup_UnownedResource_KeepsCachedActive(t *testing.T) {
	// Regression: after a ring reshuffle this pod can lose ownership of a
	// resource while its file-based index is still cached and in use. The
	// cleanup sweep must keep the on-disk directory until the eviction loop
	// closes the index; otherwise the live scorch persister fails on its
	// next segment write with "persist err: ... no such file or directory".
	owns := func(_ resource.NamespacedResource) (bool, error) { return false, nil }
	b, metrics := setupDiskCleanupBackend(t, time.Minute, owns)

	ns := resource.NamespacedResource{Namespace: "ns1", Group: "dashboard.grafana.app", Resource: "dashboards"}
	resourceDir := b.getResourceDir(ns)
	require.NoError(t, os.MkdirAll(resourceDir, 0o750))

	mapper, err := GetBleveMappings(nil, "", "", nil)
	require.NoError(t, err)
	activeDir := filepath.Join(resourceDir, "20240301-120000")
	activeIdx, err := newBleveIndex(activeDir, mapper, time.Now(), buildVersion, nil, "")
	require.NoError(t, err)
	t.Cleanup(func() { _ = activeIdx.Close() })
	older := mkdirOld(t, resourceDir, "20240101-000000")
	writeFileOld(t, older, "root.bolt")

	b.cacheMx.Lock()
	b.cache[ns] = &bleveIndex{key: ns, index: activeIdx, indexStorage: indexStorageFile}
	b.cacheMx.Unlock()
	t.Cleanup(func() {
		b.cacheMx.Lock()
		delete(b.cache, ns)
		b.cacheMx.Unlock()
	})

	// Force the active dir to look stale on disk so the only thing that can
	// save it is the active-cache check (not the mtime gate). This mirrors
	// production, where a read-heavy unowned index ages out of fresh-mtime
	// well before the eviction loop closes it.
	chtimesRecursive(t, activeDir, time.Now().Add(-24*time.Hour))

	b.runDiskCleanup(t.Context())

	require.DirExists(t, activeDir, "cached active index directory must survive even when this pod no longer owns it")
	require.NoDirExists(t, older, "unowned, uncached, stale sibling is still deleted")
	require.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexDiskCleanupDirsDeleted.WithLabelValues("index", "success")))
}

func TestRunDiskCleanup_OwnedResource_KeepsNewestSiblingWhenNotCached(t *testing.T) {
	// Normal grace is short so the older sibling falls through to delete.
	// Unopened grace is generous so the newest — stale by 24h on disk —
	// survives the mtime gate as the cold-start reuse candidate.
	b, _ := setupDiskCleanupBackend(t, time.Minute, nil)
	b.opts.DiskCleanupUnopenedGracePeriod = 48 * time.Hour
	root := b.opts.Root

	resourceDir := filepath.Join(root, "ns1", "dashboards.dashboard.grafana.app")
	older := mkdirOld(t, resourceDir, "20240101-000000")
	newer := mkdirOld(t, resourceDir, "20240301-120000")

	b.runDiskCleanup(t.Context())

	require.DirExists(t, newer)
	require.NoDirExists(t, older)
}

func TestRunDiskCleanup_OwnedResource_NewestSiblingDeletedWhenUnopenedGraceExpires(t *testing.T) {
	// Both siblings are well past unopened-grace, so even the newest gets
	// reclaimed. This is the "truly idle owned resource" path.
	b, _ := setupDiskCleanupBackend(t, time.Minute, nil)
	b.opts.DiskCleanupUnopenedGracePeriod = time.Hour
	root := b.opts.Root

	resourceDir := filepath.Join(root, "ns1", "dashboards.dashboard.grafana.app")
	older := mkdirOld(t, resourceDir, "20240101-000000")
	newer := mkdirOld(t, resourceDir, "20240301-120000")
	writeFileOld(t, older, "root.bolt")
	writeFileOld(t, newer, "root.bolt")

	b.runDiskCleanup(t.Context())

	require.NoDirExists(t, newer)
	require.NoDirExists(t, older)
}

func TestRunDiskCleanup_InFlightBuildDirNeverDeleted(t *testing.T) {
	owns := func(_ resource.NamespacedResource) (bool, error) { return false, nil }
	b, _ := setupDiskCleanupBackend(t, time.Minute, owns)
	root := b.opts.Root

	dir := mkdirOld(t, root, "ns1", "dashboards.dashboard.grafana.app", "20240101-000000")
	b.registerInFlightBuildDir(dir)
	t.Cleanup(func() { b.unregisterInFlightBuildDir(dir) })

	b.runDiskCleanup(t.Context())

	require.DirExists(t, dir, "in-flight registered directory must survive the sweep")
}

func TestRunDiskCleanup_EmptyParentDirsRemoved(t *testing.T) {
	owns := func(_ resource.NamespacedResource) (bool, error) { return false, nil }
	b, _ := setupDiskCleanupBackend(t, time.Minute, owns)
	root := b.opts.Root

	mkdirOld(t, root, "ns1", "dashboards.dashboard.grafana.app", "20240101-000000")
	mkdirOld(t, root, "ns1", "folders.folder.grafana.app", "20240101-000000")

	b.runDiskCleanup(t.Context())

	require.NoDirExists(t, filepath.Join(root, "ns1", "dashboards.dashboard.grafana.app"))
	require.NoDirExists(t, filepath.Join(root, "ns1", "folders.folder.grafana.app"))
	require.NoDirExists(t, filepath.Join(root, "ns1"))
}

func TestRunDiskCleanup_SnapshotStaging_OldDeleted(t *testing.T) {
	b, metrics := setupDiskCleanupBackend(t, time.Minute, nil)
	root := b.opts.Root

	stale := mkdirOld(t, root, "snapshots", "ns1", "dashboards.dashboard.grafana.app", "upload-1234567890")
	writeFileOld(t, filepath.Join(stale, "store"), "root.bolt")
	// Force the staging directory itself (and store/) to look old after the
	// nested files were written.
	chtimesRecursive(t, stale, time.Now().Add(-24*time.Hour))

	b.runDiskCleanup(t.Context())

	require.NoDirExists(t, stale)
	require.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexDiskCleanupDirsDeleted.WithLabelValues("snapshot_staging", "success")))
}

func TestRunDiskCleanup_SnapshotStaging_FreshKept(t *testing.T) {
	b, _ := setupDiskCleanupBackend(t, time.Hour, nil)
	root := b.opts.Root

	fresh := mkdirFresh(t, root, "snapshots", "ns1", "dashboards.dashboard.grafana.app", "upload-1234567890")
	require.NoError(t, os.MkdirAll(filepath.Join(fresh, "store"), 0o750))
	require.NoError(t, os.WriteFile(filepath.Join(fresh, "store", "root.bolt"), []byte("x"), 0o600))

	b.runDiskCleanup(t.Context())

	require.DirExists(t, fresh, "in-flight CopyTo staging directory must survive when fresh")
}

func TestRunDiskCleanup_OwnershipErrorFailsSafe(t *testing.T) {
	owns := func(_ resource.NamespacedResource) (bool, error) {
		return false, fs.ErrInvalid
	}
	b, metrics := setupDiskCleanupBackend(t, time.Minute, owns)
	root := b.opts.Root

	dir := mkdirOld(t, root, "ns1", "dashboards.dashboard.grafana.app", "20240101-000000")

	b.runDiskCleanup(t.Context())

	require.DirExists(t, dir, "ownership errors must fail safe (keep directories)")
	require.Equal(t, 0.0, testutil.ToFloat64(metrics.IndexDiskCleanupDirsDeleted.WithLabelValues("index", "success")))
	// One failing ownership probe taints the whole run as "error".
	require.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexDiskCleanupRuns.WithLabelValues("error")))
}

func TestRunDiskCleanup_UnknownNamespaceLayoutIgnored(t *testing.T) {
	owns := func(_ resource.NamespacedResource) (bool, error) { return false, nil }
	b, _ := setupDiskCleanupBackend(t, time.Minute, owns)
	root := b.opts.Root

	// Directory whose name does not parse as <resource>.<group>: never touched.
	weird := mkdirOld(t, root, "ns1", "not-a-resource-group", "20240101-000000")

	b.runDiskCleanup(t.Context())

	require.DirExists(t, weird, "directories that don't match <resource>.<group> are left alone")
}

func TestSplitResourceGroup(t *testing.T) {
	cases := map[string]struct {
		in    string
		res   string
		group string
		ok    bool
	}{
		"normal":         {"dashboards.dashboard.grafana.app", "dashboards", "dashboard.grafana.app", true},
		"no dot":         {"resourcename", "", "", false},
		"leading dot":    {".group", "", "", false},
		"trailing dot":   {"res.", "", "", false},
		"single segment": {"res.group", "res", "group", true},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			res, group, ok := splitResourceGroup(c.in)
			require.Equal(t, c.ok, ok)
			require.Equal(t, c.res, res)
			require.Equal(t, c.group, group)
		})
	}
}

func TestHasFreshActivity(t *testing.T) {
	root, err := os.OpenRoot(t.TempDir())
	require.NoError(t, err)
	t.Cleanup(func() { _ = root.Close() })
	t.Run("disabled when grace is zero", func(t *testing.T) {
		require.NoError(t, root.Mkdir("disabled", 0o750))
		require.False(t, hasFreshActivity(root, "disabled", time.Now(), 0))
	})
	t.Run("fast path keeps directory whose mtime is fresh", func(t *testing.T) {
		require.NoError(t, root.Mkdir("fresh", 0o750))
		require.True(t, hasFreshActivity(root, "fresh", time.Now(), time.Hour))
	})
	t.Run("slow path finds fresh file under stale parent", func(t *testing.T) {
		require.NoError(t, root.Mkdir("slow", 0o750))
		f, err := root.Create("slow/fresh.txt")
		require.NoError(t, err)
		_, err = f.WriteString("x")
		require.NoError(t, err)
		require.NoError(t, f.Close())
		old := time.Now().Add(-24 * time.Hour)
		require.NoError(t, root.Chtimes("slow", old, old))
		require.True(t, hasFreshActivity(root, "slow", time.Now(), time.Hour))
	})
	t.Run("all stale returns false", func(t *testing.T) {
		require.NoError(t, root.Mkdir("stale", 0o750))
		f, err := root.Create("stale/old.txt")
		require.NoError(t, err)
		_, err = f.WriteString("x")
		require.NoError(t, err)
		require.NoError(t, f.Close())
		old := time.Now().Add(-24 * time.Hour)
		require.NoError(t, root.Chtimes("stale/old.txt", old, old))
		require.NoError(t, root.Chtimes("stale", old, old))
		require.False(t, hasFreshActivity(root, "stale", time.Now(), time.Hour))
	})
}

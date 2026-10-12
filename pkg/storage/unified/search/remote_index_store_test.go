package search

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/blevesearch/bleve/v2"
	"github.com/oklog/ulid/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// testLogger is the logger passed to package-level helpers from tests. Tests
// generally don't assert on log output, so a single shared logger is fine.
var testLogger = log.New("remote-index-test")

type transientTestError struct{}

func (transientTestError) Error() string   { return "transient timeout" }
func (transientTestError) Timeout() bool   { return true }
func (transientTestError) Temporary() bool { return true }

func useFastSnapshotStoreRetries(t *testing.T) {
	t.Helper()
	old := snapshotStoreRetryBackoffConfig
	snapshotStoreRetryBackoffConfig.MinBackoff = 0
	snapshotStoreRetryBackoffConfig.MaxBackoff = 0
	snapshotStoreRetryBackoffConfig.MaxRetries = 2
	oldMeta := snapshotStoreMetadataRetryBackoffConfig
	snapshotStoreMetadataRetryBackoffConfig.MinBackoff = 0
	snapshotStoreMetadataRetryBackoffConfig.MaxBackoff = 0
	t.Cleanup(func() {
		snapshotStoreRetryBackoffConfig = old
		snapshotStoreMetadataRetryBackoffConfig = oldMeta
	})
}

// Failing a metadata read leaves no candidate, so it waits longer than a file read.
func TestMetadataRetriesOutlastFileRetries(t *testing.T) {
	require.Greater(t, snapshotStoreMetadataRetryBackoffConfig.MaxRetries, snapshotStoreRetryBackoffConfig.MaxRetries)

	useFastSnapshotStoreRetries(t)
	attempts := 0
	_, err := retryMetadataRemoteIndexStoreValue(t.Context(), "test", nil, func() (struct{}, error) {
		attempts++
		return struct{}{}, transientTestError{}
	})
	require.Error(t, err)
	require.Equal(t, snapshotStoreMetadataRetryBackoffConfig.MaxRetries+1, attempts)
}

func newTestNsResource() resource.NamespacedResource {
	return resource.NamespacedResource{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}
}

// createTestBleveIndex creates a real bleve index with sample documents.
func createTestBleveIndex(t *testing.T) string {
	t.Helper()
	dir := filepath.Join(t.TempDir(), "bleve-index")
	idx, err := bleve.New(dir, bleve.NewIndexMapping())
	require.NoError(t, err)

	for id, doc := range map[string]map[string]string{
		"dash-1": {"title": "Production Overview", "folder": "ops"},
		"dash-2": {"title": "API Latency", "folder": "ops"},
		"dash-3": {"title": "Frontend Errors", "folder": "frontend"},
	} {
		require.NoError(t, idx.Index(id, doc))
	}
	require.NoError(t, idx.Close())
	return dir
}

// writeTestSnapshotFile writes data as relPath of the snapshot at indexKey.
// It takes no testing.T so it can run on a helper goroutine.
func writeTestSnapshotFile(ctx context.Context, store RemoteIndexStore, ns resource.NamespacedResource, indexKey ulid.ULID, relPath string, data []byte) error {
	f, err := os.CreateTemp("", "snapshot-file-*")
	if err != nil {
		return err
	}
	defer func() {
		_ = f.Close()
		_ = os.Remove(f.Name())
	}()
	if _, err := f.Write(data); err != nil {
		return err
	}
	return store.WriteSnapshotFile(ctx, ns, indexKey, relPath, f)
}

// TestRemoteIndexStore_ListIndexes_LegacyMetaWithoutBuildStartTime verifies
// that a snapshot manifest produced before the BuildTime field was
// introduced is still accepted by ListIndexSnapshots and surfaces a zero-value
// BuildTime. Readers must treat zero as "unknown".
func TestRemoteIndexStore_ListIndexes_LegacyMetaWithoutBuildStartTime(t *testing.T) {
	ctx := t.Context()
	store := newTestKVRemoteIndexStore(t)
	ns := newTestNsResource()
	indexKey := ulid.Make()

	// Hand-crafted manifest with no build_time field at all,
	// mirroring the stored shape of legacy snapshots.
	legacyManifest := []byte(`{
		"build_version": "11.0.0",
		"upload_timestamp": "2024-01-01T00:00:00Z",
		"latest_resource_version": 42,
		"files": {"store/root.bolt": 1}
	}`)
	require.NoError(t, store.WriteSnapshotManifest(ctx, ns, indexKey, legacyManifest))

	listed, err := ListIndexSnapshots(ctx, store, ns, testLogger)
	require.NoError(t, err)
	require.Contains(t, listed, indexKey)
	assert.True(t, listed[indexKey].BuildTime.IsZero(),
		"legacy manifest should decode to zero-valued BuildTime, got %s",
		listed[indexKey].BuildTime)
	assert.Equal(t, "11.0.0", listed[indexKey].BuildVersion)
	assert.Equal(t, int64(42), listed[indexKey].LatestResourceVersion)
}

func TestValidateIndexSnapshotManifest(t *testing.T) {
	tests := []struct {
		name    string
		files   map[string]int64
		wantErr string
	}{
		{name: "valid paths", files: map[string]int64{"store/root.bolt": 100, "store/00001.zap": 200}},
		{name: "leading double-dot in filename", files: map[string]int64{"..foo/bar.zap": 100}},
		{name: "empty file list", files: map[string]int64{}, wantErr: "empty file manifest"},
		{name: "path traversal", files: map[string]int64{"../../../tmp/escape": 100}, wantErr: "invalid path"},
		{name: "absolute path", files: map[string]int64{"/tmp/escape": 100}, wantErr: "invalid path"},
		{name: "non-canonical dotslash", files: map[string]int64{"./store/root.bolt": 100}, wantErr: "non-canonical"},
		{name: "non-canonical double dot", files: map[string]int64{"store/../store/root.bolt": 100}, wantErr: "non-canonical"},
		{name: "dot entry", files: map[string]int64{".": 100}, wantErr: "invalid path"},
		{name: "parent dir entry", files: map[string]int64{"..": 100}, wantErr: "invalid path"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateIndexSnapshotManifest(&IndexMeta{Files: tt.files})
			if tt.wantErr == "" {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
				require.ErrorIs(t, err, ErrInvalidManifest)
				require.Contains(t, err.Error(), tt.wantErr)
			}
		})
	}
}

func TestRemoteIndexStore_UploadRejectsNonRegularFiles(t *testing.T) {
	ctx := t.Context()
	store := newTestKVRemoteIndexStore(t)
	ns := newTestNsResource()

	srcDir := createTestBleveIndex(t)

	// Add a symlink into the bleve index directory
	externalFile := filepath.Join(t.TempDir(), "secret.txt")
	require.NoError(t, os.WriteFile(externalFile, []byte("secret"), 0600))
	require.NoError(t, os.Symlink(externalFile, filepath.Join(srcDir, "sneaky.zap")))

	meta := IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 10}
	_, err := UploadIndexSnapshot(ctx, store, ns, srcDir, meta, testLogger)
	require.Error(t, err)
	require.ErrorIs(t, err, ErrNonRegularFile)
}

func TestRemoteIndexStore_DownloadRejectsCorruptMetaJSON(t *testing.T) {
	ctx := t.Context()
	store := newTestKVRemoteIndexStore(t)
	ns := newTestNsResource()
	key := ulid.Make()

	writeManifest := func(t *testing.T, meta IndexMeta) {
		t.Helper()
		metaBytes, err := json.Marshal(meta)
		require.NoError(t, err)
		require.NoError(t, store.WriteSnapshotManifest(ctx, ns, key, metaBytes))
	}

	t.Run("missing snapshot manifest", func(t *testing.T) {
		_, err := DownloadIndexSnapshot(ctx, store, ns, key, t.TempDir())
		require.ErrorIs(t, err, ErrSnapshotNotFound)
	})

	t.Run("invalid JSON", func(t *testing.T) {
		require.NoError(t, store.WriteSnapshotManifest(ctx, ns, key, []byte("{not json")))
		_, err := DownloadIndexSnapshot(ctx, store, ns, key, t.TempDir())
		require.Error(t, err)
		require.Contains(t, err.Error(), "parsing snapshot manifest")
	})

	t.Run("empty file manifest", func(t *testing.T) {
		writeManifest(t, IndexMeta{BuildVersion: "11.0.0", Files: map[string]int64{}})
		_, err := DownloadIndexSnapshot(ctx, store, ns, key, t.TempDir())
		require.Error(t, err)
		require.Contains(t, err.Error(), "empty file manifest")
	})

	t.Run("non-canonical path", func(t *testing.T) {
		writeManifest(t, IndexMeta{BuildVersion: "11.0.0", Files: map[string]int64{"store/../store/root.bolt": 100}})
		_, err := DownloadIndexSnapshot(ctx, store, ns, key, t.TempDir())
		require.Error(t, err)
		require.Contains(t, err.Error(), "non-canonical")
	})

	t.Run("absolute path", func(t *testing.T) {
		writeManifest(t, IndexMeta{BuildVersion: "11.0.0", Files: map[string]int64{"/etc/passwd": 100}})
		_, err := DownloadIndexSnapshot(ctx, store, ns, key, t.TempDir())
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid")
	})
}

func TestRemoteIndexStore_DownloadValidatesCompleteness(t *testing.T) {
	ctx := t.Context()
	store := newTestKVRemoteIndexStore(t)
	ns := newTestNsResource()

	srcDir := createTestBleveIndex(t)
	meta := IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 10}
	indexKey, err := UploadIndexSnapshot(ctx, store, ns, srcDir, meta, testLogger)
	require.NoError(t, err)

	// Delete one data file to simulate a partial upload.
	gotMeta, err := ReadIndexSnapshotManifest(ctx, store, ns, indexKey)
	require.NoError(t, err)
	for relPath := range gotMeta.Files {
		require.NoError(t, store.store.Delete(ctx, IndexSnapshotDataSection, store.dataChunkKey(ns, indexKey, relPath, 0)))
		break
	}

	_, err = DownloadIndexSnapshot(ctx, store, ns, indexKey, filepath.Join(t.TempDir(), "dl"))
	require.ErrorIs(t, err, ErrSnapshotNotFound)
}

func TestRemoteIndexStore_UploadRejectsEmptyDirectory(t *testing.T) {
	ctx := t.Context()
	store := newTestKVRemoteIndexStore(t)
	ns := newTestNsResource()

	emptyDir := t.TempDir()
	meta := IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 10}
	_, err := UploadIndexSnapshot(ctx, store, ns, emptyDir, meta, testLogger)
	require.Error(t, err)
	require.Contains(t, err.Error(), "no files to upload")
}

func TestRemoteIndexStore_UploadExcludesMetaJSON(t *testing.T) {
	ctx := t.Context()
	store := newTestKVRemoteIndexStore(t)
	ns := newTestNsResource()

	srcDir := createTestBleveIndex(t)
	// Plant a stale snapshot manifest in the source directory
	require.NoError(t, os.WriteFile(filepath.Join(srcDir, snapshotManifestFile), []byte(`{"stale":"data"}`), 0600))

	meta := IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 10}
	indexKey, err := UploadIndexSnapshot(ctx, store, ns, srcDir, meta, testLogger)
	require.NoError(t, err)

	uploaded, err := ReadIndexSnapshotManifest(ctx, store, ns, indexKey)
	require.NoError(t, err)
	require.NotContains(t, uploaded.Files, snapshotManifestFile)
}

// errorStore wraps a RemoteIndexStore and fails selected calls.
type errorStore struct {
	RemoteIndexStore
	writeFileFn      func() error // if set, called before each WriteSnapshotFile
	writeManifestErr error
	readFileFn       func() error // if set, called before each ReadSnapshotFile
	readManifestErr  error
}

func (e *errorStore) WriteSnapshotFile(ctx context.Context, ns resource.NamespacedResource, indexKey ulid.ULID, relPath string, src *os.File) error {
	if e.writeFileFn != nil {
		if err := e.writeFileFn(); err != nil {
			return err
		}
	}
	return e.RemoteIndexStore.WriteSnapshotFile(ctx, ns, indexKey, relPath, src)
}

func (e *errorStore) WriteSnapshotManifest(ctx context.Context, ns resource.NamespacedResource, indexKey ulid.ULID, manifest []byte) error {
	if e.writeManifestErr != nil {
		return e.writeManifestErr
	}
	return e.RemoteIndexStore.WriteSnapshotManifest(ctx, ns, indexKey, manifest)
}

func (e *errorStore) ReadSnapshotFile(ctx context.Context, ns resource.NamespacedResource, indexKey ulid.ULID, relPath string, dst *os.File, expectedSize int64) error {
	if e.readFileFn != nil {
		if err := e.readFileFn(); err != nil {
			return err
		}
	}
	return e.RemoteIndexStore.ReadSnapshotFile(ctx, ns, indexKey, relPath, dst, expectedSize)
}

func (e *errorStore) ReadSnapshotManifest(ctx context.Context, ns resource.NamespacedResource, indexKey ulid.ULID) ([]byte, error) {
	if e.readManifestErr != nil {
		return nil, e.readManifestErr
	}
	return e.RemoteIndexStore.ReadSnapshotManifest(ctx, ns, indexKey)
}

func failWith(err error) func() error { return func() error { return err } }

func TestRemoteIndexStore_StoreErrors(t *testing.T) {
	ctx := t.Context()
	ns := newTestNsResource()

	uploadSnapshot := func(t *testing.T, store RemoteIndexStore) ulid.ULID {
		t.Helper()
		key, err := UploadIndexSnapshot(ctx, store, ns, createTestBleveIndex(t),
			IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 10}, testLogger)
		require.NoError(t, err)
		return key
	}

	t.Run("upload file error", func(t *testing.T) {
		store := &errorStore{RemoteIndexStore: newTestKVRemoteIndexStore(t), writeFileFn: failWith(fmt.Errorf("upload network timeout"))}

		_, err := UploadIndexSnapshot(ctx, store, ns, createTestBleveIndex(t),
			IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 10}, testLogger)
		require.Error(t, err)
		require.Contains(t, err.Error(), "upload network timeout")
	})

	t.Run("snapshot manifest write error removes partial upload", func(t *testing.T) {
		inner := newTestKVRemoteIndexStore(t)
		store := &errorStore{RemoteIndexStore: inner, writeManifestErr: fmt.Errorf("write quota exceeded")}

		_, err := UploadIndexSnapshot(ctx, store, ns, createTestBleveIndex(t),
			IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 10}, testLogger)
		require.Error(t, err)
		require.Contains(t, err.Error(), "write quota exceeded")

		keys, err := inner.ListIndexKeysIncludingIncomplete(ctx, ns)
		require.NoError(t, err)
		assert.Empty(t, keys)
	})

	t.Run("snapshot manifest download error", func(t *testing.T) {
		store := &errorStore{RemoteIndexStore: newTestKVRemoteIndexStore(t), readManifestErr: fmt.Errorf("access denied")}

		_, err := DownloadIndexSnapshot(ctx, store, ns, ulid.Make(), filepath.Join(t.TempDir(), "dl"))
		require.Error(t, err)
		require.Contains(t, err.Error(), "access denied")
	})

	t.Run("file download error cleans up staging dir", func(t *testing.T) {
		inner := newTestKVRemoteIndexStore(t)
		key := uploadSnapshot(t, inner)
		store := &errorStore{RemoteIndexStore: inner, readFileFn: failWith(fmt.Errorf("connection reset"))}

		parentDir := t.TempDir()
		destDir := filepath.Join(parentDir, "downloaded")
		_, err := DownloadIndexSnapshot(ctx, store, ns, key, destDir)
		require.Error(t, err)
		require.Contains(t, err.Error(), "connection reset")

		// destDir should not exist (staging dir cleaned up, rename never happened)
		_, statErr := os.Stat(destDir)
		require.True(t, os.IsNotExist(statErr), "dest dir should not exist after failure")

		// Parent should still exist and have no leftover staging dirs
		entries, err := os.ReadDir(parentDir)
		require.NoError(t, err)
		assert.Empty(t, entries, "no staging dirs should remain in parent")
	})

	t.Run("download fails if dest already exists", func(t *testing.T) {
		store := newTestKVRemoteIndexStore(t)
		key := uploadSnapshot(t, store)

		destDir := t.TempDir() // already exists
		_, err := DownloadIndexSnapshot(ctx, store, ns, key, destDir)
		require.Error(t, err)
		require.Contains(t, err.Error(), "destination already exists")
	})
}

func TestRetryRemoteIndexStoreValue(t *testing.T) {
	useFastSnapshotStoreRetries(t)
	ctx := context.Background()

	var attempts int
	got, err := retryRemoteIndexStoreValue(ctx, snapshotStoreOpListIndexKeys, testLogger, func() (string, error) {
		attempts++
		if attempts == 1 {
			return "", transientTestError{}
		}
		return "ok", nil
	})
	require.NoError(t, err)
	assert.Equal(t, "ok", got)
	assert.Equal(t, 2, attempts)
}

func TestRetryRemoteIndexStoreValue_NonRetryable(t *testing.T) {
	useFastSnapshotStoreRetries(t)
	ctx := context.Background()

	var attempts int
	_, err := retryRemoteIndexStoreValue(ctx, snapshotStoreOpListIndexKeys, testLogger, func() (string, error) {
		attempts++
		return "", ErrSnapshotNotFound
	})
	require.ErrorIs(t, err, ErrSnapshotNotFound)
	assert.Equal(t, 1, attempts)
}

func TestRemoteIndexStore_RetriesTransientUploadAndDownloadErrors(t *testing.T) {
	useFastSnapshotStoreRetries(t)
	ctx := t.Context()
	ns := newTestNsResource()

	// failFirst returns a hook that fails the first call with a transient error.
	failFirst := func(attempts *atomic.Int32) func() error {
		return func() error {
			if attempts.Add(1) == 1 {
				return transientTestError{}
			}
			return nil
		}
	}

	t.Run("upload file", func(t *testing.T) {
		var uploadAttempts atomic.Int32
		store := &errorStore{RemoteIndexStore: newTestKVRemoteIndexStore(t), writeFileFn: failFirst(&uploadAttempts)}

		indexKey, err := UploadIndexSnapshot(ctx, store, ns, createTestBleveIndex(t),
			IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 10}, testLogger)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, uploadAttempts.Load(), int32(2))

		metas, err := ListIndexSnapshots(ctx, store, ns, testLogger)
		require.NoError(t, err)
		assert.Contains(t, metas, indexKey)
	})

	t.Run("download file", func(t *testing.T) {
		inner := newTestKVRemoteIndexStore(t)
		indexKey, err := UploadIndexSnapshot(ctx, inner, ns, createTestBleveIndex(t),
			IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 10}, testLogger)
		require.NoError(t, err)

		var downloadAttempts atomic.Int32
		store := &errorStore{RemoteIndexStore: inner, readFileFn: failFirst(&downloadAttempts)}

		destDir := filepath.Join(t.TempDir(), "downloaded")
		_, err = DownloadIndexSnapshot(ctx, store, ns, indexKey, destDir)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, downloadAttempts.Load(), int32(2))
		assert.DirExists(t, destDir)
	})
}

func TestRemoteIndexStore_CleanupIncompleteIndexSnapshots_NoneFound(t *testing.T) {
	ctx := t.Context()
	store := newTestKVRemoteIndexStore(t)
	ns := newTestNsResource()

	// Upload a complete index
	srcDir := createTestBleveIndex(t)
	meta := IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 10}
	_, err := UploadIndexSnapshot(ctx, store, ns, srcDir, meta, testLogger)
	require.NoError(t, err)

	// Nothing to clean
	cleaned, err := CleanupIncompleteIndexSnapshots(ctx, store, ns, time.Now(), testLogger)
	require.NoError(t, err)
	assert.Equal(t, 0, cleaned)
}

func TestRemoteIndexStore_CleanupIncompleteIndexSnapshots_CorruptManifest(t *testing.T) {
	ctx := t.Context()
	store := newTestKVRemoteIndexStore(t)
	ns := newTestNsResource()

	// Upload a valid complete index
	srcDir := createTestBleveIndex(t)
	meta := IndexMeta{BuildVersion: "11.0.0", LatestResourceVersion: 10}
	completeKey, err := UploadIndexSnapshot(ctx, store, ns, srcDir, meta, testLogger)
	require.NoError(t, err)

	t.Run("invalid JSON manifest", func(t *testing.T) {
		key := ulid.Make()
		require.NoError(t, writeTestSnapshotFile(ctx, store, ns, key, "store/root.bolt", []byte("data")))
		require.NoError(t, store.WriteSnapshotManifest(ctx, ns, key, []byte("{corrupt")))

		cleaned, err := CleanupIncompleteIndexSnapshots(ctx, store, ns, time.Now(), testLogger)
		require.NoError(t, err)
		assert.Equal(t, 1, cleaned)
	})

	t.Run("empty files manifest", func(t *testing.T) {
		key := ulid.Make()
		require.NoError(t, writeTestSnapshotFile(ctx, store, ns, key, "store/root.bolt", []byte("data")))
		emptyMeta, _ := json.Marshal(IndexMeta{BuildVersion: "11.0.0", Files: map[string]int64{}})
		require.NoError(t, store.WriteSnapshotManifest(ctx, ns, key, emptyMeta))

		cleaned, err := CleanupIncompleteIndexSnapshots(ctx, store, ns, time.Now(), testLogger)
		require.NoError(t, err)
		assert.Equal(t, 1, cleaned)
	})

	// Complete index should still be intact after all cleanups
	indexes, err := ListIndexSnapshots(ctx, store, ns, testLogger)
	require.NoError(t, err)
	assert.Contains(t, indexes, completeKey)
}

func TestRemoteIndexStore_CleanupIncompleteIndexSnapshots_MinAge(t *testing.T) {
	ctx := t.Context()
	store := newTestKVRemoteIndexStore(t)
	ns := newTestNsResource()

	// Create an incomplete upload with a ULID from 2 hours ago.
	oldKey, err := ulid.New(ulid.Timestamp(time.Now().Add(-2*time.Hour)), rand.Reader)
	require.NoError(t, err)
	seedIncompleteSnapshot(t, store, ns, oldKey)

	// Create an incomplete upload with a recent ULID (now).
	recentKey := ulid.Make()
	seedIncompleteSnapshot(t, store, ns, recentKey)

	// Cleanup with a cutoff of 1h ago should only delete the old upload.
	cleaned, err := CleanupIncompleteIndexSnapshots(ctx, store, ns, time.Now().Add(-time.Hour), testLogger)
	require.NoError(t, err)
	assert.Equal(t, 1, cleaned)

	assertNoDataKeys(t, store, ns, oldKey)
	assert.NotEmpty(t, collectDataKeys(t, store, ns, recentKey))
}

// hookableStore wraps a real KVRemoteIndexStore and adds per-method error injection, call counters,
// mid-call callbacks, and controllable lock loss.
//
// Error injection and counters are at the interface-method level
// (WriteSnapshotFile, ReadSnapshotFile, WriteSnapshotManifest,
// ReadSnapshotManifest, ListIndexKeys, ...). Test setters like setUploadErr
// / setDownloadErr are spelled in terms of the higher-level intent ("fail
// the upload") but plumb into the underlying method-level fields; this
// keeps test code readable without coupling it to the exact interface
// shape.
//
// Tests seed snapshots by writing directly to the inner store via seedSnapshot
// or seedDownloadableSnapshot, which lets them pin manifest fields independent
// of UploadIndexSnapshot's ULID-derived UploadTimestamp.
type hookableStore struct {
	inner *KVRemoteIndexStore

	// Error injection. nil means pass through to the inner store.
	mu                   sync.Mutex
	lockBuildErr         error
	lockCleanupErr       error
	listKeysErr          error
	writeSnapshotFileErr error               // fires on WriteSnapshotFile (data files) and WriteSnapshotManifest
	readSnapshotFileErr  error               // fires on ReadSnapshotFile (data-file phase of a download)
	readManifestErrs     map[ulid.ULID]error // fires on ReadSnapshotManifest for the keyed snapshot

	onUpload func() error

	// Counters.
	lockAcquireCalls  atomic.Int32
	lockReleaseCalls  atomic.Int32
	listKeyCalls      atomic.Int32 // ListIndexKeys
	readManifestCalls atomic.Int32 // ReadSnapshotManifest
	downloadCalls     atomic.Int32 // ReadSnapshotFile (data files)
	uploadCalls       atomic.Int32 // WriteSnapshotManifest succeeded — upload complete

	// Last-upload captures. Reset when a write for a new indexKey arrives.
	lastUploadedMeta     IndexMeta
	lastUploadedFiles    []string
	lastUploadedKey      ulid.ULID
	lastLockBuildVersion string

	// Tracks the most recently acquired build lock so signalLockLost can
	// fire it.
	currentLock *hookableLock
}

// newHookableStore returns a fresh hookableStore wrapping a real
// KVRemoteIndexStore.
func newHookableStore(t *testing.T) *hookableStore {
	t.Helper()
	return &hookableStore{inner: newTestKVRemoteIndexStore(t)}
}

func (s *hookableStore) LockBuildIndex(ctx context.Context, ns resource.NamespacedResource, buildVersion string) (IndexStoreLock, error) {
	s.lockAcquireCalls.Add(1)
	s.mu.Lock()
	s.lastLockBuildVersion = buildVersion
	injected := s.lockBuildErr
	s.mu.Unlock()
	if injected != nil {
		return nil, injected
	}
	innerLock, err := s.inner.LockBuildIndex(ctx, ns, buildVersion)
	if err != nil {
		return nil, err
	}
	lock := newHookableLock(innerLock, s)
	s.mu.Lock()
	s.currentLock = lock
	s.mu.Unlock()
	return lock, nil
}

func (s *hookableStore) LockNamespaceForCleanup(ctx context.Context, namespace string) (IndexStoreLock, error) {
	s.mu.Lock()
	injected := s.lockCleanupErr
	s.mu.Unlock()
	if injected != nil {
		return nil, injected
	}
	return s.inner.LockNamespaceForCleanup(ctx, namespace)
}

func (s *hookableStore) WriteSnapshotFile(ctx context.Context, ns resource.NamespacedResource, indexKey ulid.ULID, relPath string, src *os.File) error {
	s.mu.Lock()
	// Reset per-upload captures when we see a write for a new key.
	if s.lastUploadedKey != indexKey {
		s.lastUploadedKey = indexKey
		s.lastUploadedFiles = nil
		s.lastUploadedMeta = IndexMeta{}
	}
	s.lastUploadedFiles = append(s.lastUploadedFiles, relPath)
	injected := s.writeSnapshotFileErr
	s.mu.Unlock()

	if injected != nil {
		return injected
	}
	return s.inner.WriteSnapshotFile(ctx, ns, indexKey, relPath, src)
}

func (s *hookableStore) WriteSnapshotManifest(ctx context.Context, ns resource.NamespacedResource, indexKey ulid.ULID, manifest []byte) error {
	s.mu.Lock()
	if s.lastUploadedKey != indexKey {
		s.lastUploadedKey = indexKey
		s.lastUploadedFiles = nil
		s.lastUploadedMeta = IndexMeta{}
	}
	var meta IndexMeta
	_ = json.Unmarshal(manifest, &meta) // best-effort; tests inspect what they wrote
	s.lastUploadedMeta = meta
	onUpload := s.onUpload
	injected := s.writeSnapshotFileErr
	s.mu.Unlock()

	// onUpload fires between the data-file writes and the manifest
	// write — a deterministic point where the upload is on the verge of
	// being marked complete.
	if onUpload != nil {
		if err := onUpload(); err != nil {
			return err
		}
	}
	if injected != nil {
		return injected
	}
	if err := s.inner.WriteSnapshotManifest(ctx, ns, indexKey, manifest); err != nil {
		return err
	}
	s.uploadCalls.Add(1)
	return nil
}

func (s *hookableStore) ReadSnapshotFile(ctx context.Context, ns resource.NamespacedResource, indexKey ulid.ULID, relPath string, dst *os.File, expectedSize int64) error {
	s.mu.Lock()
	injected := s.readSnapshotFileErr
	s.mu.Unlock()

	s.downloadCalls.Add(1)

	if injected != nil {
		return injected
	}
	return s.inner.ReadSnapshotFile(ctx, ns, indexKey, relPath, dst, expectedSize)
}

func (s *hookableStore) ReadSnapshotManifest(ctx context.Context, ns resource.NamespacedResource, indexKey ulid.ULID) ([]byte, error) {
	s.mu.Lock()
	injected := s.readManifestErrs[indexKey]
	s.mu.Unlock()

	s.readManifestCalls.Add(1)

	if injected != nil {
		return nil, injected
	}
	return s.inner.ReadSnapshotManifest(ctx, ns, indexKey)
}

func (s *hookableStore) ListNamespaces(ctx context.Context) ([]string, error) {
	return s.inner.ListNamespaces(ctx)
}

func (s *hookableStore) ListNamespaceResources(ctx context.Context, namespace string) ([]resource.NamespacedResource, error) {
	return s.inner.ListNamespaceResources(ctx, namespace)
}

func (s *hookableStore) ListIndexKeys(ctx context.Context, ns resource.NamespacedResource) ([]ulid.ULID, error) {
	s.listKeyCalls.Add(1)
	s.mu.Lock()
	injected := s.listKeysErr
	s.mu.Unlock()
	if injected != nil {
		return nil, injected
	}
	return s.inner.ListIndexKeys(ctx, ns)
}

func (s *hookableStore) ListIndexKeysIncludingIncomplete(ctx context.Context, ns resource.NamespacedResource) ([]ulid.ULID, error) {
	return s.inner.ListIndexKeysIncludingIncomplete(ctx, ns)
}

func (s *hookableStore) DeleteIndex(ctx context.Context, ns resource.NamespacedResource, indexKey ulid.ULID) error {
	return s.inner.DeleteIndex(ctx, ns, indexKey)
}

// setLockBuildErr installs an error for the next LockBuildIndex calls. Use
// errLockHeld to simulate "another instance is the leader", or any other
// error to simulate a lock-backend failure. Pass nil to clear.
func (s *hookableStore) setLockBuildErr(err error) {
	s.mu.Lock()
	s.lockBuildErr = err
	s.mu.Unlock()
}

func (s *hookableStore) setListKeysErr(err error) {
	s.mu.Lock()
	s.listKeysErr = err
	s.mu.Unlock()
}

// setUploadErr makes the next WriteSnapshotFile (data file) or
// WriteSnapshotManifest call return err. Used to simulate "the upload
// fails partway".
func (s *hookableStore) setUploadErr(err error) {
	s.mu.Lock()
	s.writeSnapshotFileErr = err
	s.mu.Unlock()
}

// setDownloadErr makes ReadSnapshotFile (data file) calls return err.
// Manifest reads are not affected, so probes / ReadIndexSnapshotManifest still succeed;
// only the actual file-streaming phase of DownloadIndexSnapshot fails.
func (s *hookableStore) setDownloadErr(err error) {
	s.mu.Lock()
	s.readSnapshotFileErr = err
	s.mu.Unlock()
}

// getLastUploadedMeta returns the IndexMeta most recently written to the
// manifest via WriteSnapshotFile. The captured meta reflects what the
// production code uploaded, which makes assertions about manifest fields
// (BuildVersion, LatestResourceVersion, BuildTime, ...) straightforward.
func (s *hookableStore) getLastUploadedMeta() IndexMeta {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.lastUploadedMeta
}

// getLastUploadedFiles returns the slash-separated relative paths captured
// from non-manifest WriteSnapshotFile calls for the most recently uploaded
// snapshot. Reset implicitly when a write for a new indexKey arrives.
func (s *hookableStore) getLastUploadedFiles() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]string(nil), s.lastUploadedFiles...)
}

func (s *hookableStore) getLastLockBuildVersion() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.lastLockBuildVersion
}

// setReadManifestErr installs an error to return on the next
// ReadSnapshotManifest call for indexKey. Existing snapshot data in the
// store is left in place; only the manifest read for this key fails. Used
// to simulate ErrSnapshotNotFound / ErrInvalidManifest at a specific key
// without disturbing the store.
func (s *hookableStore) setReadManifestErr(indexKey ulid.ULID, err error) {
	s.mu.Lock()
	if s.readManifestErrs == nil {
		s.readManifestErrs = map[ulid.ULID]error{}
	}
	s.readManifestErrs[indexKey] = err
	s.mu.Unlock()
}

// setOnUpload installs a callback fired inside WriteSnapshotManifest just
// before the manifest is written to the inner store — i.e. after all data
// files have been uploaded, but before the upload is marked complete. The
// callback's returned error short-circuits the upload. Used to trigger
// races (e.g. concurrent mutations during upload) at a deterministic
// point.
func (s *hookableStore) setOnUpload(fn func() error) {
	s.mu.Lock()
	s.onUpload = fn
	s.mu.Unlock()
}

// signalLockLost closes the Lost() channel on the most recently acquired
// build lock, simulating a heartbeat-detected lease loss without depending
// on real heartbeat timing.
func (s *hookableStore) signalLockLost() {
	s.mu.Lock()
	lock := s.currentLock
	s.mu.Unlock()
	if lock != nil {
		lock.markLost()
	}
}

// hookableLock wraps a real IndexStoreLock so tests can drive lock loss via
// signalLockLost without depending on real heartbeat timing. The exposed
// Lost() channel only closes when markLost is called; inner-lock loss is
// not forwarded, because no test triggers it (real lease loss requires
// disturbing the lease entry, which no test does).
type hookableLock struct {
	inner       IndexStoreLock
	lost        chan struct{}
	lostOnce    sync.Once
	releaseOnce sync.Once
	store       *hookableStore
}

func newHookableLock(inner IndexStoreLock, store *hookableStore) *hookableLock {
	return &hookableLock{inner: inner, lost: make(chan struct{}), store: store}
}

func (l *hookableLock) Release() error {
	var err error
	l.releaseOnce.Do(func() {
		l.store.lockReleaseCalls.Add(1)
		err = l.inner.Release()
	})
	return err
}

func (l *hookableLock) Lost() <-chan struct{} { return l.lost }

func (l *hookableLock) markLost() {
	l.lostOnce.Do(func() { close(l.lost) })
}

// seedSnapshot writes a snapshot at indexKey under ns directly to store,
// bypassing UploadIndexSnapshot. The snapshot has a single placeholder file
// plus a manifest with the caller-provided meta. Use this when a test only
// needs the snapshot to be visible to ListIndexSnapshots / ReadIndexSnapshotManifest — the
// snapshot is not downloadable as a real bleve index.
//
// Manifest fields (UploadTimestamp, BuildTime, etc.) are written as-is, so
// callers can pin arbitrary values independent of indexKey's ULID time.
func seedSnapshot(t *testing.T, ctx context.Context, store RemoteIndexStore, ns resource.NamespacedResource, indexKey ulid.ULID, meta *IndexMeta) {
	t.Helper()
	require.NoError(t, writeTestSnapshotFile(ctx, store, ns, indexKey, "store/data.bin", []byte("x")))
	if meta.Files == nil {
		meta.Files = map[string]int64{"store/data.bin": 1}
	}
	metaBytes, err := json.Marshal(meta)
	require.NoError(t, err)
	require.NoError(t, store.WriteSnapshotManifest(ctx, ns, indexKey, metaBytes))
}

// downloadableSnapshot is a snapshot prepared in memory and ready to be
// written to a store. Building uses testing.T (require.*); publishing
// returns errors, so the publish step can run on a helper goroutine
// without violating the testing.TB rule that FailNow must run on the test
// goroutine.
type downloadableSnapshot struct {
	ns       resource.NamespacedResource
	indexKey ulid.ULID
	files    map[string][]byte
	manifest []byte
}

// buildDownloadableSnapshot creates a real (minimal) bleve index for
// indexKey under ns, walks it into memory, and marshals a manifest. The
// returned snapshot can be published to any store via publish.
//
// The internal buildInfo.BuildTime is taken from meta.BuildTime when
// non-zero, falling back to meta.UploadTimestamp. This mirrors production:
// real snapshots derive manifest BuildTime from the index's internal
// buildInfo (see bleve_snapshot_upload.go), so the two stay consistent
// when readers (local reuse vs fresh-remote selection) compare them.
func buildDownloadableSnapshot(t *testing.T, ns resource.NamespacedResource, indexKey ulid.ULID, meta *IndexMeta) *downloadableSnapshot {
	t.Helper()
	srcDir := filepath.Join(t.TempDir(), "idx")
	idx, err := bleve.New(srcDir, bleve.NewIndexMapping())
	require.NoError(t, err)
	require.NoError(t, setRV(idx, meta.LatestResourceVersion))

	buildTime := meta.BuildTime
	if buildTime.IsZero() {
		buildTime = meta.UploadTimestamp
	}
	// Otherwise the index is rejected after download for missing a required feature.
	// The manifest keeps meta as given, so "features not recorded" stays testable.
	indexFeatures := meta.Features
	if indexFeatures == nil {
		indexFeatures = resource.CurrentIndexFeatures()
	}
	bi, err := json.Marshal(buildInfo{
		BuildTime:    buildTime.Unix(),
		BuildVersion: meta.BuildVersion,
		Features:     indexFeatures,
	})
	require.NoError(t, err)
	require.NoError(t, idx.SetInternal([]byte(internalBuildInfoKey), bi))
	require.NoError(t, idx.Close())

	files := map[string][]byte{}
	require.NoError(t, filepath.WalkDir(srcDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(srcDir, path)
		if err != nil {
			return err
		}
		data, err := os.ReadFile(path) //nolint:gosec // path is under a test-controlled temp dir
		if err != nil {
			return err
		}
		files[filepath.ToSlash(rel)] = data
		return nil
	}))

	if meta.Files == nil {
		meta.Files = make(map[string]int64, len(files))
		for rel, data := range files {
			meta.Files[rel] = int64(len(data))
		}
	}
	manifest, err := json.Marshal(meta)
	require.NoError(t, err)

	return &downloadableSnapshot{
		ns:       ns,
		indexKey: indexKey,
		files:    files,
		manifest: manifest,
	}
}

// publish writes the snapshot's data files first, then the manifest (which
// is the completion signal). Uses no testing.T, so it is safe to call from
// a helper goroutine.
func (s *downloadableSnapshot) publish(ctx context.Context, store RemoteIndexStore) error {
	for rel, data := range s.files {
		if err := writeTestSnapshotFile(ctx, store, s.ns, s.indexKey, rel, data); err != nil {
			return fmt.Errorf("writing %s: %w", rel, err)
		}
	}
	return store.WriteSnapshotManifest(ctx, s.ns, s.indexKey, s.manifest)
}

// seedDownloadableSnapshot is buildDownloadableSnapshot + publish, for the
// common case of seeding before the system under test runs. For tests that
// need to publish from a helper goroutine, call buildDownloadableSnapshot
// on the test goroutine and publish from the goroutine via the returned
// snapshot.
func seedDownloadableSnapshot(t *testing.T, ctx context.Context, store RemoteIndexStore, ns resource.NamespacedResource, indexKey ulid.ULID, meta *IndexMeta) {
	t.Helper()
	require.NoError(t, buildDownloadableSnapshot(t, ns, indexKey, meta).publish(ctx, store))
}

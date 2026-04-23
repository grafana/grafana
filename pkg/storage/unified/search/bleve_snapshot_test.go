package search

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Masterminds/semver"
	"github.com/blevesearch/bleve/v2"
	"github.com/oklog/ulid/v2"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gocloud.dev/blob/memblob"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// fakeRemoteIndexStore is an in-memory RemoteIndexStore for unit tests.
// DownloadIndex writes a minimal bleve index populated from the stored meta
// so validateDownloadedIndex sees consistent data.
type fakeRemoteIndexStore struct {
	data          map[ulid.ULID]*IndexMeta
	listErr       error
	downloadErr   error
	listCalls     atomic.Int32
	downloadCalls atomic.Int32
}

func (f *fakeRemoteIndexStore) put(key ulid.ULID, meta *IndexMeta) {
	if f.data == nil {
		f.data = map[ulid.ULID]*IndexMeta{}
	}
	f.data[key] = meta
}

func (f *fakeRemoteIndexStore) ListIndexes(context.Context, resource.NamespacedResource) (map[ulid.ULID]*IndexMeta, error) {
	f.listCalls.Add(1)
	if f.listErr != nil {
		return nil, f.listErr
	}
	out := make(map[ulid.ULID]*IndexMeta, len(f.data))
	for k, v := range f.data {
		out[k] = v
	}
	return out, nil
}

func (f *fakeRemoteIndexStore) DownloadIndex(_ context.Context, _ resource.NamespacedResource, k ulid.ULID, destDir string) (*IndexMeta, error) {
	f.downloadCalls.Add(1)
	if f.downloadErr != nil {
		return nil, f.downloadErr
	}
	meta, ok := f.data[k]
	if !ok {
		return nil, fmt.Errorf("not found")
	}
	return meta, writeFakeSnapshot(destDir, meta)
}

func (f *fakeRemoteIndexStore) UploadIndex(context.Context, resource.NamespacedResource, string, IndexMeta) (ulid.ULID, error) {
	panic("UploadIndex not implemented for fakeRemoteIndexStore")
}
func (f *fakeRemoteIndexStore) DeleteIndex(context.Context, resource.NamespacedResource, ulid.ULID) error {
	panic("DeleteIndex not implemented for fakeRemoteIndexStore")
}
func (f *fakeRemoteIndexStore) CleanupIncompleteUploads(context.Context, resource.NamespacedResource, time.Duration) (int, error) {
	panic("CleanupIncompleteUploads not implemented for fakeRemoteIndexStore")
}

// writeFakeSnapshot creates an empty bleve index at dir with RV and build info
// matching meta. validateDownloadedIndex reads these back.
func writeFakeSnapshot(dir string, meta *IndexMeta) error {
	idx, err := bleve.New(dir, bleve.NewIndexMapping())
	if err != nil {
		return err
	}
	defer func() { _ = idx.Close() }()

	if err := setRV(idx, meta.LatestResourceVersion); err != nil {
		return err
	}
	bi, err := json.Marshal(buildInfo{
		BuildTime:    meta.UploadTimestamp.Unix(),
		BuildVersion: meta.GrafanaBuildVersion,
	})
	if err != nil {
		return err
	}
	return idx.SetInternal([]byte(internalBuildInfoKey), bi)
}

func newTestBleveBackend(t *testing.T, snapshot SnapshotOptions) (*bleveBackend, *resource.BleveIndexMetrics) {
	t.Helper()
	metrics := resource.ProvideIndexMetrics(prometheus.NewRegistry())
	be, err := NewBleveBackend(BleveOptions{
		Root:          t.TempDir(),
		FileThreshold: 5,
		BuildVersion:  "11.5.0",
		Snapshot:      snapshot,
	}, metrics)
	require.NoError(t, err)
	t.Cleanup(be.Stop)
	return be, metrics
}

func makeULID(t *testing.T, at time.Time) ulid.ULID {
	t.Helper()
	k, err := ulid.New(ulid.Timestamp(at), rand.Reader)
	require.NoError(t, err)
	return k
}

func TestSnapshotTier(t *testing.T) {
	running := semver.MustParse("11.5.0")
	minV := semver.MustParse("11.4.0")

	cases := map[string]struct {
		v    string
		tier int
	}{
		"at running":    {"11.5.0", 0},
		"between":       {"11.4.5", 0},
		"at min":        {"11.4.0", 0},
		"below min":     {"11.3.0", 1},
		"above running": {"11.6.0", 2},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			assert.Equal(t, c.tier, snapshotTier(semver.MustParse(c.v), minV, running))
		})
	}

	t.Run("no min: below running is tier 0", func(t *testing.T) {
		assert.Equal(t, 0, snapshotTier(semver.MustParse("9.0.0"), nil, running))
	})
	t.Run("no running: anything is tier 0 or 1", func(t *testing.T) {
		assert.Equal(t, 0, snapshotTier(semver.MustParse("99.0.0"), minV, nil))
	})
}

func TestPickBestSnapshot(t *testing.T) {
	now := time.Date(2026, 4, 22, 12, 0, 0, 0, time.UTC)
	minV := semver.MustParse("11.4.0")
	running := semver.MustParse("11.5.0")

	snap := func(ver string, rv int64, age time.Duration) *IndexMeta {
		return &IndexMeta{
			GrafanaBuildVersion:   ver,
			LatestResourceVersion: rv,
			UploadTimestamp:       now.Add(-age),
		}
	}

	newBackend := func(maxAge time.Duration, minVersion *semver.Version) *bleveBackend {
		return &bleveBackend{
			log:                 log.New("bleve-snapshot-test"),
			opts:                BleveOptions{Snapshot: SnapshotOptions{MaxIndexAge: maxAge, MinBuildVersion: minVersion}},
			runningBuildVersion: running,
		}
	}

	t.Run("empty list", func(t *testing.T) {
		_, ok := newBackend(24*time.Hour, minV).pickBestSnapshot(nil, now)
		assert.False(t, ok)
	})

	t.Run("dropped by age", func(t *testing.T) {
		all := map[ulid.ULID]*IndexMeta{makeULID(t, now): snap("11.5.0", 100, 2*time.Hour)}
		_, ok := newBackend(time.Hour, minV).pickBestSnapshot(all, now)
		assert.False(t, ok)
	})

	t.Run("dropped for unparseable version", func(t *testing.T) {
		all := map[ulid.ULID]*IndexMeta{makeULID(t, now): snap("not-a-version", 100, time.Minute)}
		_, ok := newBackend(24*time.Hour, minV).pickBestSnapshot(all, now)
		assert.False(t, ok)
	})

	t.Run("tier 0 preferred over 1 and 2", func(t *testing.T) {
		older := makeULID(t, now.Add(-10*time.Second))
		newer := makeULID(t, now.Add(-20*time.Second))
		ideal := makeULID(t, now.Add(-30*time.Second))
		all := map[ulid.ULID]*IndexMeta{
			older: snap("11.3.0", 200, time.Minute),  // tier 1 (below min)
			newer: snap("11.6.0", 300, time.Minute),  // tier 2 (above running)
			ideal: snap("11.5.0", 100, 10*time.Hour), // tier 0 wins despite lower RV / older upload
		}
		c, ok := newBackend(24*time.Hour, minV).pickBestSnapshot(all, now)
		require.True(t, ok)
		assert.Equal(t, ideal, c.key)
		assert.Equal(t, 0, c.tier)
	})

	t.Run("tier 1 picked when no tier 0", func(t *testing.T) {
		older := makeULID(t, now.Add(-10*time.Second))
		newer := makeULID(t, now.Add(-20*time.Second))
		all := map[ulid.ULID]*IndexMeta{
			older: snap("11.3.0", 100, time.Minute),
			newer: snap("12.0.0", 999, time.Minute),
		}
		c, ok := newBackend(24*time.Hour, minV).pickBestSnapshot(all, now)
		require.True(t, ok)
		assert.Equal(t, older, c.key)
		assert.Equal(t, 1, c.tier)
	})

	t.Run("tier 2 picked as last resort", func(t *testing.T) {
		only := makeULID(t, now)
		all := map[ulid.ULID]*IndexMeta{only: snap("12.0.0", 100, time.Minute)}
		c, ok := newBackend(24*time.Hour, minV).pickBestSnapshot(all, now)
		require.True(t, ok)
		assert.Equal(t, only, c.key)
		assert.Equal(t, 2, c.tier)
	})

	t.Run("within tier: version desc, then RV desc, then upload desc", func(t *testing.T) {
		a := makeULID(t, now.Add(-30*time.Second))
		b := makeULID(t, now.Add(-20*time.Second))
		c := makeULID(t, now.Add(-10*time.Second))
		d := makeULID(t, now)

		// Without d: c wins — same version as b but higher RV (200 > 50) despite an older
		// upload timestamp, proving RV-desc beats upload-desc.
		all := map[ulid.ULID]*IndexMeta{
			a: snap("11.4.0", 200, 10*time.Minute), // lower version
			b: snap("11.5.0", 50, time.Minute),     // best version, lowest RV, newer upload
			c: snap("11.5.0", 200, 30*time.Minute), // best version, high RV, older upload
		}
		got, ok := newBackend(24*time.Hour, minV).pickBestSnapshot(all, now)
		require.True(t, ok)
		assert.Equal(t, c, got.key)

		// Adding d (same version + RV as c, newer upload): d wins via upload-desc tiebreaker.
		all[d] = snap("11.5.0", 200, time.Minute)
		got, ok = newBackend(24*time.Hour, minV).pickBestSnapshot(all, now)
		require.True(t, ok)
		assert.Equal(t, d, got.key)
	})
}

// downloadTest bundles the shared setup used by the tryDownloadRemoteSnapshot tests.
type downloadTest struct {
	be          *bleveBackend
	metrics     *resource.BleveIndexMetrics
	store       *fakeRemoteIndexStore
	ns          resource.NamespacedResource
	resourceDir string
}

func newDownloadTest(t *testing.T, store *fakeRemoteIndexStore) downloadTest {
	t.Helper()
	be, metrics := newTestBleveBackend(t, SnapshotOptions{
		Store:       store,
		MinDocCount: 1,
		MaxIndexAge: 24 * time.Hour,
	})
	ns := newTestNsResource()
	return downloadTest{
		be:          be,
		metrics:     metrics,
		store:       store,
		ns:          ns,
		resourceDir: filepath.Join(be.opts.Root, ns.Namespace, ns.Resource+"."+ns.Group),
	}
}

func (dt downloadTest) run(t *testing.T) (bleve.Index, int64, error) {
	t.Helper()
	idx, _, rv, err := dt.be.tryDownloadRemoteSnapshot(context.Background(), dt.ns, dt.resourceDir, dt.be.log)
	if idx != nil {
		t.Cleanup(func() { _ = idx.Close() })
	}
	return idx, rv, err
}

func (dt downloadTest) counter(status string) float64 {
	return testutil.ToFloat64(dt.metrics.IndexSnapshotDownloads.WithLabelValues(status))
}

func TestTryDownloadRemoteSnapshot_Empty(t *testing.T) {
	dt := newDownloadTest(t, &fakeRemoteIndexStore{})
	idx, _, err := dt.run(t)
	require.NoError(t, err)
	assert.Nil(t, idx)
	assert.Equal(t, 1.0, dt.counter(snapshotStatusEmpty))
	assert.Zero(t, dt.store.downloadCalls.Load(), "DownloadIndex should not be called when no candidate exists")
}

func TestTryDownloadRemoteSnapshot_ListError(t *testing.T) {
	dt := newDownloadTest(t, &fakeRemoteIndexStore{listErr: errors.New("boom")})
	_, _, err := dt.run(t)
	require.Error(t, err)
	assert.Equal(t, 1.0, dt.counter(snapshotStatusDownloadError))
}

func TestTryDownloadRemoteSnapshot_DownloadError(t *testing.T) {
	store := &fakeRemoteIndexStore{downloadErr: errors.New("network dropped")}
	store.put(makeULID(t, time.Now()), &IndexMeta{
		GrafanaBuildVersion:   "11.5.0",
		LatestResourceVersion: 42,
		UploadTimestamp:       time.Now(),
	})
	dt := newDownloadTest(t, store)

	_, _, err := dt.run(t)
	require.Error(t, err)
	assert.Equal(t, 1.0, dt.counter(snapshotStatusDownloadError))

	entries, readErr := os.ReadDir(dt.resourceDir)
	require.NoError(t, readErr)
	assert.Empty(t, entries, "destDir should be cleaned up after download failure")
}

func TestTryDownloadRemoteSnapshot_ValidationError(t *testing.T) {
	store := &fakeRemoteIndexStore{}
	store.put(makeULID(t, time.Now()), &IndexMeta{
		GrafanaBuildVersion:   "11.5.0",
		LatestResourceVersion: 0, // invalid (<=0)
		UploadTimestamp:       time.Now(),
	})
	dt := newDownloadTest(t, store)

	_, _, err := dt.run(t)
	require.Error(t, err)
	assert.Equal(t, 1.0, dt.counter(snapshotStatusValidateError))

	entries, readErr := os.ReadDir(dt.resourceDir)
	require.NoError(t, readErr)
	assert.Empty(t, entries, "destDir should be cleaned up after validation failure")
}

func TestTryDownloadRemoteSnapshot_Success(t *testing.T) {
	store := &fakeRemoteIndexStore{}
	store.put(makeULID(t, time.Now()), &IndexMeta{
		GrafanaBuildVersion:   "11.5.0",
		LatestResourceVersion: 42,
		UploadTimestamp:       time.Now(),
	})
	dt := newDownloadTest(t, store)

	idx, rv, err := dt.run(t)
	require.NoError(t, err)
	require.NotNil(t, idx)
	assert.Equal(t, int64(42), rv)
	assert.Equal(t, 1.0, dt.counter(snapshotStatusSuccess))

	m := &dto.Metric{}
	require.NoError(t, dt.metrics.IndexSnapshotDownloadDuration.Write(m))
	assert.Equal(t, uint64(1), m.GetHistogram().GetSampleCount())
}

func TestTryDownloadRemoteSnapshot_AllFilteredOut(t *testing.T) {
	store := &fakeRemoteIndexStore{}
	store.put(makeULID(t, time.Now().Add(-2*time.Hour)), &IndexMeta{
		GrafanaBuildVersion:   "11.5.0",
		LatestResourceVersion: 42,
		UploadTimestamp:       time.Now().Add(-2 * time.Hour),
	})
	dt := newDownloadTest(t, store)
	dt.be.opts.Snapshot.MaxIndexAge = time.Hour

	idx, _, err := dt.run(t)
	require.NoError(t, err)
	assert.Nil(t, idx)
	assert.Equal(t, 1.0, dt.counter(snapshotStatusEmpty))
	assert.Zero(t, dt.store.downloadCalls.Load(), "DownloadIndex should not be called when all candidates are filtered out")
}

// TestBuildIndex_SkipsDownloadBelowMinDocCount ensures ListIndexes is not called
// when the size parameter is below MinDocCount.
func TestBuildIndex_SkipsDownloadBelowMinDocCount(t *testing.T) {
	store := &fakeRemoteIndexStore{}
	be, _ := newTestBleveBackend(t, SnapshotOptions{
		Store:       store,
		MinDocCount: 1000, // much higher than size below
		MaxIndexAge: 24 * time.Hour,
	})

	idx, err := be.BuildIndex(context.Background(), newTestNsResource(), 1, nil, "test",
		func(resource.ResourceIndex) (int64, error) { return 1, nil },
		nil, false, time.Time{})
	require.NoError(t, err)
	require.NotNil(t, idx)
	assert.Zero(t, store.listCalls.Load(), "ListIndexes should not be called below MinDocCount")
}

// TestIntegrationBleveSnapshotRoundTrip seeds an in-memory bucket with a
// snapshot via store.UploadIndex, then verifies BuildIndex downloads it
// instead of calling the builder. The round-trip of a real built index
// through the store is covered separately in TestRemoteIndexStore_*.
func TestIntegrationBleveSnapshotRoundTrip(t *testing.T) {
	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{Namespace: "ns"})
	bucket := memblob.OpenBucket(nil)
	t.Cleanup(func() { _ = bucket.Close() })

	store := NewBucketRemoteIndexStore(bucket)
	key := newTestNsResource()
	meta := IndexMeta{
		GrafanaBuildVersion:   "11.5.0",
		LatestResourceVersion: 123,
		UploadTimestamp:       time.Now(),
	}

	snapshotDir := filepath.Join(t.TempDir(), "snapshot")
	require.NoError(t, writeFakeSnapshot(snapshotDir, &meta))
	_, err := store.UploadIndex(ctx, key, snapshotDir, meta)
	require.NoError(t, err)

	// Fresh backend pointing at the same bucket should download instead of building.
	metrics := resource.ProvideIndexMetrics(prometheus.NewRegistry())
	be, err := NewBleveBackend(BleveOptions{
		Root:          t.TempDir(),
		FileThreshold: 5,
		BuildVersion:  "11.5.0",
		Snapshot: SnapshotOptions{
			Store:       store,
			MinDocCount: 5,
			MaxIndexAge: 24 * time.Hour,
		},
	}, metrics)
	require.NoError(t, err)
	t.Cleanup(be.Stop)

	var builderCalled atomic.Bool
	idx, err := be.BuildIndex(ctx, key, 10, nil, "startup", func(resource.ResourceIndex) (int64, error) {
		builderCalled.Store(true)
		return 0, nil
	}, nil, false, time.Time{})
	require.NoError(t, err)
	require.NotNil(t, idx)

	assert.False(t, builderCalled.Load(), "builder should not be called when a remote snapshot is available")
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotDownloads.WithLabelValues(snapshotStatusSuccess)))
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexBuildSkipped))

	bi, ok := idx.(*bleveIndex)
	require.True(t, ok)
	assert.Equal(t, meta.LatestResourceVersion, bi.resourceVersion.Load())
}

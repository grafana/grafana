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
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

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
		BuildVersion: meta.BuildVersion,
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

func testIndexFormat(t *testing.T) string {
	t.Helper()
	format := maxSupportedIndexFormat()
	require.NotEmpty(t, format)
	return format
}

func testIndexFormatDelta(t *testing.T, delta int) string {
	t.Helper()
	formatType, version, ok := parseIndexFormat(testIndexFormat(t))
	require.True(t, ok)
	return indexFormat(formatType, uint32(int(version)+delta))
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
}

func TestPickBestSnapshot(t *testing.T) {
	now := time.Date(2026, 4, 22, 12, 0, 0, 0, time.UTC)
	minV := semver.MustParse("11.4.0")
	running := semver.MustParse("11.5.0")

	snap := func(ver string, rv int64, age time.Duration) *IndexMeta {
		return &IndexMeta{
			BuildVersion:          ver,
			LatestResourceVersion: rv,
			UploadTimestamp:       now.Add(-age),
		}
	}

	format := testIndexFormat(t)

	newBackend := func(minVersion *semver.Version) *bleveBackend {
		return &bleveBackend{
			log:                     log.New("bleve-snapshot-test"),
			opts:                    BleveOptions{Snapshot: SnapshotOptions{MinBuildVersion: minVersion}},
			runningBuildVersion:     running,
			maxSupportedIndexFormat: format,
		}
	}
	cutoff := func(maxAge time.Duration) time.Time { return now.Add(-maxAge) }

	t.Run("empty list", func(t *testing.T) {
		_, ok := newBackend(minV).pickBestSnapshot(nil, cutoff(24*time.Hour), log.New("bleve-snapshot-test"))
		assert.False(t, ok)
	})

	t.Run("dropped by age", func(t *testing.T) {
		all := map[ulid.ULID]*IndexMeta{makeULID(t, now): snap("11.5.0", 100, 2*time.Hour)}
		_, ok := newBackend(minV).pickBestSnapshot(all, cutoff(time.Hour), log.New("bleve-snapshot-test"))
		assert.False(t, ok)
	})

	// Pins the "MaxIndexAge=0 means no age limit" semantic for the tiered
	// selection path: tryDownloadRemoteSnapshot leaves notOlderThan as the
	// zero time when MaxIndexAge is zero, and pickBestSnapshot must skip
	// the age filter rather than rejecting everything.
	t.Run("zero cutoff is no age limit", func(t *testing.T) {
		old := makeULID(t, now.Add(-30*24*time.Hour))
		all := map[ulid.ULID]*IndexMeta{old: snap("11.5.0", 100, 30*24*time.Hour)}
		c, ok := newBackend(minV).pickBestSnapshot(all, time.Time{}, log.New("bleve-snapshot-test"))
		require.True(t, ok)
		assert.Equal(t, old, c.key)
	})

	t.Run("dropped for unparseable version", func(t *testing.T) {
		all := map[ulid.ULID]*IndexMeta{makeULID(t, now): snap("not-a-version", 100, time.Minute)}
		_, ok := newBackend(minV).pickBestSnapshot(all, cutoff(24*time.Hour), log.New("bleve-snapshot-test"))
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
		c, ok := newBackend(minV).pickBestSnapshot(all, cutoff(24*time.Hour), log.New("bleve-snapshot-test"))
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
		c, ok := newBackend(minV).pickBestSnapshot(all, cutoff(24*time.Hour), log.New("bleve-snapshot-test"))
		require.True(t, ok)
		assert.Equal(t, older, c.key)
		assert.Equal(t, 1, c.tier)
	})

	t.Run("tier 2 picked as last resort", func(t *testing.T) {
		only := makeULID(t, now)
		all := map[ulid.ULID]*IndexMeta{only: snap("12.0.0", 100, time.Minute)}
		c, ok := newBackend(minV).pickBestSnapshot(all, cutoff(24*time.Hour), log.New("bleve-snapshot-test"))
		require.True(t, ok)
		assert.Equal(t, only, c.key)
		assert.Equal(t, 2, c.tier)
	})

	t.Run("index format gate", func(t *testing.T) {
		older := makeULID(t, now.Add(-30*time.Second))
		same := makeULID(t, now.Add(-20*time.Second))
		legacy := makeULID(t, now.Add(-10*time.Second))
		tooNew := makeULID(t, now)

		all := map[ulid.ULID]*IndexMeta{
			older:  snap("11.5.0", 100, time.Minute),
			same:   snap("11.5.0", 200, time.Minute),
			legacy: snap("11.5.0", 300, time.Minute),
			tooNew: snap("11.5.0", 400, time.Minute),
		}
		all[older].IndexFormat = testIndexFormatDelta(t, -1)
		all[same].IndexFormat = format
		all[tooNew].IndexFormat = testIndexFormatDelta(t, 1)

		c, ok := newBackend(minV).pickBestSnapshot(all, cutoff(24*time.Hour), log.New("bleve-snapshot-test"))
		require.True(t, ok)
		assert.Equal(t, legacy, c.key, "empty legacy format remains compatible and normal tie-breaking still applies")

		delete(all, legacy)
		c, ok = newBackend(minV).pickBestSnapshot(all, cutoff(24*time.Hour), log.New("bleve-snapshot-test"))
		require.True(t, ok)
		assert.Equal(t, same, c.key, "same format should beat older format by RV")
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
		got, ok := newBackend(minV).pickBestSnapshot(all, cutoff(24*time.Hour), log.New("bleve-snapshot-test"))
		require.True(t, ok)
		assert.Equal(t, c, got.key)

		// Adding d (same version + RV as c, newer upload): d wins via upload-desc tiebreaker.
		all[d] = snap("11.5.0", 200, time.Minute)
		got, ok = newBackend(minV).pickBestSnapshot(all, cutoff(24*time.Hour), log.New("bleve-snapshot-test"))
		require.True(t, ok)
		assert.Equal(t, d, got.key)
	})
}

// downloadTest bundles the shared setup used by the tryDownloadRemoteSnapshot tests.
type downloadTest struct {
	be          *bleveBackend
	metrics     *resource.BleveIndexMetrics
	store       *hookableStore
	ns          resource.NamespacedResource
	resourceDir string
}

func newDownloadTest(t *testing.T, store *hookableStore) downloadTest {
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
	return testutil.ToFloat64(dt.metrics.IndexSnapshotDownloads.WithLabelValues(snapshotPolicyTiered, status))
}

func TestTryDownloadRemoteSnapshot_Empty(t *testing.T) {
	dt := newDownloadTest(t, newHookableStore(t))
	idx, _, err := dt.run(t)
	require.NoError(t, err)
	assert.Nil(t, idx)
	assert.Equal(t, 1.0, dt.counter(snapshotStatusEmpty))
	assert.Zero(t, dt.store.downloadCalls.Load(), "DownloadIndexSnapshot should not be called when no candidate exists")
}

func TestTryDownloadRemoteSnapshot_ListError(t *testing.T) {
	store := newHookableStore(t)
	store.setListKeysErr(errors.New("boom"))
	dt := newDownloadTest(t, store)
	_, _, err := dt.run(t)
	require.Error(t, err)
	assert.Equal(t, 1.0, dt.counter(snapshotStatusDownloadError))
}

func TestTryDownloadRemoteSnapshot_DownloadError(t *testing.T) {
	store := newHookableStore(t)
	store.setDownloadErr(errors.New("network dropped"))
	dt := newDownloadTest(t, store)
	seedDownloadableSnapshot(t, t.Context(), store.bucket, dt.ns, makeULID(t, time.Now()), &IndexMeta{
		BuildVersion:          "11.5.0",
		LatestResourceVersion: 42,
		UploadTimestamp:       time.Now(),
	})

	_, _, err := dt.run(t)
	require.Error(t, err)
	assert.Equal(t, 1.0, dt.counter(snapshotStatusDownloadError))

	entries, readErr := os.ReadDir(dt.resourceDir)
	require.NoError(t, readErr)
	assert.Empty(t, entries, "destDir should be cleaned up after download failure")
}

func TestTryDownloadRemoteSnapshot_ValidationError(t *testing.T) {
	store := newHookableStore(t)
	dt := newDownloadTest(t, store)
	seedDownloadableSnapshot(t, t.Context(), store.bucket, dt.ns, makeULID(t, time.Now()), &IndexMeta{
		BuildVersion:          "11.5.0",
		LatestResourceVersion: 0, // invalid (<=0)
		UploadTimestamp:       time.Now(),
	})

	_, _, err := dt.run(t)
	require.Error(t, err)
	assert.Equal(t, 1.0, dt.counter(snapshotStatusValidateError))

	entries, readErr := os.ReadDir(dt.resourceDir)
	require.NoError(t, readErr)
	assert.Empty(t, entries, "destDir should be cleaned up after validation failure")
}

func TestTryDownloadRemoteSnapshot_Success(t *testing.T) {
	store := newHookableStore(t)
	dt := newDownloadTest(t, store)
	seedDownloadableSnapshot(t, t.Context(), store.bucket, dt.ns, makeULID(t, time.Now()), &IndexMeta{
		BuildVersion:          "11.5.0",
		LatestResourceVersion: 42,
		UploadTimestamp:       time.Now(),
	})

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
	store := newHookableStore(t)
	dt := newDownloadTest(t, store)
	seedDownloadableSnapshot(t, t.Context(), store.bucket, dt.ns, makeULID(t, time.Now().Add(-2*time.Hour)), &IndexMeta{
		BuildVersion:          "11.5.0",
		LatestResourceVersion: 42,
		UploadTimestamp:       time.Now().Add(-2 * time.Hour),
	})
	dt.be.opts.Snapshot.MaxIndexAge = time.Hour

	idx, _, err := dt.run(t)
	require.NoError(t, err)
	assert.Nil(t, idx)
	assert.Equal(t, 1.0, dt.counter(snapshotStatusEmpty))
	assert.Zero(t, dt.store.downloadCalls.Load(), "DownloadIndexSnapshot should not be called when all candidates are filtered out")
}

// TestTryDownloadRemoteSnapshot_NoAgeLimitWhenZero pins the
// "MaxIndexAge=0 means no age limit" semantic for the tiered selection
// path: an arbitrarily old same-version snapshot is still downloaded.
func TestTryDownloadRemoteSnapshot_NoAgeLimitWhenZero(t *testing.T) {
	store := newHookableStore(t)
	dt := newDownloadTest(t, store)
	seedDownloadableSnapshot(t, t.Context(), store.bucket, dt.ns, makeULID(t, time.Now().Add(-30*24*time.Hour)), &IndexMeta{
		BuildVersion:          "11.5.0",
		LatestResourceVersion: 42,
		UploadTimestamp:       time.Now().Add(-30 * 24 * time.Hour),
	})
	dt.be.opts.Snapshot.MaxIndexAge = 0

	idx, rv, err := dt.run(t)
	require.NoError(t, err)
	require.NotNil(t, idx)
	assert.Equal(t, int64(42), rv)
	assert.Equal(t, 1.0, dt.counter(snapshotStatusSuccess))
}

// freshDownloadTest bundles the shared setup used by
// tryDownloadFreshSameVersionSnapshot tests on the rebuild policy.
type freshDownloadTest struct {
	be          *bleveBackend
	metrics     *resource.BleveIndexMetrics
	store       *hookableStore
	ns          resource.NamespacedResource
	resourceDir string
}

func newFreshDownloadTest(t *testing.T, store *hookableStore) freshDownloadTest {
	t.Helper()
	be, metrics := newTestBleveBackend(t, SnapshotOptions{
		Store:       store,
		MinDocCount: 1,
		MaxIndexAge: 24 * time.Hour,
	})
	ns := newTestNsResource()
	return freshDownloadTest{
		be:          be,
		metrics:     metrics,
		store:       store,
		ns:          ns,
		resourceDir: filepath.Join(be.opts.Root, ns.Namespace, ns.Resource+"."+ns.Group),
	}
}

func (dt freshDownloadTest) run(t *testing.T, lastImportTime time.Time, maxFreshSnapshotAge time.Duration) (bleve.Index, int64, error) {
	t.Helper()
	idx, _, rv, err := dt.be.tryDownloadFreshSameVersionSnapshot(
		context.Background(), dt.ns, dt.resourceDir, lastImportTime, maxFreshSnapshotAge,
		snapshotPolicySameVersion, "search.remote_index_snapshot.download_fresh",
		dt.be.log,
	)
	if idx != nil {
		t.Cleanup(func() { _ = idx.Close() })
	}
	return idx, rv, err
}

func (dt freshDownloadTest) counter(status string) float64 {
	return testutil.ToFloat64(dt.metrics.IndexSnapshotDownloads.WithLabelValues(snapshotPolicySameVersion, status))
}

// freshSnapshot returns metadata for a freshly-built same-version snapshot at age.
func freshSnapshot(buildAge time.Duration) *IndexMeta {
	now := time.Now()
	return &IndexMeta{
		BuildVersion:          "11.5.0",
		LatestResourceVersion: 42,
		UploadTimestamp:       now.Add(-buildAge),
		BuildTime:             now.Add(-buildAge),
	}
}

func TestTryDownloadFreshSnapshot_Hit(t *testing.T) {
	store := newHookableStore(t)
	dt := newFreshDownloadTest(t, store)
	seedDownloadableSnapshot(t, t.Context(), store.bucket, dt.ns, makeULID(t, time.Now()), freshSnapshot(time.Minute))

	idx, rv, err := dt.run(t, time.Time{}, time.Hour)
	require.NoError(t, err)
	require.NotNil(t, idx)
	assert.Equal(t, int64(42), rv)
	assert.Equal(t, 1.0, dt.counter(snapshotStatusSuccess))
}

// TestTryDownloadFreshSnapshot_NoAgeLimitWhenZero verifies that maxAge=0
// means "no age limit": an arbitrarily old same-version snapshot is
// accepted as long as it is newer than lastImportTime.
func TestTryDownloadFreshSnapshot_NoAgeLimitWhenZero(t *testing.T) {
	store := newHookableStore(t)
	dt := newFreshDownloadTest(t, store)
	seedDownloadableSnapshot(t, t.Context(), store.bucket, dt.ns, makeULID(t, time.Now()), freshSnapshot(30*24*time.Hour))

	idx, rv, err := dt.run(t, time.Time{}, 0)
	require.NoError(t, err)
	require.NotNil(t, idx)
	assert.Equal(t, int64(42), rv)
	assert.Equal(t, 1.0, dt.counter(snapshotStatusSuccess))
}

func TestTryDownloadFreshSnapshot_VersionMismatchSkipped(t *testing.T) {
	store := newHookableStore(t)
	dt := newFreshDownloadTest(t, store)
	meta := freshSnapshot(time.Minute)
	meta.BuildVersion = "11.4.0" // backend runs 11.5.0
	seedSnapshot(t, t.Context(), store.bucket, dt.ns, makeULID(t, time.Now()), meta)

	idx, _, err := dt.run(t, time.Time{}, time.Hour)
	require.NoError(t, err)
	assert.Nil(t, idx)
	assert.Equal(t, 1.0, dt.counter(snapshotStatusEmpty))
	assert.Zero(t, dt.store.downloadCalls.Load())
}

func TestTryDownloadFreshSnapshot_BuildTimeOlderThanMaxAge(t *testing.T) {
	store := newHookableStore(t)
	dt := newFreshDownloadTest(t, store)
	// Periodic re-upload: ULID (upload time) is recent, but BuildTime is old.
	meta := &IndexMeta{
		BuildVersion:          "11.5.0",
		LatestResourceVersion: 42,
		UploadTimestamp:       time.Now(),
		BuildTime:             time.Now().Add(-3 * time.Hour),
	}
	seedSnapshot(t, t.Context(), store.bucket, dt.ns, makeULID(t, time.Now()), meta)

	idx, _, err := dt.run(t, time.Time{}, time.Hour)
	require.NoError(t, err)
	assert.Nil(t, idx)
	assert.Equal(t, 1.0, dt.counter(snapshotStatusEmpty))
	assert.Zero(t, dt.store.downloadCalls.Load())
}

func TestTryDownloadFreshSnapshot_RejectedByLastImportTime(t *testing.T) {
	store := newHookableStore(t)
	dt := newFreshDownloadTest(t, store)
	// Snapshot built 5 minutes ago, but lastImportTime says KV mutated 2 minutes ago.
	// The snapshot pre-dates known mutations and must be rejected even though it
	// fits the maxFreshSnapshotAge window.
	seedSnapshot(t, t.Context(), store.bucket, dt.ns, makeULID(t, time.Now()), freshSnapshot(5*time.Minute))

	lastImportTime := time.Now().Add(-2 * time.Minute)
	idx, _, err := dt.run(t, lastImportTime, time.Hour)
	require.NoError(t, err)
	assert.Nil(t, idx)
	assert.Equal(t, 1.0, dt.counter(snapshotStatusEmpty))
	assert.Zero(t, dt.store.downloadCalls.Load())
}

func TestTryDownloadFreshSnapshot_AcceptedWhenBuiltAfterLastImportTime(t *testing.T) {
	store := newHookableStore(t)
	dt := newFreshDownloadTest(t, store)
	// Snapshot built 1 minute ago, lastImportTime 5 minutes ago: snapshot is
	// strictly newer than the latest known mutation, so it's safe to use.
	seedDownloadableSnapshot(t, t.Context(), store.bucket, dt.ns, makeULID(t, time.Now()), freshSnapshot(time.Minute))

	lastImportTime := time.Now().Add(-5 * time.Minute)
	idx, _, err := dt.run(t, lastImportTime, time.Hour)
	require.NoError(t, err)
	require.NotNil(t, idx)
	assert.Equal(t, 1.0, dt.counter(snapshotStatusSuccess))
}

func TestTryDownloadFreshSnapshot_ListError(t *testing.T) {
	store := newHookableStore(t)
	store.setListKeysErr(errors.New("boom"))
	dt := newFreshDownloadTest(t, store)

	_, _, err := dt.run(t, time.Time{}, time.Hour)
	require.Error(t, err)
	assert.Equal(t, 1.0, dt.counter(snapshotStatusDownloadError))
}

func TestTryDownloadFreshSnapshot_Empty(t *testing.T) {
	dt := newFreshDownloadTest(t, newHookableStore(t))
	idx, _, err := dt.run(t, time.Time{}, time.Hour)
	require.NoError(t, err)
	assert.Nil(t, idx)
	assert.Equal(t, 1.0, dt.counter(snapshotStatusEmpty))
}

// TestTryDownloadFreshSnapshot_WalksPastStaleNewerCandidate verifies the
// probe walks past a recent ULID whose BuildTime is stale (e.g. a periodic
// re-upload) to find an earlier same-version candidate that's actually fresh.
func TestTryDownloadFreshSnapshot_WalksPastStaleNewerCandidate(t *testing.T) {
	store := newHookableStore(t)
	dt := newFreshDownloadTest(t, store)
	now := time.Now()
	// Newer ULID (uploaded just now) but stale BuildTime: a periodic re-upload
	// of a long-lived index. Must be rejected by build-start freshness.
	seedSnapshot(t, t.Context(), store.bucket, dt.ns, makeULID(t, now), &IndexMeta{
		BuildVersion:          "11.5.0",
		LatestResourceVersion: 10,
		UploadTimestamp:       now,
		BuildTime:             now.Add(-3 * time.Hour),
	})
	// Older ULID, fresh BuildTime: this is the one we want.
	seedDownloadableSnapshot(t, t.Context(), store.bucket, dt.ns, makeULID(t, now.Add(-30*time.Minute)), &IndexMeta{
		BuildVersion:          "11.5.0",
		LatestResourceVersion: 42,
		UploadTimestamp:       now.Add(-30 * time.Minute),
		BuildTime:             now.Add(-30 * time.Minute),
	})

	idx, rv, err := dt.run(t, time.Time{}, time.Hour)
	require.NoError(t, err)
	require.NotNil(t, idx)
	assert.Equal(t, int64(42), rv, "should pick the older but fresh-BuildTime candidate")
	assert.Equal(t, 1.0, dt.counter(snapshotStatusSuccess))
}

// TestBuildIndex_RebuildUsesFreshSnapshot verifies that on the rebuild path
// BuildIndex prefers downloading a fresh same-version snapshot over running
// the builder.
func TestBuildIndex_RebuildUsesFreshSnapshot(t *testing.T) {
	store := newHookableStore(t)
	ns := newTestNsResource()
	seedDownloadableSnapshot(t, t.Context(), store.bucket, ns, makeULID(t, time.Now()), freshSnapshot(time.Minute))
	be, metrics := newTestBleveBackend(t, SnapshotOptions{
		Store:       store,
		MinDocCount: 1,
		MaxIndexAge: 24 * time.Hour,
	})

	builderCalled := atomic.Int32{}
	idx, err := be.BuildIndex(context.Background(), ns, 10, nil, "rebuild",
		func(resource.ResourceIndex) (int64, error) {
			builderCalled.Add(1)
			return 1, nil
		},
		nil, true /*rebuild*/, time.Time{}, time.Hour /*maxFreshSnapshotAge*/)
	require.NoError(t, err)
	require.NotNil(t, idx)
	assert.Zero(t, builderCalled.Load(), "builder should not run when a fresh remote snapshot is used")
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotDownloads.WithLabelValues(snapshotPolicySameVersion, snapshotStatusSuccess)))
}

// TestBuildIndex_RebuildFallsBackToBuilder verifies that on the rebuild path
// when no fresh same-version snapshot is available, BuildIndex runs the
// builder rather than falling back to the tiered selection.
func TestBuildIndex_RebuildFallsBackToBuilder(t *testing.T) {
	store := newHookableStore(t)
	ns := newTestNsResource()
	// Older snapshot present — would be acceptable to the tiered policy on
	// the initial-startup path, but must be ignored on the rebuild path.
	seedSnapshot(t, t.Context(), store.bucket, ns, makeULID(t, time.Now().Add(-3*time.Hour)), &IndexMeta{
		BuildVersion:          "11.5.0",
		LatestResourceVersion: 42,
		UploadTimestamp:       time.Now().Add(-3 * time.Hour),
		BuildTime:             time.Now().Add(-3 * time.Hour),
	})
	be, metrics := newTestBleveBackend(t, SnapshotOptions{
		Store:       store,
		MinDocCount: 1,
		MaxIndexAge: 24 * time.Hour,
	})

	builderCalled := atomic.Int32{}
	idx, err := be.BuildIndex(context.Background(), ns, 10, nil, "rebuild",
		func(index resource.ResourceIndex) (int64, error) {
			builderCalled.Add(1)
			return 1, nil
		},
		nil, true /*rebuild*/, time.Time{}, time.Hour /*maxFreshSnapshotAge*/)
	require.NoError(t, err)
	require.NotNil(t, idx)
	assert.Equal(t, int32(1), builderCalled.Load(), "builder should run when no fresh snapshot is available")
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotDownloads.WithLabelValues(snapshotPolicySameVersion, snapshotStatusEmpty)))
	assert.Zero(t, store.downloadCalls.Load(), "older snapshot must not be downloaded on the rebuild path")
}

// TestBuildIndex_RebuildSkipsFastPathWhenDisabled verifies that passing
// maxFreshSnapshotAge=0 disables the rebuild-path fast path entirely (no
// list/get calls against the store).
func TestBuildIndex_RebuildSkipsFastPathWhenDisabled(t *testing.T) {
	store := newHookableStore(t)
	ns := newTestNsResource()
	seedSnapshot(t, t.Context(), store.bucket, ns, makeULID(t, time.Now()), freshSnapshot(time.Minute))
	be, _ := newTestBleveBackend(t, SnapshotOptions{
		Store:       store,
		MinDocCount: 1,
		MaxIndexAge: 24 * time.Hour,
	})

	builderCalled := atomic.Int32{}
	idx, err := be.BuildIndex(context.Background(), ns, 10, nil, "rebuild",
		func(resource.ResourceIndex) (int64, error) {
			builderCalled.Add(1)
			return 1, nil
		},
		nil, true /*rebuild*/, time.Time{}, 0 /*disabled*/)
	require.NoError(t, err)
	require.NotNil(t, idx)
	assert.Equal(t, int32(1), builderCalled.Load())
	assert.Zero(t, store.downloadCalls.Load())
}

// TestBuildIndex_SkipsDownloadBelowMinDocCount ensures ListIndexSnapshots is not called
// when the size parameter is below MinDocCount.
func TestBuildIndex_SkipsDownloadBelowMinDocCount(t *testing.T) {
	store := newHookableStore(t)
	be, _ := newTestBleveBackend(t, SnapshotOptions{
		Store:       store,
		MinDocCount: 1000, // much higher than size below
		MaxIndexAge: 24 * time.Hour,
	})

	idx, err := be.BuildIndex(context.Background(), newTestNsResource(), 1, nil, "test",
		func(resource.ResourceIndex) (int64, error) { return 1, nil },
		nil, false, time.Time{}, 0)
	require.NoError(t, err)
	require.NotNil(t, idx)
	assert.Zero(t, store.listKeyCalls.Load(), "ListIndexSnapshots should not be called below MinDocCount")
}

// TestIntegrationBleveSnapshotRoundTrip seeds an in-memory bucket with a
// snapshot via store.UploadIndexSnapshot, then verifies BuildIndex downloads it
// instead of calling the builder. The round-trip of a real built index
// through the store is covered separately in TestRemoteIndexStore_*.
func TestShouldUpload(t *testing.T) {
	key := newTestNsResource()

	t.Run("uploads when no prior upload is tracked", func(t *testing.T) {
		be, _ := newTestBleveBackend(t, SnapshotOptions{MinDocCount: 1, UploadInterval: time.Hour, MinDocChanges: 1000})
		idx := newUploadTestIndex(t, be, key, 42)

		should, err := be.shouldUpload(key, idx, time.Now())
		require.NoError(t, err)
		assert.True(t, should)
	})

	t.Run("skips below min doc count", func(t *testing.T) {
		be, _ := newTestBleveBackend(t, SnapshotOptions{MinDocCount: 2, UploadInterval: time.Hour, MinDocChanges: 1000})
		idx := newUploadTestIndex(t, be, key, 42)

		should, err := be.shouldUpload(key, idx, time.Now())
		require.NoError(t, err)
		assert.False(t, should)
	})

	t.Run("skips when upload interval has not elapsed", func(t *testing.T) {
		be, _ := newTestBleveBackend(t, SnapshotOptions{MinDocCount: 1, UploadInterval: time.Hour, MinDocChanges: 1})
		idx := newUploadTestIndex(t, be, key, 42)
		require.NoError(t, writeSnapshotMutationCount(idx.index, 5))
		be.setUploadTracking(key, time.Now().Add(-30*time.Minute))

		should, err := be.shouldUpload(key, idx, time.Now())
		require.NoError(t, err)
		assert.False(t, should)
	})

	t.Run("skips when mutation count is below threshold", func(t *testing.T) {
		be, _ := newTestBleveBackend(t, SnapshotOptions{MinDocCount: 1, UploadInterval: time.Minute, MinDocChanges: 100})
		idx := newUploadTestIndex(t, be, key, 150)
		require.NoError(t, writeSnapshotMutationCount(idx.index, 50))
		be.setUploadTracking(key, time.Now().Add(-2*time.Minute))

		should, err := be.shouldUpload(key, idx, time.Now())
		require.NoError(t, err)
		assert.False(t, should)
	})

	t.Run("uploads when interval elapsed and mutation count is large enough", func(t *testing.T) {
		be, _ := newTestBleveBackend(t, SnapshotOptions{MinDocCount: 1, UploadInterval: time.Minute, MinDocChanges: 25})
		idx := newUploadTestIndex(t, be, key, 150)
		require.NoError(t, writeSnapshotMutationCount(idx.index, 30))
		be.setUploadTracking(key, time.Now().Add(-2*time.Minute))

		should, err := be.shouldUpload(key, idx, time.Now())
		require.NoError(t, err)
		assert.True(t, should)
	})
}

func TestBulkIndexTracksSnapshotMutations(t *testing.T) {
	be, _ := newTestBleveBackend(t, SnapshotOptions{})
	key := newTestNsResource()
	idx := newUploadTestIndex(t, be, key, 42)

	count, err := readSnapshotMutationCount(idx.index)
	require.NoError(t, err)
	assert.Equal(t, int64(0), count)

	err = idx.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{
		{
			Action: resource.ActionIndex,
			Doc: &resource.IndexableDocument{
				Name:  "dash-2",
				Title: "dash-2",
				Key: &resourcepb.ResourceKey{
					Name:      "dash-2",
					Namespace: key.Namespace,
					Group:     key.Group,
					Resource:  key.Resource,
				},
			},
		},
		{
			Action: resource.ActionDelete,
			Key: &resourcepb.ResourceKey{
				Name:      "dash-1",
				Namespace: key.Namespace,
				Group:     key.Group,
				Resource:  key.Resource,
			},
		},
	}})
	require.NoError(t, err)

	count, err = readSnapshotMutationCount(idx.index)
	require.NoError(t, err)
	assert.Equal(t, int64(2), count)
}

func TestEvictExpiredIndexClearsUploadTracking(t *testing.T) {
	be, _ := newTestBleveBackend(t, SnapshotOptions{})
	key := newTestNsResource()
	resourceDir := be.getResourceDir(key)
	require.NoError(t, os.MkdirAll(resourceDir, 0o750))

	index, err := newBleveIndex(filepath.Join(resourceDir, formatIndexName(time.Now())), bleve.NewIndexMapping(), time.Now(), be.opts.BuildVersion, nil)
	require.NoError(t, err)
	require.NoError(t, index.Index("dash-1", map[string]string{"title": "Production Overview"}))
	require.NoError(t, setRV(index, 42))

	idx := be.newBleveIndex(key, index, indexStorageFile, nil, nil, nil, nil, be.log)
	idx.resourceVersion.Store(42)
	idx.expiration = time.Now().Add(-time.Minute)

	be.cacheMx.Lock()
	be.cache[key] = idx
	be.cacheMx.Unlock()
	be.setUploadTracking(key, time.Now())

	be.runEvictExpiredOrUnownedIndexes(time.Now())

	assert.Nil(t, be.getCachedIndex(key, time.Now()))
	_, ok := be.getUploadTracking(key)
	assert.False(t, ok)
}

func TestBleveSnapshotLifecycleWithFileBucket(t *testing.T) {
	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{Namespace: "default"})
	bucketURL := fileBucketURL(t, t.TempDir())
	key := newTestNsResource()

	beA, metricsA := newConfiguredSnapshotBackend(t, bucketURL)
	beAStopped := false
	t.Cleanup(func() {
		if !beAStopped {
			beA.Stop()
		}
	})
	idxA, err := beA.BuildIndex(ctx, key, 10, nil, "startup", func(index resource.ResourceIndex) (int64, error) {
		require.NoError(t, index.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{
			{
				Action: resource.ActionIndex,
				Doc: &resource.IndexableDocument{
					RV:    1,
					Name:  "dash-prod",
					Title: "Production Overview",
					Key: &resourcepb.ResourceKey{
						Name:      "dash-prod",
						Namespace: key.Namespace,
						Group:     key.Group,
						Resource:  key.Resource,
					},
				},
			},
			{
				Action: resource.ActionIndex,
				Doc: &resource.IndexableDocument{
					RV:    2,
					Name:  "dash-api",
					Title: "API Latency",
					Key: &resourcepb.ResourceKey{
						Name:      "dash-api",
						Namespace: key.Namespace,
						Group:     key.Group,
						Resource:  key.Resource,
					},
				},
			},
		}}))
		return 2, nil
	}, nil, false, time.Time{}, 0)
	require.NoError(t, err)
	require.NotNil(t, idxA)

	beA.runUploadSnapshots(ctx)
	assert.Equal(t, 1.0, testutil.ToFloat64(metricsA.IndexSnapshotUploads.WithLabelValues(snapshotUploadStatusSuccess)))

	indexes, err := ListIndexSnapshots(ctx, beA.opts.Snapshot.Store, key, testLogger)
	require.NoError(t, err)
	require.Len(t, indexes, 1)

	beA.Stop()
	beAStopped = true

	beB, metricsB := newConfiguredSnapshotBackend(t, bucketURL)
	t.Cleanup(beB.Stop)
	var builderCalled atomic.Bool
	idxB, err := beB.BuildIndex(ctx, key, 10, nil, "startup", func(resource.ResourceIndex) (int64, error) {
		builderCalled.Store(true)
		return 0, fmt.Errorf("builder should not be called when a remote snapshot is available")
	}, nil, false, time.Time{}, 0)
	require.NoError(t, err)
	require.NotNil(t, idxB)

	assert.False(t, builderCalled.Load())
	assert.Equal(t, 1.0, testutil.ToFloat64(metricsB.IndexSnapshotDownloads.WithLabelValues(snapshotPolicyTiered, snapshotStatusSuccess)))

	res, err := idxB.Search(ctx, nil, &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{
			Namespace: key.Namespace,
			Group:     key.Group,
			Resource:  key.Resource,
		}},
		Query: "Production",
		Limit: 100,
	}, nil, nil)
	require.NoError(t, err)
	require.Equal(t, int64(1), res.TotalHits)
	require.Equal(t, "dash-prod", res.Results.Rows[0].Key.Name)
}

func newConfiguredSnapshotBackend(t *testing.T, bucketURL string) (*bleveBackend, *resource.BleveIndexMetrics) {
	t.Helper()
	cfg := snapshotOptionsTestCfg(t)
	cfg.EnableSearch = true
	cfg.BuildVersion = "11.5.0"
	cfg.IndexSnapshotEnabled = true
	cfg.IndexSnapshotBucketURL = bucketURL

	metrics := resource.ProvideIndexMetrics(prometheus.NewRegistry())
	opts, err := NewSearchOptions(featuremgmt.WithFeatures(), cfg, nil, metrics, nil)
	require.NoError(t, err)
	be, ok := opts.Backend.(*bleveBackend)
	require.True(t, ok)
	be.opts.Snapshot.MinDocChanges = 1
	return be, metrics
}

func TestIntegrationBleveSnapshotRoundTrip(t *testing.T) {
	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{Namespace: "ns"})
	bucket := memblob.OpenBucket(nil)
	t.Cleanup(func() { _ = bucket.Close() })

	lockOpts := LockOptions{TTL: 5 * time.Second, HeartbeatInterval: 500 * time.Millisecond}
	store := NewBucketRemoteIndexStore(BucketRemoteIndexStoreConfig{
		Bucket:      bucket,
		LockBackend: newFakeBackend(newConditionalBucket()),
		LockOwner:   "test-owner",
		BuildLock:   lockOpts,
		CleanupLock: lockOpts,
	})
	key := newTestNsResource()
	meta := IndexMeta{
		BuildVersion:          "11.5.0",
		LatestResourceVersion: 123,
		UploadTimestamp:       time.Now(),
	}

	snapshotDir := filepath.Join(t.TempDir(), "snapshot")
	require.NoError(t, writeFakeSnapshot(snapshotDir, &meta))
	_, err := UploadIndexSnapshot(ctx, store, key, snapshotDir, meta, testLogger)
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
	}, nil, false, time.Time{}, 0)
	require.NoError(t, err)
	require.NotNil(t, idx)

	assert.False(t, builderCalled.Load(), "builder should not be called when a remote snapshot is available")
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotDownloads.WithLabelValues(snapshotPolicyTiered, snapshotStatusSuccess)))
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexBuildSkipped))

	bi, ok := idx.(*bleveIndex)
	require.True(t, ok)
	assert.Equal(t, meta.LatestResourceVersion, bi.resourceVersion.Load())

	trackedAt, tracked := be.getUploadTracking(key)
	require.True(t, tracked)
	assert.WithinDuration(t, meta.UploadTimestamp, trackedAt, time.Second)

	mutationCount, err := readSnapshotMutationCount(bi.index)
	require.NoError(t, err)
	assert.Zero(t, mutationCount)
}

// --- findFreshSnapshot{ByUploadTime,ByBuildStart} ---

// probeCase is one row in a table-driven test for findFreshSnapshotBy*.
// setup populates the per-case store and returns the ULID we expect the
// probe to return (zero ULID means "no match"). wantErr (substring) flags
// error-path cases; when set, the probe is expected to return an error.
type probeCase struct {
	name    string
	setup   func(t *testing.T, s *hookableStore, ns resource.NamespacedResource) ulid.ULID
	wantErr string
}

type probeFn func(ctx context.Context, s RemoteIndexStore, ns resource.NamespacedResource, notOlderThan time.Time, v string, f string, logger log.Logger) (ulid.ULID, *IndexMeta, error)

func runProbeCases(t *testing.T, probe probeFn, cases []probeCase) {
	t.Helper()
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			store := newHookableStore(t)
			ns := newTestNsResource()
			want := tc.setup(t, store, ns)
			format := testIndexFormat(t)
			k, meta, err := probe(t.Context(), store, ns, time.Now().Add(-time.Hour), "11.5.0", format, log.New("bleve-snapshot-test"))
			if tc.wantErr != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tc.wantErr)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, want, k)
			if (want == ulid.ULID{}) {
				assert.Nil(t, meta)
			} else {
				require.NotNil(t, meta)
			}
		})
	}
}

func TestFindFreshSnapshotByUploadTime(t *testing.T) {
	now := time.Now()
	mk := func(d time.Duration) ulid.ULID { return makeULID(t, now.Add(d)) }

	runProbeCases(t, findFreshSnapshotByUploadTime, []probeCase{
		{
			name: "homogeneous cluster: newest same-version returned",
			setup: func(t *testing.T, s *hookableStore, ns resource.NamespacedResource) ulid.ULID {
				seedSnapshot(t, t.Context(), s.bucket, ns, mk(-30*time.Minute), &IndexMeta{BuildVersion: "11.5.0"})
				k := mk(-5 * time.Minute)
				seedSnapshot(t, t.Context(), s.bucket, ns, k, &IndexMeta{BuildVersion: "11.5.0"})
				return k
			},
		},
		{
			name: "mixed version: walks past newer wrong-version",
			setup: func(t *testing.T, s *hookableStore, ns resource.NamespacedResource) ulid.ULID {
				seedSnapshot(t, t.Context(), s.bucket, ns, mk(-5*time.Minute), &IndexMeta{BuildVersion: "11.4.0"})
				match := mk(-30 * time.Minute)
				seedSnapshot(t, t.Context(), s.bucket, ns, match, &IndexMeta{BuildVersion: "11.5.0"})
				seedSnapshot(t, t.Context(), s.bucket, ns, mk(-50*time.Minute), &IndexMeta{BuildVersion: "11.5.0"})
				return match
			},
		},
		{
			name: "uses same index format",
			setup: func(t *testing.T, s *hookableStore, ns resource.NamespacedResource) ulid.ULID {
				format := testIndexFormat(t)
				match := mk(-5 * time.Minute)
				seedSnapshot(t, t.Context(), s.bucket, ns, match, &IndexMeta{BuildVersion: "11.5.0", IndexFormat: format})
				return match
			},
		},
		{
			name: "uses older index format",
			setup: func(t *testing.T, s *hookableStore, ns resource.NamespacedResource) ulid.ULID {
				match := mk(-5 * time.Minute)
				seedSnapshot(t, t.Context(), s.bucket, ns, match, &IndexMeta{BuildVersion: "11.5.0", IndexFormat: testIndexFormatDelta(t, -1)})
				return match
			},
		},
		{
			name: "skips newer index format",
			setup: func(t *testing.T, s *hookableStore, ns resource.NamespacedResource) ulid.ULID {
				format := testIndexFormat(t)
				seedSnapshot(t, t.Context(), s.bucket, ns, mk(-5*time.Minute), &IndexMeta{BuildVersion: "11.5.0", IndexFormat: testIndexFormatDelta(t, 1)})
				match := mk(-10 * time.Minute)
				seedSnapshot(t, t.Context(), s.bucket, ns, match, &IndexMeta{BuildVersion: "11.5.0", IndexFormat: format})
				return match
			},
		},
		{
			name: "uses legacy empty index format",
			setup: func(t *testing.T, s *hookableStore, ns resource.NamespacedResource) ulid.ULID {
				match := mk(-5 * time.Minute)
				seedSnapshot(t, t.Context(), s.bucket, ns, match, &IndexMeta{BuildVersion: "11.5.0"})
				return match
			},
		},
		{
			name:  "no candidates",
			setup: func(*testing.T, *hookableStore, resource.NamespacedResource) ulid.ULID { return ulid.ULID{} },
		},
		{
			name: "tolerates ErrSnapshotNotFound and ErrInvalidManifest mid-walk",
			setup: func(t *testing.T, s *hookableStore, ns resource.NamespacedResource) ulid.ULID {
				nf := mk(-5 * time.Minute)
				seedSnapshot(t, t.Context(), s.bucket, ns, nf, &IndexMeta{BuildVersion: "11.5.0"})
				s.setReadManifestErr(nf, ErrSnapshotNotFound)
				iv := mk(-10 * time.Minute)
				seedSnapshot(t, t.Context(), s.bucket, ns, iv, &IndexMeta{BuildVersion: "11.5.0"})
				s.setReadManifestErr(iv, ErrInvalidManifest)
				m := mk(-15 * time.Minute)
				seedSnapshot(t, t.Context(), s.bucket, ns, m, &IndexMeta{BuildVersion: "11.5.0"})
				return m
			},
		},
		{
			name: "surfaces list error",
			setup: func(t *testing.T, s *hookableStore, _ resource.NamespacedResource) ulid.ULID {
				s.setListKeysErr(errors.New("boom"))
				return ulid.ULID{}
			},
			wantErr: "boom",
		},
		{
			name: "surfaces unexpected GET error",
			setup: func(t *testing.T, s *hookableStore, ns resource.NamespacedResource) ulid.ULID {
				bad := mk(-5 * time.Minute)
				seedSnapshot(t, t.Context(), s.bucket, ns, bad, &IndexMeta{BuildVersion: "11.5.0"})
				s.setReadManifestErr(bad, errors.New("transport boom"))
				return ulid.ULID{}
			},
			wantErr: "transport boom",
		},
	})
}

func TestFindFreshSnapshotByBuildStart(t *testing.T) {
	now := time.Now()
	mk := func(d time.Duration) ulid.ULID { return makeULID(t, now.Add(d)) }

	runProbeCases(t, findFreshSnapshotByBuildStart, []probeCase{
		{
			name: "homogeneous cluster: newest same-version returned",
			setup: func(t *testing.T, s *hookableStore, ns resource.NamespacedResource) ulid.ULID {
				seedSnapshot(t, t.Context(), s.bucket, ns, mk(-30*time.Minute), &IndexMeta{BuildVersion: "11.5.0", BuildTime: now.Add(-35 * time.Minute)})
				k := mk(-5 * time.Minute)
				seedSnapshot(t, t.Context(), s.bucket, ns, k, &IndexMeta{BuildVersion: "11.5.0", BuildTime: now.Add(-10 * time.Minute)})
				return k
			},
		},
		{
			name: "mixed version: walks past newer wrong-version",
			setup: func(t *testing.T, s *hookableStore, ns resource.NamespacedResource) ulid.ULID {
				seedSnapshot(t, t.Context(), s.bucket, ns, mk(-5*time.Minute), &IndexMeta{BuildVersion: "11.4.0", BuildTime: now.Add(-10 * time.Minute)})
				match := mk(-30 * time.Minute)
				seedSnapshot(t, t.Context(), s.bucket, ns, match, &IndexMeta{BuildVersion: "11.5.0", BuildTime: now.Add(-35 * time.Minute)})
				seedSnapshot(t, t.Context(), s.bucket, ns, mk(-50*time.Minute), &IndexMeta{BuildVersion: "11.5.0", BuildTime: now.Add(-55 * time.Minute)})
				return match
			},
		},
		{
			// Behavioural difference vs findFreshSnapshotByUploadTime:
			// recent ULID + matching version + old BuildTime (a periodic
			// re-upload of a long-lived index) must be rejected.
			name: "skips recent re-upload of old build",
			setup: func(t *testing.T, s *hookableStore, ns resource.NamespacedResource) ulid.ULID {
				seedSnapshot(t, t.Context(), s.bucket, ns, mk(-5*time.Minute), &IndexMeta{BuildVersion: "11.5.0", BuildTime: now.Add(-3 * time.Hour)})
				return ulid.ULID{}
			},
		},
		{
			// Zero-value BuildTime carries no freshness signal.
			name: "skips zero BuildTime",
			setup: func(t *testing.T, s *hookableStore, ns resource.NamespacedResource) ulid.ULID {
				seedSnapshot(t, t.Context(), s.bucket, ns, mk(-5*time.Minute), &IndexMeta{BuildVersion: "11.5.0"})
				return ulid.ULID{}
			},
		},
		{
			name:  "no candidates",
			setup: func(*testing.T, *hookableStore, resource.NamespacedResource) ulid.ULID { return ulid.ULID{} },
		},
		{
			name: "tolerates ErrSnapshotNotFound and ErrInvalidManifest mid-walk",
			setup: func(t *testing.T, s *hookableStore, ns resource.NamespacedResource) ulid.ULID {
				nf := mk(-5 * time.Minute)
				seedSnapshot(t, t.Context(), s.bucket, ns, nf, &IndexMeta{BuildVersion: "11.5.0", BuildTime: now.Add(-10 * time.Minute)})
				s.setReadManifestErr(nf, ErrSnapshotNotFound)
				iv := mk(-10 * time.Minute)
				seedSnapshot(t, t.Context(), s.bucket, ns, iv, &IndexMeta{BuildVersion: "11.5.0", BuildTime: now.Add(-15 * time.Minute)})
				s.setReadManifestErr(iv, ErrInvalidManifest)
				m := mk(-15 * time.Minute)
				seedSnapshot(t, t.Context(), s.bucket, ns, m, &IndexMeta{BuildVersion: "11.5.0", BuildTime: now.Add(-20 * time.Minute)})
				return m
			},
		},
		{
			name: "surfaces list error",
			setup: func(t *testing.T, s *hookableStore, _ resource.NamespacedResource) ulid.ULID {
				s.setListKeysErr(errors.New("boom"))
				return ulid.ULID{}
			},
			wantErr: "boom",
		},
		{
			name: "surfaces unexpected GET error",
			setup: func(t *testing.T, s *hookableStore, ns resource.NamespacedResource) ulid.ULID {
				bad := mk(-5 * time.Minute)
				seedSnapshot(t, t.Context(), s.bucket, ns, bad, &IndexMeta{BuildVersion: "11.5.0", BuildTime: now.Add(-10 * time.Minute)})
				s.setReadManifestErr(bad, errors.New("transport boom"))
				return ulid.ULID{}
			},
			wantErr: "transport boom",
		},
	})
}

// withColdStartTimings overrides the package-level wait-loop timings for the
// duration of the test. Restored via t.Cleanup.
func withColdStartTimings(t *testing.T, poll, total time.Duration) {
	t.Helper()
	prevPoll, prevTotal := coldStartPollInterval, coldStartTotalWait
	coldStartPollInterval = poll
	coldStartTotalWait = total
	t.Cleanup(func() {
		coldStartPollInterval = prevPoll
		coldStartTotalWait = prevTotal
	})
}

// coldStartTest bundles common setup for coordinateColdStartBuild tests.
type coldStartTest struct {
	be          *bleveBackend
	metrics     *resource.BleveIndexMetrics
	store       *hookableStore
	ns          resource.NamespacedResource
	resourceDir string
}

func newColdStartTest(t *testing.T, store *hookableStore) coldStartTest {
	t.Helper()
	be, metrics := newTestBleveBackend(t, SnapshotOptions{
		Store:       store,
		MinDocCount: 1,
		MaxIndexAge: 24 * time.Hour,
	})
	ns := newTestNsResource()
	return coldStartTest{
		be:          be,
		metrics:     metrics,
		store:       store,
		ns:          ns,
		resourceDir: filepath.Join(be.opts.Root, ns.Namespace, ns.Resource+"."+ns.Group),
	}
}

func (ct coldStartTest) coordinate(ctx context.Context, lastImportTime time.Time) (string, IndexStoreLock, error) {
	idx, _, _, lock, err := ct.be.coordinateColdStartBuild(ctx, ct.ns, ct.resourceDir, lastImportTime, ct.be.log)
	role := "build_alone"
	switch {
	case err != nil:
		role = "error"
	case idx != nil:
		role = "downloaded"
		_ = idx.Close()
	case lock != nil:
		role = "leader"
	}
	return role, lock, err
}

func (ct coldStartTest) coldStartCounter(outcome string) float64 {
	return testutil.ToFloat64(ct.metrics.IndexSnapshotColdStarts.WithLabelValues(outcome))
}

func TestColdStart_BecameLeader(t *testing.T) {
	store := newHookableStore(t)
	ct := newColdStartTest(t, store)

	role, lock, err := ct.coordinate(context.Background(), time.Time{})
	require.NoError(t, err)
	assert.Equal(t, "leader", role)
	require.NotNil(t, lock)
	assert.Equal(t, int32(1), store.lockAcquireCalls.Load())
	assert.Equal(t, 1.0, ct.coldStartCounter(coldStartOutcomeAcquiredLock))

	require.NoError(t, lock.Release())
	assert.Equal(t, int32(1), store.lockReleaseCalls.Load(),
		"Release() must reach the underlying lock so the bucket entry is removed")
}

func TestColdStart_WaitedForLeader(t *testing.T) {
	store := newHookableStore(t)
	store.setLockBuildErr(errLockHeld) // another instance is the leader
	ct := newColdStartTest(t, store)
	withColdStartTimings(t, 10*time.Millisecond, time.Second)

	// Build the snapshot on the test goroutine — the build uses require.*,
	// which would violate testing.TB rules if called from the helper
	// goroutine below. The helper goroutine only writes prepared bytes to
	// the bucket and reports any error back via errCh.
	snap := buildDownloadableSnapshot(t, ct.ns, makeULID(t, time.Now()), freshSnapshot(time.Minute))
	ctx := t.Context()

	// While coordinateColdStartBuild is in its wait loop, simulate the
	// leader publishing the prepared snapshot. The next probe tick should
	// pick it up.
	errCh := make(chan error, 1)
	go func() {
		time.Sleep(25 * time.Millisecond)
		errCh <- snap.publish(ctx, store.bucket)
	}()

	role, lock, err := ct.coordinate(context.Background(), time.Time{})
	require.NoError(t, err)
	require.NoError(t, <-errCh)
	assert.Equal(t, "downloaded", role)
	assert.Nil(t, lock)
	// The waiter must not have taken the lock, so lockReleaseCalls stays at
	// zero (no Release was invoked because no Acquire ever succeeded).
	assert.Zero(t, store.lockReleaseCalls.Load(),
		"waiter must not acquire the lock when a snapshot becomes available")
	assert.Equal(t, 1.0, ct.coldStartCounter(coldStartOutcomeDownloadedAfterWait))
}

func TestColdStart_WaitTimeout(t *testing.T) {
	store := newHookableStore(t)
	store.setLockBuildErr(errLockHeld)
	ct := newColdStartTest(t, store)
	withColdStartTimings(t, 5*time.Millisecond, 30*time.Millisecond)

	role, lock, err := ct.coordinate(context.Background(), time.Time{})
	require.NoError(t, err)
	assert.Equal(t, "build_alone", role)
	assert.Nil(t, lock)
	assert.Equal(t, 1.0, ct.coldStartCounter(coldStartOutcomeWaitTimedOut))
	// We retried the lock at least a couple times before giving up.
	assert.GreaterOrEqual(t, store.lockAcquireCalls.Load(), int32(2))
}

func TestColdStart_AcquiresLockAfterLeaderRelease(t *testing.T) {
	store := newHookableStore(t)
	store.setLockBuildErr(errLockHeld)
	ct := newColdStartTest(t, store)
	withColdStartTimings(t, 10*time.Millisecond, time.Second)

	// Simulate the leader releasing the lock without uploading a snapshot
	// (e.g. its build failed). The next tryAcquire in the wait loop should
	// promote us.
	go func() {
		time.Sleep(25 * time.Millisecond)
		store.setLockBuildErr(nil)
	}()

	role, lock, err := ct.coordinate(context.Background(), time.Time{})
	require.NoError(t, err)
	assert.Equal(t, "leader", role)
	require.NotNil(t, lock)
	t.Cleanup(func() { _ = lock.Release() })
	assert.Equal(t, 1.0, ct.coldStartCounter(coldStartOutcomeAcquiredLock))
}

func TestColdStart_LockBackendErrorBuildsAlone(t *testing.T) {
	store := newHookableStore(t)
	store.setLockBuildErr(errors.New("backend down"))
	ct := newColdStartTest(t, store)

	role, lock, err := ct.coordinate(context.Background(), time.Time{})
	require.NoError(t, err)
	assert.Equal(t, "build_alone", role)
	assert.Nil(t, lock)
	assert.Equal(t, 1.0, ct.coldStartCounter(coldStartOutcomeLockError))
}

// TestColdStart_LockBackendContextErrorPropagates verifies that a context
// error returned by LockBuildIndex itself (e.g. cancellation arriving
// mid-acquire) is propagated, not swallowed as a build-alone fallback.
func TestColdStart_LockBackendContextErrorPropagates(t *testing.T) {
	store := newHookableStore(t)
	store.setLockBuildErr(context.Canceled)
	ct := newColdStartTest(t, store)

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // ctx is already canceled before the call

	_, _, err := ct.coordinate(ctx, time.Time{})
	require.ErrorIs(t, err, context.Canceled)
	assert.Zero(t, ct.coldStartCounter(coldStartOutcomeLockError), "context cancel must not be recorded as lock_error")
	assert.Zero(t, ct.coldStartCounter(coldStartOutcomeWaitTimedOut), "context cancel must not be recorded as wait_timed_out")
	assert.Equal(t, 1.0, ct.coldStartCounter(coldStartOutcomeContextCanceled))
}

func TestColdStart_ContextCancelInWaitLoop(t *testing.T) {
	store := newHookableStore(t)
	store.setLockBuildErr(errLockHeld)
	ct := newColdStartTest(t, store)
	withColdStartTimings(t, 10*time.Millisecond, time.Second)

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		time.Sleep(20 * time.Millisecond)
		cancel()
	}()

	_, _, err := ct.coordinate(ctx, time.Time{})
	require.ErrorIs(t, err, context.Canceled)
	assert.Zero(t, ct.coldStartCounter(coldStartOutcomeWaitTimedOut), "context cancel must not be recorded as wait_timed_out")
	assert.Equal(t, 1.0, ct.coldStartCounter(coldStartOutcomeContextCanceled))
}

// runBuildIndexColdStart wires a bleveBackend around store and calls
// BuildIndex on the cachedIndex==nil / !rebuild path with a stock builder
// that records its invocation count. builderExtra (optional) runs inside
// the build closure for tests that need to perturb store state
// mid-build. MinDocCount=1, MaxIndexAge=24h, lastImportTime is zero,
// rebuild=false, maxFreshSnapshotAge=0 (rebuild-path knob doesn't affect
// cold-start).
func runBuildIndexColdStart(t *testing.T, store RemoteIndexStore, builderExtra func()) (
	*resource.BleveIndexMetrics, *atomic.Int32, resource.ResourceIndex, error,
) {
	t.Helper()
	be, metrics := newTestBleveBackend(t, SnapshotOptions{
		Store:       store,
		MinDocCount: 1,
		MaxIndexAge: 24 * time.Hour,
	})
	builderCalled := &atomic.Int32{}
	idx, err := be.BuildIndex(context.Background(), newTestNsResource(), 10, nil, "startup",
		func(resource.ResourceIndex) (int64, error) {
			builderCalled.Add(1)
			if builderExtra != nil {
				builderExtra()
			}
			return 1, nil
		},
		nil, false, time.Time{}, 0)
	return metrics, builderCalled, idx, err
}

// TestBuildIndex_ColdStartFastPathDownloads verifies that on the
// initial-startup path (cachedIndex == nil, !rebuild) BuildIndex picks up
// a same-version snapshot from the remote store and skips the builder.
// With a fresh snapshot present, the tiered selection runs first and
// downloads it before the cold-start path is even considered.
func TestBuildIndex_ColdStartFastPathDownloads(t *testing.T) {
	store := newHookableStore(t)
	seedDownloadableSnapshot(t, t.Context(), store.bucket, newTestNsResource(), makeULID(t, time.Now()), freshSnapshot(time.Minute))
	metrics, builderCalled, idx, err := runBuildIndexColdStart(t, store, nil)
	require.NoError(t, err)
	require.NotNil(t, idx)

	// The tiered remote-snapshot selection runs first and downloads —
	// that's enough to skip the builder. The cold-start path only runs if
	// the tiered selection misses; here it finds the snapshot first.
	assert.Zero(t, builderCalled.Load(), "builder must not run when a snapshot is available")
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotDownloads.WithLabelValues(snapshotPolicyTiered, snapshotStatusSuccess)))
}

// TestBuildIndex_ColdStartLeaderUploads exercises the leader path: empty
// store, leader builds from scratch, and the leader's freshly-built snapshot
// is uploaded immediately under the held lock.
func TestBuildIndex_ColdStartLeaderUploads(t *testing.T) {
	store := newHookableStore(t)
	metrics, builderCalled, idx, err := runBuildIndexColdStart(t, store, nil)
	require.NoError(t, err)
	require.NotNil(t, idx)

	assert.Equal(t, int32(1), builderCalled.Load(), "builder must run on the leader path")
	assert.Equal(t, int32(1), store.uploadCalls.Load(), "leader must upload immediately")
	assert.Equal(t, int32(1), store.lockReleaseCalls.Load(), "leader must release the build lock")
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotColdStarts.WithLabelValues(coldStartOutcomeAcquiredLock)))
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotUploads.WithLabelValues(snapshotUploadStatusSuccess)))
}

// TestBuildIndex_ColdStartLeaderLockLostDuringBuild verifies that if the
// leader's lock is lost while the builder is running, the immediate upload
// is skipped (recorded as skip_lock_lost) but the build itself still
// completes — lock-lost is coordination, not a fatal error.
func TestBuildIndex_ColdStartLeaderLockLostDuringBuild(t *testing.T) {
	store := newHookableStore(t)
	// Simulate heartbeat-detected lease loss while we're in the middle of
	// the from-scratch build.
	metrics, builderCalled, idx, err := runBuildIndexColdStart(t, store, store.signalLockLost)
	require.NoError(t, err)
	require.NotNil(t, idx)

	assert.Equal(t, int32(1), builderCalled.Load(), "builder must run on the leader path")
	assert.Zero(t, store.uploadCalls.Load(), "leader must skip immediate upload after lock loss")
	assert.Equal(t, int32(1), store.lockReleaseCalls.Load(), "leader still releases the lock object")
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotUploads.WithLabelValues(snapshotUploadStatusSkipLockLost)))
	assert.Zero(t, testutil.ToFloat64(metrics.IndexSnapshotUploads.WithLabelValues(snapshotUploadStatusSuccess)))
}

// TestBuildIndex_ColdStartTimeoutBuildsAlone verifies that when the lock is
// permanently held by another instance and no snapshot ever appears, the
// timeout path runs the builder anyway (no upload).
func TestBuildIndex_ColdStartTimeoutBuildsAlone(t *testing.T) {
	store := newHookableStore(t)
	store.setLockBuildErr(errLockHeld)
	withColdStartTimings(t, 5*time.Millisecond, 30*time.Millisecond)
	metrics, builderCalled, idx, err := runBuildIndexColdStart(t, store, nil)
	require.NoError(t, err)
	require.NotNil(t, idx)

	assert.Equal(t, int32(1), builderCalled.Load(), "build alone after timeout")
	assert.Zero(t, store.uploadCalls.Load(), "no leader upload on timeout path")
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotColdStarts.WithLabelValues(coldStartOutcomeWaitTimedOut)))
}

// TestBuildIndex_ColdStartRunsWhenMaxIndexAgeZero verifies that
// MaxIndexAge=0 means "no age limit" rather than "reject everything":
// cold-start coordination still runs, the leader path is taken, and the
// freshly-built snapshot is uploaded immediately under the held lock.
func TestBuildIndex_ColdStartRunsWhenMaxIndexAgeZero(t *testing.T) {
	store := newHookableStore(t)
	be, metrics := newTestBleveBackend(t, SnapshotOptions{
		Store:       store,
		MinDocCount: 1,
		// MaxIndexAge intentionally zero — "no age limit".
	})

	builderCalled := atomic.Int32{}
	idx, err := be.BuildIndex(context.Background(), newTestNsResource(), 10, nil, "startup",
		func(resource.ResourceIndex) (int64, error) {
			builderCalled.Add(1)
			return 1, nil
		},
		nil, false, time.Time{}, 0)
	require.NoError(t, err)
	require.NotNil(t, idx)

	assert.Equal(t, int32(1), builderCalled.Load(), "builder must run on the leader path")
	assert.Equal(t, int32(1), store.lockAcquireCalls.Load(), "cold-start must attempt the lock even when MaxIndexAge=0")
	assert.Equal(t, int32(1), store.uploadCalls.Load(), "leader must upload immediately")
	assert.Equal(t, int32(1), store.lockReleaseCalls.Load(), "leader must release the build lock")
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotColdStarts.WithLabelValues(coldStartOutcomeAcquiredLock)))
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotUploads.WithLabelValues(snapshotUploadStatusSuccess)))
}

// TestBuildIndex_ColdStartContextCancelPropagates verifies that a context
// cancellation during cold-start coordination aborts BuildIndex with the
// context error rather than falling back to a full from-scratch build.
func TestBuildIndex_ColdStartContextCancelPropagates(t *testing.T) {
	store := newHookableStore(t)
	store.setLockBuildErr(errLockHeld) // force entry to the wait loop
	withColdStartTimings(t, 5*time.Millisecond, time.Second)
	be, _ := newTestBleveBackend(t, SnapshotOptions{
		Store:       store,
		MinDocCount: 1,
		MaxIndexAge: 24 * time.Hour,
	})

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		time.Sleep(20 * time.Millisecond)
		cancel()
	}()

	builderCalled := atomic.Int32{}
	idx, err := be.BuildIndex(ctx, newTestNsResource(), 10, nil, "startup",
		func(resource.ResourceIndex) (int64, error) {
			builderCalled.Add(1)
			return 1, nil
		},
		nil, false, time.Time{}, 0)
	require.ErrorIs(t, err, context.Canceled)
	assert.Nil(t, idx)
	assert.Zero(t, builderCalled.Load(), "builder must not run after context cancel")
}

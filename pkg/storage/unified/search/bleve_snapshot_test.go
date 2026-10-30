package search

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Masterminds/semver/v3"
	"github.com/blevesearch/bleve/v2"
	"github.com/grafana/authlib/types"
	"github.com/oklog/ulid/v2"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
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
	features := meta.Features
	if features == nil {
		// Otherwise the index is rejected after download for missing a required feature.
		features = resource.CurrentIndexFeatures()
	}
	bi, err := json.Marshal(buildInfo{
		BuildTime:          meta.UploadTimestamp.Unix(),
		BuildVersion:       meta.BuildVersion,
		Features:           features,
		ReaderRequirements: meta.ReaderRequirements,
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
	ns := newTestNsResource()
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
		_, ok := newBackend(minV).pickBestSnapshot(ns, nil, cutoff(24*time.Hour), log.New("bleve-snapshot-test"))
		assert.False(t, ok)
	})

	t.Run("dropped by age", func(t *testing.T) {
		all := map[ulid.ULID]*IndexMeta{makeULID(t, now): snap("11.5.0", 100, 2*time.Hour)}
		_, ok := newBackend(minV).pickBestSnapshot(ns, all, cutoff(time.Hour), log.New("bleve-snapshot-test"))
		assert.False(t, ok)
	})

	// Pins the "MaxIndexAge=0 means no age limit" semantic for the tiered
	// selection path: tryDownloadRemoteSnapshot leaves notOlderThan as the
	// zero time when MaxIndexAge is zero, and pickBestSnapshot must skip
	// the age filter rather than rejecting everything.
	t.Run("zero cutoff is no age limit", func(t *testing.T) {
		old := makeULID(t, now.Add(-30*24*time.Hour))
		all := map[ulid.ULID]*IndexMeta{old: snap("11.5.0", 100, 30*24*time.Hour)}
		c, ok := newBackend(minV).pickBestSnapshot(ns, all, time.Time{}, log.New("bleve-snapshot-test"))
		require.True(t, ok)
		assert.Equal(t, old, c.key)
	})

	t.Run("dropped for unparseable version", func(t *testing.T) {
		all := map[ulid.ULID]*IndexMeta{makeULID(t, now): snap("not-a-version", 100, time.Minute)}
		_, ok := newBackend(minV).pickBestSnapshot(ns, all, cutoff(24*time.Hour), log.New("bleve-snapshot-test"))
		assert.False(t, ok)
	})

	requiring := func(ver string, rv int64, age time.Duration, requirements ...resource.IndexFeature) *IndexMeta {
		m := snap(ver, rv, age)
		m.ReaderRequirements = requirements
		return m
	}

	t.Run("dropped for unknown reader requirements", func(t *testing.T) {
		all := map[ulid.ULID]*IndexMeta{makeULID(t, now): requiring("11.5.0", 100, time.Minute, "feature-from-the-future")}
		_, ok := newBackend(minV).pickBestSnapshot(ns, all, cutoff(24*time.Hour), log.New("bleve-snapshot-test"))
		assert.False(t, ok)
	})

	t.Run("requirements this instance understands are accepted", func(t *testing.T) {
		key := makeULID(t, now)
		all := map[ulid.ULID]*IndexMeta{key: requiring("11.5.0", 100, time.Minute, resource.IndexFeatureDeletedMarker)}
		c, ok := newBackend(minV).pickBestSnapshot(ns, all, cutoff(24*time.Hour), log.New("bleve-snapshot-test"))
		require.True(t, ok)
		assert.Equal(t, key, c.key)
	})

	requiringFeatures := func(features ...resource.IndexFeature) *bleveBackend {
		be := newBackend(minV)
		be.requiredFeatures = features
		return be
	}
	having := func(ver string, rv int64, age time.Duration, features ...resource.IndexFeature) *IndexMeta {
		m := snap(ver, rv, age)
		m.Features = features
		m.FeaturesRecorded = true
		return m
	}

	t.Run("dropped when missing a required feature", func(t *testing.T) {
		all := map[ulid.ULID]*IndexMeta{makeULID(t, now): having("11.5.0", 100, time.Minute)}
		_, ok := requiringFeatures("alpha").pickBestSnapshot(ns, all, cutoff(24*time.Hour), log.New("bleve-snapshot-test"))
		assert.False(t, ok)
	})

	t.Run("kept when it has the required feature", func(t *testing.T) {
		key := makeULID(t, now)
		all := map[ulid.ULID]*IndexMeta{key: having("11.5.0", 100, time.Minute, "alpha")}
		c, ok := requiringFeatures("alpha").pickBestSnapshot(ns, all, cutoff(24*time.Hour), log.New("bleve-snapshot-test"))
		require.True(t, ok)
		assert.Equal(t, key, c.key)
	})

	// Snapshots uploaded before features were recorded are unknown, not known to be
	// unusable, so they stay in the running as before.
	t.Run("kept when features were not recorded", func(t *testing.T) {
		key := makeULID(t, now)
		all := map[ulid.ULID]*IndexMeta{key: snap("11.5.0", 100, time.Minute)}
		c, ok := requiringFeatures("alpha").pickBestSnapshot(ns, all, cutoff(24*time.Hour), log.New("bleve-snapshot-test"))
		require.True(t, ok)
		assert.Equal(t, key, c.key)
	})

	// What the filter is for: the newest snapshot lacks the feature, so an older one
	// that has it is used instead of downloading, rejecting and rebuilding.
	t.Run("falls back to an older snapshot that has the feature", func(t *testing.T) {
		usable := makeULID(t, now.Add(-30*time.Second))
		all := map[ulid.ULID]*IndexMeta{
			usable:           having("11.4.5", 100, time.Minute, "alpha"),
			makeULID(t, now): having("11.5.0", 999, time.Minute),
		}
		c, ok := requiringFeatures("alpha").pickBestSnapshot(ns, all, cutoff(24*time.Hour), log.New("bleve-snapshot-test"))
		require.True(t, ok)
		assert.Equal(t, usable, c.key)
	})

	// Without the filter the newer one wins as tier 2 and its documents are misread.
	t.Run("falls back to an older snapshot when the newest needs an unknown feature", func(t *testing.T) {
		compatible := makeULID(t, now.Add(-30*time.Second))
		all := map[ulid.ULID]*IndexMeta{
			compatible:       snap("11.5.0", 100, time.Minute),
			makeULID(t, now): requiring("12.0.0", 999, time.Minute, "feature-from-the-future"),
		}
		c, ok := newBackend(minV).pickBestSnapshot(ns, all, cutoff(24*time.Hour), log.New("bleve-snapshot-test"))
		require.True(t, ok)
		assert.Equal(t, compatible, c.key)
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
		c, ok := newBackend(minV).pickBestSnapshot(ns, all, cutoff(24*time.Hour), log.New("bleve-snapshot-test"))
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
		c, ok := newBackend(minV).pickBestSnapshot(ns, all, cutoff(24*time.Hour), log.New("bleve-snapshot-test"))
		require.True(t, ok)
		assert.Equal(t, older, c.key)
		assert.Equal(t, 1, c.tier)
	})

	t.Run("tier 2 picked as last resort", func(t *testing.T) {
		only := makeULID(t, now)
		all := map[ulid.ULID]*IndexMeta{only: snap("12.0.0", 100, time.Minute)}
		c, ok := newBackend(minV).pickBestSnapshot(ns, all, cutoff(24*time.Hour), log.New("bleve-snapshot-test"))
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

		c, ok := newBackend(minV).pickBestSnapshot(ns, all, cutoff(24*time.Hour), log.New("bleve-snapshot-test"))
		require.True(t, ok)
		assert.Equal(t, legacy, c.key, "empty legacy format remains compatible and normal tie-breaking still applies")

		delete(all, legacy)
		c, ok = newBackend(minV).pickBestSnapshot(ns, all, cutoff(24*time.Hour), log.New("bleve-snapshot-test"))
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
		got, ok := newBackend(minV).pickBestSnapshot(ns, all, cutoff(24*time.Hour), log.New("bleve-snapshot-test"))
		require.True(t, ok)
		assert.Equal(t, c, got.key)

		// Adding d (same version + RV as c, newer upload): d wins via upload-desc tiebreaker.
		all[d] = snap("11.5.0", 200, time.Minute)
		got, ok = newBackend(minV).pickBestSnapshot(ns, all, cutoff(24*time.Hour), log.New("bleve-snapshot-test"))
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
	return testutil.ToFloat64(dt.metrics.IndexSnapshotDownloadAttempts.WithLabelValues(snapshotPolicyTiered, status))
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
	seedDownloadableSnapshot(t, t.Context(), store.inner, dt.ns, makeULID(t, time.Now()), &IndexMeta{
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
	seedDownloadableSnapshot(t, t.Context(), store.inner, dt.ns, makeULID(t, time.Now()), &IndexMeta{
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
	seedDownloadableSnapshot(t, t.Context(), store.inner, dt.ns, makeULID(t, time.Now()), &IndexMeta{
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

// Without the fallback this would rebuild from scratch instead.
func TestTryDownloadRemoteSnapshot_FallsBackToNextCandidate(t *testing.T) {
	store := newHookableStore(t)
	dt := newDownloadTest(t, store)
	dt.be.requiredFeatures = []resource.IndexFeature{"alpha"}

	// Ranked first on RV, but its index lacks the required feature — which selection
	// cannot see, because the manifest recorded no features.
	seedDownloadableSnapshot(t, t.Context(), store.inner, dt.ns, makeULID(t, time.Now()), &IndexMeta{
		BuildVersion:          "11.5.0",
		LatestResourceVersion: 100,
		UploadTimestamp:       time.Now(),
	})
	seedDownloadableSnapshot(t, t.Context(), store.inner, dt.ns, makeULID(t, time.Now().Add(-time.Minute)), &IndexMeta{
		BuildVersion:          "11.5.0",
		LatestResourceVersion: 50,
		UploadTimestamp:       time.Now().Add(-time.Minute),
		Features:              []resource.IndexFeature{"alpha"},
	})

	idx, rv, err := dt.run(t)
	require.NoError(t, err)
	require.NotNil(t, idx)
	assert.Equal(t, int64(50), rv, "should end up on the older snapshot that validates")
	// One outcome per attempt, not per call.
	assert.Equal(t, 1.0, dt.counter(snapshotStatusValidateError))
	assert.Equal(t, 1.0, dt.counter(snapshotStatusSuccess))
}

// The cap keeps a namespace full of unusable snapshots from delaying startup.
func TestTryDownloadRemoteSnapshot_StopsAtAttemptCap(t *testing.T) {
	store := newHookableStore(t)
	dt := newDownloadTest(t, store)
	dt.be.requiredFeatures = []resource.IndexFeature{"alpha"}

	for i := range maxSnapshotDownloadAttempts + 2 {
		age := time.Duration(i) * time.Minute
		seedDownloadableSnapshot(t, t.Context(), store.inner, dt.ns, makeULID(t, time.Now().Add(-age)), &IndexMeta{
			BuildVersion:          "11.5.0",
			LatestResourceVersion: int64(100 - i),
			UploadTimestamp:       time.Now().Add(-age),
		})
	}

	_, _, err := dt.run(t)
	require.Error(t, err)
	// Stops at the cap rather than working through all five candidates.
	assert.Equal(t, float64(maxSnapshotDownloadAttempts), dt.counter(snapshotStatusValidateError))
	assert.Zero(t, dt.counter(snapshotStatusSuccess))
}

func TestTryDownloadRemoteSnapshot_AllFilteredOut(t *testing.T) {
	store := newHookableStore(t)
	dt := newDownloadTest(t, store)
	seedDownloadableSnapshot(t, t.Context(), store.inner, dt.ns, makeULID(t, time.Now().Add(-2*time.Hour)), &IndexMeta{
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
	seedDownloadableSnapshot(t, t.Context(), store.inner, dt.ns, makeULID(t, time.Now().Add(-30*24*time.Hour)), &IndexMeta{
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
	return testutil.ToFloat64(dt.metrics.IndexSnapshotDownloadAttempts.WithLabelValues(snapshotPolicySameVersion, status))
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
	seedDownloadableSnapshot(t, t.Context(), store.inner, dt.ns, makeULID(t, time.Now()), freshSnapshot(time.Minute))

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
	seedDownloadableSnapshot(t, t.Context(), store.inner, dt.ns, makeULID(t, time.Now()), freshSnapshot(30*24*time.Hour))

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
	seedSnapshot(t, t.Context(), store.inner, dt.ns, makeULID(t, time.Now()), meta)

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
	seedSnapshot(t, t.Context(), store.inner, dt.ns, makeULID(t, time.Now()), meta)

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
	seedSnapshot(t, t.Context(), store.inner, dt.ns, makeULID(t, time.Now()), freshSnapshot(5*time.Minute))

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
	seedDownloadableSnapshot(t, t.Context(), store.inner, dt.ns, makeULID(t, time.Now()), freshSnapshot(time.Minute))

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
	seedSnapshot(t, t.Context(), store.inner, dt.ns, makeULID(t, now), &IndexMeta{
		BuildVersion:          "11.5.0",
		LatestResourceVersion: 10,
		UploadTimestamp:       now,
		BuildTime:             now.Add(-3 * time.Hour),
	})
	// Older ULID, fresh BuildTime: this is the one we want.
	seedDownloadableSnapshot(t, t.Context(), store.inner, dt.ns, makeULID(t, now.Add(-30*time.Minute)), &IndexMeta{
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
	seedDownloadableSnapshot(t, t.Context(), store.inner, ns, makeULID(t, time.Now()), freshSnapshot(time.Minute))
	be, metrics := newTestBleveBackend(t, SnapshotOptions{
		Store:       store,
		MinDocCount: 1,
		MaxIndexAge: 24 * time.Hour,
	})

	builderCalled := atomic.Int32{}
	idx, err := be.BuildIndex(context.Background(), ns, 10, "rebuild",
		func(resource.ResourceIndex) (int64, error) {
			builderCalled.Add(1)
			return 1, nil
		},
		nil, true /*rebuild*/, time.Time{}, time.Hour /*maxFreshSnapshotAge*/, resource.BuildIndexOptions{})
	require.NoError(t, err)
	require.NotNil(t, idx)
	assert.Zero(t, builderCalled.Load(), "builder should not run when a fresh remote snapshot is used")
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotDownloadAttempts.WithLabelValues(snapshotPolicySameVersion, snapshotStatusSuccess)))
}

// TestBuildIndex_RebuildFallsBackToBuilder verifies that on the rebuild path
// when no fresh same-version snapshot is available, BuildIndex runs the
// builder rather than falling back to the tiered selection.
func TestBuildIndex_RebuildFallsBackToBuilder(t *testing.T) {
	store := newHookableStore(t)
	ns := newTestNsResource()
	// Older snapshot present — would be acceptable to the tiered policy on
	// the initial-startup path, but must be ignored on the rebuild path.
	seedSnapshot(t, t.Context(), store.inner, ns, makeULID(t, time.Now().Add(-3*time.Hour)), &IndexMeta{
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
	idx, err := be.BuildIndex(context.Background(), ns, 10, "rebuild",
		func(index resource.ResourceIndex) (int64, error) {
			builderCalled.Add(1)
			return 1, nil
		},
		nil, true /*rebuild*/, time.Time{}, time.Hour /*maxFreshSnapshotAge*/, resource.BuildIndexOptions{})
	require.NoError(t, err)
	require.NotNil(t, idx)
	assert.Equal(t, int32(1), builderCalled.Load(), "builder should run when no fresh snapshot is available")
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotDownloadAttempts.WithLabelValues(snapshotPolicySameVersion, snapshotStatusEmpty)))
	assert.Zero(t, store.downloadCalls.Load(), "older snapshot must not be downloaded on the rebuild path")
}

// TestBuildIndex_RebuildLeaderUploads verifies that a periodic rebuild leader
// holds the remote build lock through the rebuild and uploads the fresh snapshot
// immediately so waiting replicas can download it.
func TestBuildIndex_RebuildLeaderUploads(t *testing.T) {
	store := newHookableStore(t)
	ns := newTestNsResource()
	be, metrics := newTestBleveBackend(t, SnapshotOptions{
		Store:       store,
		MinDocCount: 1,
		MaxIndexAge: 24 * time.Hour,
	})

	builderCalled := atomic.Int32{}
	idx, err := be.BuildIndex(t.Context(), ns, 10, "rebuild",
		func(index resource.ResourceIndex) (int64, error) {
			builderCalled.Add(1)
			return 7, nil
		},
		nil, true /*rebuild*/, time.Time{}, time.Hour /*maxFreshSnapshotAge*/, resource.BuildIndexOptions{})
	require.NoError(t, err)
	require.NotNil(t, idx)

	assert.Equal(t, int32(1), builderCalled.Load(), "builder must run on the leader path")
	assert.Equal(t, int32(1), store.lockAcquireCalls.Load(), "leader must acquire the build lock")
	assert.Equal(t, int32(1), store.uploadCalls.Load(), "leader must upload immediately")
	assert.Equal(t, int32(1), store.lockReleaseCalls.Load(), "leader must release the build lock")
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotUploads.WithLabelValues(snapshotUploadStatusSuccess)))
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotBuildCoordinations.WithLabelValues(snapshotBuildFlowRebuild, snapshotBuildOutcomeAcquiredLock)))
}

// TestBuildIndex_RebuildLeaderLockLostDuringBuild verifies that if the rebuild
// leader's lock is lost during the build, the immediate upload is skipped but
// the rebuild itself still completes — lock-lost is coordination, not fatal.
func TestBuildIndex_RebuildLeaderLockLostDuringBuild(t *testing.T) {
	store := newHookableStore(t)
	ns := newTestNsResource()
	be, metrics := newTestBleveBackend(t, SnapshotOptions{
		Store:       store,
		MinDocCount: 1,
		MaxIndexAge: 24 * time.Hour,
	})

	builderCalled := atomic.Int32{}
	idx, err := be.BuildIndex(t.Context(), ns, 10, "rebuild",
		func(resource.ResourceIndex) (int64, error) {
			builderCalled.Add(1)
			store.signalLockLost()
			return 7, nil
		},
		nil, true /*rebuild*/, time.Time{}, time.Hour /*maxFreshSnapshotAge*/, resource.BuildIndexOptions{})
	require.NoError(t, err)
	require.NotNil(t, idx)

	assert.Equal(t, int32(1), builderCalled.Load(), "builder must run on the leader path")
	assert.Zero(t, store.uploadCalls.Load(), "leader must skip immediate upload after lock loss")
	assert.Equal(t, int32(1), store.lockReleaseCalls.Load(), "leader still releases the build lock")
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotUploads.WithLabelValues(snapshotUploadStatusSkipLockLost)))
	assert.Zero(t, testutil.ToFloat64(metrics.IndexSnapshotUploads.WithLabelValues(snapshotUploadStatusSuccess)))
}

func TestBuildIndex_RebuildWaiterDownloadsFreshSnapshot(t *testing.T) {
	store := newHookableStore(t)
	ns := newTestNsResource()
	be, _ := newTestBleveBackend(t, SnapshotOptions{
		Store:       store,
		MinDocCount: 1,
		MaxIndexAge: 24 * time.Hour,
	})
	withSnapshotBuildPollInterval(t, 5*time.Millisecond)

	heldLock, err := store.inner.LockBuildIndex(t.Context(), ns, "11.5.0")
	require.NoError(t, err)
	defer func() { require.NoError(t, heldLock.Release()) }()

	ctx, cancel := context.WithTimeout(t.Context(), 2*time.Second)
	defer cancel()

	builderCalled := atomic.Int32{}
	type buildResult struct {
		idx resource.ResourceIndex
		err error
	}
	resultCh := make(chan buildResult, 1)
	go func() {
		idx, err := be.BuildIndex(ctx, ns, 10, "rebuild",
			func(resource.ResourceIndex) (int64, error) {
				builderCalled.Add(1)
				return 1, nil
			},
			nil, true /*rebuild*/, time.Time{}, time.Hour /*maxFreshSnapshotAge*/, resource.BuildIndexOptions{})
		resultCh <- buildResult{idx: idx, err: err}
	}()

	require.Eventually(t, func() bool {
		return store.lockAcquireCalls.Load() > 0
	}, time.Second, 5*time.Millisecond)
	seedDownloadableSnapshot(t, t.Context(), store.inner, ns, makeULID(t, time.Now()), freshSnapshot(time.Minute))

	select {
	case result := <-resultCh:
		require.NoError(t, result.err)
		require.NotNil(t, result.idx)
	case <-ctx.Done():
		t.Fatal("timed out waiting for rebuild waiter")
	}

	assert.Zero(t, builderCalled.Load(), "waiter must not rebuild when a fresh snapshot appears")
	assert.Positive(t, store.downloadCalls.Load(), "waiter must download the fresh snapshot")
}

// TestBuildIndex_RebuildWaiterRecordsDownloadedAfterWait verifies that the
// rebuild waiter records the downloaded_after_wait outcome under the rebuild
// flow on the shared build-coordination metric.
func TestBuildIndex_RebuildWaiterRecordsDownloadedAfterWait(t *testing.T) {
	store := newHookableStore(t)
	ns := newTestNsResource()
	be, metrics := newTestBleveBackend(t, SnapshotOptions{
		Store:       store,
		MinDocCount: 1,
		MaxIndexAge: 24 * time.Hour,
	})
	withSnapshotBuildPollInterval(t, 5*time.Millisecond)

	heldLock, err := store.inner.LockBuildIndex(t.Context(), ns, "11.5.0")
	require.NoError(t, err)
	defer func() { require.NoError(t, heldLock.Release()) }()

	ctx, cancel := context.WithTimeout(t.Context(), 2*time.Second)
	defer cancel()

	type buildResult struct {
		idx resource.ResourceIndex
		err error
	}
	resultCh := make(chan buildResult, 1)
	go func() {
		idx, err := be.BuildIndex(ctx, ns, 10, "rebuild",
			func(resource.ResourceIndex) (int64, error) { return 1, nil },
			nil, true /*rebuild*/, time.Time{}, time.Hour /*maxFreshSnapshotAge*/, resource.BuildIndexOptions{})
		resultCh <- buildResult{idx: idx, err: err}
	}()

	require.Eventually(t, func() bool {
		return store.lockAcquireCalls.Load() > 0
	}, time.Second, 5*time.Millisecond)
	seedDownloadableSnapshot(t, t.Context(), store.inner, ns, makeULID(t, time.Now()), freshSnapshot(time.Minute))

	select {
	case result := <-resultCh:
		require.NoError(t, result.err)
		require.NotNil(t, result.idx)
	case <-ctx.Done():
		t.Fatal("timed out waiting for rebuild waiter")
	}

	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotBuildCoordinations.WithLabelValues(snapshotBuildFlowRebuild, snapshotBuildOutcomeDownloadedAfterWait)))
}

// TestBuildIndex_RebuildSkipsFastPathWhenDisabled verifies that passing
// maxFreshSnapshotAge=0 disables the rebuild-path fast path entirely (no
// list/get calls against the store).
func TestBuildIndex_RebuildSkipsFastPathWhenDisabled(t *testing.T) {
	store := newHookableStore(t)
	ns := newTestNsResource()
	seedSnapshot(t, t.Context(), store.inner, ns, makeULID(t, time.Now()), freshSnapshot(time.Minute))
	be, _ := newTestBleveBackend(t, SnapshotOptions{
		Store:       store,
		MinDocCount: 1,
		MaxIndexAge: 24 * time.Hour,
	})

	builderCalled := atomic.Int32{}
	idx, err := be.BuildIndex(context.Background(), ns, 10, "rebuild",
		func(resource.ResourceIndex) (int64, error) {
			builderCalled.Add(1)
			return 1, nil
		},
		nil, true /*rebuild*/, time.Time{}, 0 /*disabled*/, resource.BuildIndexOptions{})
	require.NoError(t, err)
	require.NotNil(t, idx)
	assert.Equal(t, int32(1), builderCalled.Load())
	assert.Zero(t, store.downloadCalls.Load())
	assert.Zero(t, store.lockAcquireCalls.Load())
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

	idx, err := be.BuildIndex(context.Background(), newTestNsResource(), 1, "test",
		func(resource.ResourceIndex) (int64, error) { return 1, nil },
		nil, false, time.Time{}, 0, resource.BuildIndexOptions{})
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

	t.Run("skips when mutation count is below threshold and snapshot is still fresh", func(t *testing.T) {
		be, _ := newTestBleveBackend(t, SnapshotOptions{MinDocCount: 1, MaxIndexAge: 8 * time.Hour, UploadInterval: time.Minute, MinDocChanges: 100})
		idx := newUploadTestIndex(t, be, key, 150)
		require.NoError(t, writeSnapshotMutationCount(idx.index, 50))
		now := time.Now()
		be.setUploadTracking(key, now.Add(-2*time.Hour))

		should, err := be.shouldUpload(key, idx, now)
		require.NoError(t, err)
		assert.False(t, should)
	})

	t.Run("uploads when mutation count is below threshold but snapshot is stale", func(t *testing.T) {
		be, _ := newTestBleveBackend(t, SnapshotOptions{MinDocCount: 1, MaxIndexAge: 8 * time.Hour, UploadInterval: time.Minute, MinDocChanges: 100})
		idx := newUploadTestIndex(t, be, key, 150)
		require.NoError(t, writeSnapshotMutationCount(idx.index, 50))
		now := time.Now()
		be.setUploadTracking(key, now.Add(-5*time.Hour))

		should, err := be.shouldUpload(key, idx, now)
		require.NoError(t, err)
		assert.True(t, should)
	})

	t.Run("skips stale snapshot when upload interval has not elapsed", func(t *testing.T) {
		be, _ := newTestBleveBackend(t, SnapshotOptions{MinDocCount: 1, MaxIndexAge: 2 * time.Hour, UploadInterval: 4 * time.Hour, MinDocChanges: 100})
		idx := newUploadTestIndex(t, be, key, 150)
		require.NoError(t, writeSnapshotMutationCount(idx.index, 50))
		now := time.Now()
		be.setUploadTracking(key, now.Add(-2*time.Hour))

		should, err := be.shouldUpload(key, idx, now)
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

	index, err := newBleveIndex(filepath.Join(resourceDir, formatIndexName(time.Now())), bleve.NewIndexMapping(), time.Now(), be.opts.BuildVersion, nil, "")
	require.NoError(t, err)
	require.NoError(t, index.Index("dash-1", map[string]string{"title": "Production Overview"}))
	require.NoError(t, setRV(index, 42))

	idx := be.newBleveIndex(key, index, indexStorageFile, nil, nil, nil, be.log)
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

func TestBleveSnapshotLifecycleWithSharedStore(t *testing.T) {
	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{Namespace: "default"})
	store := newTestKVRemoteIndexStore(t)
	key := newTestNsResource()

	beA, metricsA := newConfiguredSnapshotBackend(t, store)
	beAStopped := false
	t.Cleanup(func() {
		if !beAStopped {
			beA.Stop()
		}
	})
	idxA, err := beA.BuildIndex(ctx, key, 10, "startup", func(index resource.ResourceIndex) (int64, error) {
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
	}, nil, false, time.Time{}, 0, resource.BuildIndexOptions{})
	require.NoError(t, err)
	require.NotNil(t, idxA)

	beA.runUploadSnapshots(ctx)
	assert.Equal(t, 1.0, testutil.ToFloat64(metricsA.IndexSnapshotUploads.WithLabelValues(snapshotUploadStatusSuccess)))

	indexes, err := ListIndexSnapshots(ctx, beA.opts.Snapshot.Store, key, testLogger)
	require.NoError(t, err)
	require.Len(t, indexes, 1)

	beA.Stop()
	beAStopped = true

	beB, metricsB := newConfiguredSnapshotBackend(t, store)
	t.Cleanup(beB.Stop)
	var builderCalled atomic.Bool
	idxB, err := beB.BuildIndex(ctx, key, 10, "startup", func(resource.ResourceIndex) (int64, error) {
		builderCalled.Store(true)
		return 0, fmt.Errorf("builder should not be called when a remote snapshot is available")
	}, nil, false, time.Time{}, 0, resource.BuildIndexOptions{})
	require.NoError(t, err)
	require.NotNil(t, idxB)

	assert.False(t, builderCalled.Load())
	assert.Equal(t, 1.0, testutil.ToFloat64(metricsB.IndexSnapshotDownloadAttempts.WithLabelValues(snapshotPolicyTiered, snapshotStatusSuccess)))

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
	require.Equal(t, "dash-prod", res.Rows[0].Key.Name)
}

func newConfiguredSnapshotBackend(t *testing.T, store RemoteIndexStore) (*bleveBackend, *resource.BleveIndexMetrics) {
	t.Helper()
	cfg := snapshotOptionsTestCfg(t)
	cfg.EnableSearch = true
	cfg.BuildVersion = "11.5.0"
	cfg.IndexSnapshotEnabled = true

	metrics := resource.ProvideIndexMetrics(prometheus.NewRegistry())
	opts, err := NewSearchOptions(cfg, nil, metrics, nil, store)
	require.NoError(t, err)
	be, ok := opts.Backend.(*bleveBackend)
	require.True(t, ok)
	be.opts.Snapshot.MinDocChanges = 1
	return be, metrics
}

func TestIntegrationBleveSnapshotRoundTrip(t *testing.T) {
	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{Namespace: "ns"})
	store := newTestKVRemoteIndexStore(t)
	key := newTestNsResource()
	meta := IndexMeta{
		BuildVersion:          "11.5.0",
		LatestResourceVersion: 123,
		UploadTimestamp:       time.Now(),
	}

	snapshotDir := filepath.Join(t.TempDir(), "snapshot")
	require.NoError(t, writeFakeSnapshot(snapshotDir, &meta))
	uploadedKey, err := UploadIndexSnapshot(ctx, store, key, snapshotDir, meta, testLogger)
	require.NoError(t, err)
	// UploadIndexSnapshot derives the persisted UploadTimestamp from a freshly
	// generated ULID, not from the caller's meta. Use that as the expected value
	// so the assertion below is exact and not subject to scheduling delays.
	expectedUploadedAt := ulid.Time(uploadedKey.Time())

	// Fresh backend pointing at the same store should download instead of building.
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
	idx, err := be.BuildIndex(ctx, key, 10, "startup", func(resource.ResourceIndex) (int64, error) {
		builderCalled.Store(true)
		return 0, nil
	}, nil, false, time.Time{}, 0, resource.BuildIndexOptions{})
	require.NoError(t, err)
	require.NotNil(t, idx)

	assert.False(t, builderCalled.Load(), "builder should not be called when a remote snapshot is available")
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotDownloadAttempts.WithLabelValues(snapshotPolicyTiered, snapshotStatusSuccess)))
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexBuildSkipped))

	bi, ok := idx.(*bleveIndex)
	require.True(t, ok)
	assert.Equal(t, meta.LatestResourceVersion, bi.resourceVersion.Load())

	trackedAt, tracked := be.getUploadTracking(key)
	require.True(t, tracked)
	assert.True(t, expectedUploadedAt.Equal(trackedAt),
		"trackedAt %s should equal manifest UploadTimestamp %s", trackedAt, expectedUploadedAt)

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
				seedSnapshot(t, t.Context(), s.inner, ns, mk(-30*time.Minute), &IndexMeta{BuildVersion: "11.5.0"})
				k := mk(-5 * time.Minute)
				seedSnapshot(t, t.Context(), s.inner, ns, k, &IndexMeta{BuildVersion: "11.5.0"})
				return k
			},
		},
		{
			name: "mixed version: walks past newer wrong-version",
			setup: func(t *testing.T, s *hookableStore, ns resource.NamespacedResource) ulid.ULID {
				seedSnapshot(t, t.Context(), s.inner, ns, mk(-5*time.Minute), &IndexMeta{BuildVersion: "11.4.0"})
				match := mk(-30 * time.Minute)
				seedSnapshot(t, t.Context(), s.inner, ns, match, &IndexMeta{BuildVersion: "11.5.0"})
				seedSnapshot(t, t.Context(), s.inner, ns, mk(-50*time.Minute), &IndexMeta{BuildVersion: "11.5.0"})
				return match
			},
		},
		{
			name: "uses same index format",
			setup: func(t *testing.T, s *hookableStore, ns resource.NamespacedResource) ulid.ULID {
				format := testIndexFormat(t)
				match := mk(-5 * time.Minute)
				seedSnapshot(t, t.Context(), s.inner, ns, match, &IndexMeta{BuildVersion: "11.5.0", IndexFormat: format})
				return match
			},
		},
		{
			name: "uses older index format",
			setup: func(t *testing.T, s *hookableStore, ns resource.NamespacedResource) ulid.ULID {
				match := mk(-5 * time.Minute)
				seedSnapshot(t, t.Context(), s.inner, ns, match, &IndexMeta{BuildVersion: "11.5.0", IndexFormat: testIndexFormatDelta(t, -1)})
				return match
			},
		},
		{
			name: "skips newer index format",
			setup: func(t *testing.T, s *hookableStore, ns resource.NamespacedResource) ulid.ULID {
				format := testIndexFormat(t)
				seedSnapshot(t, t.Context(), s.inner, ns, mk(-5*time.Minute), &IndexMeta{BuildVersion: "11.5.0", IndexFormat: testIndexFormatDelta(t, 1)})
				match := mk(-10 * time.Minute)
				seedSnapshot(t, t.Context(), s.inner, ns, match, &IndexMeta{BuildVersion: "11.5.0", IndexFormat: format})
				return match
			},
		},
		{
			name: "uses legacy empty index format",
			setup: func(t *testing.T, s *hookableStore, ns resource.NamespacedResource) ulid.ULID {
				match := mk(-5 * time.Minute)
				seedSnapshot(t, t.Context(), s.inner, ns, match, &IndexMeta{BuildVersion: "11.5.0"})
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
				seedSnapshot(t, t.Context(), s.inner, ns, nf, &IndexMeta{BuildVersion: "11.5.0"})
				s.setReadManifestErr(nf, ErrSnapshotNotFound)
				iv := mk(-10 * time.Minute)
				seedSnapshot(t, t.Context(), s.inner, ns, iv, &IndexMeta{BuildVersion: "11.5.0"})
				s.setReadManifestErr(iv, ErrInvalidManifest)
				m := mk(-15 * time.Minute)
				seedSnapshot(t, t.Context(), s.inner, ns, m, &IndexMeta{BuildVersion: "11.5.0"})
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
				seedSnapshot(t, t.Context(), s.inner, ns, bad, &IndexMeta{BuildVersion: "11.5.0"})
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
				seedSnapshot(t, t.Context(), s.inner, ns, mk(-30*time.Minute), &IndexMeta{BuildVersion: "11.5.0", BuildTime: now.Add(-35 * time.Minute)})
				k := mk(-5 * time.Minute)
				seedSnapshot(t, t.Context(), s.inner, ns, k, &IndexMeta{BuildVersion: "11.5.0", BuildTime: now.Add(-10 * time.Minute)})
				return k
			},
		},
		{
			name: "mixed version: walks past newer wrong-version",
			setup: func(t *testing.T, s *hookableStore, ns resource.NamespacedResource) ulid.ULID {
				seedSnapshot(t, t.Context(), s.inner, ns, mk(-5*time.Minute), &IndexMeta{BuildVersion: "11.4.0", BuildTime: now.Add(-10 * time.Minute)})
				match := mk(-30 * time.Minute)
				seedSnapshot(t, t.Context(), s.inner, ns, match, &IndexMeta{BuildVersion: "11.5.0", BuildTime: now.Add(-35 * time.Minute)})
				seedSnapshot(t, t.Context(), s.inner, ns, mk(-50*time.Minute), &IndexMeta{BuildVersion: "11.5.0", BuildTime: now.Add(-55 * time.Minute)})
				return match
			},
		},
		{
			// Behavioural difference vs findFreshSnapshotByUploadTime:
			// recent ULID + matching version + old BuildTime (a periodic
			// re-upload of a long-lived index) must be rejected.
			name: "skips recent re-upload of old build",
			setup: func(t *testing.T, s *hookableStore, ns resource.NamespacedResource) ulid.ULID {
				seedSnapshot(t, t.Context(), s.inner, ns, mk(-5*time.Minute), &IndexMeta{BuildVersion: "11.5.0", BuildTime: now.Add(-3 * time.Hour)})
				return ulid.ULID{}
			},
		},
		{
			// Zero-value BuildTime carries no freshness signal.
			name: "skips zero BuildTime",
			setup: func(t *testing.T, s *hookableStore, ns resource.NamespacedResource) ulid.ULID {
				seedSnapshot(t, t.Context(), s.inner, ns, mk(-5*time.Minute), &IndexMeta{BuildVersion: "11.5.0"})
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
				seedSnapshot(t, t.Context(), s.inner, ns, nf, &IndexMeta{BuildVersion: "11.5.0", BuildTime: now.Add(-10 * time.Minute)})
				s.setReadManifestErr(nf, ErrSnapshotNotFound)
				iv := mk(-10 * time.Minute)
				seedSnapshot(t, t.Context(), s.inner, ns, iv, &IndexMeta{BuildVersion: "11.5.0", BuildTime: now.Add(-15 * time.Minute)})
				s.setReadManifestErr(iv, ErrInvalidManifest)
				m := mk(-15 * time.Minute)
				seedSnapshot(t, t.Context(), s.inner, ns, m, &IndexMeta{BuildVersion: "11.5.0", BuildTime: now.Add(-20 * time.Minute)})
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
				seedSnapshot(t, t.Context(), s.inner, ns, bad, &IndexMeta{BuildVersion: "11.5.0", BuildTime: now.Add(-10 * time.Minute)})
				s.setReadManifestErr(bad, errors.New("transport boom"))
				return ulid.ULID{}
			},
			wantErr: "transport boom",
		},
	})
}

// withSnapshotBuildPollInterval overrides snapshotBuildPollInterval for the
// duration of the test. Restored via t.Cleanup.
func withSnapshotBuildPollInterval(t *testing.T, poll time.Duration) {
	t.Helper()
	prev := snapshotBuildPollInterval
	snapshotBuildPollInterval = poll
	t.Cleanup(func() {
		snapshotBuildPollInterval = prev
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
	idx, _, _, lock, err := ct.be.coordinateColdStartBuild(ctx, ct.ns, ct.resourceDir, lastImportTime, ct.be.log, false)
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
	return testutil.ToFloat64(ct.metrics.IndexSnapshotBuildCoordinations.WithLabelValues(snapshotBuildFlowColdStart, outcome))
}

type pausedInitialListing struct {
	resource.StorageBackend
	once    sync.Once
	started chan struct{}
	release <-chan struct{}
}

func (s *pausedInitialListing) ListIterator(ctx context.Context, req *resourcepb.ListRequest, callback func(resource.ListIterator) error) (int64, error) {
	pause := false
	s.once.Do(func() {
		pause = true
		close(s.started)
	})
	if pause {
		select {
		case <-ctx.Done():
			return 0, ctx.Err()
		case <-s.release:
		}
	}
	return s.StorageBackend.ListIterator(ctx, req, callback)
}

func TestBackgroundGlobalIndexBuildAndSnapshotRestore(t *testing.T) {
	ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
	defer cancel()
	ctx = types.WithAuthInfo(ctx, &identity.StaticRequester{
		Type: types.TypeUser, Login: "testuser", UserID: 1, UserUID: "u1", Namespace: "default", IsGrafanaAdmin: true,
	})
	kvStore := newTestBadgerKV(t)
	storage, err := resource.NewKVStorageBackend(resource.KVBackendOptions{KvStore: kvStore, DisableStorageServices: true})
	require.NoError(t, err)
	writer, err := resource.NewResourceServer(resource.ResourceServerOptions{Backend: storage})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, writer.Stop(t.Context())) })
	for _, kind := range []struct{ group, resource, name string }{
		{group: "dashboard.grafana.app", resource: "dashboards", name: "Dashboard"},
		{group: "folder.grafana.app", resource: "folders", name: "Folder"},
	} {
		for i := range 3 {
			name := fmt.Sprintf("%s-%d", kind.resource, i)
			rsp, err := writer.Create(ctx, &resourcepb.CreateRequest{
				Key: &resourcepb.ResourceKey{Namespace: "default", Group: kind.group, Resource: kind.resource, Name: name},
				Value: fmt.Appendf(nil, `{"apiVersion":%q,"kind":%q,"metadata":{"name":%q,"namespace":"default"},"spec":{"title":%q}}`,
					kind.group+"/v1", kind.name, name, name),
			})
			require.NoError(t, err)
			require.Nil(t, rsp.Error)
		}
	}
	key := resource.GlobalSearchKey("default")
	newServer := func(backend *bleveBackend, storage resource.StorageBackend) resource.SearchServer {
		t.Helper()
		server, err := resource.NewUninitializedSearchServer(resource.ResourceServerOptions{
			Backend: storage,
			Search: resource.SearchOptions{
				Backend: backend,
				Resources: &resource.TestDocumentBuilderSupplier{GroupsResources: map[string]string{
					"dashboard.grafana.app": "dashboards", "folder.grafana.app": "folders",
				}},
				GlobalIndexEnabled:   true,
				GlobalIndexBuildWait: 20 * time.Millisecond,
				InitMinCount:         4,
			},
			AccessClient: types.FixedAccessClient(true),
		})
		require.NoError(t, err)
		t.Cleanup(func() { require.NoError(t, server.Stop(t.Context())) })
		return server
	}
	store := newTestKVRemoteIndexStoreOn(t, kvStore, "builder")
	backend, _ := newTestBleveBackend(t, SnapshotOptions{Store: store, MinDocCount: 5, MaxIndexAge: time.Hour})
	release := make(chan struct{})
	paused := &pausedInitialListing{StorageBackend: storage, started: make(chan struct{}), release: release}
	server := newServer(backend, paused)
	require.NoError(t, server.Init(ctx))
	req := &resourcepb.ResourceSearchRequest{
		Options:      &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource}},
		Limit:        10,
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
	}
	// Startup does not build the global index; the first search does, and gets
	// 503 while it is being built.
	rsp, err := server.Search(ctx, req)
	require.NoError(t, err)
	require.Equal(t, resource.NewServiceUnavailableError("the global search index for this namespace is still being built"), rsp.Error)
	select {
	case <-paused.started:
	case <-ctx.Done():
		t.Fatal("the first search did not start the build")
	}
	close(release)
	assertSearch := func(server resource.SearchServer) {
		t.Helper()
		require.Eventually(t, func() bool {
			rsp, err := server.Search(ctx, req)
			return err == nil && rsp.Error == nil && rsp.TotalHits == 6
		}, 5*time.Second, 10*time.Millisecond)
	}
	assertSearch(server)
	// A build for a search does not upload; the periodic uploader does.
	backend.runUploadSnapshots(ctx)
	snapshots, err := ListIndexSnapshots(ctx, store, key, testLogger)
	require.NoError(t, err)
	require.Len(t, snapshots, 1)

	followerStore := newTestKVRemoteIndexStoreOn(t, kvStore, "restorer")
	followerBackend, metrics := newTestBleveBackend(t, SnapshotOptions{Store: followerStore, MinDocCount: 5, MaxIndexAge: time.Hour})
	follower := newServer(followerBackend, storage)
	require.NoError(t, follower.Init(ctx))
	assertSearch(follower)
	require.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotDownloadAttempts.WithLabelValues(snapshotPolicyTiered, snapshotStatusSuccess)))
}

// A global index built for a search has no size, but it may be large, so it
// is restored from a snapshot when one exists.
func TestGlobalIndexOfUnknownSizeDownloadsASnapshot(t *testing.T) {
	kvStore := newTestBadgerKV(t)
	key := resource.GlobalSearchKey("default")
	docsKey := resource.NamespacedResource{Namespace: "default", Group: "dashboard.grafana.app", Resource: "dashboards"}
	builder, _ := newTestBleveBackend(t, SnapshotOptions{Store: newTestKVRemoteIndexStoreOn(t, kvStore, "builder"), MinDocCount: 5, MaxIndexAge: time.Hour})
	_, err := builder.BuildIndex(t.Context(), key, 6, "init", indexTestDocs(docsKey, 6, 100), nil, false, time.Time{}, 0, resource.BuildIndexOptions{})
	require.NoError(t, err)

	restorer, metrics := newTestBleveBackend(t, SnapshotOptions{Store: newTestKVRemoteIndexStoreOn(t, kvStore, "restorer"), MinDocCount: 5, MaxIndexAge: time.Hour})
	idx, err := restorer.BuildIndex(t.Context(), key, -1, "search", indexTestDocs(docsKey, 6, 100), nil, false, time.Time{}, 0, resource.BuildIndexOptions{})
	require.NoError(t, err)
	count, err := idx.DocCount(t.Context(), "", nil)
	require.NoError(t, err)
	require.Equal(t, int64(6), count)
	require.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotDownloadAttempts.WithLabelValues(snapshotPolicyTiered, snapshotStatusSuccess)))
}

func TestColdStartReplicasShareOneBuild(t *testing.T) {
	for _, key := range []resource.NamespacedResource{
		{Namespace: "default", Group: "dashboard.grafana.app", Resource: "dashboards"},
		resource.GlobalSearchKey("default"),
	} {
		t.Run(key.Resource, func(t *testing.T) {
			kvStore := newTestBadgerKV(t)
			leaderStore := newTestKVRemoteIndexStoreOn(t, kvStore, "leader")
			followerStore := newTestKVRemoteIndexStoreOn(t, kvStore, "follower")
			leader, _ := newTestBleveBackend(t, SnapshotOptions{Store: leaderStore, MinDocCount: 1, MaxIndexAge: time.Hour})
			follower, _ := newTestBleveBackend(t, SnapshotOptions{Store: followerStore, MinDocCount: 1, MaxIndexAge: time.Hour})

			ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
			defer cancel()
			started := make(chan struct{})
			release := make(chan struct{})
			leaderDone := make(chan error, 1)
			var builds sync.WaitGroup
			builds.Go(func() {
				_, err := leader.BuildIndex(ctx, key, 1, "init", func(index resource.ResourceIndex) (int64, error) {
					close(started)
					select {
					case <-ctx.Done():
						return 0, ctx.Err()
					case <-release:
					}
					err := index.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{{
						Action: resource.ActionIndex,
						Doc: &resource.IndexableDocument{
							Name:  "dashboard",
							Title: "Dashboard",
							RV:    1,
							Key:   &resourcepb.ResourceKey{Namespace: key.Namespace, Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dashboard"},
						},
					}}})
					return 1, err
				}, nil, false, time.Time{}, 0, resource.BuildIndexOptions{SkipIfBuilding: true})
				leaderDone <- err
			})
			t.Cleanup(func() {
				cancel()
				builds.Wait()
			})
			select {
			case <-started:
			case <-ctx.Done():
				t.Fatal("leader did not start building")
			}

			var followerBuilds atomic.Int32
			tryFollower := func() (resource.ResourceIndex, error) {
				return follower.BuildIndex(ctx, key, 1, "init", func(resource.ResourceIndex) (int64, error) {
					followerBuilds.Add(1)
					return 0, fmt.Errorf("follower must download the leader's snapshot")
				}, nil, false, time.Time{}, 0, resource.BuildIndexOptions{SkipIfBuilding: true})
			}
			for range 3 {
				index, err := tryFollower()
				require.ErrorIs(t, err, resource.ErrIndexBuildInProgress)
				require.Nil(t, index)
			}
			close(release)
			require.NoError(t, <-leaderDone)

			index, err := tryFollower()
			require.NoError(t, err)
			require.NotNil(t, index)
			require.Zero(t, followerBuilds.Load())
			count, err := index.DocCount(ctx, "", nil)
			require.NoError(t, err)
			require.Equal(t, int64(1), count)
			snapshots, err := ListIndexSnapshots(ctx, followerStore, key, testLogger)
			require.NoError(t, err)
			require.Len(t, snapshots, 1)
		})
	}
}

func TestOnDemandGlobalReplicasDoNotCoordinateForUnknownSize(t *testing.T) {
	kvStore := newTestBadgerKV(t)
	firstStore := &hookableStore{inner: newTestKVRemoteIndexStoreOn(t, kvStore, "first")}
	secondStore := &hookableStore{inner: newTestKVRemoteIndexStoreOn(t, kvStore, "second")}
	first, _ := newTestBleveBackend(t, SnapshotOptions{Store: firstStore, MinDocCount: 5, MaxIndexAge: time.Hour})
	second, _ := newTestBleveBackend(t, SnapshotOptions{Store: secondStore, MinDocCount: 5, MaxIndexAge: time.Hour})
	key := resource.GlobalSearchKey("default")
	writeDoc := func(index resource.ResourceIndex) (int64, error) {
		return 1, index.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{{
			Action: resource.ActionIndex,
			Doc: &resource.IndexableDocument{
				Name:  "dashboard",
				Title: "Dashboard",
				RV:    1,
				Key:   &resourcepb.ResourceKey{Namespace: key.Namespace, Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dashboard"},
			},
		}}})
	}

	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	started := make(chan struct{})
	release := make(chan struct{})
	firstDone := make(chan error, 1)
	var builds sync.WaitGroup
	builds.Go(func() {
		_, err := first.BuildIndex(ctx, key, -1, "search", func(index resource.ResourceIndex) (int64, error) {
			close(started)
			select {
			case <-ctx.Done():
				return 0, ctx.Err()
			case <-release:
				return writeDoc(index)
			}
		}, nil, false, time.Time{}, 0, resource.BuildIndexOptions{})
		firstDone <- err
	})
	t.Cleanup(func() {
		cancel()
		builds.Wait()
	})
	select {
	case <-started:
	case <-ctx.Done():
		t.Fatal("first request did not start building")
	}

	// Unknown size is what a request passes, and its build uses blocking options.
	index, err := second.BuildIndex(ctx, key, -1, "search", writeDoc, nil, false, time.Time{}, 0, resource.BuildIndexOptions{})
	require.NoError(t, err, "a small on-demand build must not wait for another replica")
	count, err := index.DocCount(ctx, "", nil)
	require.NoError(t, err)
	require.Equal(t, int64(1), count)
	select {
	case err := <-firstDone:
		t.Fatalf("the first build should still be waiting for release: %v", err)
	default:
	}
	close(release)
	require.NoError(t, <-firstDone)
	for _, store := range []*hookableStore{firstStore, secondStore} {
		// It looks for a snapshot to download, but does not coordinate a build
		// or upload one, so it never waits for another replica.
		require.Zero(t, store.lockAcquireCalls.Load())
		require.NotZero(t, store.listKeyCalls.Load())
		require.Zero(t, store.uploadCalls.Load())
	}
}

func TestColdStart_BecameLeader(t *testing.T) {
	store := newHookableStore(t)
	ct := newColdStartTest(t, store)

	role, lock, err := ct.coordinate(context.Background(), time.Time{})
	require.NoError(t, err)
	assert.Equal(t, "leader", role)
	require.NotNil(t, lock)
	assert.Equal(t, int32(1), store.lockAcquireCalls.Load())
	assert.Equal(t, 1.0, ct.coldStartCounter(snapshotBuildOutcomeAcquiredLock))

	require.NoError(t, lock.Release())
	assert.Equal(t, int32(1), store.lockReleaseCalls.Load(),
		"Release() must reach the underlying lock so the bucket entry is removed")
}

func TestColdStart_WaitedForLeader(t *testing.T) {
	store := newHookableStore(t)
	store.setLockBuildErr(errLockHeld) // another instance is the leader
	ct := newColdStartTest(t, store)
	withSnapshotBuildPollInterval(t, 10*time.Millisecond)

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
		errCh <- snap.publish(ctx, store.inner)
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
	assert.Equal(t, 1.0, ct.coldStartCounter(snapshotBuildOutcomeDownloadedAfterWait))
}

func TestColdStart_WaitsUntilCanceled(t *testing.T) {
	store := newHookableStore(t)
	store.setLockBuildErr(errLockHeld)
	ct := newColdStartTest(t, store)
	withSnapshotBuildPollInterval(t, 5*time.Millisecond)

	ctx, cancel := context.WithTimeout(t.Context(), 50*time.Millisecond)
	defer cancel()
	role, lock, err := ct.coordinate(ctx, time.Time{})
	require.ErrorIs(t, err, context.DeadlineExceeded)
	assert.Equal(t, "error", role)
	assert.Nil(t, lock)
	assert.Equal(t, 1.0, ct.coldStartCounter(snapshotBuildOutcomeContextCanceled))
	assert.GreaterOrEqual(t, store.lockAcquireCalls.Load(), int32(2))
}

func TestColdStart_DefersWhenLeaderHoldsLock(t *testing.T) {
	store := newHookableStore(t)
	store.setLockBuildErr(errLockHeld)
	ct := newColdStartTest(t, store)

	idx, _, _, lock, err := ct.be.coordinateColdStartBuild(t.Context(), ct.ns, ct.resourceDir, time.Time{}, ct.be.log, true)
	require.ErrorIs(t, err, resource.ErrIndexBuildInProgress)
	assert.Nil(t, idx)
	assert.Nil(t, lock)
	assert.Equal(t, int32(1), store.lockAcquireCalls.Load())
	assert.Equal(t, 1.0, ct.coldStartCounter(snapshotBuildOutcomeLockHeld))
}

func TestColdStart_AcquiresLockAfterLeaderRelease(t *testing.T) {
	store := newHookableStore(t)
	store.setLockBuildErr(errLockHeld)
	ct := newColdStartTest(t, store)
	withSnapshotBuildPollInterval(t, 10*time.Millisecond)

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
	assert.Equal(t, 1.0, ct.coldStartCounter(snapshotBuildOutcomeAcquiredLock))
}

func TestColdStart_LockBackendErrorBuildsAlone(t *testing.T) {
	store := newHookableStore(t)
	store.setLockBuildErr(errors.New("backend down"))
	ct := newColdStartTest(t, store)

	role, lock, err := ct.coordinate(context.Background(), time.Time{})
	require.NoError(t, err)
	assert.Equal(t, "build_alone", role)
	assert.Nil(t, lock)
	assert.Equal(t, 1.0, ct.coldStartCounter(snapshotBuildOutcomeLockError))
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
	assert.Zero(t, ct.coldStartCounter(snapshotBuildOutcomeLockError), "context cancel must not be recorded as lock_error")
	assert.Equal(t, 1.0, ct.coldStartCounter(snapshotBuildOutcomeContextCanceled))
}

func TestColdStart_ContextCancelInWaitLoop(t *testing.T) {
	store := newHookableStore(t)
	store.setLockBuildErr(errLockHeld)
	ct := newColdStartTest(t, store)
	withSnapshotBuildPollInterval(t, 10*time.Millisecond)

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		time.Sleep(20 * time.Millisecond)
		cancel()
	}()

	_, _, err := ct.coordinate(ctx, time.Time{})
	require.ErrorIs(t, err, context.Canceled)
	assert.Equal(t, 1.0, ct.coldStartCounter(snapshotBuildOutcomeContextCanceled))
}

// runBuildIndexColdStart wires a bleveBackend around store and calls
// BuildIndex on the cachedIndex==nil / !rebuild path with a stock builder
// that records its invocation count. builderExtra (optional) runs inside
// the build closure for tests that need to perturb store state
// mid-build. MinDocCount=1, MaxIndexAge=24h, lastImportTime is zero,
// rebuild=false, maxFreshSnapshotAge=0 (rebuild-path knob doesn't affect
// cold-start).
func runBuildIndexColdStart(t *testing.T, store RemoteIndexStore, builderExtra func(), options resource.BuildIndexOptions) (
	*resource.BleveIndexMetrics, *atomic.Int32, resource.ResourceIndex, error,
) {
	t.Helper()
	be, metrics := newTestBleveBackend(t, SnapshotOptions{
		Store:       store,
		MinDocCount: 1,
		MaxIndexAge: 24 * time.Hour,
	})
	builderCalled := &atomic.Int32{}
	idx, err := be.BuildIndex(context.Background(), newTestNsResource(), 10, "startup",
		func(resource.ResourceIndex) (int64, error) {
			builderCalled.Add(1)
			if builderExtra != nil {
				builderExtra()
			}
			return 1, nil
		},
		nil, false, time.Time{}, 0, options)
	return metrics, builderCalled, idx, err
}

// TestBuildIndex_ColdStartFastPathDownloads verifies that on the
// initial-startup path (cachedIndex == nil, !rebuild) BuildIndex picks up
// a same-version snapshot from the remote store and skips the builder.
// With a fresh snapshot present, the tiered selection runs first and
// downloads it before the cold-start path is even considered.
func TestBuildIndex_ColdStartFastPathDownloads(t *testing.T) {
	store := newHookableStore(t)
	seedDownloadableSnapshot(t, t.Context(), store.inner, newTestNsResource(), makeULID(t, time.Now()), freshSnapshot(time.Minute))
	metrics, builderCalled, idx, err := runBuildIndexColdStart(t, store, nil, resource.BuildIndexOptions{})
	require.NoError(t, err)
	require.NotNil(t, idx)

	// The tiered remote-snapshot selection runs first and downloads —
	// that's enough to skip the builder. The cold-start path only runs if
	// the tiered selection misses; here it finds the snapshot first.
	assert.Zero(t, builderCalled.Load(), "builder must not run when a snapshot is available")
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotDownloadAttempts.WithLabelValues(snapshotPolicyTiered, snapshotStatusSuccess)))
}

// TestBuildIndex_ColdStartLeaderUploads exercises the leader path: empty
// store, leader builds from scratch, and the leader's freshly-built snapshot
// is uploaded immediately under the held lock.
func TestBuildIndex_ColdStartLeaderUploads(t *testing.T) {
	store := newHookableStore(t)
	metrics, builderCalled, idx, err := runBuildIndexColdStart(t, store, nil, resource.BuildIndexOptions{})
	require.NoError(t, err)
	require.NotNil(t, idx)

	assert.Equal(t, int32(1), builderCalled.Load(), "builder must run on the leader path")
	assert.Equal(t, int32(1), store.uploadCalls.Load(), "leader must upload immediately")
	assert.Equal(t, int32(1), store.lockReleaseCalls.Load(), "leader must release the build lock")
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotBuildCoordinations.WithLabelValues(snapshotBuildFlowColdStart, snapshotBuildOutcomeAcquiredLock)))
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
	metrics, builderCalled, idx, err := runBuildIndexColdStart(t, store, store.signalLockLost, resource.BuildIndexOptions{})
	require.NoError(t, err)
	require.NotNil(t, idx)

	assert.Equal(t, int32(1), builderCalled.Load(), "builder must run on the leader path")
	assert.Zero(t, store.uploadCalls.Load(), "leader must skip immediate upload after lock loss")
	assert.Equal(t, int32(1), store.lockReleaseCalls.Load(), "leader still releases the lock object")
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotUploads.WithLabelValues(snapshotUploadStatusSkipLockLost)))
	assert.Zero(t, testutil.ToFloat64(metrics.IndexSnapshotUploads.WithLabelValues(snapshotUploadStatusSuccess)))
}

func TestBuildIndex_ColdStartDefersWithoutBuilding(t *testing.T) {
	store := newHookableStore(t)
	store.setLockBuildErr(errLockHeld)
	metrics, builderCalled, idx, err := runBuildIndexColdStart(t, store, nil, resource.BuildIndexOptions{SkipIfBuilding: true})
	require.ErrorIs(t, err, resource.ErrIndexBuildInProgress)
	require.Nil(t, idx)

	assert.Zero(t, builderCalled.Load())
	assert.Zero(t, store.uploadCalls.Load())
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotBuildCoordinations.WithLabelValues(snapshotBuildFlowColdStart, snapshotBuildOutcomeLockHeld)))
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
	idx, err := be.BuildIndex(context.Background(), newTestNsResource(), 10, "startup",
		func(resource.ResourceIndex) (int64, error) {
			builderCalled.Add(1)
			return 1, nil
		},
		nil, false, time.Time{}, 0, resource.BuildIndexOptions{})
	require.NoError(t, err)
	require.NotNil(t, idx)

	assert.Equal(t, int32(1), builderCalled.Load(), "builder must run on the leader path")
	assert.Equal(t, int32(1), store.lockAcquireCalls.Load(), "cold-start must attempt the lock even when MaxIndexAge=0")
	assert.Equal(t, int32(1), store.uploadCalls.Load(), "leader must upload immediately")
	assert.Equal(t, int32(1), store.lockReleaseCalls.Load(), "leader must release the build lock")
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotBuildCoordinations.WithLabelValues(snapshotBuildFlowColdStart, snapshotBuildOutcomeAcquiredLock)))
	assert.Equal(t, 1.0, testutil.ToFloat64(metrics.IndexSnapshotUploads.WithLabelValues(snapshotUploadStatusSuccess)))
}

// TestBuildIndex_ColdStartContextCancelPropagates verifies that a context
// cancellation during cold-start coordination aborts BuildIndex with the
// context error rather than falling back to a full from-scratch build.
func TestBuildIndex_ColdStartContextCancelPropagates(t *testing.T) {
	store := newHookableStore(t)
	store.setLockBuildErr(errLockHeld) // force entry to the wait loop
	withSnapshotBuildPollInterval(t, 5*time.Millisecond)
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
	idx, err := be.BuildIndex(ctx, newTestNsResource(), 10, "startup",
		func(resource.ResourceIndex) (int64, error) {
			builderCalled.Add(1)
			return 1, nil
		},
		nil, false, time.Time{}, 0, resource.BuildIndexOptions{})
	require.ErrorIs(t, err, context.Canceled)
	assert.Nil(t, idx)
	assert.Zero(t, builderCalled.Load(), "builder must not run after context cancel")
}

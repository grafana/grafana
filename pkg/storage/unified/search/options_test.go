package search

import (
	"context"
	"net/url"
	"path/filepath"
	"testing"
	"time"

	"github.com/Masterminds/semver/v3"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// Anchors what semver.NewVersion accepts for the strings we feed it from
// cfg.BuildVersion / cfg.MinFileIndexBuildVersion (options.go) and from snapshot
// metadata (bleve_snapshot.go, remote_index_cleanup.go). Parsing failures are
// not fatal at call sites — they fall back to nil — but a change here would
// quietly hide or expose snapshots, so it's worth pinning.
func TestBuildVersionParsing(t *testing.T) {
	tests := []struct {
		input    string
		wantOK   bool
		wantNorm string // expected v.String() when wantOK
	}{
		{input: "11.5.0", wantOK: true, wantNorm: "11.5.0"},
		{input: "11.5.0-pre1", wantOK: true, wantNorm: "11.5.0-pre1"},
		{input: "11.5.0+meta", wantOK: true, wantNorm: "11.5.0+meta"},
		{input: "v11.5.0", wantOK: true, wantNorm: "11.5.0"}, // v-prefix is stripped
		{input: "11.5", wantOK: true, wantNorm: "11.5.0"},    // missing patch is filled in
		// Real build versions seen in production.
		{input: "13.1.0-ephemeral-enterprise-11758-10265-1", wantOK: true, wantNorm: "13.1.0-ephemeral-enterprise-11758-10265-1"},
		{input: "13.1.0-ephemeral-oss-123137-102418-1", wantOK: true, wantNorm: "13.1.0-ephemeral-oss-123137-102418-1"},
		{input: "13.0.0-23069273608.patch13", wantOK: true, wantNorm: "13.0.0-23069273608.patch13"},
		{input: "13.1.0-25901809875", wantOK: true, wantNorm: "13.1.0-25901809875"},
		{input: "dev", wantOK: false},
		{input: "main", wantOK: false},
		{input: "a1b2c3d4", wantOK: false}, // git SHA-like
	}
	for _, tc := range tests {
		t.Run(tc.input, func(t *testing.T) {
			v, err := semver.NewVersion(tc.input)
			if tc.wantOK {
				require.NoError(t, err)
				require.NotNil(t, v)
				assert.Equal(t, tc.wantNorm, v.String())
			} else {
				assert.Error(t, err)
			}
		})
	}
}

func TestSnapshotLockHeartbeat(t *testing.T) {
	tests := []struct {
		name string
		ttl  time.Duration
	}{
		{name: "default TTL", ttl: DefaultSnapshotLockTTL},
		{name: "one second", ttl: time.Second},
		{name: "five seconds", ttl: 5 * time.Second},
		{name: "non-divisible", ttl: 1300 * time.Millisecond},
		{name: "tiny positive", ttl: 1 * time.Nanosecond},
		{name: "zero", ttl: 0},
		{name: "negative", ttl: -1 * time.Second},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			hb := snapshotLockHeartbeat(tc.ttl)

			assert.Greater(t, hb, time.Duration(0), "heartbeat must always be positive")

			if tc.ttl >= 2*time.Second {
				assert.LessOrEqual(t, 2*hb, tc.ttl, "heartbeat must satisfy lock validation (TTL >= 2x heartbeat)")
			}
		})
	}
}

func TestBuildSnapshotOptionsGating(t *testing.T) {
	t.Run("disabled snapshot feature ignores invalid bucket URL", func(t *testing.T) {
		cfg := snapshotOptionsTestCfg(t)
		cfg.IndexSnapshotEnabled = false
		cfg.IndexSnapshotBucketURL = "://not-a-valid-url"

		snapshot, err := buildSnapshotOptions(cfg, nil)
		require.NoError(t, err)
		assert.Nil(t, snapshot.Store)
	})

	t.Run("enabled snapshot feature with empty bucket URL leaves store nil", func(t *testing.T) {
		cfg := snapshotOptionsTestCfg(t)
		cfg.IndexSnapshotEnabled = true
		cfg.IndexSnapshotBucketURL = ""

		snapshot, err := buildSnapshotOptions(cfg, nil)
		require.NoError(t, err)
		assert.Nil(t, snapshot.Store)
	})

	t.Run("enabled snapshot feature with file bucket URL creates store", func(t *testing.T) {
		cfg := snapshotOptionsTestCfg(t)
		cfg.IndexSnapshotEnabled = true
		cfg.IndexSnapshotBucketURL = fileBucketURL(t, t.TempDir())

		snapshot, err := buildSnapshotOptions(cfg, nil)
		require.NoError(t, err)
		require.NotNil(t, snapshot.Store)
	})

	t.Run("unsupported non-cloud provider fails", func(t *testing.T) {
		cfg := snapshotOptionsTestCfg(t)
		cfg.IndexSnapshotEnabled = true
		cfg.IndexSnapshotBucketURL = "mem://snapshot-test"

		snapshot, err := buildSnapshotOptions(cfg, nil)
		require.Error(t, err)
		assert.Nil(t, snapshot.Store)
		assert.Contains(t, err.Error(), "unsupported blob provider")
	})
}

func TestBuildSnapshotOptionsFileBucketUsesProcessLocalLocks(t *testing.T) {
	cfg := snapshotOptionsTestCfg(t)
	cfg.IndexSnapshotEnabled = true
	cfg.IndexSnapshotBucketURL = fileBucketURL(t, t.TempDir())

	snapshot, err := buildSnapshotOptions(cfg, nil)
	require.NoError(t, err)

	ns := resource.NamespacedResource{Namespace: "default", Group: "dashboard.grafana.app", Resource: "dashboards"}
	lock1, err := snapshot.Store.LockBuildIndex(context.Background(), ns, "11.0.0")
	require.NoError(t, err)
	defer func() { require.NoError(t, lock1.Release()) }()

	lock2, err := snapshot.Store.LockBuildIndex(context.Background(), ns, "11.0.0")
	require.ErrorIs(t, err, errLockHeld)
	assert.Nil(t, lock2)
}

func TestNewSearchOptionsPassesFileSnapshotStoreToBleveBackend(t *testing.T) {
	cfg := snapshotOptionsTestCfg(t)
	cfg.EnableSearch = true
	cfg.BuildVersion = "11.0.0"
	cfg.IndexPath = filepath.Join(t.TempDir(), "bleve")
	cfg.IndexSnapshotEnabled = true
	cfg.IndexSnapshotBucketURL = fileBucketURL(t, t.TempDir())

	metrics := resource.ProvideIndexMetrics(prometheus.NewRegistry())
	opts, err := NewSearchOptions(featuremgmt.WithFeatures(), cfg, nil, metrics, nil)
	require.NoError(t, err)

	backend, ok := opts.Backend.(*bleveBackend)
	require.True(t, ok)
	t.Cleanup(backend.Stop)

	assert.True(t, opts.IndexSnapshotEnabled)
	assert.Equal(t, cfg.IndexSnapshotBucketURL, opts.IndexSnapshotBucketURL)
	assert.NotNil(t, backend.opts.Snapshot.Store)
}

func snapshotOptionsTestCfg(t *testing.T) *setting.Cfg {
	t.Helper()
	return &setting.Cfg{
		DataPath:                        t.TempDir(),
		InstanceName:                    "test-instance",
		IndexFileThreshold:              1,
		IndexSnapshotThreshold:          1,
		IndexSnapshotMaxAge:             time.Hour,
		IndexSnapshotCleanupGracePeriod: time.Minute,
	}
}

func fileBucketURL(t *testing.T, dir string) string {
	t.Helper()
	u := url.URL{Scheme: "file", Path: dir}
	return u.String()
}

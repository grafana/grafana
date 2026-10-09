package search

import (
	searchmetrics "github.com/grafana/grafana/pkg/storage/unified/search/metrics"

	searchmodel "github.com/grafana/grafana/pkg/storage/unified/search/model"

	"path/filepath"
	"testing"
	"time"

	"github.com/Masterminds/semver/v3"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestNewSearchOptionsEmbeddingConfig(t *testing.T) {
	for _, tc := range []struct {
		name     string
		search   bool
		indexing bool
	}{
		{name: "search", search: true},
		{name: "vector indexing without lexical search", indexing: true},
		{name: "disabled"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := snapshotOptionsTestCfg(t)
			cfg.EnableSearch = tc.search
			cfg.VectorIndexingEnabled = tc.indexing
			opts, err := NewSearchOptions(cfg, nil, searchmetrics.ProvideBleveMetrics(prometheus.NewRegistry(), nil), nil, nil)
			require.NoError(t, err)
			if opts.Backend != nil {
				t.Cleanup(opts.Backend.(*bleveBackend).Stop)
			}
			if !tc.search && !tc.indexing {
				require.Nil(t, opts.EmbeddingConfig)
				return
			}
			require.NotNil(t, opts.EmbeddingConfig)
			for _, manifest := range resource.AppManifests() {
				for _, version := range manifest.Versions {
					for _, kind := range version.Kinds {
						gvr := schema.GroupVersionResource{Group: manifest.Group, Version: version.Name, Resource: searchmodel.ManifestResourceName(kind)}
						config, ok := opts.EmbeddingConfig.For(gvr)
						require.Equal(t, kind.Embed != nil, ok, "%s", gvr)
						if kind.Embed != nil {
							require.Equal(t, kind.Embed.Fields, config.Fields)
							require.Equal(t, manifest.Embed[gvr.Resource].ReembedVersion, config.ReembedVersion)
						}
					}
				}
			}
		})
	}
}

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

func TestBuildSnapshotOptionsGating(t *testing.T) {
	t.Run("enabled snapshot feature without a store leaves store nil", func(t *testing.T) {
		cfg := snapshotOptionsTestCfg(t)
		cfg.IndexSnapshotEnabled = true

		snapshot := buildSnapshotOptions(cfg, nil, nil)
		assert.Nil(t, snapshot.Store)
	})

	t.Run("store is used as-is", func(t *testing.T) {
		cfg := snapshotOptionsTestCfg(t)
		cfg.IndexSnapshotEnabled = true
		cfg.IndexSnapshotThreshold = 12345
		cfg.IndexSnapshotMaxAge = 7 * 24 * time.Hour

		store := &fakeRemoteIndexStore{}
		snapshot := buildSnapshotOptions(cfg, nil, store)
		assert.Same(t, store, snapshot.Store)
		// Non-Store fields still come from cfg.
		assert.Equal(t, int64(12345), snapshot.MinDocCount)
		assert.Equal(t, 7*24*time.Hour, snapshot.MaxIndexAge)
	})

	t.Run("store is ignored when snapshots are disabled", func(t *testing.T) {
		cfg := snapshotOptionsTestCfg(t)
		cfg.IndexSnapshotEnabled = false

		snapshot := buildSnapshotOptions(cfg, nil, &fakeRemoteIndexStore{})
		assert.Nil(t, snapshot.Store)
	})
}

// fakeRemoteIndexStore is a stand-in RemoteIndexStore used to verify that
// buildSnapshotOptions wires the store through as-is. Methods are
// unimplemented because the test never exercises them.
type fakeRemoteIndexStore struct {
	RemoteIndexStore
}

func TestNewSearchOptionsPassesSnapshotStoreToBleveBackend(t *testing.T) {
	cfg := snapshotOptionsTestCfg(t)
	cfg.EnableSearch = true
	cfg.BuildVersion = "11.0.0"
	cfg.IndexPath = filepath.Join(t.TempDir(), "bleve")
	cfg.IndexSnapshotEnabled = true

	store := newTestKVRemoteIndexStore(t)
	metrics := searchmetrics.ProvideBleveMetrics(prometheus.NewRegistry(), nil)
	opts, err := NewSearchOptions(cfg, nil, metrics, nil, store)
	require.NoError(t, err)

	backend, ok := opts.Backend.(*bleveBackend)
	require.True(t, ok)
	t.Cleanup(backend.Stop)

	assert.True(t, opts.IndexSnapshotEnabled)
	assert.Same(t, store, backend.opts.Snapshot.Store)
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

// Dry run counts what the collector would remove and deletes nothing, so trash of
// any age is still restorable and must stay searchable.
func TestNewSearchOptionsTrashRetentionFollowsGarbageCollection(t *testing.T) {
	for _, tc := range []struct {
		name        string
		enabled     bool
		dryRun      bool
		wantEnabled bool
	}{
		{name: "collection off", enabled: false, wantEnabled: false},
		{name: "collection on", enabled: true, wantEnabled: true},
		{name: "collection on, dry run", enabled: true, dryRun: true, wantEnabled: false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := snapshotOptionsTestCfg(t)
			cfg.EnableSearch = true
			cfg.BuildVersion = "11.0.0"
			cfg.IndexPath = filepath.Join(t.TempDir(), "bleve")
			cfg.EnableGarbageCollection = tc.enabled
			cfg.GarbageCollectionDryRun = tc.dryRun
			cfg.GarbageCollectionMaxAge = time.Hour

			opts, err := NewSearchOptions(cfg, nil, searchmetrics.ProvideBleveMetrics(prometheus.NewRegistry(), nil), nil, nil)
			require.NoError(t, err)

			backend, ok := opts.Backend.(*bleveBackend)
			require.True(t, ok)
			t.Cleanup(backend.Stop)

			assert.Equal(t, tc.wantEnabled, backend.opts.TrashRetention.Enabled)
			assert.Equal(t, time.Hour, backend.opts.TrashRetention.MaxAge)
		})
	}
}

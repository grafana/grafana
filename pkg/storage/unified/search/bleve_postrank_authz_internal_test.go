package search

import (
	"testing"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/search"
	"github.com/blevesearch/bleve/v2/search/query"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestPostRankAuthzConfigWindowSize(t *testing.T) {
	cfg := PostRankAuthzConfig{OverFetchFactor: 5, MaxWindow: 10000}.effective()
	assert.Equal(t, 500, cfg.windowSize(100))
	assert.Equal(t, 5000, cfg.windowSize(1000))
	// Clamped to MaxWindow.
	assert.Equal(t, 10000, cfg.windowSize(100000))
}

func TestPostRankAuthzConfigGrowWindow(t *testing.T) {
	cfg := PostRankAuthzConfig{OverFetchFactor: 1, MaxWindow: 40}.effective()
	base := cfg.windowSize(10) // 10

	// First window is the base; each subsequent window doubles.
	assert.Equal(t, 10, cfg.growWindow(base, 0))
	assert.Equal(t, 20, cfg.growWindow(base, 1))
	assert.Equal(t, 40, cfg.growWindow(base, 2))
	// Growth saturates at MaxWindow and stays there.
	assert.Equal(t, 40, cfg.growWindow(base, 3))
	assert.Equal(t, 40, cfg.growWindow(base, 99))

	// When the base already equals MaxWindow, growth is a no-op.
	flat := PostRankAuthzConfig{OverFetchFactor: 5, MaxWindow: 100}.effective()
	fb := flat.windowSize(1000) // clamped to 100
	assert.Equal(t, 100, flat.growWindow(fb, 5))
}

// Post-rank windows load no stored fields, so the folder authorization reads
// comes from doc values. A hit deleted since its window was searched is missing,
// so it is not authorized without a folder, and with federated indexes each hit
// is read from whichever index holds it.
func TestReadAuthzMetadata(t *testing.T) {
	newIndex := func(t *testing.T, docs map[string]string) bleve.Index {
		t.Helper()
		mappings, err := GetBleveMappings(nil, "dashboard.grafana.app", "dashboards", nil)
		require.NoError(t, err)
		idx, err := bleve.NewUsing("", mappings, bleve.Config.DefaultIndexType, bleve.Config.DefaultMemKVStore, nil)
		require.NoError(t, err)
		t.Cleanup(func() { require.NoError(t, idx.Close()) })
		for id, folder := range docs {
			require.NoError(t, idx.Index(id, &resource.IndexableDocument{
				Key:    &resourcepb.ResourceKey{Group: "dashboard.grafana.app", Resource: "dashboards", Name: id},
				Title:  id,
				Folder: folder,
			}))
		}
		return idx
	}
	dashboards := newIndex(t, map[string]string{"a": "folder-1", "root": ""})
	folders := newIndex(t, map[string]string{"f": "folder-2"})

	byID := func(ids []string) query.Query { return bleve.NewDocIDQuery(ids) }
	hits := search.DocumentMatchCollection{{ID: "a"}, {ID: "deleted"}, {ID: "f"}, {ID: "root"}}
	metadata, err := readAuthzMetadata(t.Context(), bleve.NewIndexAlias(dashboards, folders), byID, hits, authzLoadFields(false))
	require.NoError(t, err)
	require.Equal(t, map[string]authzMetadata{
		"a":    {folder: "folder-1"},
		"f":    {folder: "folder-2"},
		"root": {},
	}, metadata)
}

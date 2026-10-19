package search

import (
	"testing"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/search"
	"github.com/grafana/authlib/authz"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
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

	page := &postRankPage{index: bleve.NewIndexAlias(dashboards, folders), query: bleve.NewMatchAllQuery()}
	hits := search.DocumentMatchCollection{{ID: "a"}, {ID: "deleted"}, {ID: "f"}, {ID: "root"}}
	metadata, err := page.readAuthzMetadata(t.Context(), hits)
	require.NoError(t, err)
	require.Equal(t, map[string]authzMetadata{
		"a":    {folder: "folder-1"},
		"f":    {folder: "folder-2"},
		"root": {},
	}, metadata)
	require.NotZero(t, page.cost, "the lookup's reads count towards the search's cost")
}

func TestAuthzResourcesVerb(t *testing.T) {
	idx := &bleveIndex{key: resource.NamespacedResource{Namespace: "default", Group: "folder.grafana.app", Resource: "folders"}}
	for perm, verb := range map[dashboardaccess.PermissionType]string{
		0:                                 utils.VerbGet,
		dashboardaccess.PERMISSION_EDIT:   utils.VerbUpdate,
		dashboardaccess.PERMISSION_CREATE: utils.VerbCreate,
	} {
		got := idx.authzResources(&resourcepb.ResourceSearchRequest{Permission: int64(perm)})
		assert.Equal(t, map[string]string{"folder.grafana.app/folders": verb}, got, "permission %v", perm)
	}
}

func TestAuthzResourcesCreateOnlyAppliesToFolders(t *testing.T) {
	idx := &bleveIndex{key: resource.NamespacedResource{Namespace: "default", Group: dashboardGroup, Resource: "dashboards"}}
	got := idx.authzResources(&resourcepb.ResourceSearchRequest{Permission: int64(dashboardaccess.PERMISSION_CREATE)})
	assert.Equal(t, map[string]string{dashboardGroup + "/dashboards": utils.VerbGet}, got)

	other := &bleveIndex{key: resource.NamespacedResource{Namespace: "default", Group: "other.grafana.app", Resource: "folders"}}
	got = other.authzResources(&resourcepb.ResourceSearchRequest{Permission: int64(dashboardaccess.PERMISSION_CREATE)})
	assert.Equal(t, map[string]string{"other.grafana.app/folders": utils.VerbGet}, got, "same resource name in another group")
}

// A global index answers every type, and keeps types of the same name in
// different groups apart.
func TestAuthzResourcesOfAGlobalIndex(t *testing.T) {
	idx := &bleveIndex{key: resource.GlobalSearchKey("default")}
	got := idx.authzResources(&resourcepb.ResourceSearchRequest{Permission: int64(dashboardaccess.PERMISSION_CREATE)})

	for _, tc := range []struct{ group, resource, verb string }{
		{"folder.grafana.app", "folders", utils.VerbCreate},
		{"other.grafana.app", "folders", utils.VerbGet},
		{"assistant.ext.grafana.app", "pages", utils.VerbGet},
	} {
		verb, ok := authzVerb(got, tc.group, tc.resource)
		require.True(t, ok, "%s/%s", tc.group, tc.resource)
		assert.Equal(t, tc.verb, verb, "%s/%s", tc.group, tc.resource)
	}

	perResource := &bleveIndex{key: resource.NamespacedResource{Namespace: "default", Group: "assistant.ext.grafana.app", Resource: "pages"}}
	_, ok := authzVerb(perResource.authzResources(&resourcepb.ResourceSearchRequest{}), "gas.ext.grafana.app", "pages")
	assert.False(t, ok, "a per-resource index returns only its own type")
}

func TestBatchCheckItem(t *testing.T) {
	folder := docInfo{namespace: "default", group: "folder.grafana.app", resourceType: "folders", name: "team-a", folder: "public"}

	edit := folder
	edit.verb = utils.VerbUpdate
	assert.Equal(t, authz.BatchCheckItem{Namespace: "default", Group: "folder.grafana.app", Resource: "folders", Name: "team-a", Folder: "public", Verb: utils.VerbUpdate}, batchCheckItem(edit))

	create := folder
	create.verb = utils.VerbCreate
	assert.Equal(t, authz.BatchCheckItem{Namespace: "default", Group: dashboardGroup, Resource: "dashboards", Folder: "team-a", Verb: utils.VerbCreate}, batchCheckItem(create))

	other := create
	other.group = "other.grafana.app"
	assert.Equal(t, "other.grafana.app", batchCheckItem(other).Group, "a folders resource in another group is not rewritten")
}

package service

import (
	"slices"
	"testing"

	resourcecontract "github.com/grafana/grafana/pkg/storage/unified/resource/contract"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	searchmodel "github.com/grafana/grafana/pkg/storage/unified/search/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func fieldByName(t *testing.T, defs []searchmodel.SearchFieldDefinition, name string) searchmodel.SearchFieldDefinition {
	t.Helper()
	for _, def := range defs {
		if def.Name == name {
			return def
		}
	}
	require.Failf(t, "field not found", "no field named %q", name)
	return searchmodel.SearchFieldDefinition{}
}

func TestGlobalSearchFieldDefinitions(t *testing.T) {
	global := searchmodel.GlobalSearchFieldDefinitions()

	gr := fieldByName(t, global, searchmodel.SEARCH_FIELD_GROUP_RESOURCE)
	assert.True(t, gr.HasCapability(searchmodel.SearchCapabilityFilter))
	assert.True(t, gr.HasCapability(searchmodel.SearchCapabilityFacet))

	// Timestamps are filterable and sortable here, so hits of different resource
	// types can be ordered by time.
	for _, name := range []string{searchmodel.SEARCH_FIELD_CREATED, searchmodel.SEARCH_FIELD_UPDATED} {
		def := fieldByName(t, global, name)
		assert.True(t, def.HasCapability(searchmodel.SearchCapabilityFilter), name)
		assert.True(t, def.HasCapability(searchmodel.SearchCapabilitySort), name)
	}
}

func TestGlobalSearchFieldDefinitionsLeaveStandardAlone(t *testing.T) {
	// Indexing created and updated for every kind would change the
	// index-affecting hash and rebuild every index in the deployment, so the
	// standard set must not pick up the global capabilities.
	_ = searchmodel.GlobalSearchFieldDefinitions()

	standard := searchmodel.StandardSearchFieldDefinitions()
	for _, name := range []string{searchmodel.SEARCH_FIELD_CREATED, searchmodel.SEARCH_FIELD_UPDATED} {
		def := fieldByName(t, standard, name)
		assert.False(t, def.HasCapability(searchmodel.SearchCapabilityFilter), name)
		assert.False(t, def.HasCapability(searchmodel.SearchCapabilitySort), name)
	}

	for _, def := range standard {
		assert.NotEqual(t, searchmodel.SEARCH_FIELD_GROUP_RESOURCE, def.Name)
	}
}

func TestIndexFieldDefinitions(t *testing.T) {
	standard, deleted := searchmodel.IndexFieldDefinitions("dashboard.grafana.app", "dashboards")
	assert.Equal(t, searchmodel.StandardSearchFieldDefinitions(), standard)
	assert.Equal(t, searchmodel.TrashSearchFieldDefinitions(), deleted)

	// A namespace-wide index holds only live documents, so it declares nothing a
	// deleted document would need.
	standard, deleted = searchmodel.IndexFieldDefinitions(resourcecontract.GlobalSearchGroup, resourcecontract.GlobalSearchResource)
	assert.Equal(t, searchmodel.GlobalSearchFieldDefinitions(), standard)
	assert.Empty(t, deleted)
}

func TestIndexSources(t *testing.T) {
	dashboards := resourcecontract.NamespacedResource{Namespace: "ns", Group: "dashboard.grafana.app", Resource: "dashboards"}
	assert.Equal(t, []resourcecontract.NamespacedResource{dashboards}, indexSources(dashboards))

	// A namespace-wide index draws from every covered type, in the namespace it
	// belongs to.
	sources := indexSources(resourcecontract.GlobalSearchKey("ns"))
	require.Len(t, sources, len(searchmodel.GlobalSearchResourceTypes()))
	for _, src := range sources {
		assert.Equal(t, "ns", src.Namespace)
		assert.False(t, src.IsGlobal())
	}
	assert.Contains(t, sources, dashboards)
}

func TestGlobalIndexStats(t *testing.T) {
	stats := []resourcecontract.ResourceStats{
		{NamespacedResource: resourcecontract.NamespacedResource{Namespace: "a", Group: "dashboard.grafana.app", Resource: "dashboards"}, Count: 10},
		{NamespacedResource: resourcecontract.NamespacedResource{Namespace: "a", Group: "folder.grafana.app", Resource: "folders"}, Count: 5},
		{NamespacedResource: resourcecontract.NamespacedResource{Namespace: "a", Group: "playlist.grafana.app", Resource: "playlists"}, Count: 100},
		{NamespacedResource: resourcecontract.NamespacedResource{Namespace: "b", Group: "folder.grafana.app", Resource: "folders"}, Count: 2},
		{NamespacedResource: resourcecontract.NamespacedResource{Namespace: "c", Group: "playlist.grafana.app", Resource: "playlists"}, Count: 7},
	}

	t.Run("nothing is added while the index is switched off", func(t *testing.T) {
		s := &searchServer{}
		assert.Empty(t, s.globalIndexStats(stats))
	})

	t.Run("one index per namespace, sized by the types it covers", func(t *testing.T) {
		s := &searchServer{globalIndexEnabled: true}
		// Namespace c holds none of the covered types, so it gets no index. The
		// playlists in namespace a are not counted.
		assert.Equal(t, []resourcecontract.ResourceStats{
			{NamespacedResource: resourcecontract.GlobalSearchKey("a"), Count: 15},
			{NamespacedResource: resourcecontract.GlobalSearchKey("b"), Count: 2},
		}, s.globalIndexStats(stats))
	})

	t.Run("an index already named in the stats is not added twice", func(t *testing.T) {
		s := &searchServer{globalIndexEnabled: true}
		withGlobal := append(slices.Clone(stats), resourcecontract.ResourceStats{NamespacedResource: resourcecontract.GlobalSearchKey("a"), Count: 15})
		assert.Equal(t, []resourcecontract.ResourceStats{
			{NamespacedResource: resourcecontract.GlobalSearchKey("b"), Count: 2},
		}, s.globalIndexStats(withGlobal))
	})
}

func TestGlobalSearchFieldsHash(t *testing.T) {
	hash := searchmodel.GlobalSearchFieldsHash()
	assert.NotEmpty(t, hash)
	assert.Equal(t, hash, searchmodel.GlobalSearchFieldsHash(), "the fingerprint must not move on its own")

	// A namespace-wide index takes none of its inputs from a manifest, so the
	// registry answers for it without being seeded.
	registry := searchmodel.NewSearchFieldsRegistry(nil, nil, nil)
	fields, got, provider := registry.ForKey(resourcecontract.GlobalSearchKey("ns"))
	assert.Equal(t, hash, got)
	assert.Empty(t, fields)
	assert.Nil(t, provider)

	_, perResource, _ := registry.ForKey(resourcecontract.NamespacedResource{Namespace: "ns", Group: "dashboard.grafana.app", Resource: "dashboards"})
	assert.NotEqual(t, hash, perResource)
}

func TestKeepStandardFieldsOnly(t *testing.T) {
	doc := keepStandardFieldsOnly(&searchmodel.IndexableDocument{
		Title:            "kept",
		Fields:           map[string]any{"panel_types": []string{"timeseries"}},
		SelectableFields: map[string]string{"spec.title": "kept"},
	})
	assert.Equal(t, "kept", doc.Title)
	assert.Empty(t, doc.Fields)
	assert.Empty(t, doc.SelectableFields)

	assert.Nil(t, keepStandardFieldsOnly(nil))
}

func TestUpdateCopyFieldsSetsGroupResource(t *testing.T) {
	doc := (&searchmodel.IndexableDocument{Key: &resourcepb.ResourceKey{
		Namespace: "ns",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
		Name:      "abc",
	}}).UpdateCopyFields()

	assert.Equal(t, "dashboard.grafana.app/dashboards", doc.GroupResource)
}

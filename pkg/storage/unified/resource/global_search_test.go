package resource

import (
	"slices"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func fieldByName(t *testing.T, defs []SearchFieldDefinition, name string) SearchFieldDefinition {
	t.Helper()
	for _, def := range defs {
		if def.Name == name {
			return def
		}
	}
	require.Failf(t, "field not found", "no field named %q", name)
	return SearchFieldDefinition{}
}

func TestGlobalSearchFieldDefinitions(t *testing.T) {
	global := GlobalSearchFieldDefinitions()

	gr := fieldByName(t, global, SEARCH_FIELD_GROUP_RESOURCE)
	assert.True(t, gr.HasCapability(SearchCapabilityFilter))
	assert.True(t, gr.HasCapability(SearchCapabilityFacet))

	// Timestamps are filterable and sortable here, so hits of different resource
	// types can be ordered by time.
	for _, name := range []string{SEARCH_FIELD_CREATED, SEARCH_FIELD_UPDATED} {
		def := fieldByName(t, global, name)
		assert.True(t, def.HasCapability(SearchCapabilityFilter), name)
		assert.True(t, def.HasCapability(SearchCapabilitySort), name)
	}
}

func TestGlobalSearchFieldDefinitionsLeaveStandardAlone(t *testing.T) {
	// Indexing created and updated for every kind would change the
	// index-affecting hash and rebuild every index in the deployment, so the
	// standard set must not pick up the global capabilities.
	_ = GlobalSearchFieldDefinitions()

	standard := StandardSearchFieldDefinitions()
	for _, name := range []string{SEARCH_FIELD_CREATED, SEARCH_FIELD_UPDATED} {
		def := fieldByName(t, standard, name)
		assert.False(t, def.HasCapability(SearchCapabilityFilter), name)
		assert.False(t, def.HasCapability(SearchCapabilitySort), name)
	}

	for _, def := range standard {
		assert.NotEqual(t, SEARCH_FIELD_GROUP_RESOURCE, def.Name)
	}
}

func TestIndexFieldDefinitions(t *testing.T) {
	standard, deleted := IndexFieldDefinitions("dashboard.grafana.app", "dashboards")
	assert.Equal(t, StandardSearchFieldDefinitions(), standard)
	assert.Equal(t, TrashSearchFieldDefinitions(), deleted)

	// A namespace-wide index holds only live documents, so it declares nothing a
	// deleted document would need.
	standard, deleted = IndexFieldDefinitions(GlobalSearchGroup, GlobalSearchResource)
	assert.Equal(t, GlobalSearchFieldDefinitions(), standard)
	assert.Empty(t, deleted)
}

func TestIndexSources(t *testing.T) {
	dashboards := NamespacedResource{Namespace: "ns", Group: "dashboard.grafana.app", Resource: "dashboards"}
	assert.Equal(t, []NamespacedResource{dashboards}, indexSources(dashboards))

	// A namespace-wide index draws from every covered type, in the namespace it
	// belongs to.
	sources := indexSources(GlobalSearchKey("ns"))
	require.Len(t, sources, len(GlobalSearchResourceTypes()))
	for _, src := range sources {
		assert.Equal(t, "ns", src.Namespace)
		assert.False(t, src.IsGlobal())
	}
	assert.Contains(t, sources, dashboards)
}

func TestGlobalIndexStats(t *testing.T) {
	stats := []ResourceStats{
		{NamespacedResource: NamespacedResource{Namespace: "a", Group: "dashboard.grafana.app", Resource: "dashboards"}, Count: 10},
		{NamespacedResource: NamespacedResource{Namespace: "a", Group: "folder.grafana.app", Resource: "folders"}, Count: 5},
		{NamespacedResource: NamespacedResource{Namespace: "a", Group: "playlist.grafana.app", Resource: "playlists"}, Count: 100},
		{NamespacedResource: NamespacedResource{Namespace: "b", Group: "folder.grafana.app", Resource: "folders"}, Count: 2},
		{NamespacedResource: NamespacedResource{Namespace: "c", Group: "playlist.grafana.app", Resource: "playlists"}, Count: 7},
	}

	t.Run("nothing is added while the index is switched off", func(t *testing.T) {
		s := &searchServer{}
		assert.Empty(t, s.globalIndexStats(stats))
	})

	t.Run("one index per namespace, sized by the types it covers", func(t *testing.T) {
		s := &searchServer{globalIndexEnabled: true}
		// Namespace c holds none of the covered types, so it gets no index. The
		// playlists in namespace a are not counted.
		assert.Equal(t, []ResourceStats{
			{NamespacedResource: GlobalSearchKey("a"), Count: 15},
			{NamespacedResource: GlobalSearchKey("b"), Count: 2},
		}, s.globalIndexStats(stats))
	})

	t.Run("an index already named in the stats is not added twice", func(t *testing.T) {
		s := &searchServer{globalIndexEnabled: true}
		withGlobal := append(slices.Clone(stats), ResourceStats{NamespacedResource: GlobalSearchKey("a"), Count: 15})
		assert.Equal(t, []ResourceStats{
			{NamespacedResource: GlobalSearchKey("b"), Count: 2},
		}, s.globalIndexStats(withGlobal))
	})
}

func TestGlobalSearchFieldsHash(t *testing.T) {
	hash := GlobalSearchFieldsHash()
	assert.NotEmpty(t, hash)
	assert.Equal(t, hash, GlobalSearchFieldsHash(), "the fingerprint must not move on its own")

	// A namespace-wide index takes none of its inputs from a manifest, so the
	// registry answers for it without being seeded.
	registry := NewSearchFieldsRegistry(nil, nil, nil)
	fields, got, provider := registry.ForKey(GlobalSearchKey("ns"))
	assert.Equal(t, hash, got)
	assert.Empty(t, fields)
	assert.Nil(t, provider)

	_, perResource, _ := registry.ForKey(NamespacedResource{Namespace: "ns", Group: "dashboard.grafana.app", Resource: "dashboards"})
	assert.NotEqual(t, hash, perResource)
}

// An import replaces a type without writing through the usual path, so a
// namespace-wide index is as old as the latest import into any type it covers.
// Its own key is never imported, so asking about it would always say never.
func TestLastImportTimeOfGlobalIndex(t *testing.T) {
	older := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	newer := older.Add(time.Hour)
	dashboards := NamespacedResource{Namespace: "ns", Group: "dashboard.grafana.app", Resource: "dashboards"}
	folders := NamespacedResource{Namespace: "ns", Group: "folder.grafana.app", Resource: "folders"}

	storage := &mockStorageBackend{lastImportTimes: []ResourceLastImportTime{
		{NamespacedResource: dashboards, LastImportTime: older},
		{NamespacedResource: folders, LastImportTime: newer},
		// Another namespace, which must not count.
		{NamespacedResource: NamespacedResource{Namespace: "other", Group: "folder.grafana.app", Resource: "folders"}, LastImportTime: newer.Add(time.Hour)},
	}}
	s := &searchServer{storage: storage}

	got, err := s.lastImportTime(t.Context(), GlobalSearchKey("ns"))
	require.NoError(t, err)
	assert.Equal(t, newer, got)

	// A per-resource index still answers with its own import time.
	got, err = s.lastImportTime(t.Context(), dashboards)
	require.NoError(t, err)
	assert.Equal(t, older, got)

	times, err := s.getLastImportTimes(t.Context(), []NamespacedResource{GlobalSearchKey("ns"), dashboards})
	require.NoError(t, err)
	assert.Equal(t, map[NamespacedResource]time.Time{GlobalSearchKey("ns"): newer, dashboards: older}, times)
}

func TestLastImportTimeOfGlobalIndexNeverImported(t *testing.T) {
	s := &searchServer{storage: &mockStorageBackend{}}

	got, err := s.lastImportTime(t.Context(), GlobalSearchKey("ns"))
	require.NoError(t, err)
	assert.True(t, got.IsZero())
}

func TestKeepStandardFieldsOnly(t *testing.T) {
	doc := keepStandardFieldsOnly(&IndexableDocument{
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
	doc := (&IndexableDocument{Key: &resourcepb.ResourceKey{
		Namespace: "ns",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
		Name:      "abc",
	}}).UpdateCopyFields()

	assert.Equal(t, "dashboard.grafana.app/dashboards", doc.GroupResource)
}

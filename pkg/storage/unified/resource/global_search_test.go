package resource

import (
	"slices"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

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

// Dashboards and folders opt in through their manifests. Written out so that a
// Grafana kind joining them is reviewed: its lists must not hide objects that a
// get by name returns, including in storage wrappers the manifest says nothing
// about.
func TestGlobalSearchCoversTheKindsThatOptIn(t *testing.T) {
	dashboards := schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}
	folders := schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}
	assert.Equal(t, []schema.GroupResource{dashboards, folders}, GlobalSearchResourceTypes())
	assert.Equal(t, map[schema.GroupResource]string{dashboards: "Dashboard", folders: "Folder"}, GlobalSearchKinds())
}

// A kind opts in on every version it is served in, or on none: the global index
// holds one document per object, whichever version it is read in.
func TestGlobalSearchKindsOptInOnEveryVersion(t *testing.T) {
	for _, m := range AppManifests() {
		if m == nil {
			continue
		}
		optedIn := map[string][]bool{}
		for _, version := range m.Versions {
			for _, kind := range version.Kinds {
				optedIn[kind.Kind] = append(optedIn[kind.Kind], kind.InGlobalSearchIndex())
			}
		}
		for kind, versions := range optedIn {
			assert.Len(t, slices.Compact(versions), 1, "%s %s opts in to the global search index on some versions only", m.Group, kind)
		}
	}
}

// Otherwise the kind would be left out of the global index without a word.
func TestGlobalSearchKindsServeGenericReads(t *testing.T) {
	for _, m := range AppManifests() {
		if m == nil {
			continue
		}
		for _, version := range m.Versions {
			for _, kind := range version.Kinds {
				if !kind.InGlobalSearchIndex() {
					continue
				}
				assert.True(t, kind.HasSearchEndpoint(), "%s %s %s opts in to the global search index without serving search", m.Group, version.Name, kind.Kind)
				assert.True(t, kind.HasListKeysEndpoint(), "%s %s %s opts in to the global search index without serving list-keys", m.Group, version.Name, kind.Kind)
			}
		}
	}
}

func TestGlobalSearchCoverageOf(t *testing.T) {
	yes, no := true, false
	kind := func(name, plural string, global *bool) app.ManifestVersionKind {
		k := app.ManifestVersionKind{Kind: name, Plural: plural}
		if global != nil {
			k.Search = &app.ManifestVersionKindSearch{Global: global}
		}
		return k
	}
	withoutSearch := kind("Secret", "Secrets", &yes)
	withoutSearch.Search.Endpoint = &no
	withoutListKeys := kind("Private", "Privates", &yes)
	withoutListKeys.Storage = &app.ManifestVersionKindStorage{ListKeys: &no}
	got := globalSearchCoverageOf([]*app.ManifestData{
		nil,
		{Group: "b.grafana.app", Versions: []app.ManifestVersion{
			{Name: "v1", Kinds: []app.ManifestVersionKind{kind("Widget", "", &yes), kind("Gadget", "Gadgets", &no)}},
		}},
		{Group: "a.grafana.app", Versions: []app.ManifestVersion{
			{Name: "v1", Kinds: []app.ManifestVersionKind{kind("Thing", "Things", nil), kind("Secret", "Secrets", &yes)}},
			{Name: "v2", Kinds: []app.ManifestVersionKind{kind("Thing", "Things", &yes), withoutSearch, withoutListKeys}},
		}},
	})
	assert.Equal(t, []schema.GroupResource{
		{Group: "a.grafana.app", Resource: "things"},
		{Group: "b.grafana.app", Resource: "widgets"},
	}, got.types, "sorted; opted in on one version is enough; the plural defaults to the kind plus s; "+
		"a kind without search or list-keys on any version is left out")
	assert.Equal(t, map[schema.GroupResource]string{
		{Group: "a.grafana.app", Resource: "things"}:  "Thing",
		{Group: "b.grafana.app", Resource: "widgets"}: "Widget",
	}, got.kinds)
}

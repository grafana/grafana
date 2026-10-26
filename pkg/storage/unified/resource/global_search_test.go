package resource

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
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
	s := &searchServer{}
	dashboards := NamespacedResource{Namespace: "ns", Group: "dashboard.grafana.app", Resource: "dashboards"}
	assert.Equal(t, []NamespacedResource{dashboards}, s.indexSources(dashboards))

	// A namespace-wide index draws from every covered type, in the namespace it
	// belongs to.
	sources := s.indexSources(GlobalSearchKey("ns"))
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

func TestGlobalDocumentBuilder(t *testing.T) {
	for _, gr := range GlobalSearchResourceTypes() {
		t.Run(gr.Resource, func(t *testing.T) {
			key := &resourcepb.ResourceKey{Namespace: "ns", Group: gr.Group, Resource: gr.Resource, Name: "item"}
			value := []byte(`{
				"apiVersion": "group/v1", "kind": "Thing",
				"metadata": {
					"name": "item", "namespace": "ns",
					"labels": {"team": "search"},
					"annotations": {"grafana.app/folder": "folder-a"}
				},
				"spec": {
					"title": "Resource title", "description": "Resource description", "tags": ["ops"],
					"views_total": 42, "panel_types": ["timeseries"]
				}
			}`)

			doc, err := (&globalDocumentBuilder{}).BuildDocument(t.Context(), key, 20, value)
			require.NoError(t, err)
			assert.Equal(t, key, doc.Key)
			assert.Equal(t, int64(20), doc.RV)
			assert.Equal(t, "Resource title", doc.Title)
			assert.Equal(t, "Resource description", doc.Description)
			assert.Equal(t, []string{"ops"}, doc.Tags)
			assert.Equal(t, "folder-a", doc.Folder)
			assert.Equal(t, map[string]string{"team": "search"}, doc.Labels)
			assert.Empty(t, doc.Fields)
			assert.Empty(t, doc.SelectableFields)
		})
	}
}

func TestGlobalDocumentBuilderToleratesSpecFields(t *testing.T) {
	for _, tc := range []struct {
		name      string
		spec      string
		wantTitle string
		wantTags  []string
	}{
		{name: "name fallback", spec: `{"name":"Spec name"}`, wantTitle: "Spec name"},
		{name: "title takes precedence", spec: `{"title":"Title","name":"Name"}`, wantTitle: "Title"},
		{name: "mixed tags", spec: `{"tags":[null,42,{},[],"","ops"]}`, wantTags: []string{"ops"}},
		{name: "non-list tags", spec: `{"tags":"ops"}`},
		{name: "invalid field types", spec: `{"title":42,"description":{},"tags":null}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			value := fmt.Appendf(nil, `{"apiVersion":"group/v1","kind":"Thing","metadata":{"name":"item"},"spec":%s}`, tc.spec)
			doc, err := (&globalDocumentBuilder{}).BuildDocument(t.Context(), &resourcepb.ResourceKey{Name: "item"}, 20, value)
			require.NoError(t, err)
			wantTitle := tc.wantTitle
			if wantTitle == "" {
				wantTitle = "item"
			}
			assert.Equal(t, wantTitle, doc.Title)
			assert.Empty(t, doc.Description)
			assert.Equal(t, tc.wantTags, doc.Tags)
		})
	}
}

func BenchmarkGlobalDocumentBuilderLargeDashboard(b *testing.B) {
	panel := `{"title":"Panel","targets":[{"expr":"sum(rate(requests_total[5m]))","datasource":{"type":"prometheus","uid":"metrics"}}],"options":{"legend":{"displayMode":"list"}}}`
	value := fmt.Appendf(nil, `{"apiVersion":"dashboard.grafana.app/v0alpha1","kind":"Dashboard","metadata":{"name":"item"},"spec":{"title":"Dashboard","description":"Large dashboard","tags":["ops"],"panels":[%s]}}`, strings.TrimSuffix(strings.Repeat(panel+",", 2000), ","))
	key := &resourcepb.ResourceKey{Namespace: "ns", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "item"}
	for _, tc := range []struct {
		name    string
		builder DocumentBuilder
	}{
		{name: "standard builder", builder: StandardDocumentBuilder(nil)},
		{name: "global builder", builder: &globalDocumentBuilder{}},
	} {
		b.Run(tc.name, func(b *testing.B) {
			b.ReportAllocs()
			b.SetBytes(int64(len(value)))
			for b.Loop() {
				if _, err := tc.builder.BuildDocument(b.Context(), key, 20, value); err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

type globalDocumentBlob struct {
	BlobSupport
	response *resourcepb.GetBlobResponse
	err      error
	key      *resourcepb.ResourceKey
	info     *utils.BlobInfo
	proxy    bool
}

func (b *globalDocumentBlob) GetResourceBlob(_ context.Context, key *resourcepb.ResourceKey, info *utils.BlobInfo, proxy bool) (*resourcepb.GetBlobResponse, error) {
	b.key, b.info, b.proxy = key, info, proxy
	return b.response, b.err
}

func TestGlobalDocumentBuilderLoadsBlob(t *testing.T) {
	spec := `{"title":"Blob title","description":"Blob description","tags":["blob-tag",null,42,{},[],""],"views_total":42}`
	for _, tc := range []struct {
		name  string
		value string
	}{
		{name: "spec", value: spec},
		{
			name:  "resource",
			value: `{"metadata":{"name":"old-name","annotations":{"grafana.app/folder":"old-folder"}},"spec":` + spec + `}`,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			key := &resourcepb.ResourceKey{Namespace: "ns", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "item"}
			value := fmt.Appendf(nil, `{
				"apiVersion": "dashboard.grafana.app/v0alpha1", "kind": "Dashboard",
				"metadata": {
					"name": "item", "namespace": "ns",
					"labels": {"team": "search"},
					"annotations": {"%s": "blob-uid", "grafana.app/folder": "current-folder"}
				},
				"spec": {}
			}`, utils.AnnoKeyBlob)
			blob := &globalDocumentBlob{response: &resourcepb.GetBlobResponse{Value: []byte(tc.value)}}

			doc, err := (&globalDocumentBuilder{blob: blob}).BuildDocument(t.Context(), key, 20, value)
			require.NoError(t, err)
			assert.Equal(t, key, blob.key)
			assert.Equal(t, "blob-uid", blob.info.UID)
			assert.True(t, blob.proxy, "the builder needs bytes, not a signed URL")
			assert.Equal(t, key, doc.Key)
			assert.Equal(t, "item", doc.Name)
			assert.Equal(t, int64(20), doc.RV)
			assert.Equal(t, "Blob title", doc.Title)
			assert.Equal(t, "Blob description", doc.Description)
			assert.Equal(t, []string{"blob-tag"}, doc.Tags)
			assert.Equal(t, "current-folder", doc.Folder)
			assert.Equal(t, map[string]string{"team": "search"}, doc.Labels)
			assert.Empty(t, doc.Fields)
			assert.Empty(t, doc.SelectableFields)
		})
	}
}

func TestGlobalDocumentBuilderBlobErrors(t *testing.T) {
	for _, tc := range []struct {
		name      string
		blob      *globalDocumentBlob
		wantErr   error
		wantError string
	}{
		{name: "missing blob support", wantError: "blob support is not configured"},
		{
			name:    "transport error",
			blob:    &globalDocumentBlob{err: context.Canceled},
			wantErr: context.Canceled,
		},
		{
			name: "response error",
			blob: &globalDocumentBlob{response: &resourcepb.GetBlobResponse{
				Error: &resourcepb.ErrorResult{Code: http.StatusServiceUnavailable, Message: "blob unavailable"},
			}},
			wantError: "blob unavailable",
		},
		{
			name: "transport error takes precedence",
			blob: &globalDocumentBlob{
				response: &resourcepb.GetBlobResponse{Error: &resourcepb.ErrorResult{Message: "blob unavailable"}},
				err:      context.Canceled,
			},
			wantErr: context.Canceled,
		},
		{
			name: "invalid JSON",
			blob: &globalDocumentBlob{response: &resourcepb.GetBlobResponse{Value: []byte("invalid")}},
		},
		{
			name: "nil response",
			blob: &globalDocumentBlob{},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			builder := &globalDocumentBuilder{}
			if tc.blob != nil {
				builder.blob = tc.blob
			}
			value := fmt.Appendf(nil, `{"apiVersion":"dashboard.grafana.app/v0alpha1","kind":"Dashboard","metadata":{"name":"item","annotations":{"%s":"blob-uid"}}}`, utils.AnnoKeyBlob)
			doc, err := builder.BuildDocument(t.Context(), &resourcepb.ResourceKey{Name: "item"}, 20, value)
			require.Error(t, err)
			assert.Nil(t, doc)
			if tc.wantErr != nil {
				assert.ErrorIs(t, err, tc.wantErr)
			}
			if tc.wantError != "" {
				assert.ErrorContains(t, err, tc.wantError)
			}
		})
	}
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

// Dashboards, folders, notebooks and playlists opt in through their manifests.
// Written out so that a Grafana kind joining them is reviewed: its lists must not
// hide objects that a get by name returns, including in storage wrappers the
// manifest says nothing about. The only test that reads the real coverage; the
// others use testBuiltinManifests.
func TestGlobalSearchCoversTheKindsThatOptIn(t *testing.T) {
	dashboards := schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}
	folders := schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}
	notebooks := schema.GroupResource{Group: "dashboard.grafana.app", Resource: "notebooks"}
	playlists := schema.GroupResource{Group: "playlist.grafana.app", Resource: "playlists"}
	got := globalSearchCoverageOf(AppManifests())
	assert.Equal(t, []schema.GroupResource{dashboards, folders, notebooks, playlists}, got.types)
	assert.Equal(t, map[schema.GroupResource]string{
		dashboards: "Dashboard",
		folders:    "Folder",
		notebooks:  "Notebook",
		playlists:  "Playlist",
	}, got.kinds)
}

// testBuiltinManifests stand in for the compiled-in manifests in tests, so that
// a Grafana kind opting in to global search changes only the test above.
func testBuiltinManifests() []*app.ManifestData {
	yes := true
	return []*app.ManifestData{
		testGlobalManifest("dashboard.grafana.app", testGlobalKind("Dashboard", "Dashboards", &yes)),
		testGlobalManifest("folder.grafana.app", testGlobalKind("Folder", "Folders", &yes)),
	}
}

// useTestGlobalSearchCoverage makes the compiled-in coverage, which a nil
// registry falls back to, the one testBuiltinManifests describe.
func useTestGlobalSearchCoverage() {
	globalSearchCoverage = func() globalSearchTypes { return globalSearchCoverageOf(testBuiltinManifests()) }
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

func testGlobalKind(name, plural string, global *bool) app.ManifestVersionKind {
	k := app.ManifestVersionKind{Kind: name, Plural: plural, Scope: namespacedScope}
	if global != nil {
		k.Search = &app.ManifestVersionKindSearch{Global: global}
	}
	return k
}

func testGlobalManifest(group string, kinds ...app.ManifestVersionKind) *app.ManifestData {
	return &app.ManifestData{Group: group, Versions: []app.ManifestVersion{{Name: "v1", Kinds: kinds}}}
}

func TestGlobalSearchCoverageOf(t *testing.T) {
	yes, no := true, false
	withoutSearch := testGlobalKind("Secret", "Secrets", &yes)
	withoutSearch.Search.Endpoint = &no
	withoutListKeys := testGlobalKind("Private", "Privates", &yes)
	withoutListKeys.Storage = &app.ManifestVersionKindStorage{ListKeys: &no}
	clusterScoped := testGlobalKind("Cluster", "Clusters", &yes)
	clusterScoped.Scope = "Cluster"
	got := globalSearchCoverageOf([]*app.ManifestData{
		nil,
		{Group: "b.grafana.app", Versions: []app.ManifestVersion{
			{Name: "v1", Kinds: []app.ManifestVersionKind{testGlobalKind("Widget", "", &yes), testGlobalKind("Gadget", "Gadgets", &no), clusterScoped}},
		}},
		{Group: "a.grafana.app", Versions: []app.ManifestVersion{
			{Name: "v1", Kinds: []app.ManifestVersionKind{testGlobalKind("Thing", "Things", nil), testGlobalKind("Secret", "Secrets", &yes)}},
			{Name: "v2", Kinds: []app.ManifestVersionKind{testGlobalKind("Thing", "Things", &yes), withoutSearch, withoutListKeys}},
		}},
	})
	assert.Equal(t, []schema.GroupResource{
		{Group: "a.grafana.app", Resource: "things"},
		{Group: "b.grafana.app", Resource: "widgets"},
	}, got.types, "sorted; opted in on one version is enough; the plural defaults to the kind plus s; "+
		"a kind without search or list-keys on any version, or not namespaced, is left out")
	assert.Equal(t, map[schema.GroupResource]string{
		{Group: "a.grafana.app", Resource: "things"}:  "Thing",
		{Group: "b.grafana.app", Resource: "widgets"}: "Widget",
	}, got.kinds)
}

// A kind renamed between versions is named from the preferred version, or else
// the first version that declares it, not from whichever version comes last.
func TestGlobalSearchCoverageOfNamesRenamedKinds(t *testing.T) {
	yes := true
	widgets := schema.GroupResource{Group: "a.grafana.app", Resource: "widgets"}
	for _, tc := range []struct {
		preferred string
		want      string
	}{
		{preferred: "", want: "Widget"},
		{preferred: "v1", want: "Widget"},
		{preferred: "v2", want: "Gadget"},
	} {
		t.Run("preferred "+tc.preferred, func(t *testing.T) {
			got := globalSearchCoverageOf([]*app.ManifestData{{
				Group:            widgets.Group,
				PreferredVersion: tc.preferred,
				Versions: []app.ManifestVersion{
					{Name: "v1", Kinds: []app.ManifestVersionKind{testGlobalKind("Widget", "widgets", &yes)}},
					{Name: "v2", Kinds: []app.ManifestVersionKind{testGlobalKind("Gadget", "widgets", &yes)}},
				},
			}})
			assert.Equal(t, map[schema.GroupResource]string{widgets: tc.want}, got.kinds)
		})
	}
}

func TestManifestKindsInclude(t *testing.T) {
	m := &app.ManifestData{Group: "a.grafana.app", PreferredVersion: "v2", Versions: []app.ManifestVersion{
		{Name: "v1", Kinds: []app.ManifestVersionKind{{Kind: "Widget", Plural: "widgets"}}},
		{Name: "v2", Kinds: []app.ManifestVersionKind{{Kind: "Gadget", Plural: "widgets"}}},
	}}
	onlyV1 := func(v app.ManifestVersion, _ app.ManifestVersionKind) bool { return v.Name == "v1" }
	assert.Equal(t, map[schema.GroupResource]schema.GroupVersionKind{
		{Group: "a.grafana.app", Resource: "widgets"}: {Group: "a.grafana.app", Version: "v1", Kind: "Widget"},
	}, ManifestKinds(m, onlyV1), "a preferred version left out by include does not count")
	assert.Empty(t, ManifestKinds(nil, nil))
}

// Manifests read at runtime replace the compiled-in ones kind by kind, so an app
// can opt a kind in or out without a Grafana release.
func TestGlobalSearchCoverageOfSeveralSources(t *testing.T) {
	yes, no := true, false
	builtin := []*app.ManifestData{
		testGlobalManifest("a.grafana.app", testGlobalKind("Thing", "Things", &yes), testGlobalKind("Other", "Others", &yes)),
	}
	live := []*app.ManifestData{
		testGlobalManifest("a.grafana.app", testGlobalKind("Thing", "Things", &no)),
		testGlobalManifest("x.ext.grafana.app", testGlobalKind("Page", "Pages", &yes)),
		// Declared again by a later manifest of the same source, which does not win.
		testGlobalManifest("x.ext.grafana.app", testGlobalKind("Page", "Pages", &no)),
	}
	got := globalSearchCoverageOf(builtin, live)
	assert.Equal(t, []schema.GroupResource{
		{Group: "a.grafana.app", Resource: "others"},
		{Group: "x.ext.grafana.app", Resource: "pages"},
	}, got.types, "the live manifest opts things out; others, which it does not declare, stays")
}

func TestGlobalSearchCoverageRegistry(t *testing.T) {
	yes := true
	things := schema.GroupResource{Group: "a.grafana.app", Resource: "things"}
	pages := schema.GroupResource{Group: "x.ext.grafana.app", Resource: "pages"}
	builtin := []*app.ManifestData{testGlobalManifest("a.grafana.app", testGlobalKind("Thing", "Things", &yes))}
	r := NewGlobalSearchCoverageRegistry(builtin)
	assert.Equal(t, []schema.GroupResource{things}, r.Types())

	changed := r.Changed()
	added, dropped := r.Reload(builtin, []*app.ManifestData{testGlobalManifest("x.ext.grafana.app", testGlobalKind("Page", "Pages", &yes))})
	assert.Equal(t, []schema.GroupResource{pages}, added)
	assert.Empty(t, dropped)
	assert.True(t, r.Covers(pages))
	select {
	case <-changed:
	default:
		t.Fatal("a change is announced")
	}

	unchanged := r.Changed()
	added, dropped = r.Reload(builtin, []*app.ManifestData{testGlobalManifest("x.ext.grafana.app", testGlobalKind("Page", "Pages", &yes))})
	assert.Empty(t, added)
	assert.Empty(t, dropped)
	select {
	case <-unchanged:
		t.Fatal("a reload that changes nothing is not announced")
	default:
	}

	_, dropped = r.Reload(builtin, nil)
	assert.Equal(t, []schema.GroupResource{pages}, dropped)
	assert.False(t, r.Covers(pages))

	var none *GlobalSearchCoverageRegistry
	assert.Equal(t, GlobalSearchResourceTypes(), none.Types(), "no registry means the compiled-in coverage")
	assert.Nil(t, none.Changed())
}

// The manifest watcher reloads every registry through ReloadManifests.
func TestReloadManifestsUpdatesGlobalSearchCoverage(t *testing.T) {
	yes := true
	opts := SearchOptions{GlobalSearchCoverage: NewGlobalSearchCoverageRegistry(testBuiltinManifests())}
	pages := schema.GroupResource{Group: "x.ext.grafana.app", Resource: "pages"}
	require.NoError(t, opts.ReloadManifests(testBuiltinManifests(), []*app.ManifestData{testGlobalManifest(pages.Group, testGlobalKind("Page", "Pages", &yes))}))
	assert.True(t, opts.GlobalSearchCoverage.Covers(pages))
}

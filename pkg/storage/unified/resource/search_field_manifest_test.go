package resource

import (
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func manifestWithSearchFields() app.Manifest {
	return app.Manifest{ManifestData: &app.ManifestData{
		Group:            "widgets.example.test",
		PreferredVersion: "v2",
		Versions: []app.ManifestVersion{
			{
				Name: "v1",
				Kinds: []app.ManifestVersionKind{{
					Kind:   "Widget",
					Plural: "widgets",
					SearchFields: []app.ManifestVersionKindSearchField{
						{Name: "color", Path: "spec.color", Type: "string", Capabilities: []string{"filter", "sort"}},
					},
				}},
			},
			{
				Name: "v2",
				Kinds: []app.ManifestVersionKind{{
					Kind:   "Widget",
					Plural: "widgets",
					SearchFields: []app.ManifestVersionKindSearchField{
						{Name: "color", Path: "spec.settings.color", Type: "string", Capabilities: []string{"filter", "sort"}},
						{Name: "size", Path: "spec.size", Type: "int64", Array: true, EmitZeroIfAbsent: true, Capabilities: []string{"filter"}},
					},
				}},
			},
		},
	}}
}

func TestNewManifestBackedProvider(t *testing.T) {
	p := NewManifestBackedProvider([]app.Manifest{manifestWithSearchFields()})

	v2 := schema.GroupVersionResource{Group: "widgets.example.test", Version: "v2", Resource: "widgets"}
	got := p.Fields(v2)
	require.Len(t, got, 2)

	assert.Equal(t, SearchFieldDefinition{
		Name:         "color",
		Path:         "spec.settings.color",
		Type:         SearchFieldTypeString,
		Capabilities: []SearchCapability{SearchCapabilityFilter, SearchCapabilitySort},
	}, got[0])
	assert.Equal(t, SearchFieldDefinition{
		Name:             "size",
		Path:             "spec.size",
		Type:             SearchFieldTypeInt64,
		Array:            true,
		EmitZeroIfAbsent: true,
		Capabilities:     []SearchCapability{SearchCapabilityFilter},
	}, got[1])

	// Path may differ per version; v1 declares the same field at a different path.
	v1 := schema.GroupVersionResource{Group: "widgets.example.test", Version: "v1", Resource: "widgets"}
	v1Fields := p.Fields(v1)
	require.Len(t, v1Fields, 1)
	assert.Equal(t, "spec.color", v1Fields[0].Path)

	// The manifest's explicit preferredVersion is honoured.
	assert.Equal(t, "v2", p.PreferredVersion("widgets.example.test", "widgets"))
}

func TestNewManifestBackedProvider_DefaultsPluralAndPreferredVersion(t *testing.T) {
	// No plural and no explicit preferredVersion: resource defaults to kind+"s"
	// (lower-cased) and the last declaring version is preferred.
	p := NewManifestBackedProvider([]app.Manifest{{ManifestData: &app.ManifestData{
		Group: "widgets.example.test",
		Versions: []app.ManifestVersion{
			{Name: "v1", Kinds: []app.ManifestVersionKind{{
				Kind:         "Gadget",
				SearchFields: []app.ManifestVersionKindSearchField{{Name: "name", Path: "spec.name", Type: "string", Capabilities: []string{"filter"}}},
			}}},
			{Name: "v2", Kinds: []app.ManifestVersionKind{{
				Kind:         "Gadget",
				SearchFields: []app.ManifestVersionKindSearchField{{Name: "name", Path: "spec.name", Type: "string", Capabilities: []string{"filter"}}},
			}}},
		},
	}}})

	gvr := schema.GroupVersionResource{Group: "widgets.example.test", Version: "v1", Resource: "gadgets"}
	require.Len(t, p.Fields(gvr), 1)
	assert.Equal(t, "v2", p.PreferredVersion("widgets.example.test", "gadgets"))
}

func TestSearchFieldProviders_MapsDeclaredKinds(t *testing.T) {
	got, err := SearchFieldProviders([]app.Manifest{manifestWithSearchFields()})
	require.NoError(t, err)

	// The one kind that declares search fields is present and provider-backed.
	require.Len(t, got, 1)
	provider := got[NewLowerGroupResource("widgets.example.test", "widgets")]
	require.NotNil(t, provider)

	// The mapped provider answers for that kind's own (group, resource).
	gvr := schema.GroupVersionResource{Group: "widgets.example.test", Version: "v2", Resource: "widgets"}
	assert.Len(t, provider.Fields(gvr), 2)
}

func TestSearchFieldProviders_NoManifestDeclarationsIsEmpty(t *testing.T) {
	// A manifest that declares no search fields yields an empty map.
	manifestNoFields := app.Manifest{ManifestData: &app.ManifestData{
		Group: "widgets.example.test",
		Versions: []app.ManifestVersion{{
			Name:  "v1",
			Kinds: []app.ManifestVersionKind{{Kind: "Widget", Plural: "widgets"}},
		}},
	}}

	got, err := SearchFieldProviders([]app.Manifest{manifestNoFields})
	require.NoError(t, err)
	assert.Empty(t, got)
}

func TestSearchFieldProviders_InvalidManifestReturnsError(t *testing.T) {
	// A runtime manifest source can carry an invalid declaration; the path must
	// surface it as an error rather than panicking.
	invalid := app.Manifest{ManifestData: &app.ManifestData{
		Group: "widgets.example.test",
		Versions: []app.ManifestVersion{{
			Name: "v1",
			Kinds: []app.ManifestVersionKind{{
				Kind:   "Widget",
				Plural: "widgets",
				SearchFields: []app.ManifestVersionKindSearchField{
					{Name: "size", Path: "spec.size", Type: "int64", Capabilities: []string{"text"}},
				},
			}},
		}},
	}}

	got, err := SearchFieldProviders([]app.Manifest{invalid})
	require.Error(t, err)
	assert.Nil(t, got)
}

func mergeTestManifest(appName, group string, versions ...app.ManifestVersion) app.Manifest {
	return app.Manifest{ManifestData: &app.ManifestData{AppName: appName, Group: group, Versions: versions}}
}

func mergeTestKind(kind, field string) app.ManifestVersionKind {
	return app.ManifestVersionKind{
		Kind:   kind,
		Plural: kind + "s",
		SearchFields: []app.ManifestVersionKindSearchField{
			{Name: field, Path: "spec." + field, Type: "string", Capabilities: []string{"filter"}},
		},
	}
}

// fieldNames lets a test assert whose declaration of a kind survived a merge.
func fieldNames(t *testing.T, manifests []app.Manifest, group, version, resource string) []string {
	t.Helper()
	p, err := newManifestBackedProvider(manifests)
	require.NoError(t, err)
	fields := p.Fields(schema.GroupVersionResource{Group: group, Version: version, Resource: resource})
	names := make([]string, 0, len(fields))
	for _, f := range fields {
		names = append(names, f.Name)
	}
	return names
}

func TestMergeManifestsByKind(t *testing.T) {
	t.Run("disjoint kinds from different sources are all kept", func(t *testing.T) {
		builtin := mergeTestManifest("builtin", "a.test", app.ManifestVersion{Name: "v1", Kinds: []app.ManifestVersionKind{mergeTestKind("Foo", "one")}})
		live := mergeTestManifest("live", "b.test", app.ManifestVersion{Name: "v1", Kinds: []app.ManifestVersionKind{mergeTestKind("Bar", "two")}})

		merged := MergeManifestsByKind([]app.Manifest{builtin}, []app.Manifest{live})

		require.Equal(t, []string{"one"}, fieldNames(t, merged, "a.test", "v1", "foos"))
		require.Equal(t, []string{"two"}, fieldNames(t, merged, "b.test", "v1", "bars"))
	})

	t.Run("later source wins the whole kind across all versions", func(t *testing.T) {
		builtin := mergeTestManifest("builtin", "g.test",
			app.ManifestVersion{Name: "v1", Kinds: []app.ManifestVersionKind{mergeTestKind("Foo", "builtin_v1")}},
			app.ManifestVersion{Name: "v2", Kinds: []app.ManifestVersionKind{mergeTestKind("Foo", "builtin_v2")}},
		)
		// The higher-priority source declares Foo only in v1.
		live := mergeTestManifest("live", "g.test",
			app.ManifestVersion{Name: "v1", Kinds: []app.ManifestVersionKind{mergeTestKind("Foo", "live_v1")}},
		)

		merged := MergeManifestsByKind([]app.Manifest{builtin}, []app.Manifest{live})

		// Whole kind comes from the winner: v2 is gone, not kept from built-in.
		require.Equal(t, []string{"live_v1"}, fieldNames(t, merged, "g.test", "v1", "foos"))
		require.Empty(t, fieldNames(t, merged, "g.test", "v2", "foos"))
	})

	t.Run("a fully overridden manifest is dropped from the output", func(t *testing.T) {
		builtin := mergeTestManifest("builtin", "g.test", app.ManifestVersion{Name: "v1", Kinds: []app.ManifestVersionKind{mergeTestKind("Foo", "builtin")}})
		live := mergeTestManifest("live", "g.test", app.ManifestVersion{Name: "v1", Kinds: []app.ManifestVersionKind{mergeTestKind("Foo", "live")}})

		merged := MergeManifestsByKind([]app.Manifest{builtin}, []app.Manifest{live})

		require.Len(t, merged, 1)
		require.Equal(t, "live", merged[0].ManifestData.AppName)
	})

	t.Run("a source without search fields for a kind does not override another source", func(t *testing.T) {
		builtin := mergeTestManifest("builtin", "g.test", app.ManifestVersion{Name: "v1", Kinds: []app.ManifestVersionKind{mergeTestKind("Foo", "builtin")}})
		// The higher-priority source declares Foo with selectable fields but no
		// search fields, so it must not claim the kind and strip the built-in's
		// search fields.
		live := mergeTestManifest("live", "g.test", app.ManifestVersion{Name: "v1", Kinds: []app.ManifestVersionKind{{Kind: "Foo", Plural: "foos", SelectableFields: []string{"spec.x"}}}})

		merged := MergeManifestsByKind([]app.Manifest{builtin}, []app.Manifest{live})

		require.Equal(t, []string{"builtin"}, fieldNames(t, merged, "g.test", "v1", "foos"))
	})

	t.Run("within one source the first manifest wins a duplicated kind", func(t *testing.T) {
		// A well-formed source never does this (one manifest per app); the guard
		// logs a warning and the merge keeps the first manifest's declaration.
		a := mergeTestManifest("a", "g.test", app.ManifestVersion{Name: "v1", Kinds: []app.ManifestVersionKind{mergeTestKind("Foo", "first")}})
		b := mergeTestManifest("b", "g.test", app.ManifestVersion{Name: "v1", Kinds: []app.ManifestVersionKind{mergeTestKind("Foo", "second")}})

		merged := MergeManifestsByKind([]app.Manifest{a, b})

		require.Equal(t, []string{"first"}, fieldNames(t, merged, "g.test", "v1", "foos"))
	})

	t.Run("a selectable-only manifest survives the merge", func(t *testing.T) {
		// Its kinds declare only selectable fields (no search fields), and the merge
		// output drives selectable-field wiring too, so it must not be dropped.
		kind := app.ManifestVersionKind{Kind: "Foo", Plural: "foos", SelectableFields: []string{"spec.x"}}
		in := []app.Manifest{mergeTestManifest("app", "g.test", app.ManifestVersion{Name: "v1", Kinds: []app.ManifestVersionKind{kind}})}

		merged := MergeManifestsByKind(in)

		require.NotEmpty(t, SelectableFieldsForManifests(merged))
		require.Equal(t, SelectableFieldsForManifests(in), SelectableFieldsForManifests(merged))
	})

	t.Run("manifests without data pass through", func(t *testing.T) {
		merged := MergeManifestsByKind([]app.Manifest{{ManifestData: nil}})
		require.Len(t, merged, 1)
		require.Nil(t, merged[0].ManifestData)
	})
}

func TestSearchFieldsForManifests(t *testing.T) {
	kind := mergeTestKind("Foo", "one")
	kind.SelectableFields = []string{"spec.two"}
	manifests := []app.Manifest{mergeTestManifest("app", "g.test", app.ManifestVersion{Name: "v1", Kinds: []app.ManifestVersionKind{kind}})}

	selectable, hashes, providers, err := SearchFieldsForManifests(manifests)
	require.NoError(t, err)

	// The three inputs all come from the same manifests.
	wantProviders, err := SearchFieldProviders(manifests)
	require.NoError(t, err)
	require.Equal(t, wantProviders, providers)
	require.Equal(t, SearchFieldsHashesForProviders(wantProviders), hashes)
	require.Equal(t, SelectableFieldsForManifests(manifests), selectable)

	// The kind declares both search and selectable fields, so none is empty.
	require.NotEmpty(t, providers)
	require.NotEmpty(t, hashes)
	require.NotEmpty(t, selectable)
}

func TestApplyManifests(t *testing.T) {
	registry := NewSearchFieldsRegistry(nil, nil, nil)
	builtin := []app.Manifest{
		mergeTestManifest("builtin", "a.test", app.ManifestVersion{Name: "v1", Kinds: []app.ManifestVersionKind{mergeTestKind("Foo", "builtinfield")}}),
	}
	require.NoError(t, ApplyManifests(registry, builtin, nil))

	key := NewLowerGroupResource("a.test", "foos")
	gvr := schema.GroupVersionResource{Group: "a.test", Version: "v1", Resource: "foos"}
	_, hashBuiltin, provider := registry.For(key)
	require.NotNil(t, provider)
	require.NotEmpty(t, hashBuiltin)

	// A live source overrides the same kind with a different field. The registry
	// must reflect the live declaration and its hash must change.
	live := []app.Manifest{
		mergeTestManifest("live", "a.test", app.ManifestVersion{Name: "v1", Kinds: []app.ManifestVersionKind{mergeTestKind("Foo", "livefield")}}),
	}
	require.NoError(t, ApplyManifests(registry, builtin, live))

	_, hashLive, provider := registry.For(key)
	require.NotEqual(t, hashBuiltin, hashLive)

	fields := provider.Fields(gvr)
	names := make([]string, 0, len(fields))
	for _, f := range fields {
		names = append(names, f.Name)
	}
	require.Contains(t, names, "livefield")
	require.NotContains(t, names, "builtinfield")
}

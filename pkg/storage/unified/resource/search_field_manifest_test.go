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

// stubProvider is a SearchFieldsProvider used only to assert identity in the
// merge test; its methods are never exercised for their return values.
type stubProvider struct{ SearchFieldsProvider }

func TestSearchFieldProviders_ManifestWinsBuilderFallback(t *testing.T) {
	widgetBuilder := &stubProvider{}
	gadgetBuilder := &stubProvider{}
	builderProviders := map[string]SearchFieldsProvider{
		"widgets.example.test/widgets": widgetBuilder, // manifest also declares this one
		"widgets.example.test/gadgets": gadgetBuilder, // builder-only, manifest declares nothing
	}

	got := SearchFieldProviders([]app.Manifest{manifestWithSearchFields()}, builderProviders)

	// Widget is declared in the manifest, so its provider is replaced.
	require.NotSame(t, widgetBuilder, got["widgets.example.test/widgets"])
	require.NotNil(t, got["widgets.example.test/widgets"])

	// Gadget is not in the manifest, so it keeps the builder provider.
	assert.Same(t, gadgetBuilder, got["widgets.example.test/gadgets"])
}

func TestSearchFieldProviders_NoManifestDeclarationsIsNoOp(t *testing.T) {
	widgetBuilder := &stubProvider{}
	builderProviders := map[string]SearchFieldsProvider{
		"widgets.example.test/widgets": widgetBuilder,
	}

	// A manifest that declares no search fields must not change anything.
	manifestNoFields := app.Manifest{ManifestData: &app.ManifestData{
		Group: "widgets.example.test",
		Versions: []app.ManifestVersion{{
			Name:  "v1",
			Kinds: []app.ManifestVersionKind{{Kind: "Widget", Plural: "widgets"}},
		}},
	}}

	got := SearchFieldProviders([]app.Manifest{manifestNoFields}, builderProviders)
	assert.Same(t, widgetBuilder, got["widgets.example.test/widgets"])
	assert.Len(t, got, 1)
}

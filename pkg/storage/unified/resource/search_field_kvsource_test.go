package resource

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const kvTestOwner = "usageinsights.grafana.app"

func kvDef(name, owner, key, path string) SearchFieldDefinition {
	return SearchFieldDefinition{
		Name:         name,
		Type:         SearchFieldTypeInt64,
		Capabilities: []SearchCapability{SearchCapabilitySort, SearchCapabilityRetrieve},
		KVSource:     &KVFieldSource{Owner: owner, Key: key, Path: path},
	}
}

func kvManifest(group, plural string, fields ...app.ManifestVersionKindSearchField) *app.ManifestData {
	return &app.ManifestData{
		Group:            group,
		PreferredVersion: "v1",
		Versions: []app.ManifestVersion{{
			Name: "v1",
			Kinds: []app.ManifestVersionKind{{
				Kind:         "Thing",
				Plural:       plural,
				KV:           &app.ManifestVersionKindKV{},
				SearchFields: fields,
			}},
		}},
	}
}

func kvManifestField(name, owner, key, path string) app.ManifestVersionKindSearchField {
	return app.ManifestVersionKindSearchField{
		Name:         name,
		Type:         "int64",
		Capabilities: []string{"sort", "retrieve"},
		Source: &app.ManifestVersionKindSearchFieldSource{
			KV: &app.ManifestVersionKindSearchFieldKVSource{Owner: owner, Key: key, Path: path},
		},
	}
}

func TestSearchFieldDefinition_IsKVSourced(t *testing.T) {
	t.Parallel()
	assert.True(t, kvDef("views_total", kvTestOwner, "stats", "views_total").IsKVSourced())
	assert.False(t, SearchFieldDefinition{Name: "title", Path: "spec.title", Type: SearchFieldTypeString}.IsKVSourced())
	assert.False(t, SearchFieldDefinition{Name: "computed", Type: SearchFieldTypeString}.IsKVSourced())
}

func TestManifestBackedProvider_CopiesKVSource(t *testing.T) {
	t.Parallel()

	m := kvManifest("playlist.grafana.app", "playlists",
		app.ManifestVersionKindSearchField{Name: "title", Path: "spec.title", Type: "string", Capabilities: []string{"filter"}},
		kvManifestField("views_total", kvTestOwner, "stats", "views_total"),
		kvManifestField("nested", "other.example.app", "daily/rollup", "totals.views"),
	)
	p, err := ManifestBackedProvider(m)
	require.NoError(t, err)

	fields := p.Fields(schema.GroupVersionResource{Group: "playlist.grafana.app", Version: "v1", Resource: "playlists"})
	byName := map[string]SearchFieldDefinition{}
	for _, f := range fields {
		byName[f.Name] = f
	}
	require.Len(t, byName, 3)

	assert.False(t, byName["title"].IsKVSourced())
	assert.Nil(t, byName["title"].KVSource)

	require.True(t, byName["views_total"].IsKVSourced())
	assert.Equal(t, KVFieldSource{Owner: kvTestOwner, Key: "stats", Path: "views_total"}, *byName["views_total"].KVSource)
	assert.Empty(t, byName["views_total"].Path)

	require.True(t, byName["nested"].IsKVSourced())
	assert.Equal(t, KVFieldSource{Owner: "other.example.app", Key: "daily/rollup", Path: "totals.views"}, *byName["nested"].KVSource)
}

func TestSearchFieldProviders_RejectInvalidKVSource(t *testing.T) {
	t.Parallel()

	gvr := schema.GroupVersionResource{Group: "example.grafana.app", Version: "v1", Resource: "things"}

	withPath := kvDef("f", kvTestOwner, "stats", "views_total")
	withPath.Path = "spec.x"
	withArray := kvDef("f", kvTestOwner, "stats", "views_total")
	withArray.Array = true

	cases := []struct {
		name string
		def  SearchFieldDefinition
	}{
		{name: "path and kv source", def: withPath},
		{name: "empty owner", def: kvDef("f", "", "stats", "views_total")},
		{name: "empty key", def: kvDef("f", kvTestOwner, "", "views_total")},
		{name: "empty path", def: kvDef("f", kvTestOwner, "stats", "")},
		{name: "array kv source", def: withArray},
	}
	for _, tc := range cases {
		t.Run("NewMapProvider panics: "+tc.name, func(t *testing.T) {
			t.Parallel()
			assert.Panics(t, func() {
				NewMapProvider(map[schema.GroupVersionResource][]SearchFieldDefinition{gvr: {tc.def}}, nil)
			})
		})

		t.Run("ManifestBackedProvider errors: "+tc.name, func(t *testing.T) {
			t.Parallel()
			f := app.ManifestVersionKindSearchField{
				Name:         tc.def.Name,
				Path:         tc.def.Path,
				Type:         string(tc.def.Type),
				Array:        tc.def.Array,
				Capabilities: []string{"sort"},
				Source: &app.ManifestVersionKindSearchFieldSource{KV: &app.ManifestVersionKindSearchFieldKVSource{
					Owner: tc.def.KVSource.Owner, Key: tc.def.KVSource.Key, Path: tc.def.KVSource.Path,
				}},
			}
			_, err := ManifestBackedProvider(kvManifest(gvr.Group, gvr.Resource, f))
			assert.Error(t, err)
		})
	}

	t.Run("a valid kv source is accepted", func(t *testing.T) {
		t.Parallel()
		assert.NotPanics(t, func() {
			NewMapProvider(map[schema.GroupVersionResource][]SearchFieldDefinition{gvr: {kvDef("f", kvTestOwner, "stats", "views_total")}}, nil)
		})
		_, err := ManifestBackedProvider(kvManifest(gvr.Group, gvr.Resource, kvManifestField("f", kvTestOwner, "stats", "views_total")))
		assert.NoError(t, err)
	})
}

func TestIndexAffectingHash_ChangesWithKVSource(t *testing.T) {
	t.Parallel()

	gvr := schema.GroupVersionResource{Group: "example.grafana.app", Version: "v1", Resource: "things"}
	hashOf := func(def SearchFieldDefinition) string {
		p := NewMapProvider(map[schema.GroupVersionResource][]SearchFieldDefinition{gvr: {def}}, nil)
		return p.IndexAffectingHash(gvr.Group, gvr.Resource)
	}

	noSource := SearchFieldDefinition{Name: "views_total", Type: SearchFieldTypeInt64, Capabilities: []SearchCapability{SearchCapabilitySort, SearchCapabilityRetrieve}}
	variants := map[string]SearchFieldDefinition{
		"no source":       noSource,
		"kv source":       kvDef("views_total", kvTestOwner, "stats", "views_total"),
		"different owner": kvDef("views_total", "other.grafana.app", "stats", "views_total"),
		"different key":   kvDef("views_total", kvTestOwner, "daily", "views_total"),
		"different path":  kvDef("views_total", kvTestOwner, "stats", "views_today"),
	}
	seen := map[string]string{}
	for name, def := range variants {
		h := hashOf(def)
		require.NotEmpty(t, h, name)
		if prev, dup := seen[h]; dup {
			t.Errorf("%q and %q hash the same; a KVSource change must change the hash", prev, name)
		}
		seen[h] = name
	}

	t.Run("hash is stable for identical kv sources", func(t *testing.T) {
		t.Parallel()
		assert.Equal(t, hashOf(kvDef("v", kvTestOwner, "stats", "p")), hashOf(kvDef("v", kvTestOwner, "stats", "p")))
	})
}

func TestSearchFieldsRegistry_KVSourcedKinds(t *testing.T) {
	t.Parallel()

	providers := map[LowerGroupResource]SearchFieldsProvider{}
	add := func(group, resource string, fields ...app.ManifestVersionKindSearchField) {
		p, err := ManifestBackedProvider(kvManifest(group, resource, fields...))
		require.NoError(t, err)
		providers[NewLowerGroupResource(group, resource)] = p
	}
	kvf := kvManifestField("views_total", kvTestOwner, "stats", "views_total")
	pathOnly := app.ManifestVersionKindSearchField{Name: "title", Path: "spec.title", Type: "string", Capabilities: []string{"filter"}}

	add("playlist.grafana.app", "playlists", pathOnly, kvf)
	add("b.example.app", "beta", kvf)
	add("a.example.app", "zeta", kvf)
	add("a.example.app", "alpha", kvf)
	add("folder.grafana.app", "folders", pathOnly)

	reg := NewSearchFieldsRegistry(nil, nil, providers)
	assert.Equal(t, []LowerGroupResource{
		NewLowerGroupResource("a.example.app", "alpha"),
		NewLowerGroupResource("a.example.app", "zeta"),
		NewLowerGroupResource("b.example.app", "beta"),
		NewLowerGroupResource("playlist.grafana.app", "playlists"),
	}, reg.KVSourcedKinds())

	t.Run("no kv-sourced kinds", func(t *testing.T) {
		t.Parallel()
		empty := NewSearchFieldsRegistry(nil, nil, nil)
		assert.Empty(t, empty.KVSourcedKinds())
	})
}

// CoerceSearchFieldValue must agree with what the standard document builder
// indexes for a path-sourced field carrying the same JSON value.
func TestCoerceSearchFieldValue_MatchesPathCoercion(t *testing.T) {
	t.Parallel()

	values := []string{`30`, `3.7`, `-2.5`, `0`, `"abc"`, `"2026-09-29T00:00:00Z"`, `true`, `false`, `null`, `{"a":1}`, `[1,2]`, `1e30`}
	types := []SearchFieldType{SearchFieldTypeInt64, SearchFieldTypeDouble, SearchFieldTypeString, SearchFieldTypeBoolean, SearchFieldTypeDate}

	gvr := schema.GroupVersionResource{Group: "example.grafana.app", Version: "v1", Resource: "things"}
	key := &resourcepb.ResourceKey{Namespace: "default", Group: gvr.Group, Resource: gvr.Resource, Name: "thing-1"}

	for _, typ := range types {
		for _, raw := range values {
			t.Run(fmt.Sprintf("%s/%s", typ, raw), func(t *testing.T) {
				t.Parallel()
				pathDef := SearchFieldDefinition{Name: "f", Path: "spec.v", Type: typ}
				provider := NewMapProvider(map[schema.GroupVersionResource][]SearchFieldDefinition{gvr: {pathDef}}, nil)
				body := []byte(`{"apiVersion":"example.grafana.app/v1","kind":"Thing","metadata":{"name":"thing-1","namespace":"default"},"spec":{"v":` + raw + `}}`)
				doc, err := StandardDocumentBuilder(registryWithProvider(gvr, provider)).BuildDocument(t.Context(), key, 1, body)
				require.NoError(t, err)
				want, wantOK := doc.Fields["f"]

				var decoded any
				require.NoError(t, json.Unmarshal([]byte(raw), &decoded))
				def := kvDef("f", kvTestOwner, "stats", "v")
				def.Type = typ
				got, ok := CoerceSearchFieldValue(decoded, def)
				assert.Equal(t, wantOK, ok, "presence must match path coercion")
				if wantOK {
					assert.Equal(t, want, got)
				}
			})
		}
	}
}

func TestCoerceSearchFieldValue_Table(t *testing.T) {
	t.Parallel()

	def := func(typ SearchFieldType) SearchFieldDefinition {
		d := kvDef("f", kvTestOwner, "stats", "v")
		d.Type = typ
		return d
	}
	cases := []struct {
		name   string
		raw    any
		typ    SearchFieldType
		want   any
		wantOK bool
	}{
		{name: "json number to int64", raw: float64(30), typ: SearchFieldTypeInt64, want: int64(30), wantOK: true},
		{name: "fractional number rounds to int64", raw: 3.7, typ: SearchFieldTypeInt64, want: int64(4), wantOK: true},
		{name: "number to double", raw: 2.5, typ: SearchFieldTypeDouble, want: 2.5, wantOK: true},
		{name: "string stays string", raw: "abc", typ: SearchFieldTypeString, want: "abc", wantOK: true},
		{name: "bool stays bool", raw: true, typ: SearchFieldTypeBoolean, want: true, wantOK: true},
		{name: "string is not int64", raw: "30", typ: SearchFieldTypeInt64},
		{name: "number is not string", raw: float64(1), typ: SearchFieldTypeString},
		{name: "nil is absent", raw: nil, typ: SearchFieldTypeInt64},
		{name: "object is absent", raw: map[string]any{"a": 1.0}, typ: SearchFieldTypeInt64},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, ok := CoerceSearchFieldValue(tc.raw, def(tc.typ))
			assert.Equal(t, tc.wantOK, ok)
			if tc.wantOK {
				assert.Equal(t, tc.want, got)
			}
		})
	}
}

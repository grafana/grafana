package resource

import (
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func manifestReloadObject(searchField string, revision int64, fields ...app.ManifestVersionKindEmbedField) *unstructured.Unstructured {
	obj := testAppManifestObj("widgets", "widgets", "widgets.test", "Widget", searchField)
	spec := obj.Object["spec"].(map[string]interface{})
	spec["embed"] = map[string]interface{}{
		"widgets": map[string]interface{}{"reembedVersion": revision},
	}
	kind := manifestReloadKind(obj)
	kind["searchFields"] = []interface{}{
		map[string]interface{}{
			"name": searchField, "path": "spec." + searchField,
			"type": "string", "capabilities": []interface{}{"filter"},
		},
	}
	embedFields := make([]interface{}, 0, len(fields))
	for _, field := range fields {
		embedFields = append(embedFields, map[string]interface{}{"name": field.Name, "path": field.Path})
	}
	kind["embed"] = map[string]interface{}{"fields": embedFields}
	return obj
}

func manifestReloadKind(obj *unstructured.Unstructured) map[string]interface{} {
	spec := obj.Object["spec"].(map[string]interface{})
	version := spec["versions"].([]interface{})[0].(map[string]interface{})
	return version["kinds"].([]interface{})[0].(map[string]interface{})
}

func manifestReloadOptions(t *testing.T, builtin []*app.ManifestData) SearchOptions {
	t.Helper()
	opts := SearchOptions{
		SearchFields:    NewSearchFieldsRegistry(nil, nil, nil),
		EmbeddingConfig: NewEmbeddingConfigRegistry(builtin),
	}
	require.NoError(t, opts.ReloadManifests(builtin, nil))
	return opts
}

// resolvedOptions wires a resolver into opts the way the storage service does,
// so search fields and embedding config are loaded through the registry.
func resolvedOptions(opts SearchOptions, router *fakeRouter, builtin []*app.ManifestData) *ManifestResolver {
	r := newManifestResolver(router.fetcher(), builtin, func(live []*app.ManifestData) error {
		return opts.ReloadManifests(builtin, live)
	}, nil)
	opts.SearchFields.SetResolver(r)
	return r
}

func TestSearchFieldsRegistry_ResolveLoadsUnknownKind(t *testing.T) {
	opts := manifestReloadOptions(t, nil)
	resolvedOptions(opts, newFakeRouter(t, manifestReloadObject("live", 2,
		app.ManifestVersionKindEmbedField{Name: "body", Path: "spec.body"})), nil)
	gvr := schema.GroupVersionResource{Group: "widgets.test", Version: "v1", Resource: "widgets"}
	key := NewLowerGroupResource(gvr.Group, gvr.Resource)

	_, _, provider := opts.SearchFields.For(key)
	require.Nil(t, provider)

	// The fields are there as soon as Resolve returns, which is what lets the
	// first index for a new kind be built with them.
	opts.SearchFields.Resolve(t.Context(), key)
	_, hash, provider := opts.SearchFields.For(key)
	require.NotEmpty(t, hash)
	require.NotNil(t, provider)
	require.Equal(t, "live", provider.Fields(gvr)[0].Name)
	config, found := opts.EmbeddingConfig.For(gvr)
	require.True(t, found)
	require.Equal(t, 2, config.ReembedVersion)
}

func TestSearchFieldsRegistry_ResolveWithoutResolver(t *testing.T) {
	var nilRegistry *SearchFieldsRegistry
	nilRegistry.Resolve(t.Context(), widgetsKey)
	NewSearchFieldsRegistry(nil, nil, nil).Resolve(t.Context(), widgetsKey)
}

func TestManifestResolver_LiveManifestOverridesBuiltin(t *testing.T) {
	builtinManifest, err := ManifestFromUnstructured(manifestReloadObject("builtin", 1,
		app.ManifestVersionKindEmbedField{Name: "title", Path: "spec.title"}))
	require.NoError(t, err)
	builtin := []*app.ManifestData{builtinManifest}
	opts := manifestReloadOptions(t, builtin)
	r := resolvedOptions(opts, newFakeRouter(t, manifestReloadObject("live", 2,
		app.ManifestVersionKindEmbedField{Name: "body", Path: "spec.body"})), builtin)
	gvr := schema.GroupVersionResource{Group: "widgets.test", Version: "v1", Resource: "widgets"}

	// A builtin group doesn't wait; the override arrives from the background fetch.
	r.background = func(f func()) { f() }
	opts.SearchFields.Resolve(t.Context(), NewLowerGroupResource(gvr.Group, gvr.Resource))

	_, _, provider := opts.SearchFields.For(NewLowerGroupResource(gvr.Group, gvr.Resource))
	require.NotNil(t, provider)
	require.Len(t, provider.Fields(gvr), 1)
	require.Equal(t, "live", provider.Fields(gvr)[0].Name)
	config, found := opts.EmbeddingConfig.For(gvr)
	require.True(t, found)
	require.Equal(t, EmbeddingConfig{ReembedVersion: 2, Fields: []app.ManifestVersionKindEmbedField{
		{Name: "body", Path: "spec.body"},
	}}, config)
}

func TestManifestResolver_KeepsPreviousConfigWhenSDKRejectsEmbedding(t *testing.T) {
	for _, tc := range []struct {
		name     string
		revision int64
		path     string
	}{
		{name: "invalid revision", revision: 0, path: "spec.body"},
		{name: "missing path", revision: 2, path: ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			initial := manifestReloadObject("title", 1,
				app.ManifestVersionKindEmbedField{Name: "title", Path: "spec.title"})
			router := newFakeRouter(t, initial)
			opts := manifestReloadOptions(t, nil)
			var reloadErr error
			var reloads int
			resolver := newManifestResolver(router.fetcher(), nil, func(manifests []*app.ManifestData) error {
				reloads++
				reloadErr = opts.ReloadManifests(nil, manifests)
				return reloadErr
			}, nil)
			resolver.fetch(t.Context(), "widgets.test", "test")
			require.Equal(t, 1, reloads)
			require.NoError(t, reloadErr)
			initialManifests := resolver.Manifests()

			gvr := schema.GroupVersionResource{Group: "widgets.test", Version: "v1", Resource: "widgets"}
			key := NewLowerGroupResource(gvr.Group, gvr.Resource)
			_, initialHash, _ := opts.SearchFields.For(key)
			require.NotEmpty(t, initialHash)
			initialConfig, found := opts.EmbeddingConfig.For(gvr)
			require.True(t, found)

			invalid := manifestReloadObject("label", tc.revision,
				app.ManifestVersionKindEmbedField{Name: "body", Path: tc.path})
			router.set(invalid)
			resolver.fetch(t.Context(), "widgets.test", "test")
			require.Equal(t, 1, reloads)
			require.NoError(t, reloadErr)
			require.Equal(t, initialManifests, resolver.Manifests())

			_, hash, provider := opts.SearchFields.For(key)
			require.NotNil(t, provider)
			require.Len(t, provider.Fields(gvr), 1)
			config, found := opts.EmbeddingConfig.For(gvr)
			require.True(t, found)
			require.Equal(t, initialHash, hash)
			require.Equal(t, "title", provider.Fields(gvr)[0].Name)
			require.Equal(t, initialConfig, config)

			updated := manifestReloadObject("label", 2,
				app.ManifestVersionKindEmbedField{Name: "body", Path: "spec.body"})
			router.set(updated)
			resolver.fetch(t.Context(), "widgets.test", "test")
			require.Equal(t, 2, reloads)
			require.NoError(t, reloadErr)
			_, hash, provider = opts.SearchFields.For(key)
			require.NotEqual(t, initialHash, hash)
			require.NotNil(t, provider)
			require.Len(t, provider.Fields(gvr), 1)
			require.Equal(t, "label", provider.Fields(gvr)[0].Name)
			config, found = opts.EmbeddingConfig.For(gvr)
			require.True(t, found)
			require.Equal(t, 2, config.ReembedVersion)
			require.Equal(t, []app.ManifestVersionKindEmbedField{{Name: "body", Path: "spec.body"}}, config.Fields)
		})
	}
}

func TestSearchOptions_ReloadsEmbeddingWhenSearchMappingIsInvalid(t *testing.T) {
	initial, err := ManifestFromUnstructured(manifestReloadObject("title", 1,
		app.ManifestVersionKindEmbedField{Name: "title", Path: "spec.title"}))
	require.NoError(t, err)
	opts := manifestReloadOptions(t, []*app.ManifestData{initial})
	gvr := schema.GroupVersionResource{Group: "widgets.test", Version: "v1", Resource: "widgets"}
	key := NewLowerGroupResource(gvr.Group, gvr.Resource)
	_, initialHash, _ := opts.SearchFields.For(key)
	require.NotEmpty(t, initialHash)

	updated := manifestReloadObject("count", 2,
		app.ManifestVersionKindEmbedField{Name: "body", Path: "spec.body"})
	manifestReloadKind(updated)["searchFields"] = []interface{}{
		map[string]interface{}{
			"name": "count", "path": "spec.count", "type": "int64",
			"capabilities": []interface{}{"text"},
		},
	}
	manifest, err := ManifestFromUnstructured(updated)
	require.NoError(t, err)
	require.Error(t, opts.ReloadManifests(nil, []*app.ManifestData{manifest}))
	_, hash, provider := opts.SearchFields.For(key)
	require.Equal(t, initialHash, hash)
	require.NotNil(t, provider)
	require.Len(t, provider.Fields(gvr), 1)
	require.Equal(t, "title", provider.Fields(gvr)[0].Name)
	config, found := opts.EmbeddingConfig.For(gvr)
	require.True(t, found)
	require.Equal(t, EmbeddingConfig{ReembedVersion: 2, Fields: []app.ManifestVersionKindEmbedField{
		{Name: "body", Path: "spec.body"},
	}}, config)
}

func TestManifestResolver_EmbeddingOnlyChangesPreserveSearchHash(t *testing.T) {
	initial := manifestReloadObject("title", 1,
		app.ManifestVersionKindEmbedField{Name: "title", Path: "spec.title"})
	router := newFakeRouter(t, initial)
	opts := manifestReloadOptions(t, nil)
	var reloadErr error
	var reloads int
	resolver := newManifestResolver(router.fetcher(), nil, func(manifests []*app.ManifestData) error {
		reloads++
		reloadErr = opts.ReloadManifests(nil, manifests)
		return reloadErr
	}, nil)
	resolver.fetch(t.Context(), "widgets.test", "test")
	require.NoError(t, reloadErr)
	gvr := schema.GroupVersionResource{Group: "widgets.test", Version: "v1", Resource: "widgets"}
	key := NewLowerGroupResource(gvr.Group, gvr.Resource)
	_, initialHash, _ := opts.SearchFields.For(key)
	require.NotEmpty(t, initialHash)

	updated := manifestReloadObject("title", 2,
		app.ManifestVersionKindEmbedField{Name: "body", Path: "spec.body"})
	router.set(updated)
	resolver.fetch(t.Context(), "widgets.test", "test")
	require.Equal(t, 2, reloads)
	require.NoError(t, reloadErr)
	_, hash, provider := opts.SearchFields.For(key)
	require.Equal(t, initialHash, hash)
	require.Len(t, provider.Fields(gvr), 1)
	require.Equal(t, "title", provider.Fields(gvr)[0].Name)
	config, found := opts.EmbeddingConfig.For(gvr)
	require.True(t, found)
	require.Equal(t, EmbeddingConfig{ReembedVersion: 2, Fields: []app.ManifestVersionKindEmbedField{
		{Name: "body", Path: "spec.body"},
	}}, config)

	absent := updated.DeepCopy()
	delete(absent.Object["spec"].(map[string]interface{}), "embed")
	delete(manifestReloadKind(absent), "embed")
	router.set(absent)
	resolver.fetch(t.Context(), "widgets.test", "test")
	require.Equal(t, 3, reloads)
	require.NoError(t, reloadErr)
	_, found = opts.EmbeddingConfig.For(gvr)
	require.False(t, found)
	_, hash, _ = opts.SearchFields.For(key)
	require.Equal(t, initialHash, hash)

	empty := manifestReloadObject("title", 2)
	router.set(empty)
	resolver.fetch(t.Context(), "widgets.test", "test")
	require.Equal(t, 4, reloads)
	require.NoError(t, reloadErr)
	config, found = opts.EmbeddingConfig.For(gvr)
	require.True(t, found)
	require.Equal(t, 2, config.ReembedVersion)
	require.Empty(t, config.Fields)
	_, hash, _ = opts.SearchFields.For(key)
	require.Equal(t, initialHash, hash)

	resolver.fetch(t.Context(), "widgets.test", "test")
	require.Equal(t, 4, reloads)
}

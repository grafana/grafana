package resource

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
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

func TestManifestWatcher_ReloadsSearchOptionsBeforeRunning(t *testing.T) {
	builtinManifest, err := ManifestFromUnstructured(manifestReloadObject("builtin", 1,
		app.ManifestVersionKindEmbedField{Name: "title", Path: "spec.title"}))
	require.NoError(t, err)
	builtin := []*app.ManifestData{builtinManifest}
	opts := manifestReloadOptions(t, builtin)
	live := manifestReloadObject("live", 2,
		app.ManifestVersionKindEmbedField{Name: "body", Path: "spec.body"})

	type initialReload struct {
		state services.State
		err   error
	}
	reloads := make(chan initialReload, 1)
	var watcher *ManifestWatcher
	watcher = newManifestWatcher(fakeManifestClient(live), time.Hour, func(manifests []*app.ManifestData) {
		reloads <- initialReload{state: watcher.State(), err: opts.ReloadManifests(builtin, manifests)}
	}, nil)
	watcher.Service = services.NewBasicService(watcher.starting, watcher.running, nil)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.WithoutCancel(t.Context()), time.Second)
		defer cancel()
		require.NoError(t, services.StopAndAwaitTerminated(ctx, watcher))
	})
	require.NoError(t, services.StartAndAwaitRunning(t.Context(), watcher))

	reload := <-reloads
	require.Equal(t, services.Starting, reload.state)
	require.NoError(t, reload.err)
	gvr := schema.GroupVersionResource{Group: "widgets.test", Version: "v1", Resource: "widgets"}
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

func TestManifestWatcher_KeepsPreviousConfigWhenSDKRejectsEmbedding(t *testing.T) {
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
			client := fakeManifestClient(initial)
			opts := manifestReloadOptions(t, nil)
			var reloadErr error
			var reloads int
			watcher := newManifestWatcher(client, 0, func(manifests []*app.ManifestData) {
				reloads++
				reloadErr = opts.ReloadManifests(nil, manifests)
			}, nil)
			watcher.runPollCycle(t.Context())
			require.Equal(t, 1, reloads)
			require.NoError(t, reloadErr)
			initialManifests := watcher.Manifests()

			gvr := schema.GroupVersionResource{Group: "widgets.test", Version: "v1", Resource: "widgets"}
			key := NewLowerGroupResource(gvr.Group, gvr.Resource)
			_, initialHash, _ := opts.SearchFields.For(key)
			require.NotEmpty(t, initialHash)
			initialConfig, found := opts.EmbeddingConfig.For(gvr)
			require.True(t, found)

			invalid := manifestReloadObject("label", tc.revision,
				app.ManifestVersionKindEmbedField{Name: "body", Path: tc.path})
			require.NoError(t, client.Tracker().Update(AppManifestGVR, invalid, ""))
			watcher.runPollCycle(t.Context())
			require.Equal(t, 1, reloads)
			require.NoError(t, reloadErr)
			require.Equal(t, initialManifests, watcher.Manifests())

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
			require.NoError(t, client.Tracker().Update(AppManifestGVR, updated, ""))
			watcher.runPollCycle(t.Context())
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

func TestManifestWatcher_EmbeddingOnlyChangesPreserveSearchHash(t *testing.T) {
	initial := manifestReloadObject("title", 1,
		app.ManifestVersionKindEmbedField{Name: "title", Path: "spec.title"})
	client := fakeManifestClient(initial)
	opts := manifestReloadOptions(t, nil)
	var reloadErr error
	var reloads int
	watcher := newManifestWatcher(client, 0, func(manifests []*app.ManifestData) {
		reloads++
		reloadErr = opts.ReloadManifests(nil, manifests)
	}, nil)
	watcher.runPollCycle(t.Context())
	require.NoError(t, reloadErr)
	gvr := schema.GroupVersionResource{Group: "widgets.test", Version: "v1", Resource: "widgets"}
	key := NewLowerGroupResource(gvr.Group, gvr.Resource)
	_, initialHash, _ := opts.SearchFields.For(key)
	require.NotEmpty(t, initialHash)

	updated := manifestReloadObject("title", 2,
		app.ManifestVersionKindEmbedField{Name: "body", Path: "spec.body"})
	require.NoError(t, client.Tracker().Update(AppManifestGVR, updated, ""))
	watcher.runPollCycle(t.Context())
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
	require.NoError(t, client.Tracker().Update(AppManifestGVR, absent, ""))
	watcher.runPollCycle(t.Context())
	require.Equal(t, 3, reloads)
	require.NoError(t, reloadErr)
	_, found = opts.EmbeddingConfig.For(gvr)
	require.False(t, found)
	_, hash, _ = opts.SearchFields.For(key)
	require.Equal(t, initialHash, hash)

	empty := manifestReloadObject("title", 2)
	require.NoError(t, client.Tracker().Update(AppManifestGVR, empty, ""))
	watcher.runPollCycle(t.Context())
	require.Equal(t, 4, reloads)
	require.NoError(t, reloadErr)
	config, found = opts.EmbeddingConfig.For(gvr)
	require.True(t, found)
	require.Equal(t, 2, config.ReembedVersion)
	require.Empty(t, config.Fields)
	_, hash, _ = opts.SearchFields.For(key)
	require.Equal(t, initialHash, hash)

	watcher.runPollCycle(t.Context())
	require.Equal(t, 4, reloads)
}

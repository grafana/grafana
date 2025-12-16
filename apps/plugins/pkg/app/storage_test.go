package app

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/meta"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

func TestMetaStorageListPreload(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), "default")

	preloadPlugin := pluginstore.Plugin{
		JSONData: plugins.JSONData{
			ID:      "test-plugin",
			Name:    "Test Plugin",
			Type:    plugins.TypeDataSource,
			Info:    plugins.Info{Version: "1.0.0"},
			Preload: true,
		},
	}
	nonPreloadPlugin := pluginstore.Plugin{
		JSONData: plugins.JSONData{
			ID:      "test-plugin-2",
			Name:    "Test Plugin 2",
			Type:    plugins.TypeDataSource,
			Info:    plugins.Info{Version: "1.0.0"},
			Preload: false,
		},
	}

	store := &mockPluginStore{plugins: map[string]pluginstore.Plugin{
		"test-plugin": preloadPlugin,
	}}
	store2 := &mockPluginStore{plugins: map[string]pluginstore.Plugin{
		"test-plugin-2": nonPreloadPlugin,
	}}
	catalogServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodGet, r.Method)
		require.Equal(t, "application/json", r.Header.Get("Accept"))
		require.Equal(t, "grafana-plugins-app", r.Header.Get("User-Agent"))

		segments := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		require.Len(t, segments, 5)
		require.Equal(t, "api", segments[0])
		require.Equal(t, "plugins", segments[1])
		require.Equal(t, "versions", segments[3])

		preload := true
		response := struct {
			PluginID string                       `json:"pluginSlug"`
			Version  string                       `json:"version"`
			JSON     pluginsv0alpha1.MetaJSONData `json:"json"`
		}{
			PluginID: segments[2],
			Version:  segments[4],
			JSON: pluginsv0alpha1.MetaJSONData{
				Id:      segments[2],
				Name:    segments[2],
				Type:    pluginsv0alpha1.MetaJSONDataTypeDatasource,
				Preload: &preload,
			},
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		require.NoError(t, json.NewEncoder(w).Encode(response))
	}))
	defer catalogServer.Close()
	provider := meta.NewLocalProvider(store, mockPluginAssets{})
	provider2 := meta.NewLocalProvider(store2, mockPluginAssets{})
	catalogProvider := meta.NewCatalogProvider(catalogServer.URL + "/api/plugins")
	metaManager := meta.NewProviderManager(provider2, provider, catalogProvider)

	pluginClient := pluginsv0alpha1.NewPluginClient(&mockResourceClient{
		listFunc: func(ctx context.Context, namespace string, opts resource.ListOptions) (resource.ListObject, error) {
			return newPluginList(), nil
		},
	})

	storage := NewMetaStorage(metaManager, func(ctx context.Context) (*pluginsv0alpha1.PluginClient, error) {
		return pluginClient, nil
	})

	obj, err := storage.List(ctx, nil)
	require.NoError(t, err)

	metaList, ok := obj.(*pluginsv0alpha1.MetaList)
	require.True(t, ok)
	require.Len(t, metaList.Items, 3)

	require.NotNil(t, metaList.Items[0].Spec.PluginJson.Preload)
	require.True(t, *metaList.Items[0].Spec.PluginJson.Preload)
	require.NotNil(t, metaList.Items[1].Spec.PluginJson.Preload)
	require.True(t, *metaList.Items[1].Spec.PluginJson.Preload)
	require.Nil(t, metaList.Items[2].Spec.PluginJson.Preload)

	obj, err = storage.List(ctx, nil)
	require.NoError(t, err)
	metaList, ok = obj.(*pluginsv0alpha1.MetaList)
	require.True(t, ok)
	require.Len(t, metaList.Items, 3)
	require.NotNil(t, metaList.Items[0].Spec.PluginJson.Preload)
	require.True(t, *metaList.Items[0].Spec.PluginJson.Preload)
	require.NotNil(t, metaList.Items[1].Spec.PluginJson.Preload)
	require.True(t, *metaList.Items[1].Spec.PluginJson.Preload)
	require.Nil(t, metaList.Items[2].Spec.PluginJson.Preload)
}

type mockPluginAssets struct{}

func (mockPluginAssets) LoadingStrategy(ctx context.Context, p pluginstore.Plugin) plugins.LoadingStrategy {
	return plugins.LoadingStrategyFetch
}

func (mockPluginAssets) ModuleHash(ctx context.Context, p pluginstore.Plugin) string {
	return "hash"
}

type mockPluginStore struct {
	plugins map[string]pluginstore.Plugin
}

func (m *mockPluginStore) Plugin(ctx context.Context, pluginID string) (pluginstore.Plugin, bool) {
	if m.plugins[pluginID].ID != pluginID {
		return pluginstore.Plugin{}, false
	}
	return m.plugins[pluginID], true
}

func (m *mockPluginStore) Plugins(ctx context.Context, pluginTypes ...plugins.Type) []pluginstore.Plugin {
	result := []pluginstore.Plugin{}
	for _, plugin := range m.plugins {
		if len(pluginTypes) == 0 || slices.Contains(pluginTypes, plugin.Type) {
			result = append(result, plugin)
		}
	}
	return result
}

func newPluginList() *pluginsv0alpha1.PluginList {
	return &pluginsv0alpha1.PluginList{
		Items: []pluginsv0alpha1.Plugin{
			{
				ObjectMeta: metav1.ObjectMeta{Name: "grafana-plugins-app", Namespace: "org-1"},
				Spec:       pluginsv0alpha1.PluginSpec{Id: "grafana-plugins-app", Version: "1.0.0"},
			},
			{
				ObjectMeta: metav1.ObjectMeta{Name: "test-plugin", Namespace: "org-1"},
				Spec:       pluginsv0alpha1.PluginSpec{Id: "test-plugin", Version: "1.0.0"},
			},
			{
				ObjectMeta: metav1.ObjectMeta{Name: "test-plugin-2", Namespace: "org-1"},
				Spec:       pluginsv0alpha1.PluginSpec{Id: "test-plugin-2", Version: "1.0.0"},
			},
		},
	}
}

type mockResourceClient struct {
	listFunc func(ctx context.Context, namespace string, opts resource.ListOptions) (resource.ListObject, error)
}

func (m *mockResourceClient) List(ctx context.Context, namespace string, opts resource.ListOptions) (resource.ListObject, error) {
	if m.listFunc != nil {
		return m.listFunc(ctx, namespace, opts)
	}
	return &pluginsv0alpha1.PluginList{}, nil
}

func (m *mockResourceClient) ListInto(ctx context.Context, namespace string, opts resource.ListOptions, into resource.ListObject) error {
	list, err := m.List(ctx, namespace, opts)
	if err != nil {
		return err
	}
	if src, ok := list.(*pluginsv0alpha1.PluginList); ok {
		if dst, ok := into.(*pluginsv0alpha1.PluginList); ok {
			*dst = *src
		}
	}
	return nil
}

func (m *mockResourceClient) Get(ctx context.Context, identifier resource.Identifier) (resource.Object, error) {
	return nil, nil
}

func (m *mockResourceClient) GetInto(ctx context.Context, identifier resource.Identifier, into resource.Object) error {
	return nil
}

func (m *mockResourceClient) Create(ctx context.Context, identifier resource.Identifier, obj resource.Object, opts resource.CreateOptions) (resource.Object, error) {
	return nil, nil
}

func (m *mockResourceClient) CreateInto(ctx context.Context, identifier resource.Identifier, obj resource.Object, opts resource.CreateOptions, into resource.Object) error {
	return nil
}

func (m *mockResourceClient) Update(ctx context.Context, identifier resource.Identifier, obj resource.Object, opts resource.UpdateOptions) (resource.Object, error) {
	return nil, nil
}

func (m *mockResourceClient) UpdateInto(ctx context.Context, identifier resource.Identifier, obj resource.Object, opts resource.UpdateOptions, into resource.Object) error {
	return nil
}

func (m *mockResourceClient) Patch(ctx context.Context, identifier resource.Identifier, patch resource.PatchRequest, opts resource.PatchOptions) (resource.Object, error) {
	return nil, nil
}

func (m *mockResourceClient) PatchInto(ctx context.Context, identifier resource.Identifier, patch resource.PatchRequest, opts resource.PatchOptions, into resource.Object) error {
	return nil
}

func (m *mockResourceClient) Delete(ctx context.Context, identifier resource.Identifier, opts resource.DeleteOptions) error {
	return nil
}

func (m *mockResourceClient) SubresourceRequest(ctx context.Context, identifier resource.Identifier, req resource.CustomRouteRequestOptions) ([]byte, error) {
	return nil, nil
}

func (m *mockResourceClient) Watch(ctx context.Context, namespace string, opts resource.WatchOptions) (resource.WatchResponse, error) {
	return &mockWatchResponse{}, nil
}

type mockWatchResponse struct{}

func (m *mockWatchResponse) Stop() {}

func (m *mockWatchResponse) WatchEvents() <-chan resource.WatchEvent {
	ch := make(chan resource.WatchEvent)
	close(ch)
	return ch
}

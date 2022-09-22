package updatechecker

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
)

func TestPluginUpdateChecker_HasUpdate(t *testing.T) {
	t.Run("update is available", func(t *testing.T) {
		svc := PluginsService{
			availableUpdates: map[string]string{
				"test-ds": "1.0.0",
			},
			pluginStore: fakePluginStore{
				plugins: map[string]plugins.PluginDTO{
					"test-ds": {
						JSONData: plugins.JSONData{
							Info: plugins.Info{Version: "0.9.0"},
						},
					},
				},
			},
		}

		update, exists := svc.HasUpdate(context.Background(), "test-ds")
		require.True(t, exists)
		require.Equal(t, "1.0.0", update)
	})

	t.Run("update is not available", func(t *testing.T) {
		svc := PluginsService{
			availableUpdates: map[string]string{
				"test-panel": "0.9.0",
				"test-app":   "0.0.1",
			},
			pluginStore: fakePluginStore{
				plugins: map[string]plugins.PluginDTO{
					"test-ds": {
						JSONData: plugins.JSONData{
							Info: plugins.Info{Version: "0.9.0"},
						},
					},
					"test-panel": {
						JSONData: plugins.JSONData{
							Info: plugins.Info{Version: "0.9.0"},
						},
					},
					"test-app": {
						JSONData: plugins.JSONData{
							Info: plugins.Info{Version: "0.9.0"},
						},
					},
				},
			},
		}

		update, exists := svc.HasUpdate(context.Background(), "test-ds")
		require.False(t, exists)
		require.Empty(t, update)

		update, exists = svc.HasUpdate(context.Background(), "test-panel")
		require.False(t, exists)
		require.Empty(t, update)

		update, exists = svc.HasUpdate(context.Background(), "test-app")
		require.False(t, exists)
		require.Empty(t, update)
	})

	t.Run("update is available but plugin is not in store", func(t *testing.T) {
		svc := PluginsService{
			availableUpdates: map[string]string{
				"test-panel": "0.9.0",
			},
			pluginStore: fakePluginStore{
				plugins: map[string]plugins.PluginDTO{
					"test-ds": {
						JSONData: plugins.JSONData{
							Info: plugins.Info{Version: "1.0.0"},
						},
					},
				},
			},
		}

		update, exists := svc.HasUpdate(context.Background(), "test-panel")
		require.False(t, exists)
		require.Empty(t, update)

		update, exists = svc.HasUpdate(context.Background(), "test-ds")
		require.False(t, exists)
		require.Empty(t, update)
	})
}

func TestPluginUpdateChecker_checkForUpdates(t *testing.T) {
	t.Run("update is available", func(t *testing.T) {
		jsonResp := `[
		  {
			"slug": "test-ds",
			"version": "1.0.12"
		  },
		  {
			"slug": "test-panel",
			"version": "2.5.7"
		  },
		  {
			"slug": "test-core-panel",
			"version": "1.0.0"
		  }
		]`

		svc := PluginsService{
			availableUpdates: map[string]string{
				"test-app": "1.0.0",
			},
			pluginStore: fakePluginStore{
				plugins: map[string]plugins.PluginDTO{
					"test-ds": {
						JSONData: plugins.JSONData{
							ID:   "test-ds",
							Info: plugins.Info{Version: "0.9.0"},
						},
					},
					"test-app": {
						JSONData: plugins.JSONData{
							ID:   "test-app",
							Info: plugins.Info{Version: "0.5.0"},
						},
					},
					"test-panel": {
						JSONData: plugins.JSONData{
							ID:   "test-panel",
							Info: plugins.Info{Version: "2.5.7"},
						},
					},
					"test-core-panel": {
						Class: plugins.Core,
						JSONData: plugins.JSONData{
							ID:   "test-core-panel",
							Info: plugins.Info{Version: "0.0.1"},
						},
					},
				},
			},
			httpClient: &fakeHTTPClient{
				fakeResp: jsonResp,
			},
			log: log.NewNopLogger(),
		}

		svc.checkForUpdates(context.Background())

		require.Equal(t, 1, len(svc.availableUpdates))

		require.Equal(t, "1.0.12", svc.availableUpdates["test-ds"])
		update, exists := svc.HasUpdate(context.Background(), "test-ds")
		require.True(t, exists)
		require.Equal(t, "1.0.12", update)

		require.Empty(t, svc.availableUpdates["test-app"])
		update, exists = svc.HasUpdate(context.Background(), "test-app")
		require.False(t, exists)
		require.Empty(t, update)

		require.Empty(t, svc.availableUpdates["test-panel"])
		update, exists = svc.HasUpdate(context.Background(), "test-panel")
		require.False(t, exists)
		require.Empty(t, update)

		require.Empty(t, svc.availableUpdates["test-core-panel"])
	})
}

type fakeHTTPClient struct {
	fakeResp string

	requestURL string
}

func (c *fakeHTTPClient) Get(url string) (*http.Response, error) {
	c.requestURL = url

	resp := &http.Response{
		Body: io.NopCloser(strings.NewReader(c.fakeResp)),
	}

	return resp, nil
}

type fakePluginStore struct {
	plugins.Store

	plugins map[string]plugins.PluginDTO
}

func (pr fakePluginStore) Plugin(_ context.Context, pluginID string) (plugins.PluginDTO, bool) {
	p, exists := pr.plugins[pluginID]

	return p, exists
}

func (pr fakePluginStore) Plugins(_ context.Context, _ ...plugins.Type) []plugins.PluginDTO {
	var result []plugins.PluginDTO
	for _, p := range pr.plugins {
		result = append(result, p)
	}
	return result
}

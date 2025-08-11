package dashboard

import (
	"context"
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
)

func TestPluginStorePanelProvider_GetPanels(t *testing.T) {
	tests := []struct {
		name           string
		plugins        []pluginstore.Plugin
		buildVersion   string
		expectedPanels []schemaversion.PanelPluginInfo
	}{
		{
			name: "should return all panel plugins with their versions",
			plugins: []pluginstore.Plugin{
				{
					JSONData: plugins.JSONData{ID: "gauge", Info: plugins.Info{Version: "1.0.0"}},
				},
				{
					JSONData: plugins.JSONData{ID: "stat", Info: plugins.Info{Version: "2.0.0"}},
				},
				{
					JSONData: plugins.JSONData{ID: "timeseries", Info: plugins.Info{Version: "3.0.0"}},
				},
			},
			buildVersion: "10.0.0",
			expectedPanels: []schemaversion.PanelPluginInfo{
				{ID: "gauge", Version: "1.0.0"},
				{ID: "stat", Version: "2.0.0"},
				{ID: "timeseries", Version: "3.0.0"},
			},
		},
		{
			name: "should use build version when plugin version is empty",
			plugins: []pluginstore.Plugin{
				{
					JSONData: plugins.JSONData{ID: "gauge", Info: plugins.Info{Version: ""}},
				},
				{
					JSONData: plugins.JSONData{ID: "stat", Info: plugins.Info{Version: "2.0.0"}},
				},
			},
			buildVersion: "10.0.0",
			expectedPanels: []schemaversion.PanelPluginInfo{
				{ID: "gauge", Version: "10.0.0"},
				{ID: "stat", Version: "2.0.0"},
			},
		},
		{
			name:           "should return empty slice when no plugins",
			plugins:        []pluginstore.Plugin{},
			buildVersion:   "10.0.0",
			expectedPanels: []schemaversion.PanelPluginInfo{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create mock plugin store
			mockStore := &mockPluginStore{
				plugins: tt.plugins,
			}

			// Create mock setting
			mockSetting := &setting.Cfg{
				BuildVersion: tt.buildVersion,
			}

			// Create provider
			provider := &PluginStorePanelProvider{
				pluginStore:  mockStore,
				buildVersion: mockSetting.BuildVersion,
			}

			// Call the function
			result := provider.GetPanels()

			// Assert results
			assert.Len(t, result, len(tt.expectedPanels))
			for i, expected := range tt.expectedPanels {
				assert.Equal(t, expected.ID, result[i].ID)
				assert.Equal(t, expected.Version, result[i].Version)
			}
		})
	}
}

func TestPluginStorePanelProvider_GetPanelPlugin(t *testing.T) {
	tests := []struct {
		name          string
		plugins       []pluginstore.Plugin
		buildVersion  string
		searchID      string
		expectedPanel schemaversion.PanelPluginInfo
	}{
		{
			name: "should return panel plugin when found",
			plugins: []pluginstore.Plugin{
				{
					JSONData: plugins.JSONData{ID: "gauge", Info: plugins.Info{Version: "1.0.0"}},
				},
				{
					JSONData: plugins.JSONData{ID: "stat", Info: plugins.Info{Version: "2.0.0"}},
				},
			},
			buildVersion: "10.0.0",
			searchID:     "stat",
			expectedPanel: schemaversion.PanelPluginInfo{
				ID:      "stat",
				Version: "2.0.0",
			},
		},
		{
			name: "should return panel plugin with build version when plugin version is empty",
			plugins: []pluginstore.Plugin{
				{
					JSONData: plugins.JSONData{ID: "gauge", Info: plugins.Info{Version: ""}},
				},
			},
			buildVersion: "10.0.0",
			searchID:     "gauge",
			expectedPanel: schemaversion.PanelPluginInfo{
				ID:      "gauge",
				Version: "10.0.0",
			},
		},
		{
			name: "should return empty panel plugin when not found",
			plugins: []pluginstore.Plugin{
				{
					JSONData: plugins.JSONData{ID: "gauge", Info: plugins.Info{Version: "1.0.0"}},
				},
			},
			buildVersion:  "10.0.0",
			searchID:      "nonexistent",
			expectedPanel: schemaversion.PanelPluginInfo{},
		},
		{
			name:          "should return empty panel plugin when no plugins exist",
			plugins:       []pluginstore.Plugin{},
			buildVersion:  "10.0.0",
			searchID:      "gauge",
			expectedPanel: schemaversion.PanelPluginInfo{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockStore := &mockPluginStore{
				plugins: tt.plugins,
			}

			mockSetting := &setting.Cfg{
				BuildVersion: tt.buildVersion,
			}

			provider := &PluginStorePanelProvider{
				pluginStore:  mockStore,
				buildVersion: mockSetting.BuildVersion,
			}

			result := provider.GetPanelPlugin(tt.searchID)

			assert.Equal(t, tt.expectedPanel.ID, result.ID)
			assert.Equal(t, tt.expectedPanel.Version, result.Version)
		})
	}
}

type mockPluginStore struct {
	plugins []pluginstore.Plugin
}

func (m *mockPluginStore) Plugin(ctx context.Context, pluginID string) (pluginstore.Plugin, bool) {
	for _, p := range m.plugins {
		if p.ID == pluginID {
			return p, true
		}
	}
	return pluginstore.Plugin{}, false
}

func (m *mockPluginStore) Plugins(ctx context.Context, pluginTypes ...plugins.Type) []pluginstore.Plugin {
	return m.plugins
}

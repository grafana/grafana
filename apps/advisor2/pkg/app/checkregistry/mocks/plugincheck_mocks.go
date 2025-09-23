package mocks

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginchecker"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

// Mocks for plugin checks

// mockPluginStore implements pluginstore.Store interface for testing
type mockPluginStore struct {
	pluginstore.Store
}

func (s *mockPluginStore) Plugin(ctx context.Context, pluginID string) (pluginstore.Plugin, bool) {
	return pluginstore.Plugin{
		JSONData: plugins.JSONData{
			ID:   "prometheus",
			Type: plugins.TypeDataSource,
			Name: "Prometheus",
			Info: plugins.Info{
				Author: plugins.InfoLink{
					Name: "Grafana Labs",
				},
				Version: "10.0.0",
			},
			Category: "Time series databases",
			State:    plugins.ReleaseStateAlpha,
			Backend:  true,
			Metrics:  true,
			Logs:     true,
			Alerting: true,
			Explore:  true,
		},
		Class:         plugins.ClassCore,
		Signature:     plugins.SignatureStatusInternal,
		SignatureType: plugins.SignatureTypeGrafana,
		SignatureOrg:  "grafana.com",
	}, false
}

func (s *mockPluginStore) Plugins(ctx context.Context, pluginTypes ...plugins.Type) []pluginstore.Plugin {
	return []pluginstore.Plugin{

		{
			JSONData: plugins.JSONData{
				ID:   "grafana-piechart-panel",
				Type: plugins.TypePanel,
				Name: "Pie Chart",
				Info: plugins.Info{
					Author: plugins.InfoLink{
						Name: "Grafana Labs",
					},
					Version: "1.6.0",
				},
				Category: "Visualization",
				State:    plugins.ReleaseStateAlpha,
			},
			Class:         plugins.ClassCore,
			Signature:     plugins.SignatureStatusInternal,
			SignatureType: plugins.SignatureTypeGrafana,
			SignatureOrg:  "grafana.com",
		},
		{
			JSONData: plugins.JSONData{
				ID:   "prometheus",
				Type: plugins.TypeDataSource,
				Name: "Prometheus",
				Info: plugins.Info{
					Author: plugins.InfoLink{
						Name: "Grafana Labs",
					},
					Version: "10.0.0",
				},
				Category: "Time series databases",
				State:    plugins.ReleaseStateAlpha,
				Backend:  true,
				Metrics:  true,
				Logs:     true,
				Alerting: true,
				Explore:  true,
			},
			Class:         plugins.ClassCore,
			Signature:     plugins.SignatureStatusInternal,
			SignatureType: plugins.SignatureTypeGrafana,
			SignatureOrg:  "grafana.com",
		},
		{
			JSONData: plugins.JSONData{
				ID:   "test-datasource",
				Type: plugins.TypeDataSource,
				Name: "Test Datasource",
				Info: plugins.Info{
					Author: plugins.InfoLink{
						Name: "Test Author",
					},
					Version: "1.0.0",
				},
				Category: "Other",
				State:    plugins.ReleaseStateAlpha,
				Backend:  true,
				Metrics:  true,
			},
			Class:         plugins.ClassExternal,
			Signature:     plugins.SignatureStatusValid,
			SignatureType: plugins.SignatureTypeCommunity,
			SignatureOrg:  "test.com",
		},
		{
			JSONData: plugins.JSONData{
				ID:   "test-app",
				Type: plugins.TypeApp,
				Name: "Test App",
				Info: plugins.Info{
					Author: plugins.InfoLink{
						Name: "Test Author",
					},
					Version: "2.0.0",
				},
				Category:    "Application",
				State:       plugins.ReleaseStateAlpha,
				AutoEnabled: true,
			},
			Class:         plugins.ClassExternal,
			Signature:     plugins.SignatureStatusValid,
			SignatureType: plugins.SignatureTypeCommercial,
			SignatureOrg:  "test.com",
		},
	}
}

type mockPluginRepo struct {
	repo.Service
}

// ACTUALLY USED by plugincheck.Init()
func (m *mockPluginRepo) GetPluginsInfo(ctx context.Context, options repo.GetPluginsInfoOptions, compatOpts repo.CompatOpts) ([]repo.PluginInfo, error) {
	// Return sample plugin info for testing
	return []repo.PluginInfo{
		{
			ID:      1,
			Slug:    "grafana-piechart-panel",
			Version: "1.6.0",
		},
		{
			ID:      2,
			Slug:    "prometheus",
			Version: "10.0.0",
		},
	}, nil
}

type mockUpdateChecker struct {
	pluginchecker.PluginUpdateChecker
}

type mockPluginErrorResolver struct {
	plugins.ErrorResolver
}

// ACTUALLY USED by plugincheck.Items()
func (m *mockPluginErrorResolver) PluginError(ctx context.Context, pluginID string) *plugins.Error {
	// Return nil for most plugins (no errors)
	if pluginID == "test-error-plugin" {
		return &plugins.Error{
			ErrorCode: "PLUGIN_ERROR",
			PluginID:  pluginID,
		}
	}
	return nil
}

// ACTUALLY USED by plugincheck.Items()
func (m *mockPluginErrorResolver) PluginErrors(ctx context.Context) []*plugins.Error {
	// Return sample plugin errors for testing
	return []*plugins.Error{
		{
			ErrorCode: "PLUGIN_ERROR",
			PluginID:  "test-error-plugin",
		},
	}
}

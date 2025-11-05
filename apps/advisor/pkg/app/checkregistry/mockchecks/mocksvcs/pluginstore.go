package mocksvcs

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

type PluginStore struct {
}

var ps = map[string]pluginstore.Plugin{
	"prometheus": {
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
	"test-datasource": {
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
	"grafana-piechart-panel": {
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
	"test-app": {
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

func (s *PluginStore) Plugin(ctx context.Context, pluginID string) (pluginstore.Plugin, bool) {
	p, ok := ps[pluginID]
	return p, ok
}

func (s *PluginStore) Plugins(ctx context.Context, pluginTypes ...plugins.Type) []pluginstore.Plugin {
	plugins := make([]pluginstore.Plugin, 0, len(ps))
	for _, p := range ps {
		plugins = append(plugins, p)
	}
	return plugins
}

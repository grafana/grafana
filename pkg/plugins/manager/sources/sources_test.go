package sources

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/setting"
)

func TestSources_List(t *testing.T) {
	t.Run("Plugin sources are added in order", func(t *testing.T) {
		cfg := &setting.Cfg{
			BundledPluginsPath: "path1",
		}
		pCfg := &config.Cfg{
			PluginsPath: "path2",
			PluginSettings: setting.PluginSettings{
				"foo": map[string]string{
					"path": "path3",
				},
				"bar": map[string]string{
					"url": "https://grafana.plugin",
				},
			},
		}

		s := ProvideService(cfg, pCfg)
		srcs := s.List(context.Background())

		expected := []plugins.PluginSource{
			{Class: plugins.Core, Paths: []string{"app/plugins/datasource", "app/plugins/panel"}},
			{Class: plugins.Bundled, Paths: []string{"path1"}},
			{Class: plugins.External, Paths: []string{"path2", "path3"}},
		}
		require.Equal(t, expected, srcs)
	})
}

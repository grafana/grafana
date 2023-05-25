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
	t.Run("Plugin sources are populated by default and listed in specific order", func(t *testing.T) {
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

		ctx := context.Background()

		require.Len(t, srcs, 3)

		require.Equal(t, srcs[0].PluginClass(ctx), plugins.Core)
		require.Equal(t, srcs[0].PluginURIs(ctx), []string{"app/plugins/datasource", "app/plugins/panel"})
		sig, exists := srcs[0].DefaultSignature(ctx)
		require.True(t, exists)
		require.Equal(t, plugins.SignatureInternal, sig.Status)
		require.Equal(t, plugins.SignatureType(""), sig.Type)
		require.Equal(t, "", sig.SigningOrg)

		require.Equal(t, srcs[1].PluginClass(ctx), plugins.Bundled)
		require.Equal(t, srcs[1].PluginURIs(ctx), []string{"path1"})
		sig, exists = srcs[1].DefaultSignature(ctx)
		require.False(t, exists)
		require.Equal(t, plugins.Signature{}, sig)

		require.Equal(t, srcs[2].PluginClass(ctx), plugins.External)
		require.Equal(t, srcs[2].PluginURIs(ctx), []string{"path2", "path3"})
		sig, exists = srcs[2].DefaultSignature(ctx)
		require.False(t, exists)
		require.Equal(t, plugins.Signature{}, sig)
	})
}

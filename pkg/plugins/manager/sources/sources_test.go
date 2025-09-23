package sources

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

func TestSources_List(t *testing.T) {
	t.Run("Plugin sources are populated by default and listed in specific order", func(t *testing.T) {
		testdata, err := filepath.Abs("../testdata")
		require.NoError(t, err)

		cfg := &setting.Cfg{
			StaticRootPath: testdata,
			PluginsPath:    filepath.Join(testdata, "pluginRootWithDist"),
			PluginSettings: setting.PluginSettings{
				"foo": map[string]string{
					"path": filepath.Join(testdata, "test-app"),
				},
				"bar": map[string]string{
					"url": "https://grafana.plugin",
				},
			},
		}

		s := ProvideService(cfg)
		srcs := s.List(context.Background())

		ctx := context.Background()

		require.Len(t, srcs, 5)

		require.Equal(t, srcs[0].PluginClass(ctx), plugins.ClassCore)
		require.Equal(t, srcs[0].PluginURIs(ctx), []string{
			filepath.Join(testdata, "app", "plugins", "datasource"),
			filepath.Join(testdata, "app", "plugins", "panel"),
		})
		sig, exists := srcs[0].DefaultSignature(ctx, "")
		require.True(t, exists)
		require.Equal(t, plugins.SignatureStatusInternal, sig.Status)
		require.Equal(t, plugins.SignatureType(""), sig.Type)
		require.Equal(t, "", sig.SigningOrg)

		require.Equal(t, srcs[1].PluginClass(ctx), plugins.ClassExternal)
		require.Equal(t, srcs[1].PluginURIs(ctx), []string{
			filepath.Join(testdata, "pluginRootWithDist", "datasource"),
		})
		sig, exists = srcs[1].DefaultSignature(ctx, "")
		require.False(t, exists)
		require.Equal(t, plugins.Signature{}, sig)

		require.Equal(t, srcs[2].PluginClass(ctx), plugins.ClassExternal)
		require.Equal(t, srcs[2].PluginURIs(ctx), []string{
			filepath.Join(testdata, "pluginRootWithDist", "dist"),
		})
		sig, exists = srcs[2].DefaultSignature(ctx, "")
		require.False(t, exists)
		require.Equal(t, plugins.Signature{}, sig)

		require.Equal(t, srcs[3].PluginClass(ctx), plugins.ClassExternal)
		require.Equal(t, srcs[3].PluginURIs(ctx), []string{
			filepath.Join(testdata, "pluginRootWithDist", "panel"),
		})
		sig, exists = srcs[3].DefaultSignature(ctx, "")
		require.False(t, exists)
		require.Equal(t, plugins.Signature{}, sig)
	})

	t.Run("Plugin sources are populated with symbolic links", func(t *testing.T) {
		testdata, err := filepath.Abs("../testdata")
		require.NoError(t, err)

		cfg := &setting.Cfg{
			StaticRootPath: testdata,
			PluginsPath:    filepath.Join(testdata, "symbolic-plugin-dirs"),
		}
		s := ProvideService(cfg)
		ctx := context.Background()
		srcs := s.List(ctx)
		uris := map[plugins.Class]map[string]struct{}{}
		for _, s := range srcs {
			class := s.PluginClass(ctx)
			if _, exists := uris[class]; !exists {
				uris[class] = map[string]struct{}{}
			}
			for _, uri := range s.PluginURIs(ctx) {
				uris[class][uri] = struct{}{}
			}
		}

		require.Equal(t, uris[plugins.ClassCore], map[string]struct{}{
			filepath.Join(testdata, "app", "plugins", "datasource"): {},
			filepath.Join(testdata, "app", "plugins", "panel"):      {},
		}, "should include core plugins")

		require.Equal(t, uris[plugins.ClassExternal], map[string]struct{}{
			filepath.Join(testdata, "symbolic-plugin-dirs", "plugin"): {},
		}, "should include external symlinked plugin")
	})
}

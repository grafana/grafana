package pluginsources

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/plugins/manager/sources/cdn"
	"github.com/grafana/grafana/pkg/plugins/pluginerrs"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/setting"
)

func TestSources_List(t *testing.T) {
	t.Run("A remote source is only listed, first, in dev mode and never as a local source", func(t *testing.T) {
		testdata := testDataDir(t)
		cfg := &setting.Cfg{StaticRootPath: testdata}

		countRemote := func(srcs []plugins.PluginSource) int {
			n := 0
			for _, src := range srcs {
				if _, ok := src.(*cdn.Source); ok {
					n++
				}
			}
			return n
		}

		for _, devMode := range []bool{false, true} {
			pCfg := &config.PluginManagementCfg{DevMode: devMode}
			s := ProvideService(cfg, pCfg, pluginscdn.ProvideService(pCfg), pluginerrs.ProvideErrorTracker())

			srcs := s.List(context.Background())
			require.Equal(t, map[bool]int{false: 0, true: 1}[devMode], countRemote(srcs), "devMode=%v", devMode)
			if devMode {
				_, ok := srcs[0].(*cdn.Source)
				require.True(t, ok, "the remote source is listed first")
			}
			require.Zero(t, countRemote(s.LocalSources(context.Background())), "devMode=%v", devMode)
		}
	})

	t.Run("Plugin sources are populated by default and listed in specific order", func(t *testing.T) {
		testdata := testDataDir(t)

		cfg := &setting.Cfg{
			StaticRootPath: testdata,
		}

		pCfg := &config.PluginManagementCfg{
			PluginsPaths: []string{filepath.Join(testdata, "pluginRootWithDist")},
			PluginSettings: config.PluginSettings{
				"foo": map[string]string{
					"path": filepath.Join(testdata, "test-app"),
				},
				"bar": map[string]string{
					"url": "https://grafana.plugin",
				},
			},
		}

		s := ProvideService(cfg, pCfg, pluginscdn.ProvideService(pCfg), pluginerrs.ProvideErrorTracker())
		srcs := s.List(context.Background())

		ctx := context.Background()

		require.Len(t, srcs, 5)

		require.Equal(t, srcs[0].PluginClass(ctx), plugins.ClassCore)
		if localSrc, ok := srcs[0].(*sources.LocalSource); ok {
			require.Equal(t, localSrc.Paths(), []string{
				filepath.Join(testdata, "app", "plugins", "datasource"),
				filepath.Join(testdata, "app", "plugins", "panel"),
			})
		} else {
			t.Fatalf("Expected LocalSource, got %T", srcs[0])
		}
		sig, exists := srcs[0].DefaultSignature(ctx, "")
		require.True(t, exists)
		require.Equal(t, plugins.SignatureStatusInternal, sig.Status)
		require.Equal(t, plugins.SignatureType(""), sig.Type)
		require.Equal(t, "", sig.SigningOrg)

		require.Equal(t, srcs[1].PluginClass(ctx), plugins.ClassExternal)
		if localSrc, ok := srcs[1].(*sources.LocalSource); ok {
			require.Equal(t, localSrc.Paths(), []string{
				filepath.Join(testdata, "pluginRootWithDist", "datasource"),
			})
		} else {
			t.Fatalf("Expected LocalSource, got %T", srcs[1])
		}
		sig, exists = srcs[1].DefaultSignature(ctx, "")
		require.False(t, exists)
		require.Equal(t, plugins.Signature{}, sig)

		require.Equal(t, srcs[2].PluginClass(ctx), plugins.ClassExternal)
		if localSrc, ok := srcs[2].(*sources.LocalSource); ok {
			require.Equal(t, localSrc.Paths(), []string{
				filepath.Join(testdata, "pluginRootWithDist", "dist"),
			})
		} else {
			t.Fatalf("Expected LocalSource, got %T", srcs[2])
		}
		sig, exists = srcs[2].DefaultSignature(ctx, "")
		require.False(t, exists)
		require.Equal(t, plugins.Signature{}, sig)

		require.Equal(t, srcs[3].PluginClass(ctx), plugins.ClassExternal)
		if localSrc, ok := srcs[3].(*sources.LocalSource); ok {
			require.Equal(t, localSrc.Paths(), []string{
				filepath.Join(testdata, "pluginRootWithDist", "panel"),
			})
		} else {
			t.Fatalf("Expected LocalSource, got %T", srcs[3])
		}
		sig, exists = srcs[3].DefaultSignature(ctx, "")
		require.False(t, exists)
		require.Equal(t, plugins.Signature{}, sig)
	})

	t.Run("Plugin sources are populated with symbolic links", func(t *testing.T) {
		testdata := testDataDir(t)
		cfg := &setting.Cfg{
			StaticRootPath: testdata,
		}

		pCfg := &config.PluginManagementCfg{
			PluginsPaths: []string{filepath.Join(testdata, "symbolic-plugin-dirs")},
		}

		s := ProvideService(cfg, pCfg, pluginscdn.ProvideService(pCfg), pluginerrs.ProvideErrorTracker())
		ctx := context.Background()
		srcs := s.List(ctx)
		uris := map[plugins.Class]map[string]struct{}{}
		for _, src := range srcs {
			class := src.PluginClass(ctx)
			if _, exists := uris[class]; !exists {
				uris[class] = map[string]struct{}{}
			}
			if localSrc, ok := src.(*sources.LocalSource); ok {
				for _, path := range localSrc.Paths() {
					uris[class][path] = struct{}{}
				}
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

func testDataDir(t *testing.T) string {
	dir, err := filepath.Abs("../../../plugins/manager/testdata")
	if err != nil {
		t.Errorf("could not construct absolute path of current dir")
		return ""
	}
	return dir
}

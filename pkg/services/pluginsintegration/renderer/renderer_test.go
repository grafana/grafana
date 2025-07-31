package renderer

import (
	"context"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
)

func TestRenderer(t *testing.T) {
	t.Run("Test Renderer will treat directories under plugins path as individual sources", func(t *testing.T) {
		testdataDir := filepath.Join("testdata", "plugins")

		numLoaded := 0
		numUnloaded := 0
		loader := &fakes.FakeLoader{
			LoadFunc: func(ctx context.Context, src plugins.PluginSource) ([]*plugins.Plugin, error) {
				require.True(t, src.PluginClass(ctx) == plugins.ClassExternal)

				if localSrc, ok := src.(*sources.LocalSource); ok {
					paths := localSrc.Paths()
					require.Len(t, paths, 1)
					require.True(t, strings.HasPrefix(paths[0], testdataDir))
				} else {
					t.Fatalf("Expected LocalSource, got %T", src)
				}

				numLoaded++
				return []*plugins.Plugin{}, nil
			},
			UnloadFunc: func(_ context.Context, _ *plugins.Plugin) (*plugins.Plugin, error) {
				numUnloaded++
				return nil, nil
			},
		}
		cfg := &config.PluginManagementCfg{PluginsPath: filepath.Join(testdataDir)}

		m := NewManager(cfg, loader)

		r, exists := m.Renderer(context.Background())
		require.False(t, exists)
		require.Equal(t, 3, numLoaded)
		require.Equal(t, 0, numUnloaded)
		require.Nil(t, r)
	})

	t.Run("Test Renderer load all directories until a plugin is returned", func(t *testing.T) {
		testdataDir := filepath.Join("testdata", "plugins")

		numLoaded := 0
		numUnloaded := 0
		p := &plugins.Plugin{
			JSONData: plugins.JSONData{ID: "test"},
		}
		loader := &fakes.FakeLoader{
			LoadFunc: func(ctx context.Context, src plugins.PluginSource) ([]*plugins.Plugin, error) {
				numLoaded++

				if localSrc, ok := src.(*sources.LocalSource); ok {
					paths := localSrc.Paths()
					if strings.HasPrefix(paths[0], filepath.Join(testdataDir, "renderer")) {
						return []*plugins.Plugin{p}, nil
					}
				} else {
					t.Fatalf("Expected LocalSource, got %T", src)
				}

				return []*plugins.Plugin{}, nil
			},
			UnloadFunc: func(_ context.Context, _ *plugins.Plugin) (*plugins.Plugin, error) {
				numUnloaded++
				return nil, nil
			},
		}
		cfg := &config.PluginManagementCfg{PluginsPath: filepath.Join(testdataDir)}

		m := NewManager(cfg, loader)

		r, exists := m.Renderer(context.Background())
		require.True(t, exists)
		require.Equal(t, 3, numLoaded)
		require.Equal(t, 0, numUnloaded)
		require.NotNil(t, r)
	})
}

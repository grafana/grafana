package pipeline

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
)

func TestSkipPlugins(t *testing.T) {
	cfg := &config.PluginManagementCfg{
		DisablePlugins: []string{"plugin1", "plugin2"},
	}
	s := NewDisablePluginsStep(cfg)

	bundles := []*plugins.FoundBundle{
		{
			Primary: plugins.FoundPlugin{
				JSONData: plugins.JSONData{
					ID: "plugin1",
				},
			},
		},
		{
			Primary: plugins.FoundPlugin{
				JSONData: plugins.JSONData{
					ID: "plugin2",
				},
			},
		},
		{
			Primary: plugins.FoundPlugin{
				JSONData: plugins.JSONData{
					ID: "plugin3",
				},
			},
		},
	}

	filtered, err := s.Filter(bundles)
	require.NoError(t, err)
	require.Len(t, filtered, 1)
	require.Equal(t, filtered[0].Primary.JSONData.ID, "plugin3")
}

func TestAsExternal(t *testing.T) {
	bundles := []*plugins.FoundBundle{
		{
			Primary: plugins.FoundPlugin{
				JSONData: plugins.JSONData{
					ID: "plugin1",
				},
			},
		},
		{
			Primary: plugins.FoundPlugin{
				JSONData: plugins.JSONData{
					ID: "plugin2",
				},
			},
		},
	}

	t.Run("should skip a core plugin when both as_external and ActiveExternalOverrides are set", func(t *testing.T) {
		cfg := &config.PluginManagementCfg{
			PluginSettings: config.PluginSettings{
				"plugin1": map[string]string{
					"as_external": "true",
				},
			},
			ActiveExternalOverrides: []config.ExternalOverride{
				{CorePluginID: "plugin1", ExternalPluginID: "external-plugin1"},
			},
		}

		s := NewAsExternalStep(cfg)
		filtered, err := s.Filter(plugins.ClassCore, bundles)
		require.NoError(t, err)
		require.Len(t, filtered, 1)
		require.Equal(t, filtered[0].Primary.JSONData.ID, "plugin2")
	})

	t.Run("should not skip a core plugin when as_external is set but ActiveExternalOverrides is empty", func(t *testing.T) {
		cfg := &config.PluginManagementCfg{
			PluginSettings: config.PluginSettings{
				"plugin1": map[string]string{
					"as_external": "true",
				},
			},
		}

		s := NewAsExternalStep(cfg)
		filtered, err := s.Filter(plugins.ClassCore, bundles)
		require.NoError(t, err)
		require.Len(t, filtered, 2)
	})
}

func TestDuplicatePluginIDValidation(t *testing.T) {
	tcs := []struct {
		name              string
		registeredPlugins []string
		in                []*plugins.FoundBundle
		out               []*plugins.FoundBundle
	}{
		{
			name:              "should filter out a plugin if it already exists in the plugin registry",
			registeredPlugins: []string{"foobar-datasource"},
			in: []*plugins.FoundBundle{
				{
					Primary: plugins.FoundPlugin{
						JSONData: plugins.JSONData{
							ID: "foobar-datasource",
						},
					},
				},
			},
			out: []*plugins.FoundBundle{},
		},
		{
			name:              "should not filter out a plugin if it doesn't exist in the plugin registry",
			registeredPlugins: []string{"foobar-datasource"},
			in: []*plugins.FoundBundle{
				{
					Primary: plugins.FoundPlugin{
						JSONData: plugins.JSONData{
							ID: "test-datasource",
						},
					},
				},
			},
			out: []*plugins.FoundBundle{
				{
					Primary: plugins.FoundPlugin{
						JSONData: plugins.JSONData{
							ID: "test-datasource",
						},
					},
				},
			},
		},
		{
			name:              "should filter out child plugins if they are already registered",
			registeredPlugins: []string{"foobar-datasource"},
			in: []*plugins.FoundBundle{
				{
					Primary: plugins.FoundPlugin{
						JSONData: plugins.JSONData{
							ID: "test-datasource",
						},
					},
					Children: []*plugins.FoundPlugin{
						{
							JSONData: plugins.JSONData{
								ID: "foobar-datasource",
							},
						},
					},
				},
			},
			out: []*plugins.FoundBundle{
				{
					Primary: plugins.FoundPlugin{
						JSONData: plugins.JSONData{
							ID: "test-datasource",
						},
					},
				},
			},
		},
	}
	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			r := registry.NewInMemory()
			s := NewDuplicatePluginIDFilterStep(r)

			ctx := context.Background()
			for _, pluginID := range tc.registeredPlugins {
				err := r.Add(ctx, &plugins.Plugin{
					JSONData: plugins.JSONData{
						ID: pluginID,
					},
				})
				require.NoError(t, err)
			}

			res, err := s.Filter(ctx, tc.in)
			require.NoError(t, err)
			require.Equal(t, tc.out, res)
		})
	}
}

func TestExternalPluginOverridesDecorateFunc(t *testing.T) {
	override := config.ExternalOverride{
		CorePluginID:     "canvas",
		ExternalPluginID: "grafana-canvas-panel",
	}

	newCanvasPanel := func() *plugins.Plugin {
		return &plugins.Plugin{JSONData: plugins.JSONData{ID: "grafana-canvas-panel"}}
	}
	newOtherPanel := func() *plugins.Plugin {
		return &plugins.Plugin{JSONData: plugins.JSONData{ID: "other-panel"}}
	}

	t.Run("injects core alias when override is active", func(t *testing.T) {
		p, err := ExternalPluginOverridesDecorateFunc([]config.ExternalOverride{override})(context.Background(), newCanvasPanel())
		require.NoError(t, err)
		require.Contains(t, p.AliasIDs, "canvas")
	})

	t.Run("does not inject alias when no overrides are active", func(t *testing.T) {
		p, err := ExternalPluginOverridesDecorateFunc(nil)(context.Background(), newCanvasPanel())
		require.NoError(t, err)
		require.NotContains(t, p.AliasIDs, "canvas")
	})

	t.Run("does not inject alias on non-matching plugins", func(t *testing.T) {
		p, err := ExternalPluginOverridesDecorateFunc([]config.ExternalOverride{override})(context.Background(), newOtherPanel())
		require.NoError(t, err)
		require.NotContains(t, p.AliasIDs, "canvas")
	})
}

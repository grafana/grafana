package pipeline

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/setting"
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

	t.Run("should skip a core plugin", func(t *testing.T) {
		cfg := &config.PluginManagementCfg{
			PluginSettings: setting.PluginSettings{
				"plugin1": map[string]string{
					"as_external": "true",
				},
			},
		}

		s := NewAsExternalStep(cfg)
		filtered, err := s.Filter(plugins.ClassCore, bundles)
		require.NoError(t, err)
		require.Len(t, filtered, 1)
		require.Equal(t, filtered[0].Primary.JSONData.ID, "plugin2")
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

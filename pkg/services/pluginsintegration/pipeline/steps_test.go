package pipeline

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func TestSkipPlugins(t *testing.T) {
	cfg := &config.Cfg{
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
		cfg := &config.Cfg{
			Features: featuremgmt.WithFeatures(featuremgmt.FlagExternalCorePlugins),
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

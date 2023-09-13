package discovery

import (
	"testing"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/stretchr/testify/require"
)

func TestSkipPlugins(t *testing.T) {
	cfg := &config.Cfg{
		SkipPlugins: []string{"plugin1", "plugin2"},
	}
	s := NewSkipPluginsStep(cfg)

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

package pluginexternal

import (
	"testing"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestService_validateExternal(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.PluginSettings = setting.PluginSettings{
		"grafana-testdata-datasource": map[string]string{
			"as_external": "true",
		},
	}

	t.Run("should not log error if core plugin is loaded as external", func(t *testing.T) {
		l := log.NewTestLogger()
		s := &Service{
			cfg:    cfg,
			logger: l,
			pluginStore: &pluginstore.FakePluginStore{
				PluginList: []pluginstore.Plugin{
					{
						JSONData: plugins.JSONData{
							ID: "grafana-testdata-datasource",
						},
					},
				},
			},
		}
		s.validateExternal()
		require.Equal(t, l.ErrorLogs.Calls, 0)
	})

	t.Run("should log error if a core plugin is missing", func(t *testing.T) {
		l := log.NewTestLogger()
		s := &Service{
			cfg:    cfg,
			logger: l,
			pluginStore: &pluginstore.FakePluginStore{
				PluginList: []pluginstore.Plugin{},
			},
		}
		s.validateExternal()
		require.Equal(t, l.ErrorLogs.Calls, 1)
		require.Contains(t, l.ErrorLogs.Message, "Core plugin expected to be loaded as external")
	})
}

package pluginscdn

import (
	"testing"

	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/stretchr/testify/require"
)

func TestService(t *testing.T) {
	svc := ProvideService(&config.Cfg{
		PluginsCDNURLTemplate: "https://cdn.example.com",
		PluginSettings: map[string]map[string]string{
			"one": {"cdn": "true"},
			"two": {},
		},
	})

	t.Run("IsCDNPlugin", func(t *testing.T) {
		require.True(t, svc.PluginSupported("one"))
		require.False(t, svc.PluginSupported("two"))
		require.False(t, svc.PluginSupported("unknown"))
	})

	t.Run("CDNBaseURL", func(t *testing.T) {
		for _, c := range []struct {
			name       string
			cfgURL     string
			expBaseURL string
		}{
			{
				name:       "valid",
				cfgURL:     "https://grafana-assets.grafana.net/plugin-cdn-test/plugin-cdn",
				expBaseURL: "https://grafana-assets.grafana.net/plugin-cdn-test/plugin-cdn",
			},
			{
				name:       "empty",
				cfgURL:     "",
				expBaseURL: "",
			},
		} {
			t.Run(c.name, func(t *testing.T) {
				u, err := ProvideService(&config.Cfg{PluginsCDNURLTemplate: c.cfgURL}).BaseURL()
				require.NoError(t, err)
				require.Equal(t, c.expBaseURL, u)
			})
		}
	})
}

package pluginscdn

import (
	"testing"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/stretchr/testify/require"
)

func extPath(pluginID string) string {
	return "/grafana/data/plugins/" + pluginID
}

func TestService(t *testing.T) {
	svc := ProvideService(&config.Cfg{
		PluginsCDNURLTemplate: "https://cdn.example.com/{id}/{version}/public/plugins/{id}/{assetPath}",
		PluginSettings: map[string]map[string]string{
			"one": {"cdn": "true"},
			"two": {},
		},
	})

	t.Run("IsCDNPlugin", func(t *testing.T) {
		require.True(t, svc.IsCDNPlugin("one"))
		require.False(t, svc.IsCDNPlugin("two"))
		require.False(t, svc.IsCDNPlugin("unknown"))
	})

	const tableOldPath = "/grafana/public/app/plugins/panel/table-old"
	jsonData := map[string]plugins.JSONData{
		"table-old": {ID: "table-old", Info: plugins.Info{Version: "1.0.0"}},

		"one": {ID: "one", Info: plugins.Info{Version: "1.0.0"}},
		"two": {ID: "two", Info: plugins.Info{Version: "2.0.0"}},
	}

	t.Run("Base", func(t *testing.T) {
		base, err := svc.Base(jsonData["one"], plugins.External, extPath("one"))
		require.NoError(t, err)
		require.Equal(t, "plugin-cdn/one/1.0.0/public/plugins/one", base)

		base, err = svc.Base(jsonData["two"], plugins.External, extPath("two"))
		require.NoError(t, err)
		require.Equal(t, "public/plugins/two", base)

		base, err = svc.Base(jsonData["table-old"], plugins.Core, tableOldPath)
		require.NoError(t, err)
		require.Equal(t, "public/app/plugins/table-old", base)
	})

	t.Run("Module", func(t *testing.T) {
		module, err := svc.Module(jsonData["one"], plugins.External, extPath("one"))
		require.NoError(t, err)
		require.Equal(t, "plugin-cdn/one/1.0.0/public/plugins/one/module", module)

		module, err = svc.Module(jsonData["two"], plugins.External, extPath("two"))
		require.NoError(t, err)
		require.Equal(t, "plugins/two/module", module)

		module, err = svc.Module(jsonData["table-old"], plugins.Core, tableOldPath)
		require.NoError(t, err)
		require.Equal(t, "app/plugins/table-old/module", module)
	})

	t.Run("RelativeURL", func(t *testing.T) {
		pluginsMap := map[string]*plugins.Plugin{
			"one": {
				JSONData: plugins.JSONData{ID: "one", Info: plugins.Info{Version: "1.0.0"}},
				BaseURL:  "plugin-cdn/one/1.0.0/public/pluginsMap/one",
			},
			"two": {
				JSONData: plugins.JSONData{ID: "two", Info: plugins.Info{Version: "2.0.0"}},
				BaseURL:  "public/pluginsMap/two",
			},
		}
		u, err := svc.RelativeURL(pluginsMap["one"], "", "default")
		require.NoError(t, err)
		require.Equal(t, "default", u)

		u, err = svc.RelativeURL(pluginsMap["one"], "path/to/file.txt", "default")
		require.NoError(t, err)
		require.Equal(t, "https://cdn.example.com/one/1.0.0/public/plugins/one/path/to/file.txt", u)

		u, err = svc.RelativeURL(pluginsMap["two"], "path/to/file.txt", "default")
		require.NoError(t, err)
		require.Equal(t, "public/pluginsMap/two/path/to/file.txt", u)

		u, err = svc.RelativeURL(pluginsMap["two"], "default", "default")
		require.NoError(t, err)
		require.Equal(t, "default", u)
	})

	t.Run("CDNBaseURL", func(t *testing.T) {
		for _, c := range []struct {
			name       string
			cfgURL     string
			expBaseURL string
			expError   error
		}{
			{
				name:       "valid",
				cfgURL:     "https://grafana-assets.grafana.net/plugin-cdn-test/plugin-cdn/{id}/{version}/public/plugins/{id}/{assetPath}",
				expBaseURL: "https://grafana-assets.grafana.net",
			},
			{
				name:     "empty",
				cfgURL:   "",
				expError: ErrCDNDisabled,
			},
		} {
			t.Run(c.name, func(t *testing.T) {
				u, err := ProvideService(&config.Cfg{PluginsCDNURLTemplate: c.cfgURL}).CDNBaseURL()
				require.Equal(t, c.expError, err)
				if c.expError == nil {
					require.Equal(t, c.expBaseURL, u)
				}
			})
		}
	})
}

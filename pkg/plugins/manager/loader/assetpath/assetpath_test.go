package assetpath

import (
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/stretchr/testify/require"
)

func extPath(pluginID string) string {
	return "/grafana/data/plugins/" + pluginID
}

func TestService(t *testing.T) {
	for _, tc := range []struct {
		name       string
		cdnBaseURL string
	}{
		{
			name:       "Simple",
			cdnBaseURL: "https://cdn.example.com",
		},
		{
			name:       "Not root",
			cdnBaseURL: "https://cdn.example.com/plugins",
		},
		{
			name:       "End slashes",
			cdnBaseURL: "https://cdn.example.com/plugins////",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			svc := ProvideService(pluginscdn.ProvideService(&config.Cfg{
				PluginsCDNURLTemplate: tc.cdnBaseURL,
				PluginSettings: map[string]map[string]string{
					"one": {"cdn": "true"},
					"two": {},
				},
			}))

			const tableOldPath = "/grafana/public/app/plugins/panel/table-old"
			jsonData := map[string]plugins.JSONData{
				"table-old": {ID: "table-old", Info: plugins.Info{Version: "1.0.0"}},

				"one": {ID: "one", Info: plugins.Info{Version: "1.0.0"}},
				"two": {ID: "two", Info: plugins.Info{Version: "2.0.0"}},
			}

			t.Run("CDN Base URL", func(t *testing.T) {
				base, err := svc.cdn.BaseURL()
				require.NoError(t, err)
				require.Equal(t, tc.cdnBaseURL, base)
			})

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
				require.Equal(t, strings.TrimRight(tc.cdnBaseURL, "/")+"/one/1.0.0/public/plugins/one/path/to/file.txt", u)

				u, err = svc.RelativeURL(pluginsMap["two"], "path/to/file.txt", "default")
				require.NoError(t, err)
				require.Equal(t, "public/pluginsMap/two/path/to/file.txt", u)

				u, err = svc.RelativeURL(pluginsMap["two"], "default", "default")
				require.NoError(t, err)
				require.Equal(t, "default", u)
			})
		})
	}
}

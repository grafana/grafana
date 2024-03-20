package assetpath

import (
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
)

func extPath(pluginID string) *fakes.FakePluginFiles {
	return fakes.NewFakePluginFiles(pluginID)
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
			cfg := &config.PluginManagementCfg{
				PluginsCDNURLTemplate: tc.cdnBaseURL,
				PluginSettings: map[string]map[string]string{
					"one": {"cdn": "true"},
					"two": {},
				},
			}
			svc := ProvideService(cfg, pluginscdn.ProvideService(cfg))

			tableOldFS := fakes.NewFakePluginFiles("/grafana/public/app/plugins/panel/table-old")
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
				base, err := svc.Base(NewPluginInfo(jsonData["one"], plugins.ClassExternal, extPath("one")))
				require.NoError(t, err)

				u, err := url.JoinPath(tc.cdnBaseURL, "/one/1.0.0/public/plugins/one")
				require.NoError(t, err)
				require.Equal(t, u, base)

				base, err = svc.Base(NewPluginInfo(jsonData["two"], plugins.ClassExternal, extPath("two")))
				require.NoError(t, err)
				require.Equal(t, "public/plugins/two", base)

				base, err = svc.Base(NewPluginInfo(jsonData["table-old"], plugins.ClassCore, tableOldFS))
				require.NoError(t, err)
				require.Equal(t, "public/app/plugins/table-old", base)
			})

			t.Run("Module", func(t *testing.T) {
				module, err := svc.Module(NewPluginInfo(jsonData["one"], plugins.ClassExternal, extPath("one")))
				require.NoError(t, err)

				u, err := url.JoinPath(tc.cdnBaseURL, "/one/1.0.0/public/plugins/one/module.js")
				require.NoError(t, err)
				require.Equal(t, u, module)

				module, err = svc.Module(NewPluginInfo(jsonData["two"], plugins.ClassExternal, extPath("two")))
				require.NoError(t, err)
				require.Equal(t, "public/plugins/two/module.js", module)

				module, err = svc.Module(NewPluginInfo(jsonData["table-old"], plugins.ClassCore, tableOldFS))
				require.NoError(t, err)
				require.Equal(t, "core:plugin/table-old", module)
			})

			t.Run("RelativeURL", func(t *testing.T) {
				pluginsMap := map[string]*plugins.Plugin{
					"one": {
						JSONData: plugins.JSONData{ID: "one", Info: plugins.Info{Version: "1.0.0"}},
					},
					"two": {
						JSONData: plugins.JSONData{ID: "two", Info: plugins.Info{Version: "2.0.0"}},
					},
				}

				u, err := svc.RelativeURL(NewPluginInfo(pluginsMap["one"].JSONData, plugins.ClassExternal, extPath("one")), "")
				require.NoError(t, err)
				// given an empty path, base URL will be returned
				baseURL, err := svc.Base(NewPluginInfo(pluginsMap["one"].JSONData, plugins.ClassExternal, extPath("one")))
				require.NoError(t, err)
				require.Equal(t, baseURL, u)

				u, err = svc.RelativeURL(NewPluginInfo(pluginsMap["one"].JSONData, plugins.ClassExternal, extPath("one")), "path/to/file.txt")
				require.NoError(t, err)
				require.Equal(t, strings.TrimRight(tc.cdnBaseURL, "/")+"/one/1.0.0/public/plugins/one/path/to/file.txt", u)

				u, err = svc.RelativeURL(NewPluginInfo(pluginsMap["two"].JSONData, plugins.ClassExternal, extPath("two")), "path/to/file.txt")
				require.NoError(t, err)
				require.Equal(t, "public/plugins/two/path/to/file.txt", u)

				u, err = svc.RelativeURL(NewPluginInfo(pluginsMap["two"].JSONData, plugins.ClassExternal, extPath("two")), "default")
				require.NoError(t, err)
				require.Equal(t, "public/plugins/two/default", u)
			})
		})
	}
}

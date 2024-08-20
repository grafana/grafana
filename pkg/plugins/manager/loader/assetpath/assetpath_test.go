package assetpath

import (
	"net/url"
	"path"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
)

func pluginFS(basePath string) *fakes.FakePluginFS {
	return fakes.NewFakePluginFS(basePath)
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

			tableOldFS := fakes.NewFakePluginFS("/grafana/public/app/plugins/panel/table-old")
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
				base, err := svc.Base(NewPluginInfo(jsonData["one"], plugins.ClassExternal, pluginFS("one"), nil))
				require.NoError(t, err)

				oneCDNURL, err := url.JoinPath(tc.cdnBaseURL, "/one/1.0.0/public/plugins/one")
				require.NoError(t, err)
				require.Equal(t, oneCDNURL, base)

				base, err = svc.Base(NewPluginInfo(jsonData["one"], plugins.ClassCDN, pluginFS(oneCDNURL), nil))
				require.NoError(t, err)
				require.Equal(t, oneCDNURL, base)

				base, err = svc.Base(NewPluginInfo(jsonData["two"], plugins.ClassExternal, pluginFS("two"), nil))
				require.NoError(t, err)
				require.Equal(t, "public/plugins/two", base)

				base, err = svc.Base(NewPluginInfo(jsonData["table-old"], plugins.ClassCore, tableOldFS, nil))
				require.NoError(t, err)
				require.Equal(t, "public/app/plugins/table-old", base)

				parentFS := pluginFS(oneCDNURL)
				parentFS.RelFunc = func(_ string) (string, error) {
					return "child-plugins/two", nil
				}
				parent := NewPluginInfo(jsonData["one"], plugins.ClassExternal, parentFS, nil)
				child := NewPluginInfo(jsonData["two"], plugins.ClassExternal, fakes.NewFakePluginFS(""), &parent)
				base, err = svc.Base(child)
				require.NoError(t, err)

				childBase, err := url.JoinPath(oneCDNURL, "child-plugins/two")
				require.NoError(t, err)
				require.Equal(t, childBase, base)
			})

			t.Run("Module", func(t *testing.T) {
				module, err := svc.Module(NewPluginInfo(jsonData["one"], plugins.ClassExternal, pluginFS("one"), nil))
				require.NoError(t, err)

				oneCDNURL, err := url.JoinPath(tc.cdnBaseURL, "/one/1.0.0/public/plugins/one")
				require.NoError(t, err)

				oneCDNModuleURL, err := url.JoinPath(oneCDNURL, "module.js")
				require.NoError(t, err)
				require.Equal(t, oneCDNModuleURL, module)

				fs := pluginFS("one")
				module, err = svc.Module(NewPluginInfo(jsonData["one"], plugins.ClassCDN, fs, nil))
				require.NoError(t, err)
				require.Equal(t, path.Join(fs.Base(), "module.js"), module)

				module, err = svc.Module(NewPluginInfo(jsonData["two"], plugins.ClassExternal, pluginFS("two"), nil))
				require.NoError(t, err)
				require.Equal(t, "public/plugins/two/module.js", module)

				module, err = svc.Module(NewPluginInfo(jsonData["table-old"], plugins.ClassCore, tableOldFS, nil))
				require.NoError(t, err)
				require.Equal(t, "core:plugin/table-old", module)

				parentFS := pluginFS(oneCDNURL)
				parentFS.RelFunc = func(_ string) (string, error) {
					return "child-plugins/two", nil
				}
				parent := NewPluginInfo(jsonData["one"], plugins.ClassExternal, parentFS, nil)
				child := NewPluginInfo(jsonData["two"], plugins.ClassExternal, fakes.NewFakePluginFS(""), &parent)
				module, err = svc.Module(child)
				require.NoError(t, err)

				childModule, err := url.JoinPath(oneCDNURL, "child-plugins/two/module.js")
				require.NoError(t, err)
				require.Equal(t, childModule, module)
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

				u, err := svc.RelativeURL(NewPluginInfo(pluginsMap["one"].JSONData, plugins.ClassExternal, pluginFS("one"), nil), "")
				require.NoError(t, err)
				// given an empty path, base URL will be returned
				baseURL, err := svc.Base(NewPluginInfo(pluginsMap["one"].JSONData, plugins.ClassExternal, pluginFS("one"), nil))
				require.NoError(t, err)
				require.Equal(t, baseURL, u)

				u, err = svc.RelativeURL(NewPluginInfo(pluginsMap["one"].JSONData, plugins.ClassExternal, pluginFS("one"), nil), "path/to/file.txt")
				require.NoError(t, err)
				require.Equal(t, strings.TrimRight(tc.cdnBaseURL, "/")+"/one/1.0.0/public/plugins/one/path/to/file.txt", u)

				u, err = svc.RelativeURL(NewPluginInfo(pluginsMap["two"].JSONData, plugins.ClassExternal, pluginFS("two"), nil), "path/to/file.txt")
				require.NoError(t, err)
				require.Equal(t, "public/plugins/two/path/to/file.txt", u)

				u, err = svc.RelativeURL(NewPluginInfo(pluginsMap["two"].JSONData, plugins.ClassExternal, pluginFS("two"), nil), "default")
				require.NoError(t, err)
				require.Equal(t, "public/plugins/two/default", u)

				oneCDNURL, err := url.JoinPath(tc.cdnBaseURL, "/one/1.0.0/public/plugins/one")
				require.NoError(t, err)

				u, err = svc.RelativeURL(NewPluginInfo(pluginsMap["one"].JSONData, plugins.ClassCDN, pluginFS(oneCDNURL), nil), "path/to/file.txt")
				require.NoError(t, err)

				oneCDNRelativeURL, err := url.JoinPath(oneCDNURL, "path/to/file.txt")
				require.NoError(t, err)
				require.Equal(t, oneCDNRelativeURL, u)

				parentFS := pluginFS(oneCDNURL)
				parentFS.RelFunc = func(_ string) (string, error) {
					return "child-plugins/two", nil
				}
				parent := NewPluginInfo(jsonData["one"], plugins.ClassExternal, parentFS, nil)
				child := NewPluginInfo(jsonData["two"], plugins.ClassExternal, fakes.NewFakePluginFS(""), &parent)
				u, err = svc.RelativeURL(child, "path/to/file.txt")
				require.NoError(t, err)

				oneCDNRelativeURL, err = url.JoinPath(oneCDNURL, "child-plugins/two/path/to/file.txt")
				require.NoError(t, err)
				require.Equal(t, oneCDNRelativeURL, u)
			})
		})
	}
}

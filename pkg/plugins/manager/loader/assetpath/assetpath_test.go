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

				u, err = svc.RelativeURL(child, "../path/to/file.txt")
				require.NoError(t, err)
				oneCDNRelativeURL, err = url.JoinPath(oneCDNURL, "child-plugins/path/to/file.txt")
				require.NoError(t, err)
				require.Equal(t, oneCDNRelativeURL, u)
			})
		})
	}
}

func TestService_ChildPlugins(t *testing.T) {
	type expected struct {
		module  string
		baseURL string
		relURL  string
	}

	tcs := []struct {
		name       string
		cfg        *config.PluginManagementCfg
		pluginInfo func() PluginInfo
		expected   expected
	}{
		{
			name: "Local FS external plugin",
			cfg:  &config.PluginManagementCfg{},
			pluginInfo: func() PluginInfo {
				return NewPluginInfo(plugins.JSONData{ID: "parent", Info: plugins.Info{Version: "1.0.0"}}, plugins.ClassExternal, plugins.NewLocalFS("/plugins/parent"), nil)
			},
			expected: expected{
				module:  "public/plugins/parent/module.js",
				baseURL: "public/plugins/parent",
				relURL:  "public/plugins/parent/path/to/file.txt",
			},
		},
		{
			name: "Local FS external plugin with child",
			cfg:  &config.PluginManagementCfg{},
			pluginInfo: func() PluginInfo {
				parentInfo := NewPluginInfo(plugins.JSONData{ID: "parent", Info: plugins.Info{Version: "1.0.0"}}, plugins.ClassExternal, plugins.NewLocalFS("/plugins/parent"), nil)
				childInfo := NewPluginInfo(plugins.JSONData{ID: "child", Info: plugins.Info{Version: "1.0.0"}}, plugins.ClassExternal, plugins.NewLocalFS("/plugins/parent/child"), &parentInfo)
				return childInfo
			},
			expected: expected{
				module:  "public/plugins/parent/child/module.js",
				baseURL: "public/plugins/parent/child",
				relURL:  "public/plugins/parent/child/path/to/file.txt",
			},
		},
		{
			name: "Local FS core plugin",
			cfg:  &config.PluginManagementCfg{},
			pluginInfo: func() PluginInfo {
				return NewPluginInfo(plugins.JSONData{ID: "parent", Info: plugins.Info{Version: "1.0.0"}}, plugins.ClassCore, plugins.NewLocalFS("/plugins/parent"), nil)
			},
			expected: expected{
				module:  "core:plugin/parent",
				baseURL: "public/app/plugins/parent",
				relURL:  "public/app/plugins/parent/path/to/file.txt",
			},
		},
		{
			name: "Externally-built Local FS core plugin",
			cfg:  &config.PluginManagementCfg{},
			pluginInfo: func() PluginInfo {
				return NewPluginInfo(plugins.JSONData{ID: "parent", Info: plugins.Info{Version: "1.0.0"}}, plugins.ClassCore, plugins.NewLocalFS("/plugins/parent/dist"), nil)
			},
			expected: expected{
				module:  "public/plugins/parent/module.js",
				baseURL: "public/app/plugins/parent",
				relURL:  "public/app/plugins/parent/path/to/file.txt",
			},
		},
		{
			name: "CDN Class plugin",
			cfg: &config.PluginManagementCfg{
				PluginsCDNURLTemplate: "https://cdn.example.com",
			},
			pluginInfo: func() PluginInfo {
				return NewPluginInfo(plugins.JSONData{ID: "parent", Info: plugins.Info{Version: "1.0.0"}}, plugins.ClassCDN, pluginFS("https://cdn.example.com/plugins/parent"), nil)
			},
			expected: expected{
				module:  "https://cdn.example.com/plugins/parent/module.js",
				baseURL: "https://cdn.example.com/plugins/parent",
				relURL:  "https://cdn.example.com/plugins/parent/path/to/file.txt",
			},
		},
		{
			name: "CDN Class plugin with child",
			cfg: &config.PluginManagementCfg{
				PluginsCDNURLTemplate: "https://cdn.example.com",
			},
			pluginInfo: func() PluginInfo {
				// Note: fake plugin FS is the most convenient way to mock the plugin FS for CDN plugins
				parentInfo := NewPluginInfo(plugins.JSONData{ID: "parent", Info: plugins.Info{Version: "1.0.0"}}, plugins.ClassCDN, pluginFS("https://cdn.example.com/parent"), nil)
				childInfo := NewPluginInfo(plugins.JSONData{ID: "child", Info: plugins.Info{Version: "1.0.0"}}, plugins.ClassCDN, pluginFS("https://cdn.example.com/parent/some/other/dir/child"), &parentInfo)
				return childInfo
			},
			expected: expected{
				module:  "https://cdn.example.com/parent/some/other/dir/child/module.js",
				baseURL: "https://cdn.example.com/parent/some/other/dir/child",
				relURL:  "https://cdn.example.com/parent/some/other/dir/child/path/to/file.txt",
			},
		},
		{
			name: "CDN supported plugin",
			cfg: &config.PluginManagementCfg{
				PluginsCDNURLTemplate: "https://cdn.example.com",
				PluginSettings: map[string]map[string]string{
					"parent": {"cdn": "true"},
				},
			},
			pluginInfo: func() PluginInfo {
				return NewPluginInfo(plugins.JSONData{ID: "parent", Info: plugins.Info{Version: "1.0.0"}}, plugins.ClassExternal, plugins.NewLocalFS("/plugins/parent"), nil)
			},
			expected: expected{
				module:  "https://cdn.example.com/parent/1.0.0/public/plugins/parent/module.js",
				baseURL: "https://cdn.example.com/parent/1.0.0/public/plugins/parent",
				relURL:  "https://cdn.example.com/parent/1.0.0/public/plugins/parent/path/to/file.txt",
			},
		},
		{
			name: "CDN supported plugin with child",
			cfg: &config.PluginManagementCfg{
				PluginsCDNURLTemplate: "https://cdn.example.com",
				PluginSettings: map[string]map[string]string{
					"parent": {"cdn": "true"},
				},
			},
			pluginInfo: func() PluginInfo {
				parentInfo := NewPluginInfo(plugins.JSONData{ID: "parent", Info: plugins.Info{Version: "1.0.0"}}, plugins.ClassExternal, plugins.NewLocalFS("/plugins/parent"), nil)
				childInfo := NewPluginInfo(plugins.JSONData{ID: "child", Info: plugins.Info{Version: "1.0.0"}}, plugins.ClassExternal, plugins.NewLocalFS("/plugins/parent/child"), &parentInfo)
				return childInfo
			},
			expected: expected{
				module:  "https://cdn.example.com/parent/1.0.0/public/plugins/parent/child/module.js",
				baseURL: "https://cdn.example.com/parent/1.0.0/public/plugins/parent/child",
				relURL:  "https://cdn.example.com/parent/1.0.0/public/plugins/parent/child/path/to/file.txt",
			},
		},
	}
	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			svc := ProvideService(tc.cfg, pluginscdn.ProvideService(tc.cfg))

			module, err := svc.Module(tc.pluginInfo())
			require.NoError(t, err)
			require.Equal(t, tc.expected.module, module)

			baseURL, err := svc.Base(tc.pluginInfo())
			require.NoError(t, err)
			require.Equal(t, tc.expected.baseURL, baseURL)

			relURL, err := svc.RelativeURL(tc.pluginInfo(), "path/to/file.txt")
			require.NoError(t, err)
			require.Equal(t, tc.expected.relURL, relURL)
		})
	}
}

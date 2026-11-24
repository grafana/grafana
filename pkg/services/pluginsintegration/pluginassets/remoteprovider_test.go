package pluginassets

import (
	"context"
	"net/url"
	"path/filepath"
	"sort"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	pluginsLoader "github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angularinspector"
	"github.com/grafana/grafana/pkg/plugins/manager/pluginfakes"
	"github.com/grafana/grafana/pkg/plugins/manager/process"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	pluginassets2 "github.com/grafana/grafana/pkg/plugins/pluginassets"
	"github.com/grafana/grafana/pkg/plugins/pluginerrs"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/loader"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pipeline"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/provisionedplugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestRemoteProvider_Module(t *testing.T) {
	tests := []struct {
		name     string
		provider *RemoteProvider
		plugin   pluginassets2.PluginInfo
		expected string
	}{
		{
			name: "core plugin without dist in base path should use core:plugin prefix",
			provider: &RemoteProvider{
				grafanaCDNURL:  "https://cdn.example.com",
				staticRootPath: "/usr/share/grafana/public",
				pluginsCDN:     pluginscdn.ProvideService(&config.PluginManagementCfg{}),
				localProvider:  pluginassets2.NewLocalProvider(),
			},
			plugin: pluginassets2.PluginInfo{
				JsonData: plugins.JSONData{ID: "grafana-testdata-datasource"},
				Class:    plugins.ClassCore,
				FS:       plugins.NewLocalFS("/grafana/plugins/grafana-testdata-datasource"),
			},
			expected: "core:plugin/grafana-testdata-datasource",
		},
		{
			name: "core plugin with dist in base path and grafanaCDNURL set should use CDN",
			provider: &RemoteProvider{
				grafanaCDNURL:  "https://cdn.example.com",
				staticRootPath: "/usr/share/grafana/public",
				pluginsCDN:     pluginscdn.ProvideService(&config.PluginManagementCfg{}),
				localProvider:  pluginassets2.NewLocalProvider(),
			},
			plugin: pluginassets2.PluginInfo{
				JsonData: plugins.JSONData{ID: "grafana-testdata-datasource"},
				Class:    plugins.ClassCore,
				FS:       plugins.NewLocalFS("/usr/share/grafana/public/app/plugins/datasource/testdata/dist"),
			},
			expected: "https://cdn.example.com/public/app/plugins/datasource/testdata/dist/module.js",
		},
		{
			name: "plugin with absolute URL base path",
			provider: &RemoteProvider{
				grafanaCDNURL:  "https://cdn.example.com",
				staticRootPath: "/usr/share/grafana/public",
				pluginsCDN:     pluginscdn.ProvideService(&config.PluginManagementCfg{}),
				localProvider:  pluginassets2.NewLocalProvider(),
			},
			plugin: pluginassets2.PluginInfo{
				JsonData: plugins.JSONData{ID: "remote-plugin"},
				Class:    plugins.ClassExternal,
				FS:       pluginfakes.NewFakePluginFS("https://external-cdn.com/plugins/remote-plugin"),
			},
			expected: "https://external-cdn.com/plugins/remote-plugin/module.js",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := tt.provider.Module(tt.plugin)
			require.NoError(t, err)
			assert.Equal(t, tt.expected, got)
		})
	}
}

func TestRemoteProvider_AssetPath(t *testing.T) {
	tests := []struct {
		name      string
		provider  *RemoteProvider
		plugin    pluginassets2.PluginInfo
		assetPath []string
		expected  string
	}{
		{
			name: "plugin with https:// URL base path",
			provider: &RemoteProvider{
				grafanaCDNURL:  "https://cdn.example.com",
				staticRootPath: "/usr/share/grafana/public",
				pluginsCDN:     pluginscdn.ProvideService(&config.PluginManagementCfg{}),
				localProvider:  pluginassets2.NewLocalProvider(),
			},
			plugin: pluginassets2.PluginInfo{
				JsonData: plugins.JSONData{ID: "remote-plugin"},
				Class:    plugins.ClassExternal,
				FS:       pluginfakes.NewFakePluginFS("https://external-cdn.com/plugins/remote-plugin"),
			},
			assetPath: []string{"static", "img", "logo.png"},
			expected:  "https://external-cdn.com/plugins/remote-plugin/static/img/logo.png",
		},
		{
			name: "plugin with http:// URL base path",
			provider: &RemoteProvider{
				grafanaCDNURL:  "https://cdn.example.com",
				staticRootPath: "/usr/share/grafana/public",
				pluginsCDN:     pluginscdn.ProvideService(&config.PluginManagementCfg{}),
				localProvider:  pluginassets2.NewLocalProvider(),
			},
			plugin: pluginassets2.PluginInfo{
				JsonData: plugins.JSONData{ID: "http-plugin"},
				Class:    plugins.ClassExternal,
				FS:       pluginfakes.NewFakePluginFS("http://example.com/plugins/my-plugin"),
			},
			assetPath: []string{"module.js"},
			expected:  "http://example.com/plugins/my-plugin/module.js",
		},
		{
			name: "plugin with https:// URL with www subdomain",
			provider: &RemoteProvider{
				grafanaCDNURL:  "https://cdn.example.com",
				staticRootPath: "/usr/share/grafana/public",
				pluginsCDN:     pluginscdn.ProvideService(&config.PluginManagementCfg{}),
				localProvider:  pluginassets2.NewLocalProvider(),
			},
			plugin: pluginassets2.PluginInfo{
				JsonData: plugins.JSONData{ID: "www-plugin"},
				Class:    plugins.ClassExternal,
				FS:       pluginfakes.NewFakePluginFS("https://www.example.com/plugins/my-plugin"),
			},
			assetPath: []string{"module.js"},
			expected:  "https://www.example.com/plugins/my-plugin/module.js",
		},
		{
			name: "plugin with http:// URL with port",
			provider: &RemoteProvider{
				grafanaCDNURL:  "https://cdn.example.com",
				staticRootPath: "/usr/share/grafana/public",
				pluginsCDN:     pluginscdn.ProvideService(&config.PluginManagementCfg{}),
				localProvider:  pluginassets2.NewLocalProvider(),
			},
			plugin: pluginassets2.PluginInfo{
				JsonData: plugins.JSONData{ID: "port-plugin"},
				Class:    plugins.ClassExternal,
				FS:       pluginfakes.NewFakePluginFS("http://1.2.3.4:3000/plugins/my-plugin"),
			},
			assetPath: []string{"module.js"},
			expected:  "http://1.2.3.4:3000/plugins/my-plugin/module.js",
		},
		{
			name: "plugin with https:// URL with query parameters",
			provider: &RemoteProvider{
				grafanaCDNURL:  "https://cdn.example.com",
				staticRootPath: "/usr/share/grafana/public",
				pluginsCDN:     pluginscdn.ProvideService(&config.PluginManagementCfg{}),
				localProvider:  pluginassets2.NewLocalProvider(),
			},
			plugin: pluginassets2.PluginInfo{
				JsonData: plugins.JSONData{ID: "query-plugin"},
				Class:    plugins.ClassExternal,
				FS:       pluginfakes.NewFakePluginFS("https://example.com/plugins/my-plugin?version=1.0.0"),
			},
			assetPath: []string{"module.js"},
			expected:  "https://example.com/plugins/my-plugin/module.js?version=1.0.0",
		},
		{
			name: "plugin with domain without scheme",
			provider: &RemoteProvider{
				grafanaCDNURL:  "https://cdn.example.com",
				staticRootPath: "/usr/share/grafana/public",
				pluginsCDN:     pluginscdn.ProvideService(&config.PluginManagementCfg{}),
				localProvider:  pluginassets2.NewLocalProvider(),
			},
			plugin: pluginassets2.PluginInfo{
				JsonData: plugins.JSONData{ID: "no-scheme-plugin"},
				Class:    plugins.ClassExternal,
				FS:       pluginfakes.NewFakePluginFS("example.com/plugins/my-plugin"),
			},
			assetPath: []string{"module.js"},
			expected:  "public/plugins/no-scheme-plugin/module.js",
		},
		{
			name: "plugin with www domain without scheme falls",
			provider: &RemoteProvider{
				grafanaCDNURL:  "https://cdn.example.com",
				staticRootPath: "/usr/share/grafana/public",
				pluginsCDN:     pluginscdn.ProvideService(&config.PluginManagementCfg{}),
				localProvider:  pluginassets2.NewLocalProvider(),
			},
			plugin: pluginassets2.PluginInfo{
				JsonData: plugins.JSONData{ID: "www-no-scheme-plugin"},
				Class:    plugins.ClassExternal,
				FS:       pluginfakes.NewFakePluginFS("www.example.com/plugins/my-plugin"),
			},
			assetPath: []string{"module.js"},
			expected:  "public/plugins/www-no-scheme-plugin/module.js",
		},
		{
			name: "plugin with file:// URL",
			provider: &RemoteProvider{
				grafanaCDNURL:  "https://cdn.example.com",
				staticRootPath: "/usr/share/grafana/public",
				pluginsCDN:     pluginscdn.ProvideService(&config.PluginManagementCfg{}),
				localProvider:  pluginassets2.NewLocalProvider(),
			},
			plugin: pluginassets2.PluginInfo{
				JsonData: plugins.JSONData{ID: "file-plugin"},
				Class:    plugins.ClassExternal,
				FS:       pluginfakes.NewFakePluginFS("file:///usr/share/grafana/plugins/my-plugin"),
			},
			assetPath: []string{"module.js"},
			expected:  "public/plugins/file-plugin/module.js",
		},
		{
			name: "plugin with Windows absolute path",
			provider: &RemoteProvider{
				grafanaCDNURL:  "https://cdn.example.com",
				staticRootPath: "C:\\GrafanaLabs\\grafana\\public",
				pluginsCDN:     pluginscdn.ProvideService(&config.PluginManagementCfg{}),
				localProvider:  pluginassets2.NewLocalProvider(),
			},
			plugin: pluginassets2.PluginInfo{
				JsonData: plugins.JSONData{ID: "windows-plugin"},
				Class:    plugins.ClassExternal,
				FS:       pluginfakes.NewFakePluginFS("D:\\GrafanaLabs\\grafana\\data\\plugins\\grafana-foobar-datasource"),
			},
			assetPath: []string{"module.js"},
			expected:  "public/plugins/windows-plugin/module.js",
		},
		{
			name: "plugin with Unix absolute path",
			provider: &RemoteProvider{
				grafanaCDNURL:  "https://cdn.example.com",
				staticRootPath: "/usr/share/grafana/public",
				pluginsCDN:     pluginscdn.ProvideService(&config.PluginManagementCfg{}),
				localProvider:  pluginassets2.NewLocalProvider(),
			},
			plugin: pluginassets2.PluginInfo{
				JsonData: plugins.JSONData{ID: "unix-plugin"},
				Class:    plugins.ClassExternal,
				FS:       plugins.NewLocalFS("/var/lib/grafana/plugins/my-plugin"),
			},
			assetPath: []string{"module.js"},
			expected:  "public/plugins/unix-plugin/module.js",
		},
		{
			name: "plugin under static root with CDN URL set",
			provider: &RemoteProvider{
				grafanaCDNURL:  "https://cdn.example.com",
				staticRootPath: "/usr/share/grafana/public",
				pluginsCDN:     pluginscdn.ProvideService(&config.PluginManagementCfg{}),
				localProvider:  pluginassets2.NewLocalProvider(),
			},
			plugin: pluginassets2.PluginInfo{
				JsonData: plugins.JSONData{ID: "local-plugin"},
				Class:    plugins.ClassExternal,
				FS:       plugins.NewLocalFS("/usr/share/grafana/public/app/plugins/panel/graph"),
			},
			assetPath: []string{"module.js"},
			expected:  "https://cdn.example.com/public/app/plugins/panel/graph/module.js",
		},
		{
			name: "plugin supported by CDN service",
			provider: &RemoteProvider{
				grafanaCDNURL:  "https://cdn.example.com",
				staticRootPath: "/usr/share/grafana/public",
				pluginsCDN: pluginscdn.ProvideService(&config.PluginManagementCfg{
					PluginsCDNURLTemplate: "https://plugins-cdn.example.com",
					PluginSettings: map[string]map[string]string{
						"cdn-plugin": {"cdn": "true"},
					},
				}),
				localProvider: pluginassets2.NewLocalProvider(),
			},
			plugin: pluginassets2.PluginInfo{
				JsonData: plugins.JSONData{
					ID:   "cdn-plugin",
					Info: plugins.Info{Version: "1.0.0"},
				},
				Class: plugins.ClassExternal,
				FS:    plugins.NewLocalFS("/var/lib/grafana/plugins/cdn-plugin"),
			},
			assetPath: []string{"module.js"},
			expected:  "https://plugins-cdn.example.com/cdn-plugin/1.0.0/public/plugins/cdn-plugin/module.js",
		},
		{
			name: "child plugin with parent supported by CDN",
			provider: &RemoteProvider{
				grafanaCDNURL:  "https://cdn.example.com",
				staticRootPath: "/usr/share/grafana/public",
				pluginsCDN: pluginscdn.ProvideService(&config.PluginManagementCfg{
					PluginsCDNURLTemplate: "https://plugins-cdn.example.com",
					PluginSettings: map[string]map[string]string{
						"parent-app": {"cdn": "true"},
					},
				}),
				localProvider: pluginassets2.NewLocalProvider(),
			},
			plugin: pluginassets2.PluginInfo{
				JsonData: plugins.JSONData{ID: "child-panel"},
				Class:    plugins.ClassExternal,
				FS:       plugins.NewLocalFS("/var/lib/grafana/plugins/parent-app/panels/child"),
				Parent: &pluginassets2.PluginInfo{
					JsonData: plugins.JSONData{
						ID:   "parent-app",
						Info: plugins.Info{Version: "2.0.0"},
					},
					FS: plugins.NewLocalFS("/var/lib/grafana/plugins/parent-app"),
				},
			},
			assetPath: []string{"module.js"},
			expected:  "https://plugins-cdn.example.com/parent-app/2.0.0/public/plugins/parent-app/panels/child/module.js",
		},
		{
			name: "fallback to local provider when not under static root and not CDN supported",
			provider: &RemoteProvider{
				grafanaCDNURL:  "https://cdn.example.com",
				staticRootPath: "/usr/share/grafana/public",
				pluginsCDN:     pluginscdn.ProvideService(&config.PluginManagementCfg{}),
				localProvider:  pluginassets2.NewLocalProvider(),
			},
			plugin: pluginassets2.PluginInfo{
				JsonData: plugins.JSONData{ID: "external-plugin"},
				Class:    plugins.ClassExternal,
				FS:       plugins.NewLocalFS("/var/lib/grafana/plugins/external-plugin"),
			},
			assetPath: []string{"static", "img", "icon.png"},
			expected:  "public/plugins/external-plugin/static/img/icon.png",
		},
		{
			name: "deeply nested asset path",
			provider: &RemoteProvider{
				grafanaCDNURL:  "https://cdn.example.com",
				staticRootPath: "/usr/share/grafana/public",
				pluginsCDN:     pluginscdn.ProvideService(&config.PluginManagementCfg{}),
				localProvider:  pluginassets2.NewLocalProvider(),
			},
			plugin: pluginassets2.PluginInfo{
				JsonData: plugins.JSONData{ID: "test-plugin"},
				Class:    plugins.ClassExternal,
				FS:       plugins.NewLocalFS("/usr/share/grafana/public/app/plugins/panel/test"),
			},
			assetPath: []string{"very", "deep", "nested", "path", "to", "file.js"},
			expected:  "https://cdn.example.com/public/app/plugins/panel/test/very/deep/nested/path/to/file.js",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := tt.provider.AssetPath(tt.plugin, tt.assetPath...)
			require.NoError(t, err)
			assert.Equal(t, tt.expected, got)
		})
	}
}

func TestHTTPURL(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		{
			name:     "http:// URL returns true",
			input:    "http://example.com/path",
			expected: true,
		},
		{
			name:     "https:// URL returns true",
			input:    "https://example.com/path",
			expected: true,
		},
		{
			name:     "https:// URL with www subdomain returns true",
			input:    "https://www.example.com/path",
			expected: true,
		},
		{
			name:     "http:// URL with port returns true",
			input:    "http://example.com:8080/path",
			expected: true,
		},
		{
			name:     "http:// URL with IP address returns true",
			input:    "http://1.2.3.4:3000/path",
			expected: true,
		},
		{
			name:     "file:// URL returns false",
			input:    "file:///usr/share/grafana/plugins",
			expected: false,
		},
		{
			name:     "Windows absolute path returns false",
			input:    "D:\\GrafanaLabs\\grafana\\data\\plugins",
			expected: false,
		},
		{
			name:     "Unix absolute path returns false",
			input:    "/usr/share/grafana/plugins",
			expected: false,
		},
		{
			name:     "relative path returns false",
			input:    "plugins/my-plugin",
			expected: false,
		},
		{
			name:     "domain without scheme returns false",
			input:    "example.com/path",
			expected: false,
		},
		{
			name:     "www domain without scheme returns false",
			input:    "www.example.com/path",
			expected: false,
		},
		{
			name:     "ftp:// URL returns false",
			input:    "ftp://example.com/path",
			expected: false,
		},
		{
			name:     "ftps:// URL returns false",
			input:    "ftps://example.com/path",
			expected: false,
		},
		{
			name:     "ws:// URL returns false",
			input:    "ws://example.com/path",
			expected: false,
		},
		{
			name:     "wss:// URL returns false",
			input:    "wss://example.com/path",
			expected: false,
		},
		{
			name:     "ssh:// URL returns false",
			input:    "ssh://user@example.com/path",
			expected: false,
		},
		{
			name:     "sftp:// URL returns false",
			input:    "sftp://example.com/path",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			u, err := url.Parse(tt.input)
			require.NoError(t, err, "url.Parse should succeed for test input: %s", tt.input)
			result := httpURL(u)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// This test is used to test remote asset provider when used in the context of the plugin loader.
func TestLoader_WithRemoteAssetProvider(t *testing.T) {
	var fsComparer = cmp.Comparer(func(fs1 plugins.FS, fs2 plugins.FS) bool {
		fs1Files, err := fs1.Files()
		if err != nil {
			panic(err)
		}
		fs2Files, err := fs2.Files()
		if err != nil {
			panic(err)
		}

		sort.SliceStable(fs1Files, func(i, j int) bool {
			return fs1Files[i] < fs1Files[j]
		})

		sort.SliceStable(fs2Files, func(i, j int) bool {
			return fs2Files[i] < fs2Files[j]
		})

		return cmp.Equal(fs1Files, fs2Files) && fs1.Base() == fs2.Base()
	})

	var compareOpts = []cmp.Option{cmpopts.IgnoreFields(plugins.Plugin{}, "client", "log", "mu"), fsComparer}

	t.Run("Load a plugin", func(t *testing.T) {
		cfg := &config.PluginManagementCfg{
			PluginsCDNURLTemplate: "https://cdn.example.com",
			PluginSettings: config.PluginSettings{
				"grafana-worldmap-panel": {"cdn": "true"},
			},
		}

		pluginDir := filepath.Join(testutil.GrafanaRootDir(t), "pkg", "plugins", "manager", "testdata", "cdn", "plugin")
		sfs, err := plugins.NewStaticFS(plugins.NewLocalFS(pluginDir))
		require.NoError(t, err)

		expected := []*plugins.Plugin{{
			JSONData: plugins.JSONData{
				ID:   "grafana-worldmap-panel",
				Type: plugins.TypePanel,
				Name: "Worldmap Panel",
				Info: plugins.Info{
					Version: "0.3.3",
					Links: []plugins.InfoLink{
						{Name: "Project site", URL: "https://github.com/grafana/worldmap-panel"},
						{Name: "MIT License", URL: "https://github.com/grafana/worldmap-panel/blob/master/LICENSE"},
					},
					Logos: plugins.Logos{
						// Path substitution
						Small: "https://cdn.example.com/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/images/worldmap_logo.svg",
						Large: "https://cdn.example.com/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/images/worldmap_logo.svg",
					},
					Screenshots: []plugins.Screenshots{
						{
							Name: "World",
							Path: "https://cdn.example.com/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/images/worldmap-world.png",
						},
						{
							Name: "USA",
							Path: "https://cdn.example.com/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/images/worldmap-usa.png",
						},
						{
							Name: "Light Theme",
							Path: "https://cdn.example.com/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/images/worldmap-light-theme.png",
						},
					},
				},
				Dependencies: plugins.Dependencies{
					GrafanaVersion: "3.x.x",
					Plugins:        []plugins.Dependency{},
					Extensions: plugins.ExtensionsDependencies{
						ExposedComponents: []string{},
					},
				},
				Extensions: plugins.Extensions{
					AddedLinks:      []plugins.AddedLink{},
					AddedComponents: []plugins.AddedComponent{},
					AddedFunctions:  []plugins.AddedFunction{},

					ExposedComponents: []plugins.ExposedComponent{},
					ExtensionPoints:   []plugins.ExtensionPoint{},
				},
			},
			FS:              sfs,
			Class:           plugins.ClassExternal,
			Signature:       plugins.SignatureStatusValid,
			BaseURL:         "https://cdn.example.com/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel",
			Module:          "https://cdn.example.com/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/module.js",
			LoadingStrategy: plugins.LoadingStrategyFetch,
			SkipHostEnvVars: true,
			Translations:    map[string]string{},
		}}

		remoteAssetProvider, err := ProvideRemoteProvider(setting.NewCfg(), &pluginfakes.FakeLicensingService{CDNPrefix: "https://cdn.example.com/"}, pluginscdn.ProvideService(cfg))
		require.NoError(t, err)

		l := newLoader(t, cfg, pluginfakes.NewFakePluginRegistry(), pluginfakes.NewFakeProcessManager(), pluginfakes.NewFakeBackendProcessProvider(), pluginfakes.NewFakeErrorTracker(), remoteAssetProvider)
		got, err := l.Load(context.Background(), &pluginfakes.FakePluginSource{
			PluginClassFunc: func(ctx context.Context) plugins.Class {
				return plugins.ClassExternal
			},
			DiscoverFunc: sources.NewLocalSource(plugins.ClassExternal, []string{pluginDir}).Discover,
			DefaultSignatureFunc: func(ctx context.Context) (plugins.Signature, bool) {
				return plugins.Signature{
					Status: plugins.SignatureStatusValid,
				}, true
			},
		})

		require.NoError(t, err)
		if !cmp.Equal(got, expected, compareOpts...) {
			t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, expected, compareOpts...))
		}
	})
}

func newLoader(t *testing.T, cfg *config.PluginManagementCfg, reg registry.Service, proc process.Manager,
	backendFactory plugins.BackendFactoryProvider, errTracker pluginerrs.ErrorTracker, pluginAssetsProvider pluginassets2.Provider,
) pluginsLoader.Service {
	terminate, err := pipeline.ProvideTerminationStage(cfg, reg, proc)
	require.NoError(t, err)
	return loader.ProvideService(cfg, pipeline.ProvideDiscoveryStage(cfg, reg),
		pipeline.ProvideBootstrapStage(cfg, signature.DefaultCalculator(cfg), pluginAssetsProvider, pluginscdn.ProvideService(cfg)),
		pipeline.ProvideValidationStage(cfg, signature.NewValidator(signature.NewUnsignedAuthorizer(cfg)), angularinspector.NewStaticInspector()),
		pipeline.ProvideInitializationStage(cfg, reg, backendFactory, proc, &pluginfakes.FakeAuthService{}, pluginfakes.NewFakeRoleRegistry(), pluginfakes.NewFakeActionSetRegistry(), pluginfakes.NewFakePluginEnvProvider(), tracing.InitializeTracerForTest(), provisionedplugins.NewNoop()),
		terminate, errTracker)
}

package pluginassets

import (
	"context"
	"fmt"
	"io/fs"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/manager/signature/statickey"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
)

func TestService_LoadingStrategy(t *testing.T) {
	const pluginID = "grafana-test-datasource"

	const (
		incompatVersion = "4.14.0"
		compatVersion   = CreatePluginVersionScriptSupportEnabled
		futureVersion   = "5.0.0"
	)

	tcs := []struct {
		name           string
		pluginSettings config.PluginSettings
		plugin         *plugins.Plugin
		expected       plugins.LoadingStrategy
	}{
		{
			name: "Expected LoadingStrategyScript when create-plugin version is compatible and plugin is not angular",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				CreatePluginVersionCfgKey: compatVersion,
			}),
			plugin:   newTestPlugin(pluginID, withTestAngular(false)),
			expected: plugins.LoadingStrategyScript,
		},
		{
			name: "Expected LoadingStrategyScript when parent create-plugin version is compatible and plugin is not angular",
			pluginSettings: newPluginSettings("parent-datasource", map[string]string{
				CreatePluginVersionCfgKey: compatVersion,
			}),
			plugin: newTestPlugin(pluginID, withTestAngular(false), func(p *plugins.Plugin) {
				p.Parent = &plugins.Plugin{JSONData: plugins.JSONData{ID: "parent-datasource"}}
			}),
			expected: plugins.LoadingStrategyScript,
		},
		{
			name: "Expected LoadingStrategyScript when create-plugin version is future compatible and plugin is not angular",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				CreatePluginVersionCfgKey: futureVersion,
			}),
			plugin:   newTestPlugin(pluginID, withTestAngular(false), withTestFS(plugins.NewFakeFS())),
			expected: plugins.LoadingStrategyScript,
		},
		{
			name:           "Expected LoadingStrategyScript when create-plugin version is not provided, plugin is not angular and is not configured as CDN enabled",
			pluginSettings: newPluginSettings(pluginID, map[string]string{}),
			plugin:         newTestPlugin(pluginID, withTestAngular(false), withTestFS(plugins.NewFakeFS())),
			expected:       plugins.LoadingStrategyScript,
		},
		{
			name: "Expected LoadingStrategyScript when create-plugin version is not compatible, plugin is not angular, is not configured as CDN enabled and does not have a CDN fs",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				CreatePluginVersionCfgKey: incompatVersion,
			}),
			plugin:   newTestPlugin(pluginID, withTestAngular(false), withTestClass(plugins.ClassExternal), withTestFS(plugins.NewFakeFS())),
			expected: plugins.LoadingStrategyScript,
		},
		{
			name: "Expected LoadingStrategyFetch when parent create-plugin version is not set, is configured as CDN enabled and plugin is not angular",
			pluginSettings: config.PluginSettings{
				"parent-datasource": {
					"cdn": "true",
				},
			},
			plugin: newTestPlugin(pluginID, withTestAngular(false), func(p *plugins.Plugin) {
				p.Parent = &plugins.Plugin{JSONData: plugins.JSONData{ID: "parent-datasource"}}
			}),
			expected: plugins.LoadingStrategyFetch,
		},
		{
			name: "Expected LoadingStrategyFetch when parent create-plugin version is not set, is configured as CDN enabled and plugin is angular",
			pluginSettings: config.PluginSettings{
				"parent-datasource": {
					"cdn": "true",
				},
			},
			plugin: newTestPlugin(pluginID, withTestAngular(true), func(p *plugins.Plugin) {
				p.Parent = &plugins.Plugin{JSONData: plugins.JSONData{ID: "parent-datasource"}}
			}),
			expected: plugins.LoadingStrategyFetch,
		},
		{
			name:           "Expected LoadingStrategyFetch when parent create-plugin version is not set, is not configured as CDN enabled and plugin is angular",
			pluginSettings: config.PluginSettings{},
			plugin: newTestPlugin(pluginID, withTestAngular(true), withTestFS(plugins.NewFakeFS()), func(p *plugins.Plugin) {
				p.Parent = &plugins.Plugin{JSONData: plugins.JSONData{ID: "parent-datasource"}}
			}),
			expected: plugins.LoadingStrategyFetch,
		},
		{
			name: "Expected LoadingStrategyFetch when create-plugin version is not compatible, plugin is not angular, and plugin is configured as CDN enabled",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				"cdn":                     "true",
				CreatePluginVersionCfgKey: incompatVersion,
			}),
			plugin:   newTestPlugin(pluginID, withTestAngular(false), withTestClass(plugins.ClassExternal)),
			expected: plugins.LoadingStrategyFetch,
		},
		{
			name: "Expected LoadingStrategyFetch when create-plugin version is not compatible and plugin is angular",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				CreatePluginVersionCfgKey: incompatVersion,
			}),
			plugin:   newTestPlugin(pluginID, withTestAngular(true), withTestFS(plugins.NewFakeFS())),
			expected: plugins.LoadingStrategyFetch,
		},
		{
			name: "Expected LoadingStrategyFetch when create-plugin version is not compatible, plugin is not angular and plugin is configured as CDN enabled",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				"cdn":                     "true",
				CreatePluginVersionCfgKey: incompatVersion,
			}),
			plugin:   newTestPlugin(pluginID, withTestAngular(false)),
			expected: plugins.LoadingStrategyFetch,
		},
		{
			name: "Expected LoadingStrategyFetch when create-plugin version is not compatible, plugin is not angular and has a CDN fs",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				CreatePluginVersionCfgKey: incompatVersion,
			}),
			plugin:   newTestPlugin(pluginID, withTestAngular(false), withTestFS(newCDNFS())),
			expected: plugins.LoadingStrategyFetch,
		},
		{
			name: "Expected LoadingStrategyScript when plugin setting create-plugin version is badly formatted, plugin is not configured as CDN enabled and does not have a CDN fs",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				CreatePluginVersionCfgKey: "invalidSemver",
			}),
			plugin:   newTestPlugin(pluginID, withTestAngular(false), withTestFS(plugins.NewFakeFS())),
			expected: plugins.LoadingStrategyScript,
		},
	}
	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			reg := registry.ProvideService()
			err := reg.Add(context.Background(), tc.plugin)
			require.NoError(t, err)
			cfg := &config.PluginManagementCfg{
				PluginsCDNURLTemplate: "http://cdn.example.com", // required for cdn.PluginSupported check
				PluginSettings:        tc.pluginSettings,
			}
			s := ProvideService(cfg, pluginscdn.ProvideService(cfg), signature.ProvideService(cfg, statickey.New()), reg)
			got := s.LoadingStrategy(context.Background(), tc.plugin.ID, tc.plugin.JSONData.Info.Version)
			assert.Equal(t, tc.expected, got, "unexpected loading strategy")
		})
	}
}

func TestService_ModuleHash(t *testing.T) {
	const (
		pluginID       = "grafana-test-datasource"
		parentPluginID = "grafana-test-app"
	)
	for _, tc := range []struct {
		name     string
		features *config.Features
		registry []*plugins.Plugin

		plugin *plugins.Plugin

		// When true, set cdn=true in config
		cdn           bool
		expModuleHash string
	}{
		{
			name:          "unsigned should not return module hash",
			plugin:        newTestPlugin(pluginID, withTestSignatureStatus(plugins.SignatureStatusUnsigned)),
			cdn:           false,
			features:      &config.Features{SriChecksEnabled: false},
			expModuleHash: "",
		},
		{
			plugin: newTestPlugin(
				pluginID,
				withTestSignatureStatus(plugins.SignatureStatusValid),
				withTestFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid"))),
				withTestClass(plugins.ClassExternal),
			),
			cdn:           true,
			features:      &config.Features{SriChecksEnabled: true},
			expModuleHash: mustConvertHashForSRI(t, "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03"),
		},
		{
			plugin: newTestPlugin(
				pluginID,
				withTestSignatureStatus(plugins.SignatureStatusValid),
				withTestFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid"))),
				withTestClass(plugins.ClassExternal),
			),
			cdn:           true,
			features:      &config.Features{SriChecksEnabled: true},
			expModuleHash: mustConvertHashForSRI(t, "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03"),
		},
		{
			plugin: newTestPlugin(
				pluginID,
				withTestSignatureStatus(plugins.SignatureStatusValid),
				withTestFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid"))),
			),
			cdn:           false,
			features:      &config.Features{SriChecksEnabled: true},
			expModuleHash: "",
		},
		{
			plugin: newTestPlugin(
				pluginID,
				withTestSignatureStatus(plugins.SignatureStatusValid),
				withTestFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid"))),
			),
			cdn:           true,
			features:      &config.Features{SriChecksEnabled: false},
			expModuleHash: "",
		},
		{
			plugin: newTestPlugin(
				pluginID,
				withTestSignatureStatus(plugins.SignatureStatusValid),
				withTestFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid"))),
			),
			cdn:           false,
			features:      &config.Features{SriChecksEnabled: false},
			expModuleHash: "",
		},
		{
			// parentPluginID           (/)
			// └── pluginID             (/datasource)
			name: "nested plugin should return module hash from parent MANIFEST.txt",
			registry: []*plugins.Plugin{
				newTestPlugin(
					parentPluginID,
					withTestSignatureStatus(plugins.SignatureStatusValid),
					withTestFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-nested"))),
				),
			},
			plugin: newTestPlugin(
				pluginID,
				withTestSignatureStatus(plugins.SignatureStatusValid),
				withTestFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-nested", "datasource"))),
				func(p *plugins.Plugin) {
					p.Parent = &plugins.Plugin{JSONData: plugins.JSONData{ID: parentPluginID}}
				},
			),
			cdn:           true,
			features:      &config.Features{SriChecksEnabled: true},
			expModuleHash: mustConvertHashForSRI(t, "04d70db091d96c4775fb32ba5a8f84cc22893eb43afdb649726661d4425c6711"),
		},
		{
			// parentPluginID           (/)
			// └── pluginID             (/panels/one)
			name: "nested plugin deeper than one subfolder should return module hash from parent MANIFEST.txt",
			registry: []*plugins.Plugin{
				newTestPlugin(
					parentPluginID,
					withTestSignatureStatus(plugins.SignatureStatusValid),
					withTestFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-nested"))),
				),
			},
			plugin: newTestPlugin(
				pluginID,
				withTestSignatureStatus(plugins.SignatureStatusValid),
				withTestFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-nested", "panels", "one"))),
				func(p *plugins.Plugin) {
					p.Parent = &plugins.Plugin{JSONData: plugins.JSONData{ID: parentPluginID}}
				},
			),
			cdn:           true,
			features:      &config.Features{SriChecksEnabled: true},
			expModuleHash: mustConvertHashForSRI(t, "cbd1ac2284645a0e1e9a8722a729f5bcdd2b831222728709c6360beecdd6143f"),
		},
		{
			// grand-parent-app         (/)
			// ├── parent-datasource    (/datasource)
			// │   └── child-panel      (/datasource/panels/one)
			name: "nested plugin of a nested plugin should return module hash from parent MANIFEST.txt",
			registry: []*plugins.Plugin{
				newTestPlugin(
					"grand-parent-app",
					withTestSignatureStatus(plugins.SignatureStatusValid),
					withTestFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-deeply-nested"))),
				),
				newTestPlugin(
					"parent-datasource",
					withTestSignatureStatus(plugins.SignatureStatusValid),
					withTestFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-deeply-nested", "datasource"))),
					func(p *plugins.Plugin) {
						p.Parent = &plugins.Plugin{JSONData: plugins.JSONData{ID: "grand-parent-app"}}
					},
				),
			},
			plugin: newTestPlugin(
				"child-panel",
				withTestSignatureStatus(plugins.SignatureStatusValid),
				withTestFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-deeply-nested", "datasource", "panels", "one"))),
				func(p *plugins.Plugin) {
					p.Parent = &plugins.Plugin{JSONData: plugins.JSONData{ID: "parent-datasource"}}
				},
			),
			cdn:           true,
			features:      &config.Features{SriChecksEnabled: true},
			expModuleHash: mustConvertHashForSRI(t, "cbd1ac2284645a0e1e9a8722a729f5bcdd2b831222728709c6360beecdd6143f"),
		},
		{
			name:     "nested plugin should not return module hash from parent if it's not registered in the registry",
			registry: []*plugins.Plugin{},
			plugin: newTestPlugin(
				pluginID,
				withTestSignatureStatus(plugins.SignatureStatusValid),
				withTestFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-nested", "panels", "one"))),
				func(p *plugins.Plugin) {
					p.Parent = &plugins.Plugin{JSONData: plugins.JSONData{ID: parentPluginID}}
				},
			),
			cdn:           false,
			features:      &config.Features{SriChecksEnabled: true},
			expModuleHash: "",
		},
		{
			name: "missing module.js entry from MANIFEST.txt should not return module hash",
			plugin: newTestPlugin(
				pluginID,
				withTestSignatureStatus(plugins.SignatureStatusValid),
				withTestFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-no-module-js"))),
			),
			cdn:           false,
			features:      &config.Features{SriChecksEnabled: true},
			expModuleHash: "",
		},
		{
			name: "signed status but missing MANIFEST.txt should not return module hash",
			plugin: newTestPlugin(
				pluginID,
				withTestSignatureStatus(plugins.SignatureStatusValid),
				withTestFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-no-manifest-txt"))),
			),
			cdn:           false,
			features:      &config.Features{SriChecksEnabled: true},
			expModuleHash: "",
		},
	} {
		if tc.name == "" {
			var expS string
			if tc.expModuleHash == "" {
				expS = "should not return module hash"
			} else {
				expS = "should return module hash"
			}
			tc.name = fmt.Sprintf("feature=%v, cdn_config=%v, class=%v %s", tc.features.SriChecksEnabled, tc.cdn, tc.plugin.Class, expS)
		}

		t.Run(tc.name, func(t *testing.T) {
			var pluginSettings config.PluginSettings
			if tc.cdn {
				pluginSettings = config.PluginSettings{
					pluginID: {
						"cdn": "true",
					},
					parentPluginID: map[string]string{
						"cdn": "true",
					},
					"grand-parent-app": map[string]string{
						"cdn": "true",
					},
				}
			}
			features := tc.features
			if features == nil {
				features = &config.Features{}
			}
			pCfg := &config.PluginManagementCfg{
				PluginsCDNURLTemplate: "http://cdn.example.com",
				PluginSettings:        pluginSettings,
				Features:              *features,
			}
			reg := registry.ProvideService()
			for _, storePlugin := range tc.registry {
				err := reg.Add(context.Background(), storePlugin)
				require.NoError(t, err)
			}
			err := reg.Add(context.Background(), tc.plugin)
			require.NoError(t, err)
			svc := ProvideService(
				pCfg,
				pluginscdn.ProvideService(pCfg),
				signature.ProvideService(pCfg, statickey.New()),
				reg,
			)
			mh := svc.ModuleHash(context.Background(), tc.plugin.ID, tc.plugin.JSONData.Info.Version)
			require.Equal(t, tc.expModuleHash, mh)
		})
	}
}

func TestService_ModuleHash_Cache(t *testing.T) {
	pCfg := &config.PluginManagementCfg{
		PluginSettings: config.PluginSettings{},
		Features:       config.Features{SriChecksEnabled: true},
	}
	const pluginID = "grafana-test-datasource"

	t.Run("cache key", func(t *testing.T) {
		reg := registry.ProvideService()
		svc := ProvideService(
			pCfg,
			pluginscdn.ProvideService(pCfg),
			signature.ProvideService(pCfg, statickey.New()),
			reg,
		)

		t.Run("with version", func(t *testing.T) {
			const pluginVersion = "1.0.0"
			p := newTestPlugin(pluginID, withTestInfo(plugins.Info{Version: pluginVersion}))
			_ = reg.Add(context.Background(), p)
			// Cache is internal to Service, test via ModuleHash calls
			hash1 := svc.ModuleHash(context.Background(), pluginID, pluginVersion)
			hash2 := svc.ModuleHash(context.Background(), pluginID, pluginVersion)
			require.Equal(t, hash1, hash2, "should return cached value")
		})

		t.Run("without version", func(t *testing.T) {
			p := newTestPlugin(pluginID)
			_ = reg.Add(context.Background(), p)
			hash1 := svc.ModuleHash(context.Background(), pluginID, "")
			hash2 := svc.ModuleHash(context.Background(), pluginID, "")
			require.Equal(t, hash1, hash2, "should return cached value")
		})
	})

	t.Run("ModuleHash usage", func(t *testing.T) {
		pV1 := newTestPlugin(
			pluginID,
			withTestInfo(plugins.Info{Version: "1.0.0"}),
			withTestSignatureStatus(plugins.SignatureStatusValid),
			withTestFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid"))),
		)

		pCfg = &config.PluginManagementCfg{
			PluginsCDNURLTemplate: "https://cdn.grafana.com",
			PluginSettings: config.PluginSettings{
				pluginID: {
					"cdn": "true",
				},
			},
			Features: config.Features{SriChecksEnabled: true},
		}
		reg := newTestRegistry()
		err := reg.Add(context.Background(), pV1)
		require.NoError(t, err)
		svc := ProvideService(
			pCfg,
			pluginscdn.ProvideService(pCfg),
			signature.ProvideService(pCfg, statickey.New()),
			reg,
		)

		mhV1 := svc.ModuleHash(context.Background(), pluginID, "1.0.0")
		pV1Exp := mustConvertHashForSRI(t, "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03")
		require.Equal(t, pV1Exp, mhV1, "returned value should be correct")

		// Test that cache works by calling again
		mhV1Cached := svc.ModuleHash(context.Background(), pluginID, "1.0.0")
		require.Equal(t, pV1Exp, mhV1Cached, "cached value should match")

		t.Run("different version uses different cache key", func(t *testing.T) {
			pV2 := newTestPlugin(
				pluginID,
				withTestInfo(plugins.Info{Version: "2.0.0"}),
				withTestSignatureStatus(plugins.SignatureStatusValid),
				// different fs for different hash
				withTestFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-nested"))),
			)
			_ = reg.Add(context.Background(), pV2)
			mhV2 := svc.ModuleHash(context.Background(), pluginID, "2.0.0")
			require.NotEqual(t, mhV2, mhV1, "different version should have different hash")
			require.Equal(t, mustConvertHashForSRI(t, "266c19bc148b22ddef2a288fc5f8f40855bda22ccf60be53340b4931e469ae2a"), mhV2)
		})

		t.Run("cache should be used", func(t *testing.T) {
			// Cache is internal to Service, test that repeated calls return same value
			hash1 := svc.ModuleHash(context.Background(), pluginID, "1.0.0")
			hash2 := svc.ModuleHash(context.Background(), pluginID, "1.0.0")
			require.Equal(t, hash1, hash2, "should return cached value on second call")
		})
	})
}

func TestConvertHashFromSRI(t *testing.T) {
	for _, tc := range []struct {
		hash    string
		expHash string
		expErr  bool
	}{
		{
			hash:    "ddfcb449445064e6c39f0c20b15be3cb6a55837cf4781df23d02de005f436811",
			expHash: "sha256-3fy0SURQZObDnwwgsVvjy2pVg3z0eB3yPQLeAF9DaBE=",
		},
		{
			hash:   "not-a-valid-hash",
			expErr: true,
		},
	} {
		t.Run(tc.hash, func(t *testing.T) {
			r, err := convertHashForSRI(tc.hash)
			if tc.expErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.Equal(t, tc.expHash, r)
			}
		})
	}
}

func newTestPlugin(pluginID string, opts ...func(*plugins.Plugin)) *plugins.Plugin {
	p := &plugins.Plugin{
		JSONData: plugins.JSONData{
			ID:   pluginID,
			Info: plugins.Info{Version: ""},
		},
	}
	for _, opt := range opts {
		opt(p)
	}
	return p
}

func withTestInfo(info plugins.Info) func(*plugins.Plugin) {
	return func(p *plugins.Plugin) {
		p.JSONData.Info = info
	}
}

func withTestFS(fs plugins.FS) func(*plugins.Plugin) {
	return func(p *plugins.Plugin) {
		p.FS = fs
	}
}

func withTestSignatureStatus(status plugins.SignatureStatus) func(*plugins.Plugin) {
	return func(p *plugins.Plugin) {
		p.Signature = status
	}
}

func withTestAngular(angular bool) func(*plugins.Plugin) {
	return func(p *plugins.Plugin) {
		p.Angular = plugins.AngularMeta{Detected: angular}
	}
}

func withTestClass(class plugins.Class) func(*plugins.Plugin) {
	return func(p *plugins.Plugin) {
		p.Class = class
	}
}

func newPluginSettings(pluginID string, kv map[string]string) config.PluginSettings {
	return config.PluginSettings{
		pluginID: kv,
	}
}

func mustConvertHashForSRI(t *testing.T, s string) string {
	result, err := convertHashForSRI(s)
	require.NoError(t, err)
	return result
}

// cdnFS is a simple FS implementation that returns FSTypeCDN
type cdnFS struct{}

func newCDNFS() plugins.FS {
	return &cdnFS{}
}

func (f *cdnFS) Open(name string) (fs.File, error) {
	return nil, plugins.ErrFileNotExist
}

func (f *cdnFS) Type() plugins.FSType {
	return plugins.FSTypeCDN
}

func (f *cdnFS) Base() string {
	return ""
}

func (f *cdnFS) Files() ([]string, error) {
	return nil, nil
}

func (f *cdnFS) Rel(string) (string, error) {
	return "", nil
}

// testRegistry is a test registry that supports multiple versions of the same plugin
type testRegistry struct {
	store map[string]*plugins.Plugin // key: pluginID:version, value: plugin
}

func newTestRegistry() *testRegistry {
	return &testRegistry{
		store: make(map[string]*plugins.Plugin),
	}
}

func (r *testRegistry) Plugin(_ context.Context, id, version string) (*plugins.Plugin, bool) {
	key := id + ":" + version
	p, exists := r.store[key]
	return p, exists
}

func (r *testRegistry) Plugins(_ context.Context) []*plugins.Plugin {
	res := make([]*plugins.Plugin, 0, len(r.store))
	for _, p := range r.store {
		res = append(res, p)
	}
	return res
}

func (r *testRegistry) Add(_ context.Context, p *plugins.Plugin) error {
	version := p.Info.Version
	key := p.ID + ":" + version
	r.store[key] = p
	return nil
}

func (r *testRegistry) Remove(_ context.Context, id, version string) error {
	key := id + ":" + version
	delete(r.store, key)
	return nil
}

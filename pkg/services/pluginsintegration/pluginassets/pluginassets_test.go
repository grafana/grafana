package pluginassets

import (
	"context"
	"fmt"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/manager/signature/statickey"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
)

func TestService_Calculate(t *testing.T) {
	const pluginID = "grafana-test-datasource"

	const (
		incompatVersion = "4.14.0"
		compatVersion   = CreatePluginVersionScriptSupportEnabled
		futureVersion   = "5.0.0"
	)

	tcs := []struct {
		name           string
		pluginSettings setting.PluginSettings
		plugin         pluginstore.Plugin
		expected       plugins.LoadingStrategy
	}{
		{
			name: "Expected LoadingStrategyScript when create-plugin version is compatible and plugin is not angular",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				CreatePluginVersionCfgKey: compatVersion,
			}),
			plugin:   newPlugin(pluginID, withAngular(false)),
			expected: plugins.LoadingStrategyScript,
		},
		{
			name: "Expected LoadingStrategyScript when parent create-plugin version is compatible and plugin is not angular",
			pluginSettings: newPluginSettings("parent-datasource", map[string]string{
				CreatePluginVersionCfgKey: compatVersion,
			}),
			plugin: newPlugin(pluginID, withAngular(false), func(p pluginstore.Plugin) pluginstore.Plugin {
				p.Parent = &pluginstore.ParentPlugin{ID: "parent-datasource"}
				return p
			}),
			expected: plugins.LoadingStrategyScript,
		},
		{
			name: "Expected LoadingStrategyScript when create-plugin version is future compatible and plugin is not angular",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				CreatePluginVersionCfgKey: futureVersion,
			}),
			plugin:   newPlugin(pluginID, withAngular(false)),
			expected: plugins.LoadingStrategyScript,
		},
		{
			name:           "Expected LoadingStrategyScript when create-plugin version is not provided, plugin is not angular and is not configured as CDN enabled",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				// NOTE: cdn key is not set
			}),
			plugin:   newPlugin(pluginID, withAngular(false)),
			expected: plugins.LoadingStrategyScript,
		},
		{
			name: "Expected LoadingStrategyScript when create-plugin version is not compatible, plugin is not angular, is not configured as CDN enabled and does not have the CDN class",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				CreatePluginVersionCfgKey: incompatVersion,
				// NOTE: cdn key is not set
			}),
			plugin:   newPlugin(pluginID, withAngular(false), withClass(plugins.ClassExternal)),
			expected: plugins.LoadingStrategyScript,
		},
		{
			name: "Expected LoadingStrategyFetch when parent create-plugin version is not set, is configured as CDN enabled and plugin is not angular",
			pluginSettings: setting.PluginSettings{
				"parent-datasource": {
					"cdn": "true",
				},
			},
			plugin: newPlugin(pluginID, withAngular(false), func(p pluginstore.Plugin) pluginstore.Plugin {
				p.Parent = &pluginstore.ParentPlugin{ID: "parent-datasource"}
				return p
			}),
			expected: plugins.LoadingStrategyFetch,
		},
		{
			name: "Expected LoadingStrategyFetch when parent create-plugin version is not set, is configured as CDN enabled and plugin is angular",
			pluginSettings: setting.PluginSettings{
				"parent-datasource": {
					"cdn": "true",
				},
			},
			plugin: newPlugin(pluginID, withAngular(true), func(p pluginstore.Plugin) pluginstore.Plugin {
				p.Parent = &pluginstore.ParentPlugin{ID: "parent-datasource"}
				return p
			}),
			expected: plugins.LoadingStrategyFetch,
		},
		{
			name:           "Expected LoadingStrategyFetch when parent create-plugin version is not set, is not configured as CDN enabled and plugin is angular",
			pluginSettings: setting.PluginSettings{},
			plugin: newPlugin(pluginID, withAngular(true), func(p pluginstore.Plugin) pluginstore.Plugin {
				p.Parent = &pluginstore.ParentPlugin{ID: "parent-datasource"}
				return p
			}),
			expected: plugins.LoadingStrategyFetch,
		},
		{
			name: "Expected LoadingStrategyFetch when create-plugin version is not compatible, plugin is not angular, is configured as CDN enabled and does not have the CDN class",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				"cdn":                     "true",
				CreatePluginVersionCfgKey: incompatVersion,
			}),
			plugin:   newPlugin(pluginID, withAngular(false), withClass(plugins.ClassExternal)),
			expected: plugins.LoadingStrategyFetch,
		},
		{
			name: "Expected LoadingStrategyFetch when create-plugin version is not compatible and plugin is angular",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				CreatePluginVersionCfgKey: incompatVersion,
			}),
			plugin:   newPlugin(pluginID, withAngular(true)),
			expected: plugins.LoadingStrategyFetch,
		},
		{
			name: "Expected LoadingStrategyFetch when create-plugin version is not compatible, plugin is not angular and plugin is configured as CDN enabled",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				"cdn":                     "true",
				CreatePluginVersionCfgKey: incompatVersion,
			}),
			plugin:   newPlugin(pluginID, withAngular(false)),
			expected: plugins.LoadingStrategyFetch,
		},
		{
			name: "Expected LoadingStrategyFetch when create-plugin version is not compatible, plugin is not angular and has the CDN class",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				CreatePluginVersionCfgKey: incompatVersion,
			}),
			plugin:   newPlugin(pluginID, withAngular(false), withClass(plugins.ClassCDN)),
			expected: plugins.LoadingStrategyFetch,
		},
		{
			name: "Expected LoadingStrategyScript when plugin setting create-plugin version is badly formatted, plugin is not configured as CDN enabled and does not have the CDN class",
			pluginSettings: newPluginSettings(pluginID, map[string]string{
				CreatePluginVersionCfgKey: "invalidSemver",
			}),
			plugin:   newPlugin(pluginID, withAngular(false)),
			expected: plugins.LoadingStrategyScript,
		},
	}
	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			s := &Service{
				cfg: newCfg(tc.pluginSettings),
				cdn: pluginscdn.ProvideService(&config.PluginManagementCfg{
					PluginsCDNURLTemplate: "http://cdn.example.com", // required for cdn.PluginSupported check
					PluginSettings:        tc.pluginSettings,
				}),
				log: log.NewNopLogger(),
			}

			got := s.LoadingStrategy(context.Background(), tc.plugin)
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
		store    []pluginstore.Plugin

		// Can be used to configure plugin's class
		// cdn class = loaded from CDN with no files on disk
		// external class = files on disk but served from CDN only if cdn=true
		plugin pluginstore.Plugin

		// When true, set cdn=true in config
		cdn           bool
		expModuleHash string
	}{
		{
			name:          "unsigned should not return module hash",
			plugin:        newPlugin(pluginID, withSignatureStatus(plugins.SignatureStatusUnsigned)),
			cdn:           false,
			features:      &config.Features{SriChecksEnabled: false},
			expModuleHash: "",
		},
		{
			plugin: newPlugin(
				pluginID,
				withSignatureStatus(plugins.SignatureStatusValid),
				withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid"))),
				withClass(plugins.ClassCDN),
			),
			cdn:           true,
			features:      &config.Features{SriChecksEnabled: true},
			expModuleHash: newSRIHash(t, "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03"),
		},
		{
			plugin: newPlugin(
				pluginID,
				withSignatureStatus(plugins.SignatureStatusValid),
				withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid"))),
				withClass(plugins.ClassExternal),
			),
			cdn:           true,
			features:      &config.Features{SriChecksEnabled: true},
			expModuleHash: newSRIHash(t, "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03"),
		},
		{
			plugin: newPlugin(
				pluginID,
				withSignatureStatus(plugins.SignatureStatusValid),
				withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid"))),
			),
			cdn:           false,
			features:      &config.Features{SriChecksEnabled: true},
			expModuleHash: "",
		},
		{
			plugin: newPlugin(
				pluginID,
				withSignatureStatus(plugins.SignatureStatusValid),
				withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid"))),
				withClass(plugins.ClassCDN),
			),
			cdn:           true,
			features:      &config.Features{SriChecksEnabled: false},
			expModuleHash: "",
		},
		{
			plugin: newPlugin(
				pluginID,
				withSignatureStatus(plugins.SignatureStatusValid),
				withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid"))),
			),
			cdn:           false,
			features:      &config.Features{SriChecksEnabled: false},
			expModuleHash: "",
		},
		{
			// parentPluginID           (/)
			// └── pluginID             (/datasource)
			name: "nested plugin should return module hash from parent MANIFEST.txt",
			store: []pluginstore.Plugin{
				newPlugin(
					parentPluginID,
					withSignatureStatus(plugins.SignatureStatusValid),
					withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-nested"))),
					withClass(plugins.ClassCDN),
				),
			},
			plugin: newPlugin(
				pluginID,
				withSignatureStatus(plugins.SignatureStatusValid),
				withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-nested", "datasource"))),
				withParent(parentPluginID),
				withClass(plugins.ClassCDN),
			),
			cdn:           true,
			features:      &config.Features{SriChecksEnabled: true},
			expModuleHash: newSRIHash(t, "04d70db091d96c4775fb32ba5a8f84cc22893eb43afdb649726661d4425c6711"),
		},
		{
			// parentPluginID           (/)
			// └── pluginID             (/panels/one)
			name: "nested plugin deeper than one subfolder should return module hash from parent MANIFEST.txt",
			store: []pluginstore.Plugin{
				newPlugin(
					parentPluginID,
					withSignatureStatus(plugins.SignatureStatusValid),
					withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-nested"))),
					withClass(plugins.ClassCDN),
				),
			},
			plugin: newPlugin(
				pluginID,
				withSignatureStatus(plugins.SignatureStatusValid),
				withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-nested", "panels", "one"))),
				withParent(parentPluginID),
				withClass(plugins.ClassCDN),
			),
			cdn:           true,
			features:      &config.Features{SriChecksEnabled: true},
			expModuleHash: newSRIHash(t, "cbd1ac2284645a0e1e9a8722a729f5bcdd2b831222728709c6360beecdd6143f"),
		},
		{
			// grand-parent-app         (/)
			// ├── parent-datasource    (/datasource)
			// │   └── child-panel      (/datasource/panels/one)
			name: "nested plugin of a nested plugin should return module hash from parent MANIFEST.txt",
			store: []pluginstore.Plugin{
				newPlugin(
					"grand-parent-app",
					withSignatureStatus(plugins.SignatureStatusValid),
					withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-deeply-nested"))),
					withClass(plugins.ClassCDN),
				),
				newPlugin(
					"parent-datasource",
					withSignatureStatus(plugins.SignatureStatusValid),
					withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-deeply-nested", "datasource"))),
					withParent("grand-parent-app"),
					withClass(plugins.ClassCDN),
				),
			},
			plugin: newPlugin(
				"child-panel",
				withSignatureStatus(plugins.SignatureStatusValid),
				withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-deeply-nested", "datasource", "panels", "one"))),
				withParent("parent-datasource"),
				withClass(plugins.ClassCDN),
			),
			cdn:           true,
			features:      &config.Features{SriChecksEnabled: true},
			expModuleHash: newSRIHash(t, "cbd1ac2284645a0e1e9a8722a729f5bcdd2b831222728709c6360beecdd6143f"),
		},
		{
			name:  "nested plugin should not return module hash from parent if it's not registered in the store",
			store: []pluginstore.Plugin{},
			plugin: newPlugin(
				pluginID,
				withSignatureStatus(plugins.SignatureStatusValid),
				withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-nested", "panels", "one"))),
				withParent(parentPluginID),
			),
			cdn:           false,
			features:      &config.Features{SriChecksEnabled: true},
			expModuleHash: "",
		},
		{
			name: "missing module.js entry from MANIFEST.txt should not return module hash",
			plugin: newPlugin(
				pluginID,
				withSignatureStatus(plugins.SignatureStatusValid),
				withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-no-module-js"))),
			),
			cdn:           false,
			features:      &config.Features{SriChecksEnabled: true},
			expModuleHash: "",
		},
		{
			name: "signed status but missing MANIFEST.txt should not return module hash",
			plugin: newPlugin(
				pluginID,
				withSignatureStatus(plugins.SignatureStatusValid),
				withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-no-manifest-txt"))),
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
			var pluginSettings setting.PluginSettings
			if tc.cdn {
				pluginSettings = newPluginSettings(pluginID, map[string]string{
					"cdn": "true",
				})
			} else {
				require.NotEqual(t, plugins.ClassCDN, tc.plugin.Class, "plugin should not have the CDN class because CDN is disabled")
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
			svc := ProvideService(
				pCfg,
				pluginscdn.ProvideService(pCfg),
				signature.ProvideService(pCfg, statickey.New()),
				pluginstore.NewFakePluginStore(tc.store...),
			)
			mh := svc.ModuleHash(context.Background(), tc.plugin)
			require.Equal(t, tc.expModuleHash, mh)
		})
	}
}

func TestService_ModuleHash_Cache(t *testing.T) {
	pCfg := &config.PluginManagementCfg{
		PluginSettings: setting.PluginSettings{},
		Features:       config.Features{SriChecksEnabled: true},
	}
	svc := ProvideService(
		pCfg,
		pluginscdn.ProvideService(pCfg),
		signature.ProvideService(pCfg, statickey.New()),
		pluginstore.NewFakePluginStore(),
	)
	const pluginID = "grafana-test-datasource"

	t.Run("cache key", func(t *testing.T) {
		t.Run("with version", func(t *testing.T) {
			const pluginVersion = "1.0.0"
			p := newPlugin(pluginID, withInfo(plugins.Info{Version: pluginVersion}))
			k := svc.moduleHashCacheKey(p)
			require.Equal(t, pluginID+":"+pluginVersion, k, "cache key should be correct")
		})

		t.Run("without version", func(t *testing.T) {
			p := newPlugin(pluginID)
			k := svc.moduleHashCacheKey(p)
			require.Equal(t, pluginID+":", k, "cache key should be correct")
		})
	})

	t.Run("ModuleHash usage", func(t *testing.T) {
		pV1 := newPlugin(
			pluginID,
			withInfo(plugins.Info{Version: "1.0.0"}),
			withSignatureStatus(plugins.SignatureStatusValid),
			withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid"))),
			withClass(plugins.ClassCDN),
		)
		k := svc.moduleHashCacheKey(pV1)

		_, ok := svc.moduleHashCache.Load(k)
		require.False(t, ok, "cache should initially be empty")

		mhV1 := svc.ModuleHash(context.Background(), pV1)
		pV1Exp := newSRIHash(t, "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03")
		require.Equal(t, pV1Exp, mhV1, "returned value should be correct")

		cachedMh, ok := svc.moduleHashCache.Load(k)
		require.True(t, ok)
		require.Equal(t, pV1Exp, cachedMh, "cache should contain the returned value")

		t.Run("different version uses different cache key", func(t *testing.T) {
			pV2 := newPlugin(
				pluginID,
				withInfo(plugins.Info{Version: "2.0.0"}),
				withSignatureStatus(plugins.SignatureStatusValid),
				// different fs for different hash
				withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-nested"))),
				withClass(plugins.ClassCDN),
			)
			mhV2 := svc.ModuleHash(context.Background(), pV2)
			require.NotEqual(t, mhV2, mhV1, "different version should have different hash")
			require.Equal(t, newSRIHash(t, "266c19bc148b22ddef2a288fc5f8f40855bda22ccf60be53340b4931e469ae2a"), mhV2)
		})

		t.Run("cache should be used", func(t *testing.T) {
			// edit cache directly
			svc.moduleHashCache.Store(k, "hax")
			require.Equal(t, "hax", svc.ModuleHash(context.Background(), pV1))
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

func newPlugin(pluginID string, cbs ...func(p pluginstore.Plugin) pluginstore.Plugin) pluginstore.Plugin {
	p := pluginstore.Plugin{
		JSONData: plugins.JSONData{
			ID: pluginID,
		},
	}
	for _, cb := range cbs {
		p = cb(p)
	}
	return p
}

func withInfo(info plugins.Info) func(p pluginstore.Plugin) pluginstore.Plugin {
	return func(p pluginstore.Plugin) pluginstore.Plugin {
		p.Info = info
		return p
	}
}

func withFS(fs plugins.FS) func(p pluginstore.Plugin) pluginstore.Plugin {
	return func(p pluginstore.Plugin) pluginstore.Plugin {
		p.FS = fs
		return p
	}
}

func withSignatureStatus(status plugins.SignatureStatus) func(p pluginstore.Plugin) pluginstore.Plugin {
	return func(p pluginstore.Plugin) pluginstore.Plugin {
		p.Signature = status
		return p
	}
}

func withAngular(angular bool) func(p pluginstore.Plugin) pluginstore.Plugin {
	return func(p pluginstore.Plugin) pluginstore.Plugin {
		p.Angular = plugins.AngularMeta{Detected: angular}
		return p
	}
}

func withParent(parentID string) func(p pluginstore.Plugin) pluginstore.Plugin {
	return func(p pluginstore.Plugin) pluginstore.Plugin {
		p.Parent = &pluginstore.ParentPlugin{ID: parentID}
		return p
	}
}

func withClass(class plugins.Class) func(p pluginstore.Plugin) pluginstore.Plugin {
	return func(p pluginstore.Plugin) pluginstore.Plugin {
		p.Class = class
		return p
	}
}

func newCfg(ps setting.PluginSettings) *config.PluginManagementCfg {
	return &config.PluginManagementCfg{
		PluginSettings: ps,
	}
}

func newPluginSettings(pluginID string, kv map[string]string) setting.PluginSettings {
	return setting.PluginSettings{
		pluginID: kv,
	}
}

func newSRIHash(t *testing.T, s string) string {
	r, err := convertHashForSRI(s)
	require.NoError(t, err)
	return r
}

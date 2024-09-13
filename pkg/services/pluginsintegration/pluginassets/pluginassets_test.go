package pluginassets

import (
	"context"
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
		plugin         *pluginstore.Plugin
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
			plugin: newPlugin(pluginID, withAngular(false), func(p pluginstore.Plugin) pluginstore.Plugin {
				p.Class = plugins.ClassExternal
				return p
			}),
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
			plugin: newPlugin(pluginID, withAngular(false), func(p pluginstore.Plugin) pluginstore.Plugin {
				p.Class = plugins.ClassExternal
				return p
			}),
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
			plugin: newPlugin(pluginID, withAngular(false), func(p pluginstore.Plugin) pluginstore.Plugin {
				p.Class = plugins.ClassCDN
				return p
			}),
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

			got := s.LoadingStrategy(context.Background(), *tc.plugin)
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
		name          string
		features      *config.Features
		store         []*pluginstore.Plugin
		plugin        *pluginstore.Plugin
		cdn           bool
		expModuleHash string
	}{
		{
			name:          "unsigned should not return module hash",
			plugin:        newPlugin(pluginID, withSignatureStatus(plugins.SignatureStatusUnsigned)),
			cdn:           false,
			features:      &config.Features{FilesystemSriChecksEnabled: false},
			expModuleHash: "",
		},
		{
			name: "cdn on should return module hash",
			plugin: newPlugin(
				pluginID,
				withSignatureStatus(plugins.SignatureStatusValid),
				withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid"))),
			),
			cdn:           true,
			features:      &config.Features{FilesystemSriChecksEnabled: false},
			expModuleHash: newSRIHash(t, "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03"),
		},
		{
			name: "cdn off without feature should not return module hash",
			plugin: newPlugin(
				pluginID,
				withSignatureStatus(plugins.SignatureStatusValid),
				withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid"))),
			),
			cdn:           false,
			features:      &config.Features{FilesystemSriChecksEnabled: false},
			expModuleHash: "",
		},
		{
			name: "cdn off with feature should not return module hash",
			plugin: newPlugin(
				pluginID,
				withSignatureStatus(plugins.SignatureStatusValid),
				withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid"))),
			),
			cdn:           false,
			features:      &config.Features{FilesystemSriChecksEnabled: true},
			expModuleHash: newSRIHash(t, "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03"),
		},
		{
			// parentPluginID           (/)
			// └── pluginID             (/datasource)
			name: "nested plugin should return module hash from parent MANIFEST.txt",
			store: []*pluginstore.Plugin{
				newPlugin(
					parentPluginID,
					withSignatureStatus(plugins.SignatureStatusValid),
					withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-nested"))),
				),
			},
			plugin: newPlugin(
				pluginID,
				withSignatureStatus(plugins.SignatureStatusValid),
				withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-nested", "datasource"))),
				withParent(parentPluginID),
			),
			cdn:           false,
			features:      &config.Features{FilesystemSriChecksEnabled: true},
			expModuleHash: newSRIHash(t, "04d70db091d96c4775fb32ba5a8f84cc22893eb43afdb649726661d4425c6711"),
		},
		{
			// parentPluginID           (/)
			// └── pluginID             (/panels/one)
			name: "nested plugin deeper than one subfolder should return module hash from parent MANIFEST.txt",
			store: []*pluginstore.Plugin{
				newPlugin(
					parentPluginID,
					withSignatureStatus(plugins.SignatureStatusValid),
					withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-nested"))),
				),
			},
			plugin: newPlugin(
				pluginID,
				withSignatureStatus(plugins.SignatureStatusValid),
				withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-nested", "panels", "one"))),
				withParent(parentPluginID),
			),
			cdn:           false,
			features:      &config.Features{FilesystemSriChecksEnabled: true},
			expModuleHash: newSRIHash(t, "cbd1ac2284645a0e1e9a8722a729f5bcdd2b831222728709c6360beecdd6143f"),
		},
		{
			// grand-parent-app         (/)
			// ├── parent-datasource    (/datasource)
			// │   └── child-panel      (/datasource/panels/one)
			name: "nested plugin of a nested plugin should return module hash from parent MANIFEST.txt",
			store: []*pluginstore.Plugin{
				newPlugin(
					"grand-parent-app",
					withSignatureStatus(plugins.SignatureStatusValid),
					withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-deeply-nested"))),
				),
				newPlugin(
					"parent-datasource",
					withSignatureStatus(plugins.SignatureStatusValid),
					withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-deeply-nested", "datasource"))),
					withParent("grand-parent-app"),
				),
			},
			plugin: newPlugin(
				"child-panel",
				withSignatureStatus(plugins.SignatureStatusValid),
				withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-deeply-nested", "datasource", "panels", "one"))),
				withParent("parent-datasource"),
			),
			cdn:           false,
			features:      &config.Features{FilesystemSriChecksEnabled: true},
			expModuleHash: newSRIHash(t, "cbd1ac2284645a0e1e9a8722a729f5bcdd2b831222728709c6360beecdd6143f"),
		},
		{
			name:  "nested plugin should not return module hash from parent if it's not registered in the store",
			store: []*pluginstore.Plugin{},
			plugin: newPlugin(
				pluginID,
				withSignatureStatus(plugins.SignatureStatusValid),
				withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-nested", "panels", "one"))),
				withParent(parentPluginID),
			),
			cdn:           false,
			features:      &config.Features{FilesystemSriChecksEnabled: true},
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
			features:      &config.Features{FilesystemSriChecksEnabled: true},
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
			features:      &config.Features{FilesystemSriChecksEnabled: true},
			expModuleHash: "",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var pluginSettings setting.PluginSettings
			if tc.cdn {
				pluginSettings = newPluginSettings(pluginID, map[string]string{
					"cdn": "true",
				})
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
			sigSvc := signature.ProvideService(pCfg, statickey.New())
			for _, p := range append([]*pluginstore.Plugin{tc.plugin}, tc.store...) {
				if p.FS == nil {
					continue
				}
				if manifest, _ := sigSvc.ReadPluginManifestFromFS(context.Background(), p.FS); manifest != nil {
					p.SignatureFiles = manifest.Files
				}
			}

			storeCopy := make([]pluginstore.Plugin, len(tc.store))
			for i, p := range tc.store {
				storeCopy[i] = *p
			}
			svc := ProvideService(
				pCfg,
				pluginscdn.ProvideService(pCfg),
				pluginstore.NewFakePluginStore(storeCopy...),
			)
			mh := svc.ModuleHash(context.Background(), *tc.plugin)
			require.Equal(t, tc.expModuleHash, mh)
		})
	}
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

func newPlugin(pluginID string, cbs ...func(p pluginstore.Plugin) pluginstore.Plugin) *pluginstore.Plugin {
	p := pluginstore.Plugin{
		JSONData: plugins.JSONData{
			ID: pluginID,
		},
	}
	for _, cb := range cbs {
		p = cb(p)
	}
	return &p
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

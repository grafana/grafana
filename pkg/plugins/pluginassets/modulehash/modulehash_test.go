package modulehash

import (
	"context"
	"fmt"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/manager/signature/statickey"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
)

func TestService_ModuleHash(t *testing.T) {
	const (
		pluginID       = "grafana-test-datasource"
		parentPluginID = "grafana-test-app"
	)
	for _, tc := range []struct {
		name     string
		features *config.Features
		registry []*plugins.Plugin

		// Can be used to configure plugin's fs
		// fs cdn type = loaded from CDN with no files on disk
		// fs local type = files on disk but served from CDN only if cdn=true
		plugin string

		// When true, set cdn=true in config
		cdn           bool
		expModuleHash string
	}{
		{
			name:          "unsigned should not return module hash",
			plugin:        pluginID,
			registry:      []*plugins.Plugin{newPlugin(pluginID, withSignatureStatus(plugins.SignatureStatusUnsigned))},
			cdn:           false,
			features:      &config.Features{SriChecksEnabled: false},
			expModuleHash: "",
		},
		{
			plugin: pluginID,
			registry: []*plugins.Plugin{newPlugin(
				pluginID,
				withSignatureStatus(plugins.SignatureStatusValid),
				withFS(plugins.NewLocalFS(filepath.Join("../testdata", "module-hash-valid"))),
				withClass(plugins.ClassExternal),
			)},
			cdn:           true,
			features:      &config.Features{SriChecksEnabled: true},
			expModuleHash: newSRIHash(t, "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03"),
		},
		{
			plugin: pluginID,
			registry: []*plugins.Plugin{newPlugin(
				pluginID,
				withSignatureStatus(plugins.SignatureStatusValid),
				withFS(plugins.NewLocalFS(filepath.Join("../testdata", "module-hash-valid"))),
				withClass(plugins.ClassExternal),
			)},
			cdn:           true,
			features:      &config.Features{SriChecksEnabled: true},
			expModuleHash: newSRIHash(t, "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03"),
		},
		{
			plugin: pluginID,
			registry: []*plugins.Plugin{newPlugin(
				pluginID,
				withSignatureStatus(plugins.SignatureStatusValid),
				withFS(plugins.NewLocalFS(filepath.Join("../testdata", "module-hash-valid"))),
			)},
			cdn:           false,
			features:      &config.Features{SriChecksEnabled: true},
			expModuleHash: "",
		},
		{
			plugin: pluginID,
			registry: []*plugins.Plugin{newPlugin(
				pluginID,
				withSignatureStatus(plugins.SignatureStatusValid),
				withFS(plugins.NewLocalFS(filepath.Join("../testdata", "module-hash-valid"))),
			)},
			cdn:           true,
			features:      &config.Features{SriChecksEnabled: false},
			expModuleHash: "",
		},
		{
			plugin: pluginID,
			registry: []*plugins.Plugin{newPlugin(
				pluginID,
				withSignatureStatus(plugins.SignatureStatusValid),
				withFS(plugins.NewLocalFS(filepath.Join("../testdata", "module-hash-valid"))),
			)},
			cdn:           false,
			features:      &config.Features{SriChecksEnabled: false},
			expModuleHash: "",
		},
		{
			// parentPluginID           (/)
			// └── pluginID             (/datasource)
			name:   "nested plugin should return module hash from parent MANIFEST.txt",
			plugin: pluginID,
			registry: []*plugins.Plugin{
				newPlugin(
					pluginID,
					withSignatureStatus(plugins.SignatureStatusValid),
					withFS(plugins.NewLocalFS(filepath.Join("../testdata", "module-hash-valid-nested", "datasource"))),
					withParent(newPlugin(
						parentPluginID,
						withSignatureStatus(plugins.SignatureStatusValid),
						withFS(plugins.NewLocalFS(filepath.Join("../testdata", "module-hash-valid-nested"))),
					)),
				),
			},
			cdn:           true,
			features:      &config.Features{SriChecksEnabled: true},
			expModuleHash: newSRIHash(t, "04d70db091d96c4775fb32ba5a8f84cc22893eb43afdb649726661d4425c6711"),
		},
		{
			// parentPluginID           (/)
			// └── pluginID             (/panels/one)
			name:   "nested plugin deeper than one subfolder should return module hash from parent MANIFEST.txt",
			plugin: pluginID,
			registry: []*plugins.Plugin{
				newPlugin(
					pluginID,
					withSignatureStatus(plugins.SignatureStatusValid),
					withFS(plugins.NewLocalFS(filepath.Join("../testdata", "module-hash-valid-nested", "panels", "one"))),
					withParent(newPlugin(
						parentPluginID,
						withSignatureStatus(plugins.SignatureStatusValid),
						withFS(plugins.NewLocalFS(filepath.Join("../testdata", "module-hash-valid-nested"))),
					)),
				),
			},
			cdn:           true,
			features:      &config.Features{SriChecksEnabled: true},
			expModuleHash: newSRIHash(t, "cbd1ac2284645a0e1e9a8722a729f5bcdd2b831222728709c6360beecdd6143f"),
		},
		{
			// grand-parent-app         (/)
			// ├── parent-datasource    (/datasource)
			// │   └── child-panel      (/datasource/panels/one)
			name: "nested plugin of a nested plugin should return module hash from parent MANIFEST.txt",
			registry: []*plugins.Plugin{
				newPlugin(
					"child-panel",
					withSignatureStatus(plugins.SignatureStatusValid),
					withFS(plugins.NewLocalFS(filepath.Join("../testdata", "module-hash-valid-deeply-nested", "datasource", "panels", "one"))),
					withParent(newPlugin(
						"parent-datasource",
						withSignatureStatus(plugins.SignatureStatusValid),
						withFS(plugins.NewLocalFS(filepath.Join("../testdata", "module-hash-valid-deeply-nested", "datasource"))),
						withParent(newPlugin(
							"grand-parent-app",
							withSignatureStatus(plugins.SignatureStatusValid),
							withFS(plugins.NewLocalFS(filepath.Join("../testdata", "module-hash-valid-deeply-nested"))),
						)),
					),
					),
				),
			},
			plugin:        "child-panel",
			cdn:           true,
			features:      &config.Features{SriChecksEnabled: true},
			expModuleHash: newSRIHash(t, "cbd1ac2284645a0e1e9a8722a729f5bcdd2b831222728709c6360beecdd6143f"),
		},
		{
			name:   "nested plugin should not return module hash from parent if it's not registered in the registry",
			plugin: pluginID,
			registry: []*plugins.Plugin{newPlugin(
				pluginID,
				withSignatureStatus(plugins.SignatureStatusValid),
					withFS(plugins.NewLocalFS(filepath.Join("../testdata", "module-hash-valid-nested", "panels", "one"))),
				withParent(newPlugin(
					parentPluginID,
					withSignatureStatus(plugins.SignatureStatusValid),
					withFS(plugins.NewLocalFS(filepath.Join("../testdata", "module-hash-valid-nested"))),
				)),
			)},
			cdn:           false,
			features:      &config.Features{SriChecksEnabled: true},
			expModuleHash: "",
		},
		{
			name:   "missing module.js entry from MANIFEST.txt should not return module hash",
			plugin: pluginID,
			registry: []*plugins.Plugin{newPlugin(
				pluginID,
				withSignatureStatus(plugins.SignatureStatusValid),
				withFS(plugins.NewLocalFS(filepath.Join("../testdata", "module-hash-no-module-js"))),
			)},
			cdn:           false,
			features:      &config.Features{SriChecksEnabled: true},
			expModuleHash: "",
		},
		{
			name:   "signed status but missing MANIFEST.txt should not return module hash",
			plugin: pluginID,
			registry: []*plugins.Plugin{newPlugin(
				pluginID,
				withSignatureStatus(plugins.SignatureStatusValid),
				withFS(plugins.NewLocalFS(filepath.Join("../testdata", "module-hash-no-manifest-txt"))),
			)},
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
			tc.name = fmt.Sprintf("feature=%v, cdn_config=%v %s", tc.features.SriChecksEnabled, tc.cdn, expS)
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

			svc := NewModuleHashCalculator(
				pCfg,
				newPluginRegistry(t, tc.registry...),
				pluginscdn.ProvideService(pCfg),
				signature.ProvideService(pCfg, statickey.New()),
			)
			mh := svc.ModuleHash(context.Background(), tc.plugin, "")
			require.Equal(t, tc.expModuleHash, mh)
		})
	}
}

func TestService_ModuleHash_Cache(t *testing.T) {
	pCfg := &config.PluginManagementCfg{
		PluginSettings: config.PluginSettings{},
		Features:       config.Features{SriChecksEnabled: true},
	}
	svc := NewModuleHashCalculator(
		pCfg,
		newPluginRegistry(t),
		pluginscdn.ProvideService(pCfg),
		signature.ProvideService(pCfg, statickey.New()),
	)
	const pluginID = "grafana-test-datasource"

	t.Run("cache key", func(t *testing.T) {
		t.Run("with version", func(t *testing.T) {
			const pluginVersion = "1.0.0"
			p := newPlugin(pluginID, withInfo(plugins.Info{Version: pluginVersion}))
			k := svc.moduleHashCacheKey(p.ID, p.Info.Version)
			require.Equal(t, pluginID+":"+pluginVersion, k, "cache key should be correct")
		})

		t.Run("without version", func(t *testing.T) {
			p := newPlugin(pluginID)
			k := svc.moduleHashCacheKey(p.ID, p.Info.Version)
			require.Equal(t, pluginID+":", k, "cache key should be correct")
		})
	})

	t.Run("ModuleHash usage", func(t *testing.T) {
		pV1 := newPlugin(
			pluginID,
			withInfo(plugins.Info{Version: "1.0.0"}),
			withSignatureStatus(plugins.SignatureStatusValid),
			withFS(plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid"))),
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
		reg := newPluginRegistry(t, pV1)
		svc = NewModuleHashCalculator(
			pCfg,
			reg,
			pluginscdn.ProvideService(pCfg),
			signature.ProvideService(pCfg, statickey.New()),
		)

		k := svc.moduleHashCacheKey(pV1.ID, pV1.Info.Version)

		_, ok := svc.moduleHashCache.Load(k)
		require.False(t, ok, "cache should initially be empty")

		mhV1 := svc.ModuleHash(context.Background(), pV1.ID, pV1.Info.Version)
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
				withFS(plugins.NewLocalFS(filepath.Join("../testdata", "module-hash-valid-nested"))),
			)
			err := reg.Add(context.Background(), pV2)
			require.NoError(t, err)

			mhV2 := svc.ModuleHash(context.Background(), pV2.ID, pV2.Info.Version)
			require.NotEqual(t, mhV2, mhV1, "different version should have different hash")
			require.Equal(t, newSRIHash(t, "266c19bc148b22ddef2a288fc5f8f40855bda22ccf60be53340b4931e469ae2a"), mhV2)
		})

		t.Run("cache should be used", func(t *testing.T) {
			// edit cache directly
			svc.moduleHashCache.Store(k, "hax")
			require.Equal(t, "hax", svc.ModuleHash(context.Background(), pV1.ID, pV1.Info.Version))
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

func newPlugin(pluginID string, cbs ...func(p *plugins.Plugin) *plugins.Plugin) *plugins.Plugin {
	p := &plugins.Plugin{
		JSONData: plugins.JSONData{
			ID: pluginID,
		},
	}
	for _, cb := range cbs {
		p = cb(p)
	}
	return p
}

func withInfo(info plugins.Info) func(p *plugins.Plugin) *plugins.Plugin {
	return func(p *plugins.Plugin) *plugins.Plugin {
		p.Info = info
		return p
	}
}

func withFS(fs plugins.FS) func(p *plugins.Plugin) *plugins.Plugin {
	return func(p *plugins.Plugin) *plugins.Plugin {
		p.FS = fs
		return p
	}
}

func withSignatureStatus(status plugins.SignatureStatus) func(p *plugins.Plugin) *plugins.Plugin {
	return func(p *plugins.Plugin) *plugins.Plugin {
		p.Signature = status
		return p
	}
}

func withParent(parent *plugins.Plugin) func(p *plugins.Plugin) *plugins.Plugin {
	return func(p *plugins.Plugin) *plugins.Plugin {
		p.Parent = parent
		return p
	}
}

func withClass(class plugins.Class) func(p *plugins.Plugin) *plugins.Plugin {
	return func(p *plugins.Plugin) *plugins.Plugin {
		p.Class = class
		return p
	}
}

func newSRIHash(t *testing.T, s string) string {
	r, err := convertHashForSRI(s)
	require.NoError(t, err)
	return r
}

type pluginRegistry struct {
	registry.Service

	reg map[string]*plugins.Plugin
}

func newPluginRegistry(t *testing.T, ps ...*plugins.Plugin) *pluginRegistry {
	reg := &pluginRegistry{
		reg: make(map[string]*plugins.Plugin),
	}
	for _, p := range ps {
		err := reg.Add(context.Background(), p)
		require.NoError(t, err)
	}
	return reg
}

func (f *pluginRegistry) Plugin(_ context.Context, id, version string) (*plugins.Plugin, bool) {
	key := fmt.Sprintf("%s-%s", id, version)
	p, exists := f.reg[key]
	return p, exists
}

func (f *pluginRegistry) Add(_ context.Context, p *plugins.Plugin) error {
	key := fmt.Sprintf("%s-%s", p.ID, p.Info.Version)
	f.reg[key] = p
	return nil
}

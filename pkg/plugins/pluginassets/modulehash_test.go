package pluginassets

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
)

func TestConvertHashForSRI(t *testing.T) {
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
			r := convertHashForSRI(tc.hash)
			if tc.expErr {
				// convertHashForSRI returns empty string on error
				require.Empty(t, r)
			} else {
				require.Equal(t, tc.expHash, r)
			}
		})
	}
}

func TestCalculateModuleHash(t *testing.T) {
	const (
		pluginID       = "grafana-test-datasource"
		parentPluginID = "grafana-test-app"
	)

	// Helper to create a plugin with manifest
	createPluginWithManifest := func(id string, manifest *plugins.PluginManifest, parent *plugins.Plugin) *plugins.Plugin {
		p := &plugins.Plugin{
			JSONData: plugins.JSONData{
				ID: id,
			},
			Signature: plugins.SignatureStatusValid,
			Manifest:  manifest,
		}
		if parent != nil {
			p.Parent = parent
		}
		return p
	}

	// Helper to create a v2 manifest
	createV2Manifest := func(files map[string]string) *plugins.PluginManifest {
		return &plugins.PluginManifest{
			ManifestVersion: "2.0.0",
			Files:           files,
		}
	}

	for _, tc := range []struct {
		name          string
		plugin        *plugins.Plugin
		cfg           *config.PluginManagementCfg
		cdn           *pluginscdn.Service
		expModuleHash string
	}{
		{
			name: "should return empty string when cfg is nil",
			plugin: createPluginWithManifest(pluginID, createV2Manifest(map[string]string{
				"module.js": "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03",
			}), nil),
			cfg:           nil,
			cdn:           nil,
			expModuleHash: "",
		},
		{
			name: "should return empty string when SRI checks are disabled",
			plugin: createPluginWithManifest(pluginID, createV2Manifest(map[string]string{
				"module.js": "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03",
			}), nil),
			cfg:           &config.PluginManagementCfg{Features: config.Features{SriChecksEnabled: false}},
			cdn:           pluginscdn.ProvideService(&config.PluginManagementCfg{}),
			expModuleHash: "",
		},
		{
			name: "should return empty string for unsigned plugin",
			plugin: &plugins.Plugin{
				JSONData:  plugins.JSONData{ID: pluginID},
				Signature: plugins.SignatureStatusUnsigned,
				Manifest:  createV2Manifest(map[string]string{"module.js": "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03"}),
				FS:        plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid")),
			},
			cfg:           &config.PluginManagementCfg{Features: config.Features{SriChecksEnabled: true}},
			cdn:           pluginscdn.ProvideService(&config.PluginManagementCfg{}),
			expModuleHash: "",
		},
		{
			name: "should return module hash for valid plugin",
			plugin: &plugins.Plugin{
				JSONData:  plugins.JSONData{ID: pluginID},
				Signature: plugins.SignatureStatusValid,
				Manifest:  createV2Manifest(map[string]string{"module.js": "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03"}),
				FS:        plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid")),
			},
			cfg: &config.PluginManagementCfg{
				PluginsCDNURLTemplate: "https://cdn.example.com",
				Features:              config.Features{SriChecksEnabled: true},
				PluginSettings: config.PluginSettings{
					pluginID: {"cdn": "true"},
				},
			},
			cdn: func() *pluginscdn.Service {
				cfg := &config.PluginManagementCfg{
					PluginsCDNURLTemplate: "https://cdn.example.com",
					PluginSettings: config.PluginSettings{
						pluginID: {"cdn": "true"},
					},
				}
				return pluginscdn.ProvideService(cfg)
			}(),
			expModuleHash: "sha256-WJG1tSLV3whtD/CxEPvZ0hu0/HFjrzTQgoai6Eb2vgM=",
		},
		{
			name: "should return empty string when manifest is nil",
			plugin: &plugins.Plugin{
				JSONData:  plugins.JSONData{ID: pluginID},
				Signature: plugins.SignatureStatusValid,
				Manifest:  nil,
				FS:        plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid")),
			},
			cfg:           &config.PluginManagementCfg{Features: config.Features{SriChecksEnabled: true}},
			cdn:           pluginscdn.ProvideService(&config.PluginManagementCfg{}),
			expModuleHash: "",
		},
		{
			name: "should return empty string for v1 manifest",
			plugin: &plugins.Plugin{
				JSONData:  plugins.JSONData{ID: pluginID},
				Signature: plugins.SignatureStatusValid,
				Manifest: &plugins.PluginManifest{
					ManifestVersion: "1.0.0",
					Files:           map[string]string{"module.js": "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03"},
				},
				FS: plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid")),
			},
			cfg:           &config.PluginManagementCfg{Features: config.Features{SriChecksEnabled: true}},
			cdn:           pluginscdn.ProvideService(&config.PluginManagementCfg{}),
			expModuleHash: "",
		},
		{
			name: "should return empty string when module.js is not in manifest",
			plugin: &plugins.Plugin{
				JSONData:  plugins.JSONData{ID: pluginID},
				Signature: plugins.SignatureStatusValid,
				Manifest:  createV2Manifest(map[string]string{"plugin.json": "129fab4e0584d18c778ebdfa5fe1a68edf2e5c5aeb8290b2c68182c857cb59f8"}),
				FS:        plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid")),
			},
			cfg:           &config.PluginManagementCfg{Features: config.Features{SriChecksEnabled: true}},
			cdn:           pluginscdn.ProvideService(&config.PluginManagementCfg{}),
			expModuleHash: "",
		},
		{
			name: "missing module.js entry from MANIFEST.txt should not return module hash",
			plugin: &plugins.Plugin{
				JSONData:  plugins.JSONData{ID: pluginID},
				Signature: plugins.SignatureStatusValid,
				Manifest:  createV2Manifest(map[string]string{"plugin.json": "129fab4e0584d18c778ebdfa5fe1a68edf2e5c5aeb8290b2c68182c857cb59f8"}),
				FS:        plugins.NewLocalFS(filepath.Join("testdata", "module-hash-no-module-js")),
			},
			cfg:           &config.PluginManagementCfg{Features: config.Features{SriChecksEnabled: true}},
			cdn:           pluginscdn.ProvideService(&config.PluginManagementCfg{}),
			expModuleHash: "",
		},
		{
			name: "signed status but missing MANIFEST.txt should not return module hash",
			plugin: &plugins.Plugin{
				JSONData:  plugins.JSONData{ID: pluginID},
				Signature: plugins.SignatureStatusValid,
				Manifest:  nil,
				FS:        plugins.NewLocalFS(filepath.Join("testdata", "module-hash-no-manifest-txt")),
			},
			cfg:           &config.PluginManagementCfg{Features: config.Features{SriChecksEnabled: true}},
			cdn:           pluginscdn.ProvideService(&config.PluginManagementCfg{}),
			expModuleHash: "",
		},
		{
			// parentPluginID           (/)
			// └── pluginID             (/datasource)
			name: "nested plugin should return module hash from parent MANIFEST.txt",
			plugin: func() *plugins.Plugin {
				parent := &plugins.Plugin{
					JSONData:  plugins.JSONData{ID: parentPluginID},
					Signature: plugins.SignatureStatusValid,
					Manifest: createV2Manifest(map[string]string{
						"module.js":            "266c19bc148b22ddef2a288fc5f8f40855bda22ccf60be53340b4931e469ae2a",
						"datasource/module.js": "04d70db091d96c4775fb32ba5a8f84cc22893eb43afdb649726661d4425c6711",
					}),
					FS: plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-nested")),
				}
				return &plugins.Plugin{
					JSONData:  plugins.JSONData{ID: pluginID},
					Signature: plugins.SignatureStatusValid,
					Parent:    parent,
					FS:        plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-nested", "datasource")),
				}
			}(),
			cfg: &config.PluginManagementCfg{
				PluginsCDNURLTemplate: "https://cdn.example.com",
				Features:              config.Features{SriChecksEnabled: true},
				PluginSettings: config.PluginSettings{
					pluginID:       {"cdn": "true"},
					parentPluginID: {"cdn": "true"},
				},
			},
			cdn: func() *pluginscdn.Service {
				cfg := &config.PluginManagementCfg{
					PluginsCDNURLTemplate: "https://cdn.example.com",
					PluginSettings: config.PluginSettings{
						pluginID:       {"cdn": "true"},
						parentPluginID: {"cdn": "true"},
					},
				}
				return pluginscdn.ProvideService(cfg)
			}(),
			expModuleHash: "sha256-BNcNsJHZbEd1+zK6Wo+EzCKJPrQ6/bZJcmZh1EJcZxE=",
		},
		{
			// parentPluginID           (/)
			// └── pluginID             (/panels/one)
			name: "nested plugin deeper than one subfolder should return module hash from parent MANIFEST.txt",
			plugin: func() *plugins.Plugin {
				parent := &plugins.Plugin{
					JSONData:  plugins.JSONData{ID: parentPluginID},
					Signature: plugins.SignatureStatusValid,
					Manifest: createV2Manifest(map[string]string{
						"module.js":            "266c19bc148b22ddef2a288fc5f8f40855bda22ccf60be53340b4931e469ae2a",
						"panels/one/module.js": "cbd1ac2284645a0e1e9a8722a729f5bcdd2b831222728709c6360beecdd6143f",
						"datasource/module.js": "04d70db091d96c4775fb32ba5a8f84cc22893eb43afdb649726661d4425c6711",
					}),
					FS: plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-nested")),
				}
				return &plugins.Plugin{
					JSONData:  plugins.JSONData{ID: pluginID},
					Signature: plugins.SignatureStatusValid,
					Parent:    parent,
					FS:        plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-nested", "panels", "one")),
				}
			}(),
			cfg: &config.PluginManagementCfg{
				PluginsCDNURLTemplate: "https://cdn.example.com",
				Features:              config.Features{SriChecksEnabled: true},
				PluginSettings: config.PluginSettings{
					pluginID:       {"cdn": "true"},
					parentPluginID: {"cdn": "true"},
				},
			},
			cdn: func() *pluginscdn.Service {
				cfg := &config.PluginManagementCfg{
					PluginsCDNURLTemplate: "https://cdn.example.com",
					PluginSettings: config.PluginSettings{
						pluginID:       {"cdn": "true"},
						parentPluginID: {"cdn": "true"},
					},
				}
				return pluginscdn.ProvideService(cfg)
			}(),
			expModuleHash: "sha256-y9GsIoRkWg4emocipyn1vN0rgxIicocJxjYL7s3WFD8=",
		},
		{
			// grand-parent-app         (/)
			// ├── parent-datasource    (/datasource)
			// │   └── child-panel      (/datasource/panels/one)
			name: "nested plugin of a nested plugin should return module hash from grandparent MANIFEST.txt",
			plugin: func() *plugins.Plugin {
				grandparent := &plugins.Plugin{
					JSONData:  plugins.JSONData{ID: "grand-parent-app"},
					Signature: plugins.SignatureStatusValid,
					Manifest: createV2Manifest(map[string]string{
						"module.js":                       "266c19bc148b22ddef2a288fc5f8f40855bda22ccf60be53340b4931e469ae2a",
						"datasource/module.js":            "04d70db091d96c4775fb32ba5a8f84cc22893eb43afdb649726661d4425c6711",
						"datasource/panels/one/module.js": "cbd1ac2284645a0e1e9a8722a729f5bcdd2b831222728709c6360beecdd6143f",
					}),
					FS: plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-deeply-nested")),
				}
				parent := &plugins.Plugin{
					JSONData:  plugins.JSONData{ID: "parent-datasource"},
					Signature: plugins.SignatureStatusValid,
					Parent:    grandparent,
					FS:        plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-deeply-nested", "datasource")),
				}
				return &plugins.Plugin{
					JSONData:  plugins.JSONData{ID: "child-panel"},
					Signature: plugins.SignatureStatusValid,
					Parent:    parent,
					FS:        plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-deeply-nested", "datasource", "panels", "one")),
				}
			}(),
			cfg: &config.PluginManagementCfg{
				PluginsCDNURLTemplate: "https://cdn.example.com",
				Features:              config.Features{SriChecksEnabled: true},
				PluginSettings: config.PluginSettings{
					"child-panel":       {"cdn": "true"},
					"parent-datasource": {"cdn": "true"},
					"grand-parent-app":  {"cdn": "true"},
				},
			},
			cdn: func() *pluginscdn.Service {
				cfg := &config.PluginManagementCfg{
					PluginsCDNURLTemplate: "https://cdn.example.com",
					PluginSettings: config.PluginSettings{
						"child-panel":       {"cdn": "true"},
						"parent-datasource": {"cdn": "true"},
						"grand-parent-app":  {"cdn": "true"},
					},
				}
				return pluginscdn.ProvideService(cfg)
			}(),
			expModuleHash: "sha256-y9GsIoRkWg4emocipyn1vN0rgxIicocJxjYL7s3WFD8=",
		},
		{
			name: "nested plugin should not return module hash when parent manifest is nil",
			plugin: func() *plugins.Plugin {
				parent := &plugins.Plugin{
					JSONData:  plugins.JSONData{ID: parentPluginID},
					Signature: plugins.SignatureStatusValid,
					Manifest:  nil, // Parent has no manifest
					FS:        plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-nested")),
				}
				return &plugins.Plugin{
					JSONData:  plugins.JSONData{ID: pluginID},
					Signature: plugins.SignatureStatusValid,
					Parent:    parent,
					FS:        plugins.NewLocalFS(filepath.Join("testdata", "module-hash-valid-nested", "panels", "one")),
				}
			}(),
			cfg:           &config.PluginManagementCfg{Features: config.Features{SriChecksEnabled: true}},
			cdn:           pluginscdn.ProvideService(&config.PluginManagementCfg{}),
			expModuleHash: "",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			result := CalculateModuleHash(tc.plugin, tc.cfg, tc.cdn)
			require.Equal(t, tc.expModuleHash, result)
		})
	}
}

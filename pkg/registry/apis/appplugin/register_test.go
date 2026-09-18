package appplugin

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func TestRegisterAPIServiceRoutedPlugins(t *testing.T) {
	for _, tc := range []struct {
		router   bool
		register bool
		manifest bool
	}{
		{false, false, false}, {false, false, true},
		{false, true, false}, {false, true, true},
		{true, false, false}, {true, false, true},
		{true, true, false}, {true, true, true},
	} {
		for _, roleErr := range []error{nil, errors.New("role registration failed")} {
			t.Run(fmt.Sprintf("router=%t/register=%t/manifest=%t/error=%v", tc.router, tc.register, tc.manifest, roleErr), func(t *testing.T) {
				flags := map[string]memprovider.InMemoryFlag{}
				for flag, enabled := range map[string]bool{
					featuremgmt.FlagApppluginsRegisterAPIServer: tc.register,
					featuremgmt.FlagApppluginsLoadAppManifest:   tc.manifest,
					featuremgmt.FlagGrafanaUseRouterMiddleware:  tc.router,
				} {
					flags[flag] = memprovider.InMemoryFlag{
						Key: flag, DefaultVariant: "default", Variants: map[string]any{"default": enabled},
					}
				}
				require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(flags)))
				t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
				plugin := bundle("example-app", plugins.TypeApp)
				plugin.Primary.FS = plugins.NewInMemoryFS(map[string][]byte{
					"app-sdk-manifest.json": []byte(`{
						"apiVersion": "apps.grafana.app/v1alpha2",
						"kind": "AppManifest",
						"spec": {
							"appName": "example", "group": "example.ext.grafana.app",
							"versions": [{"name": "v1alpha1", "served": true,
								"kinds": [{"kind": "TestKind", "plural": "testkinds", "scope": "Namespaced"}]}]
						}
					}`),
				})
				sources := &fakeSourceRegistry{sources: []plugins.PluginSource{
					&fakePluginSource{bundles: []*plugins.FoundBundle{plugin, bundle("legacy-app", plugins.TypeApp)}},
				}}
				registrar := &recordingAPIRegistrar{}
				roles := &recordingRoleService{err: roleErr}
				cfg := setting.NewCfg()
				cfg.UnifiedStorage = map[string]setting.UnifiedStorageConfig{
					appPluginSettingsWildcard: {DualWriterMode: rest.Mode5},
				}
				_, err := RegisterAPIService(registrar, nil, nil, nil, sources, nil,
					roles, nil, nil, nil, nil, featuremgmt.WithFeatures(), cfg)
				if !tc.router && !tc.register {
					require.NoError(t, err)
					require.Empty(t, registrar.builders)
					require.Empty(t, roles.roles)
					return
				}
				withManifest := tc.router || tc.manifest
				if roleErr != nil && withManifest {
					require.ErrorIs(t, err, roleErr)
					require.Empty(t, registrar.builders)
					return
				}
				require.NoError(t, err)
				group := "example-app"
				if withManifest {
					group = "example.ext.grafana.app"
					registeredRoles := byName(t, roles.roles)
					require.Contains(t, registeredRoles, "fixed:example.ext.grafana.app:reader")
					require.Contains(t, registeredRoles, "fixed:example.ext.grafana.app:writer")
				} else {
					require.Empty(t, roles.roles)
				}
				groups := make([]string, 0, len(registrar.builders))
				for _, b := range registrar.builders {
					groups = append(groups, builder.GetGroupVersions(b)[0].Group)
				}
				if tc.router {
					require.Empty(t, groups)
					for _, group := range []string{"example.ext.grafana.app", "legacy-app"} {
						require.Equal(t, rest.Mode5, cfg.UnifiedStorage["app."+group].DualWriterMode,
							"the shared dual-write service must see the resolved settings configuration for %s", group)
					}
				} else {
					require.Equal(t, []string{group, "legacy-app"}, groups)
				}
			})
		}
	}
}

type recordingAPIRegistrar struct {
	builder.APIRegistrar
	builders []builder.APIGroupBuilder
}

func (r *recordingAPIRegistrar) RegisterAPI(b builder.APIGroupBuilder) {
	r.builders = append(r.builders, b)
}

type recordingRoleService struct {
	accesscontrol.Service
	roles []accesscontrol.RoleRegistration
	err   error
}

func (r *recordingRoleService) DeclareFixedRoles(roles ...accesscontrol.RoleRegistration) error {
	r.roles = append(r.roles, roles...)
	return r.err
}

func TestGetAppPlugins(t *testing.T) {
	tests := []struct {
		name        string
		registry    *fakeSourceRegistry
		expectedIDs []string
		expectedErr bool
	}{
		{
			name:        "no sources returns empty list",
			registry:    &fakeSourceRegistry{},
			expectedIDs: nil,
		},
		{
			name: "returns only app plugins",
			registry: &fakeSourceRegistry{
				sources: []plugins.PluginSource{
					&fakePluginSource{bundles: []*plugins.FoundBundle{
						bundle("my-app", plugins.TypeApp),
						bundle("my-datasource", plugins.TypeDataSource),
						bundle("my-panel", plugins.TypePanel),
						bundle("another-app", plugins.TypeApp),
					}},
				},
			},
			expectedIDs: []string{"my-app", "another-app"},
		},
		{
			name: "deduplicates app plugins across sources",
			registry: &fakeSourceRegistry{
				sources: []plugins.PluginSource{
					&fakePluginSource{bundles: []*plugins.FoundBundle{
						bundle("my-app", plugins.TypeApp),
					}},
					&fakePluginSource{bundles: []*plugins.FoundBundle{
						bundle("my-app", plugins.TypeApp),
						bundle("other-app", plugins.TypeApp),
					}},
				},
			},
			expectedIDs: []string{"my-app", "other-app"},
		},
		{
			name: "propagates discover error",
			registry: &fakeSourceRegistry{
				sources: []plugins.PluginSource{
					&fakePluginSource{err: fmt.Errorf("discover failed")},
				},
			},
			expectedErr: true,
		},
		{
			name: "source with no app plugins returns empty list",
			registry: &fakeSourceRegistry{
				sources: []plugins.PluginSource{
					&fakePluginSource{bundles: []*plugins.FoundBundle{
						bundle("ds-1", plugins.TypeDataSource),
						bundle("panel-1", plugins.TypePanel),
					}},
				},
			},
			expectedIDs: nil,
		},
		{
			name: "stops on first source error",
			registry: &fakeSourceRegistry{
				sources: []plugins.PluginSource{
					&fakePluginSource{bundles: []*plugins.FoundBundle{
						bundle("my-app", plugins.TypeApp),
					}},
					&fakePluginSource{err: fmt.Errorf("second source failed")},
				},
			},
			expectedErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			plugins, err := definition.LoadPluginDefinition(context.Background(), tt.registry, definition.Options{
				Filter: func(jsonData plugins.JSONData) bool {
					return jsonData.Type == plugins.TypeApp
				},
				Schemas:     true,
				AppManifest: false, // not for datasources yet
			})

			if tt.expectedErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			var ids []string
			for _, p := range plugins {
				ids = append(ids, p.JSONData.ID)
			}
			require.Equal(t, tt.expectedIDs, ids)
		})
	}
}

type fakePluginSource struct {
	bundles []*plugins.FoundBundle
	err     error
}

func (f *fakePluginSource) PluginClass(context.Context) plugins.Class { return plugins.ClassExternal }
func (f *fakePluginSource) DefaultSignature(context.Context, string) (plugins.Signature, bool) {
	return plugins.Signature{}, false
}
func (f *fakePluginSource) Discover(context.Context) ([]*plugins.FoundBundle, error) {
	return f.bundles, f.err
}

type fakeSourceRegistry struct {
	sources []plugins.PluginSource
}

func (f *fakeSourceRegistry) List(context.Context) []plugins.PluginSource {
	return f.sources
}

func bundle(id string, pluginType plugins.Type) *plugins.FoundBundle {
	return &plugins.FoundBundle{
		Primary: plugins.FoundPlugin{
			JSONData: plugins.JSONData{ID: id, Type: pluginType},
			FS:       plugins.NewFakeFS(), // no schema
		},
	}
}

func TestApplyDefaultStorageConfig(t *testing.T) {
	newBuilder := func(pluginID string) *AppPluginAPIBuilder {
		return &AppPluginAPIBuilder{
			pluginJSON: plugins.JSONData{ID: pluginID},
		}
	}

	newRI := func(pluginID string) utils.ResourceInfo {
		return apppluginV0.SettingsResourceInfo.WithGroupAndShortName(
			pluginID, pluginID,
		)
	}

	t.Run("no-op when StorageOpts is nil", func(t *testing.T) {
		b := newBuilder("my-app")
		opts := builder.APIGroupOptions{StorageOpts: nil}
		ri := newRI("my-app")
		b.applyDefaultStorageConfig(opts, ri)
	})

	t.Run("no-op when no wildcard and no specific config", func(t *testing.T) {
		b := newBuilder("my-app")
		storageOpts := &options.StorageOptions{
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{},
		}
		opts := builder.APIGroupOptions{StorageOpts: storageOpts}
		ri := newRI("my-app")

		b.applyDefaultStorageConfig(opts, ri)

		_, exists := storageOpts.UnifiedStorageConfig["app.my-app"]
		require.False(t, exists)
	})

	t.Run("wildcard config is applied when no specific config exists", func(t *testing.T) {
		b := newBuilder("my-app")
		storageOpts := &options.StorageOptions{
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				appPluginSettingsWildcard: {DualWriterMode: rest.Mode2},
			},
		}
		opts := builder.APIGroupOptions{StorageOpts: storageOpts}
		ri := newRI("my-app")

		b.applyDefaultStorageConfig(opts, ri)

		cfg, exists := storageOpts.UnifiedStorageConfig["app.my-app"]
		require.True(t, exists)
		require.Equal(t, rest.Mode2, cfg.DualWriterMode)
	})

	t.Run("specific config takes precedence over wildcard", func(t *testing.T) {
		b := newBuilder("my-app")
		storageOpts := &options.StorageOptions{
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				appPluginSettingsWildcard: {DualWriterMode: rest.Mode2},
				"app.my-app":              {DualWriterMode: rest.Mode4},
			},
		}
		opts := builder.APIGroupOptions{StorageOpts: storageOpts}
		ri := newRI("my-app")

		b.applyDefaultStorageConfig(opts, ri)

		cfg := storageOpts.UnifiedStorageConfig["app.my-app"]
		require.Equal(t, rest.Mode4, cfg.DualWriterMode)
	})

	t.Run("wildcard applies independently per plugin", func(t *testing.T) {
		storageOpts := &options.StorageOptions{
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				appPluginSettingsWildcard: {DualWriterMode: rest.Mode1},
			},
		}
		opts := builder.APIGroupOptions{StorageOpts: storageOpts}
		pluginIDs := []string{"owner-a-app", "owner-b-app", "owner-c-app"}

		for _, pluginID := range pluginIDs {
			b := newBuilder(pluginID)
			ri := newRI(pluginID)
			b.applyDefaultStorageConfig(opts, ri)
		}

		for _, pluginID := range pluginIDs {
			key := "app." + pluginID
			cfg, exists := storageOpts.UnifiedStorageConfig[key]
			require.True(t, exists, "expected config for %s", pluginID)
			require.Equal(t, rest.Mode1, cfg.DualWriterMode)
		}
	})
}

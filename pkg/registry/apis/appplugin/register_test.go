package appplugin

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	apppluginv0alpha1 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/setting"
)

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
			result, err := getAppPlugins(context.Background(), tt.registry)

			if tt.expectedErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			var ids []string
			for _, p := range result {
				ids = append(ids, p.ID)
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
		},
	}
}

func TestApplyDefaultStorageConfig(t *testing.T) {
	newBuilder := func(pluginID string) *AppPluginAPIBuilder {
		return &AppPluginAPIBuilder{
			pluginID: pluginID,
			groupVersion: schema.GroupVersion{
				Group:   pluginID + ".grafana.app",
				Version: apppluginv0alpha1.VERSION,
			},
		}
	}

	newRI := func(pluginID string) utils.ResourceInfo {
		return apppluginv0alpha1.SettingsResourceInfo.WithGroupAndShortName(
			pluginID+".grafana.app", pluginID,
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

		_, exists := storageOpts.UnifiedStorageConfig["settings.my-app.grafana.app"]
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

		cfg, exists := storageOpts.UnifiedStorageConfig["settings.my-app.grafana.app"]
		require.True(t, exists)
		require.Equal(t, rest.Mode2, cfg.DualWriterMode)
	})

	t.Run("specific config takes precedence over wildcard", func(t *testing.T) {
		b := newBuilder("my-app")
		storageOpts := &options.StorageOptions{
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				appPluginSettingsWildcard:     {DualWriterMode: rest.Mode2},
				"settings.my-app.grafana.app": {DualWriterMode: rest.Mode4},
			},
		}
		opts := builder.APIGroupOptions{StorageOpts: storageOpts}
		ri := newRI("my-app")

		b.applyDefaultStorageConfig(opts, ri)

		cfg := storageOpts.UnifiedStorageConfig["settings.my-app.grafana.app"]
		require.Equal(t, rest.Mode4, cfg.DualWriterMode)
	})

	t.Run("wildcard applies independently per plugin", func(t *testing.T) {
		storageOpts := &options.StorageOptions{
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				appPluginSettingsWildcard: {DualWriterMode: rest.Mode1},
			},
		}
		opts := builder.APIGroupOptions{StorageOpts: storageOpts}

		for _, pluginID := range []string{"app-a", "app-b", "app-c"} {
			b := newBuilder(pluginID)
			ri := newRI(pluginID)
			b.applyDefaultStorageConfig(opts, ri)
		}

		for _, pluginID := range []string{"app-a", "app-b", "app-c"} {
			key := "settings." + pluginID + ".grafana.app"
			cfg, exists := storageOpts.UnifiedStorageConfig[key]
			require.True(t, exists, "expected config for %s", pluginID)
			require.Equal(t, rest.Mode1, cfg.DualWriterMode)
		}
	})
}

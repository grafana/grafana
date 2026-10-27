package appsettings

import (
	"runtime"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/setting"
)

// TestNewBuilderStartsNoGoroutines prevents goroutine leaks in the
// router, which builds a builder for every plugin on each poll.
func TestNewBuilderStartsNoGoroutines(t *testing.T) {
	plugin := definition.PluginDefinition{JSONData: plugins.JSONData{ID: "test-app"}}
	baseline := runtime.NumGoroutine()

	for range 100 {
		_, err := NewBuilder(plugin, struct{ PluginClient }{}, struct{ PluginContextWrapper }{}, nil, nil, Options{}, nil, nil)
		require.NoError(t, err)
	}

	leaked := runtime.NumGoroutine() - baseline
	require.Zero(t, leaked, "constructing builders must not start goroutines")
}

func TestNewBuilderRequiresPluginClients(t *testing.T) {
	plugin := definition.PluginDefinition{JSONData: plugins.JSONData{ID: "test-app"}}
	_, err := NewBuilder(plugin, nil, struct{ PluginContextWrapper }{}, nil, nil, Options{}, nil, nil)
	require.ErrorContains(t, err, "settings require a plugin client and context provider")
	_, err = NewBuilder(plugin, struct{ PluginClient }{}, nil, nil, nil, Options{}, nil, nil)
	require.Error(t, err)
}

func TestApplyDefaultStorageConfig(t *testing.T) {
	newBuilder := func(pluginID string) *Builder {
		return &Builder{
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

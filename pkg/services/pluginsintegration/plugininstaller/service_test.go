package plugininstaller

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

// Test if the service is disabled
func TestService_IsDisabled(t *testing.T) {
	// Create a new service
	s := ProvideService(
		&setting.Cfg{
			InstallPlugins: []string{"myplugin"},
		},
		featuremgmt.WithFeatures(featuremgmt.FlagBackgroundPluginInstaller),
		&fakes.FakePluginInstaller{},
	)

	// Check if the service is disabled
	if s.IsDisabled() {
		t.Error("Service should be enabled")
	}
}

func TestService_Run(t *testing.T) {
	t.Run("Installs a plugin", func(t *testing.T) {
		installed := false
		s := ProvideService(&setting.Cfg{
			InstallPlugins: []string{"myplugin"},
		}, featuremgmt.WithFeatures(), &fakes.FakePluginInstaller{
			AddFunc: func(ctx context.Context, pluginID string, version string, opts plugins.CompatOpts) error {
				installed = true
				return nil
			},
		})

		err := s.Run(context.Background())
		require.NoError(t, err)
		require.True(t, installed)
	})

	t.Run("Skips already installed plugin", func(t *testing.T) {
		installed := false
		s := ProvideService(&setting.Cfg{
			InstallPlugins: []string{"myplugin"},
		}, featuremgmt.WithFeatures(), &fakes.FakePluginInstaller{
			AddFunc: func(ctx context.Context, pluginID string, version string, opts plugins.CompatOpts) error {
				return plugins.DuplicateError{}
			},
		})

		err := s.Run(context.Background())
		require.NoError(t, err)
		require.False(t, installed)
	})

	t.Run("Install a plugin with version", func(t *testing.T) {
		installed := false
		s := ProvideService(&setting.Cfg{
			InstallPlugins: []string{"myplugin@1.0.0"},
		}, featuremgmt.WithFeatures(), &fakes.FakePluginInstaller{
			AddFunc: func(ctx context.Context, pluginID string, version string, opts plugins.CompatOpts) error {
				if pluginID == "myplugin" && version == "1.0.0" {
					installed = true
				}
				return nil
			},
		})

		err := s.Run(context.Background())
		require.NoError(t, err)
		require.True(t, installed)
	})

	t.Run("Install multiple plugins", func(t *testing.T) {
		installed := 0
		s := ProvideService(&setting.Cfg{
			InstallPlugins: []string{"myplugin1", "myplugin2"},
		}, featuremgmt.WithFeatures(), &fakes.FakePluginInstaller{
			AddFunc: func(ctx context.Context, pluginID string, version string, opts plugins.CompatOpts) error {
				installed++
				return nil
			},
		})

		err := s.Run(context.Background())
		require.NoError(t, err)
		require.Equal(t, 2, installed)
	})

	t.Run("Fails to install a plugin but install the rest", func(t *testing.T) {
		installed := 0
		s := ProvideService(&setting.Cfg{
			InstallPlugins: []string{"myplugin1", "myplugin2"},
		}, featuremgmt.WithFeatures(), &fakes.FakePluginInstaller{
			AddFunc: func(ctx context.Context, pluginID string, version string, opts plugins.CompatOpts) error {
				if pluginID == "myplugin1" {
					return plugins.NotFoundError{}
				}
				installed++
				return nil
			},
		})

		err := s.Run(context.Background())
		require.NoError(t, err)
		require.Equal(t, 1, installed)
	})
}

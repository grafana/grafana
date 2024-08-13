package plugininstaller

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

// Test if the service is disabled
func TestService_IsDisabled(t *testing.T) {
	// Create a new service
	s := ProvideService(
		&setting.Cfg{
			InstallPlugins: []setting.InstallPlugin{{ID: "myplugin"}},
		},
		featuremgmt.WithFeatures(featuremgmt.FlagBackgroundPluginInstaller),
		pluginstore.New(registry.NewInMemory(), &fakes.FakeLoader{}),
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
		s := ProvideService(
			&setting.Cfg{
				InstallPlugins: []setting.InstallPlugin{{ID: "myplugin"}},
			},
			featuremgmt.WithFeatures(),
			pluginstore.New(registry.NewInMemory(), &fakes.FakeLoader{}),
			&fakes.FakePluginInstaller{
				AddFunc: func(ctx context.Context, pluginID string, version string, opts plugins.CompatOpts) error {
					installed = true
					return nil
				},
			},
		)

		err := s.Run(context.Background())
		require.NoError(t, err)
		require.True(t, installed)
	})

	t.Run("Install a plugin with version", func(t *testing.T) {
		installed := false
		s := ProvideService(
			&setting.Cfg{
				InstallPlugins: []setting.InstallPlugin{{ID: "myplugin", Version: "1.0.0"}},
			},
			featuremgmt.WithFeatures(),
			pluginstore.New(registry.NewInMemory(), &fakes.FakeLoader{}),
			&fakes.FakePluginInstaller{
				AddFunc: func(ctx context.Context, pluginID string, version string, opts plugins.CompatOpts) error {
					if pluginID == "myplugin" && version == "1.0.0" {
						installed = true
					}
					return nil
				},
			},
		)

		err := s.Run(context.Background())
		require.NoError(t, err)
		require.True(t, installed)
	})

	t.Run("Skips already installed plugin", func(t *testing.T) {
		preg := registry.NewInMemory()
		err := preg.Add(context.Background(), &plugins.Plugin{
			JSONData: plugins.JSONData{
				ID: "myplugin",
			},
		})
		require.NoError(t, err)
		s := ProvideService(
			&setting.Cfg{
				InstallPlugins: []setting.InstallPlugin{{ID: "myplugin"}},
			},
			featuremgmt.WithFeatures(),
			pluginstore.New(preg, &fakes.FakeLoader{}),
			&fakes.FakePluginInstaller{
				AddFunc: func(ctx context.Context, pluginID string, version string, opts plugins.CompatOpts) error {
					t.Fatal("Should not install plugin")
					return plugins.DuplicateError{}
				},
			},
		)

		err = s.Run(context.Background())
		require.NoError(t, err)
	})

	t.Run("Still installs a plugin if the plugin version does not match", func(t *testing.T) {
		installed := false
		preg := registry.NewInMemory()
		err := preg.Add(context.Background(), &plugins.Plugin{
			JSONData: plugins.JSONData{
				ID: "myplugin",
				Info: plugins.Info{
					Version: "1.0.0",
				},
			},
		})
		require.NoError(t, err)
		s := ProvideService(
			&setting.Cfg{
				InstallPlugins: []setting.InstallPlugin{{ID: "myplugin", Version: "2.0.0"}},
			},
			featuremgmt.WithFeatures(),
			pluginstore.New(preg, &fakes.FakeLoader{}),
			&fakes.FakePluginInstaller{
				AddFunc: func(ctx context.Context, pluginID string, version string, opts plugins.CompatOpts) error {
					installed = true
					return nil
				},
			},
		)

		err = s.Run(context.Background())
		require.NoError(t, err)
		require.True(t, installed)
	})

	t.Run("Install multiple plugins", func(t *testing.T) {
		installed := 0
		s := ProvideService(
			&setting.Cfg{
				InstallPlugins: []setting.InstallPlugin{{ID: "myplugin1"}, {ID: "myplugin2"}},
			},
			featuremgmt.WithFeatures(),
			pluginstore.New(registry.NewInMemory(), &fakes.FakeLoader{}),
			&fakes.FakePluginInstaller{
				AddFunc: func(ctx context.Context, pluginID string, version string, opts plugins.CompatOpts) error {
					installed++
					return nil
				},
			},
		)

		err := s.Run(context.Background())
		require.NoError(t, err)
		require.Equal(t, 2, installed)
	})

	t.Run("Fails to install a plugin but install the rest", func(t *testing.T) {
		installed := 0
		s := ProvideService(
			&setting.Cfg{
				InstallPlugins: []setting.InstallPlugin{{ID: "myplugin1"}, {ID: "myplugin2"}},
			},
			featuremgmt.WithFeatures(),
			pluginstore.New(registry.NewInMemory(), &fakes.FakeLoader{}),
			&fakes.FakePluginInstaller{
				AddFunc: func(ctx context.Context, pluginID string, version string, opts plugins.CompatOpts) error {
					if pluginID == "myplugin1" {
						return plugins.NotFoundError{}
					}
					installed++
					return nil
				},
			},
		)
		err := s.Run(context.Background())
		require.NoError(t, err)
		require.Equal(t, 1, installed)
	})
}

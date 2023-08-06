package initialization

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/log"
)

func TestInitializer_Initialize(t *testing.T) {
	t.Run("core backend datasource", func(t *testing.T) {
		p := &plugins.Plugin{
			JSONData: plugins.JSONData{
				ID:   "test",
				Type: plugins.TypeDataSource,
				Includes: []*plugins.Includes{
					{
						Name: "Example dashboard",
						Type: plugins.TypeDashboard,
					},
				},
				Backend: true,
			},
			Class: plugins.ClassCore,
		}

		stepFunc := BackendClientInitStep(&fakeEnvVarsProvider{}, &fakeBackendProvider{plugin: p})

		var err error
		p, err = stepFunc(context.Background(), p)
		require.NoError(t, err)

		c, exists := p.Client()
		require.True(t, exists)
		require.NotNil(t, c)
	})

	t.Run("renderer", func(t *testing.T) {
		p := &plugins.Plugin{
			JSONData: plugins.JSONData{
				ID:   "test",
				Type: plugins.TypeRenderer,
				Dependencies: plugins.Dependencies{
					GrafanaVersion: ">=8.x",
				},
				Backend: true,
			},
			Class: plugins.ClassExternal,
		}

		stepFunc := BackendClientInitStep(&fakeEnvVarsProvider{}, &fakeBackendProvider{plugin: p})

		var err error
		p, err = stepFunc(context.Background(), p)
		require.NoError(t, err)

		c, exists := p.Client()
		require.True(t, exists)
		require.NotNil(t, c)
	})

	t.Run("secretsmanager", func(t *testing.T) {
		p := &plugins.Plugin{
			JSONData: plugins.JSONData{
				ID:   "test",
				Type: plugins.TypeSecretsManager,
				Dependencies: plugins.Dependencies{
					GrafanaVersion: ">=8.x",
				},
				Backend: true,
			},
			Class: plugins.ClassExternal,
		}

		stepFunc := BackendClientInitStep(&fakeEnvVarsProvider{}, &fakeBackendProvider{plugin: p})

		var err error
		p, err = stepFunc(context.Background(), p)
		require.NoError(t, err)

		c, exists := p.Client()
		require.True(t, exists)
		require.NotNil(t, c)
	})

	t.Run("non backend plugin app", func(t *testing.T) {
		p := &plugins.Plugin{
			JSONData: plugins.JSONData{
				Backend: false,
			},
		}

		i := BackendClientInitStep(&fakeEnvVarsProvider{}, &fakeBackendProvider{
			plugin: p,
		})

		var err error
		p, err = i(context.Background(), p)
		require.NoError(t, err)

		c, exists := p.Client()
		require.False(t, exists)
		require.Nil(t, c)
	})
}

type fakeBackendProvider struct {
	plugins.BackendFactoryProvider

	plugin *plugins.Plugin
}

func (f *fakeBackendProvider) BackendFactory(_ context.Context, _ *plugins.Plugin) backendplugin.PluginFactoryFunc {
	return func(_ string, _ log.Logger, _ []string) (backendplugin.Plugin, error) {
		return f.plugin, nil
	}
}

type fakeEnvVarsProvider struct {
	GetFunc func(ctx context.Context, p *plugins.Plugin) []string
}

func (f *fakeEnvVarsProvider) Get(ctx context.Context, p *plugins.Plugin) ([]string, error) {
	if f.GetFunc != nil {
		return f.GetFunc(ctx, p), nil
	}
	return nil, nil
}

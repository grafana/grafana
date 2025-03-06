package initialization

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace"
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

		stepFunc := BackendClientInitStep(&fakeEnvVarsProvider{}, &fakeBackendProvider{plugin: p}, fakes.InitializeNoopTracerForTest())

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

		stepFunc := BackendClientInitStep(&fakeEnvVarsProvider{}, &fakeBackendProvider{plugin: p}, fakes.InitializeNoopTracerForTest())

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
		}, fakes.InitializeNoopTracerForTest())

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
	return func(_ string, _ log.Logger, _ trace.Tracer, _ func() []string) (backendplugin.Plugin, error) {
		return f.plugin, nil
	}
}

type fakeEnvVarsProvider struct {
	PluginEnvVarsFunc func(ctx context.Context, p *plugins.Plugin) []string
}

func (f *fakeEnvVarsProvider) PluginEnvVars(ctx context.Context, p *plugins.Plugin) []string {
	if f.PluginEnvVarsFunc != nil {
		return f.PluginEnvVars(ctx, p)
	}
	return nil
}

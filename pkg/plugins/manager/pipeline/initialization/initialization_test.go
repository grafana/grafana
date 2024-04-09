package initialization

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/stretchr/testify/require"
)

func TestInitialize(t *testing.T) {
	t.Run("Test Initialize", func(t *testing.T) {
		p := &plugins.Plugin{}
		opts := Opts{
			InitializeFuncs: []InitializeFunc{},
		}
		b := New(nil, opts)
		res, err := b.Initialize(context.Background(), []*plugins.Plugin{p})
		require.NoError(t, err)
		require.Equal(t, []*plugins.Plugin{p}, res)
	})

	t.Run("Test Initialize with error", func(t *testing.T) {
		p := &plugins.Plugin{}
		opts := Opts{
			InitializeFuncs: []InitializeFunc{
				func(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
					return nil, errors.New("initialize error")
				},
			},
		}
		b := New(nil, opts)
		res, err := b.Initialize(context.Background(), []*plugins.Plugin{p})
		require.NoError(t, err)
		require.Len(t, res, 1)
		require.True(t, res[0].Status.Errored)
		require.Equal(t, "initialize error", res[0].Status.Message)
	})

	t.Run("Test Initialize with existing error", func(t *testing.T) {
		p := &plugins.Plugin{
			Status: plugins.PluginStatus{
				Errored: true,
				Message: "bootstrap error",
			},
		}
		opts := Opts{
			InitializeFuncs: []InitializeFunc{
				func(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
					return p, nil
				},
			},
		}
		b := New(nil, opts)
		res, err := b.Initialize(context.Background(), []*plugins.Plugin{p})
		require.NoError(t, err)
		require.Len(t, res, 1)
		require.True(t, res[0].Status.Errored)
		require.Equal(t, "bootstrap error", res[0].Status.Message)
	})

	t.Run("Test Initialize should register a plugin even after an error", func(t *testing.T) {
		p := &plugins.Plugin{
			Status: plugins.PluginStatus{
				Errored: true,
				Message: "bootstrap error",
			},
		}
		pluginRegistry := fakes.NewFakePluginRegistry()
		register := PluginRegistrationStep(pluginRegistry)
		opts := Opts{
			InitializeFuncs: []InitializeFunc{register},
		}
		b := New(nil, opts)
		res, err := b.Initialize(context.Background(), []*plugins.Plugin{p})
		require.NoError(t, err)
		require.Len(t, res, 1)
		require.Len(t, pluginRegistry.Plugins(context.Background()), 1)
	})
}

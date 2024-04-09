package bootstrap

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/stretchr/testify/require"
)

func TestBootstrap(t *testing.T) {
	t.Run("Test Bootstrap", func(t *testing.T) {
		p := &plugins.Plugin{}
		opts := Opts{
			ConstructFunc: func(ctx context.Context, src plugins.PluginSource, bundles []*plugins.FoundBundle) ([]*plugins.Plugin, error) {
				return []*plugins.Plugin{p}, nil
			},
			DecorateFuncs: []DecorateFunc{
				func(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
					return p, nil
				},
			},
		}
		b := New(nil, opts)
		res, err := b.Bootstrap(context.Background(), nil, nil)
		require.NoError(t, err)
		require.Equal(t, []*plugins.Plugin{p}, res)
	})

	t.Run("Test Bootstrap with decorate error", func(t *testing.T) {
		p := &plugins.Plugin{}
		opts := Opts{
			ConstructFunc: func(ctx context.Context, src plugins.PluginSource, bundles []*plugins.FoundBundle) ([]*plugins.Plugin, error) {
				return []*plugins.Plugin{p}, nil
			},
			DecorateFuncs: []DecorateFunc{
				func(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
					return nil, errors.New("decorate error")
				},
			},
		}
		b := New(nil, opts)
		res, err := b.Bootstrap(context.Background(), nil, nil)
		require.NoError(t, err)
		require.Len(t, res, 1)
		require.True(t, res[0].Status.Errored)
		require.Equal(t, "decorate error", res[0].Status.Message)
	})
}

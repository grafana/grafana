package validation

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/stretchr/testify/require"
)

func TestValidate(t *testing.T) {
	t.Run("Test Validate", func(t *testing.T) {
		p := &plugins.Plugin{}
		opts := Opts{
			ValidateFuncs: []ValidateFunc{},
		}
		b := New(nil, opts)
		res, err := b.Validate(context.Background(), []*plugins.Plugin{p})
		require.NoError(t, err)
		require.Equal(t, []*plugins.Plugin{p}, res)
	})

	t.Run("Test Validate with error", func(t *testing.T) {
		p := &plugins.Plugin{}
		opts := Opts{
			ValidateFuncs: []ValidateFunc{
				func(ctx context.Context, p *plugins.Plugin) error {
					return errors.New("Validate error")
				},
			},
		}
		b := New(nil, opts)
		res, err := b.Validate(context.Background(), []*plugins.Plugin{p})
		require.NoError(t, err)
		require.Len(t, res, 1)
		require.True(t, res[0].Status.Errored)
		require.Equal(t, "Validate error", res[0].Status.Message)
	})

	t.Run("Test Validate with existing error", func(t *testing.T) {
		p := &plugins.Plugin{
			Status: plugins.PluginStatus{
				Errored: true,
				Message: "bootstrap error",
			},
		}
		opts := Opts{
			ValidateFuncs: []ValidateFunc{
				func(ctx context.Context, p *plugins.Plugin) error {
					return nil
				},
			},
		}
		b := New(nil, opts)
		res, err := b.Validate(context.Background(), []*plugins.Plugin{p})
		require.NoError(t, err)
		require.Len(t, res, 1)
		require.True(t, res[0].Status.Errored)
		require.Equal(t, "bootstrap error", res[0].Status.Message)
	})
}

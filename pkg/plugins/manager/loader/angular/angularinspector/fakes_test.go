package angularinspector

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/stretchr/testify/require"
)

func TestFakeInspector(t *testing.T) {
	t.Run("FakeInspector", func(t *testing.T) {
		var called bool
		inspector := FakeInspector{InspectFunc: func(_ context.Context, _ *plugins.Plugin) (bool, error) {
			called = true
			return false, nil
		}}
		r, err := inspector.Inspect(context.Background(), &plugins.Plugin{})
		require.True(t, called)
		require.NoError(t, err)
		require.False(t, r)
	})

	t.Run("AlwaysAngularFakeInspector", func(t *testing.T) {
		r, err := AlwaysAngularFakeInspector.Inspect(context.Background(), &plugins.Plugin{})
		require.NoError(t, err)
		require.True(t, r)
	})

	t.Run("NeverAngularFakeInspector", func(t *testing.T) {
		r, err := NeverAngularFakeInspector.Inspect(context.Background(), &plugins.Plugin{})
		require.NoError(t, err)
		require.False(t, r)
	})
}

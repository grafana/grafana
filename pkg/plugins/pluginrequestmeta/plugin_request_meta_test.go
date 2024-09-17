package pluginrequestmeta

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestStatusSource(t *testing.T) {
	t.Run("WithStatusSource", func(t *testing.T) {
		ctx := context.Background()
		ss := StatusSourceFromContext(ctx)
		require.Equal(t, StatusSourcePlugin, ss)

		ctx = WithStatusSource(ctx, StatusSourceDownstream)
		ss = StatusSourceFromContext(ctx)
		require.Equal(t, StatusSourceDownstream, ss)
	})

	t.Run("WithDownstreamStatusSource", func(t *testing.T) {
		t.Run("Returns error if no status source is set", func(t *testing.T) {
			ctx := context.Background()
			err := WithDownstreamStatusSource(ctx)
			require.Error(t, err)
			require.Equal(t, StatusSourcePlugin, StatusSourceFromContext(ctx))
		})

		t.Run("Should mutate context if status source is set", func(t *testing.T) {
			ctx := WithStatusSource(context.Background(), StatusSourcePlugin)
			err := WithDownstreamStatusSource(ctx)
			require.NoError(t, err)
			require.Equal(t, StatusSourceDownstream, StatusSourceFromContext(ctx))
		})
	})

	t.Run("StatusSourceFromContext", func(t *testing.T) {
		t.Run("Background returns StatusSourcePlugin", func(t *testing.T) {
			ctx := context.Background()
			ss := StatusSourceFromContext(ctx)
			require.Equal(t, StatusSourcePlugin, ss)
		})

		t.Run("Context with status source returns the set status source", func(t *testing.T) {
			ctx := WithStatusSource(context.Background(), StatusSourcePlugin)
			ss := StatusSourceFromContext(ctx)
			require.Equal(t, StatusSourcePlugin, ss)
		})
	})
}

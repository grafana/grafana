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
		require.Equal(t, StatusSourceNone, ss)

		ctx = WithStatusSource(ctx, StatusSourcePlugin)
		ss = StatusSourceFromContext(ctx)
		require.Equal(t, StatusSourcePlugin, ss)
	})

	t.Run("WithDownstreamStatusSource", func(t *testing.T) {
		t.Run("Returns error if no status source is set", func(t *testing.T) {
			ctx := context.Background()
			err := WithDownstreamStatusSource(ctx)
			require.Error(t, err)
			require.Equal(t, StatusSourceNone, StatusSourceFromContext(ctx))
		})

		t.Run("Should mutate context if status source is set", func(t *testing.T) {
			ctx := WithStatusSource(context.Background(), StatusSourcePlugin)
			err := WithDownstreamStatusSource(ctx)
			require.NoError(t, err)
			require.Equal(t, StatusSourceDownstream, StatusSourceFromContext(ctx))
		})
	})
}

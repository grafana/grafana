package request

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAcceptHeader(t *testing.T) {
	ctx := context.Background()

	t.Run("should not set ctx for empty header", func(t *testing.T) {
		out := WithAcceptHeader(ctx, "")
		acceptHeader, ok := AcceptHeaderFrom(out)
		require.False(t, ok)
		require.Empty(t, acceptHeader)
	})

	t.Run("should add header to ctx", func(t *testing.T) {
		out := WithAcceptHeader(ctx, "application/json")
		acceptHeader, ok := AcceptHeaderFrom(out)
		require.True(t, ok)
		require.Equal(t, "application/json", acceptHeader)
	})
}

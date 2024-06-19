package identity_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestRequesterFromContext(t *testing.T) {
	t.Run("User should error when context is missing user", func(t *testing.T) {
		usr, err := identity.GetRequester(context.Background())
		require.Nil(t, usr)
		require.Error(t, err)
	})

	t.Run("should return user set by ContextWithUser", func(t *testing.T) {
		expected := &identity.StaticRequester{UserUID: "AAA"}
		ctx := identity.WithRequester(context.Background(), expected)
		actual, err := identity.GetRequester(ctx)
		require.NoError(t, err)
		require.Equal(t, expected.GetUID(), actual.GetUID())
	})
}

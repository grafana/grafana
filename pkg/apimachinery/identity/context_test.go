package identity_test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/authlib/types"
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

func TestServiceIdentityInContext(t *testing.T) {
	t.Run("is assigned to the context", func(t *testing.T) {
		ctx := t.Context()
		ctx, _ = identity.WithServiceIdentity(ctx, 1)
		identity, err := identity.GetRequester(ctx)
		require.NoError(t, err)
		require.Equal(t, identity.GetName(), "service")
	})

	for i := range 2 {
		i += 1 // We start from 1
		t.Run(fmt.Sprintf("orgID=%d has permission to its namespace", i), func(t *testing.T) {
			ctx := t.Context()
			ctx, _ = identity.WithServiceIdentity(ctx, int64(i))
			identity, err := identity.GetRequester(ctx)
			require.NoError(t, err)
			ns := types.OrgNamespaceFormatter(int64(i))
			require.True(t, types.NamespaceMatches(identity.GetNamespace(), ns), "namespace of identity and an arbitrary example should match")
		})
	}
}

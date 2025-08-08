package identity_test

import (
	"context"
	"testing"

	"github.com/grafana/authlib/authn"
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

func TestWithServiceIdentity(t *testing.T) {
	t.Run("with a custom service identity name", func(t *testing.T) {
		customName := "custom-service"
		orgID := int64(1)
		ctx, requester := identity.WithServiceIdentity(context.Background(), orgID, identity.WithServiceIdentityName(customName))
		require.NotNil(t, requester)
		require.Equal(t, orgID, requester.GetOrgID())
		require.Equal(t, customName, requester.GetExtra()[string(authn.ServiceIdentityKey)][0])
		require.Contains(t, requester.GetTokenPermissions(), "secret.grafana.app/securevalues:decrypt")

		fromCtx, err := identity.GetRequester(ctx)
		require.NoError(t, err)
		require.Equal(t, customName, fromCtx.GetExtra()[string(authn.ServiceIdentityKey)][0])

		// Reuse the context but create another identity on top with a different name and org ID
		anotherCustomName := "another-custom-service"
		anotherOrgID := int64(2)
		ctx2 := identity.WithServiceIdentityContext(ctx, anotherOrgID, identity.WithServiceIdentityName(anotherCustomName))

		fromCtx, err = identity.GetRequester(ctx2)
		require.NoError(t, err)
		require.Equal(t, anotherOrgID, fromCtx.GetOrgID())
		require.Equal(t, anotherCustomName, fromCtx.GetExtra()[string(authn.ServiceIdentityKey)][0])

		// Reuse the context but create another identity without a custom name
		ctx3, requester := identity.WithServiceIdentity(ctx2, 1)
		require.NotNil(t, requester)
		require.Empty(t, requester.GetExtra()[string(authn.ServiceIdentityKey)])

		fromCtx, err = identity.GetRequester(ctx3)
		require.NoError(t, err)
		require.Empty(t, fromCtx.GetExtra()[string(authn.ServiceIdentityKey)])
	})

	t.Run("without a custom service identity name", func(t *testing.T) {
		ctx, requester := identity.WithServiceIdentity(context.Background(), 1)
		require.NotNil(t, requester)
		require.Empty(t, requester.GetExtra()[string(authn.ServiceIdentityKey)])

		fromCtx, err := identity.GetRequester(ctx)
		require.NoError(t, err)
		require.Empty(t, fromCtx.GetExtra()[string(authn.ServiceIdentityKey)])
	})
}

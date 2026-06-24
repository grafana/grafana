package identity_test

import (
	"context"
	"testing"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/authz"
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

func TestWithProvisioningIdentity(t *testing.T) {
	ctx, requester, err := identity.WithProvisioningIdentity(context.Background(), "default")
	require.NoError(t, err)
	require.NotNil(t, requester)

	fromCtx, err := identity.GetRequester(ctx)
	require.NoError(t, err)
	require.Equal(t, requester.GetUID(), fromCtx.GetUID())

	// The provisioning export/sync job enumerates every active kind and runs an authz
	// preflight via authlib's CheckServicePermissions against the identity's token
	// permissions. Playlist must be authorized the same way dashboards and folders are,
	// otherwise enabling Playlist as an active resource breaks export of every kind.
	t.Run("token permissions authorize playlists for list/read/write", func(t *testing.T) {
		kinds := []struct {
			group    string
			resource string
		}{
			{"playlist.grafana.app", "playlists"},
			{"dashboard.grafana.app", "dashboards"},
			{"folder.grafana.app", "folders"},
		}
		for _, k := range kinds {
			for _, verb := range []string{"list", "get", "create", "update", "delete"} {
				res := authz.CheckServicePermissions(requester, k.group, k.resource, verb)
				require.True(t, res.ServiceCall, "%s.%s should be a service call", k.resource, k.group)
				require.True(t, res.Allowed, "%s.%s %s should be allowed for the provisioning identity", k.resource, k.group, verb)
			}
		}
	})

	// The playlist apiserver guards access with its own authorizer, which evaluates the
	// legacy playlists:read / playlists:write actions against the requester's permission
	// map. The provisioning identity must carry those actions to read and write playlists.
	t.Run("legacy permissions grant playlist actions", func(t *testing.T) {
		perms := requester.GetPermissions()
		require.Contains(t, perms, "playlists:read")
		require.Contains(t, perms, "playlists:write")
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

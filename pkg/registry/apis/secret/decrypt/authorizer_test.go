package decrypt

import (
	"context"
	"testing"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestDecryptAuthorizer(t *testing.T) {
	t.Run("when no auth info is present, it returns false", func(t *testing.T) {
		ctx := context.Background()
		authorizer := ProvideDecryptAuthorizer(nil)

		identity, allowed := authorizer.Authorize(ctx, nil)
		require.Empty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when token permissions are empty, it returns false", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), []string{})
		authorizer := ProvideDecryptAuthorizer(nil)

		identity, allowed := authorizer.Authorize(ctx, nil)
		require.Empty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when permission format is malformed (missing verb), it returns false", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), []string{"secret.grafana.app/securevalues/group1"})
		authorizer := ProvideDecryptAuthorizer(nil)

		identity, allowed := authorizer.Authorize(ctx, nil)
		require.Empty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when permission verb is not exactly `decrypt`, it returns false", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), []string{"secret.grafana.app/securevalues/group1:something"})
		authorizer := ProvideDecryptAuthorizer(nil)

		identity, allowed := authorizer.Authorize(ctx, nil)
		require.Empty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when permission does not have 3 parts, it returns false", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), []string{"secret.grafana.app/securevalues:decrypt"})
		authorizer := ProvideDecryptAuthorizer(nil)

		identity, allowed := authorizer.Authorize(ctx, nil)
		require.Empty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when permission has group that is not `secret.grafana.app`, it returns false", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), []string{"wrong.group/securevalues/invalid:decrypt"})
		authorizer := ProvideDecryptAuthorizer(nil)

		identity, allowed := authorizer.Authorize(ctx, nil)
		require.Empty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when permission has resource that is not `securevalues`, it returns false", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), []string{"secret.grafana.app/invalid-resource/invalid:decrypt"})
		authorizer := ProvideDecryptAuthorizer(nil)

		identity, allowed := authorizer.Authorize(ctx, nil)
		require.Empty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when the actor is not in the allow list, it returns false", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), []string{"secret.grafana.app/securevalues/allowed2:decrypt"})
		authorizer := ProvideDecryptAuthorizer(map[string]struct{}{"allowed1": {}})

		identity, allowed := authorizer.Authorize(ctx, nil)
		require.Empty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when the actor doesn't match any allowed decrypters, it returns false", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), []string{"secret.grafana.app/securevalues/group1:decrypt"})
		authorizer := ProvideDecryptAuthorizer(map[string]struct{}{"group1": {}})

		identity, allowed := authorizer.Authorize(ctx, []string{"group2"})
		require.Empty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when the actor matches an allowed decrypter, it returns true", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), []string{"secret.grafana.app/securevalues/group1:decrypt"})
		authorizer := ProvideDecryptAuthorizer(map[string]struct{}{"group1": {}})

		identity, allowed := authorizer.Authorize(ctx, []string{"group1"})
		require.True(t, allowed)
		require.Equal(t, "group1", identity)
	})

	t.Run("when there are multiple permissions, some invalid, only valid ones are considered", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), []string{
			"secret.grafana.app/securevalues/group1:decrypt",
			"secret.grafana.app/securevalues/invalid:read",
			"wrong.group/securevalues/group2:decrypt",
			"secret.grafana.app/securevalues/group2:decrypt",
		})
		authorizer := ProvideDecryptAuthorizer(map[string]struct{}{"group1": {}, "group2": {}})

		identity, allowed := authorizer.Authorize(ctx, []string{"group2", "group3"})
		require.True(t, allowed)
		require.Equal(t, "group2", identity)
	})

	t.Run("when multiple valid actors match decrypters, the first match already returns true", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), []string{
			"secret.grafana.app/securevalues/group1:decrypt",
			"secret.grafana.app/securevalues/group2:decrypt",
		})
		authorizer := ProvideDecryptAuthorizer(map[string]struct{}{"group1": {}, "group2": {}})

		identity, allowed := authorizer.Authorize(ctx, []string{"group2", "group1"})
		require.True(t, allowed)
		require.Equal(t, "group2", identity)
	})
}

func createAuthContext(ctx context.Context, permissions []string) context.Context {
	requester := &identity.StaticRequester{
		AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{
			Rest: authn.AccessTokenClaims{
				Permissions: permissions,
			},
		},
	}

	return types.WithAuthInfo(ctx, requester)
}

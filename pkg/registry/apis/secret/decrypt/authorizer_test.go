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

		identity, allowed := authorizer.Authorize(ctx, "", nil)
		require.Empty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when token permissions are empty, it returns false", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), "identity", []string{})
		authorizer := ProvideDecryptAuthorizer(nil)

		identity, allowed := authorizer.Authorize(ctx, "", nil)
		require.NotEmpty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when service identity is empty, it returns false", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), "", []string{})
		authorizer := ProvideDecryptAuthorizer(nil)

		identity, allowed := authorizer.Authorize(ctx, "", nil)
		require.Empty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when permission format is malformed (missing verb), it returns false", func(t *testing.T) {
		authorizer := ProvideDecryptAuthorizer(nil)

		// nameless
		ctx := createAuthContext(context.Background(), "identity", []string{"secret.grafana.app/securevalues"})
		identity, allowed := authorizer.Authorize(ctx, "", nil)
		require.NotEmpty(t, identity)
		require.False(t, allowed)

		// named
		ctx = createAuthContext(context.Background(), "identity", []string{"secret.grafana.app/securevalues/name"})
		identity, allowed = authorizer.Authorize(ctx, "", nil)
		require.NotEmpty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when permission verb is not exactly `decrypt`, it returns false", func(t *testing.T) {
		authorizer := ProvideDecryptAuthorizer(nil)

		// nameless
		ctx := createAuthContext(context.Background(), "identity", []string{"secret.grafana.app/securevalues:*"})
		identity, allowed := authorizer.Authorize(ctx, "", nil)
		require.NotEmpty(t, identity)
		require.False(t, allowed)

		// named
		ctx = createAuthContext(context.Background(), "identity", []string{"secret.grafana.app/securevalues/name:something"})
		identity, allowed = authorizer.Authorize(ctx, "", nil)
		require.NotEmpty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when permission does not have 2 or 3 parts, it returns false", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), "identity", []string{"secret.grafana.app:decrypt"})
		authorizer := ProvideDecryptAuthorizer(nil)

		identity, allowed := authorizer.Authorize(ctx, "", nil)
		require.NotEmpty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when permission has group that is not `secret.grafana.app`, it returns false", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), "identity", []string{"wrong.group/securevalues/invalid:decrypt"})
		authorizer := ProvideDecryptAuthorizer(nil)

		identity, allowed := authorizer.Authorize(ctx, "", nil)
		require.NotEmpty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when permission has resource that is not `securevalues`, it returns false", func(t *testing.T) {
		authorizer := ProvideDecryptAuthorizer(nil)

		// nameless
		ctx := createAuthContext(context.Background(), "identity", []string{"secret.grafana.app/invalid-resource:decrypt"})
		identity, allowed := authorizer.Authorize(ctx, "", nil)
		require.NotEmpty(t, identity)
		require.False(t, allowed)

		// named
		ctx = createAuthContext(context.Background(), "identity", []string{"secret.grafana.app/invalid-resource/name:decrypt"})
		identity, allowed = authorizer.Authorize(ctx, "", nil)
		require.NotEmpty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when the identity is not in the allow list, it returns false", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), "identity", []string{"secret.grafana.app/securevalues:decrypt"})
		authorizer := ProvideDecryptAuthorizer(map[string]struct{}{"allowed1": {}})

		identity, allowed := authorizer.Authorize(ctx, "", nil)
		require.NotEmpty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when the identity doesn't match any allowed decrypters, it returns false", func(t *testing.T) {
		authorizer := ProvideDecryptAuthorizer(map[string]struct{}{"identity": {}})

		// nameless
		ctx := createAuthContext(context.Background(), "identity", []string{"secret.grafana.app/securevalues:decrypt"})
		identity, allowed := authorizer.Authorize(ctx, "", []string{"group2"})
		require.NotEmpty(t, identity)
		require.False(t, allowed)

		// named
		ctx = createAuthContext(context.Background(), "identity", []string{"secret.grafana.app/securevalues/name:decrypt"})
		identity, allowed = authorizer.Authorize(ctx, "", []string{"group2"})
		require.NotEmpty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when the identity matches an allowed decrypter, it returns true", func(t *testing.T) {
		authorizer := ProvideDecryptAuthorizer(map[string]struct{}{"identity": {}})

		// nameless
		ctx := createAuthContext(context.Background(), "identity", []string{"secret.grafana.app/securevalues:decrypt"})
		identity, allowed := authorizer.Authorize(ctx, "", []string{"identity"})
		require.True(t, allowed)
		require.Equal(t, "identity", identity)

		// named
		ctx = createAuthContext(context.Background(), "identity", []string{"secret.grafana.app/securevalues/name:decrypt"})
		identity, allowed = authorizer.Authorize(ctx, "name", []string{"identity"})
		require.True(t, allowed)
		require.Equal(t, "identity", identity)
	})

	t.Run("when there are multiple permissions, some invalid, only valid ones are considered", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), "identity", []string{
			"secret.grafana.app/securevalues/name1:decrypt",
			"secret.grafana.app/securevalues/name2:decrypt",
			"secret.grafana.app/securevalues/invalid:read",
			"wrong.group/securevalues/group2:decrypt",
			"secret.grafana.app/securevalues/identity:decrypt", // old style of identity+permission
		})
		authorizer := ProvideDecryptAuthorizer(map[string]struct{}{"identity": {}})

		identity, allowed := authorizer.Authorize(ctx, "name1", []string{"identity"})
		require.True(t, allowed)
		require.Equal(t, "identity", identity)

		identity, allowed = authorizer.Authorize(ctx, "name2", []string{"identity"})
		require.True(t, allowed)
		require.Equal(t, "identity", identity)
	})

	t.Run("when empty secure value name with specific permission, it returns false", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), "identity", []string{"secret.grafana.app/securevalues/name:decrypt"})
		authorizer := ProvideDecryptAuthorizer(map[string]struct{}{"identity": {}})

		identity, allowed := authorizer.Authorize(ctx, "", []string{"identity"})
		require.Equal(t, "identity", identity)
		require.False(t, allowed)
	})

	t.Run("when permission has an extra / but no name, it returns false", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), "identity", []string{"secret.grafana.app/securevalues/:decrypt"})
		authorizer := ProvideDecryptAuthorizer(map[string]struct{}{"identity": {}})

		identity, allowed := authorizer.Authorize(ctx, "", []string{"identity"})
		require.Equal(t, "identity", identity)
		require.False(t, allowed)
	})

	t.Run("when the decrypters list is empty, meaning nothing can decrypt the secure value, it returns false", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), "identity", []string{"secret.grafana.app/securevalues:decrypt"})
		authorizer := ProvideDecryptAuthorizer(map[string]struct{}{"identity": {}})

		identity, allowed := authorizer.Authorize(ctx, "name", []string{})
		require.Equal(t, "identity", identity)
		require.False(t, allowed)
	})

	t.Run("when one of decrypters matches the identity, it returns true", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), "identity1", []string{"secret.grafana.app/securevalues:decrypt"})
		authorizer := ProvideDecryptAuthorizer(map[string]struct{}{"identity1": {}, "identity2": {}})

		identity, allowed := authorizer.Authorize(ctx, "", []string{"identity1", "identity2", "identity3"})
		require.Equal(t, "identity1", identity)
		require.True(t, allowed)
	})

	t.Run("permissions must be case-sensitive and return false", func(t *testing.T) {
		authorizer := ProvideDecryptAuthorizer(map[string]struct{}{"identity": {}})

		ctx := createAuthContext(context.Background(), "identity", []string{"SECRET.grafana.app/securevalues:decrypt"})
		identity, allowed := authorizer.Authorize(ctx, "", []string{"identity"})
		require.Equal(t, "identity", identity)
		require.False(t, allowed)

		ctx = createAuthContext(context.Background(), "identity", []string{"secret.grafana.app/SECUREVALUES:decrypt"})
		identity, allowed = authorizer.Authorize(ctx, "", []string{"identity"})
		require.Equal(t, "identity", identity)
		require.False(t, allowed)

		ctx = createAuthContext(context.Background(), "identity", []string{"secret.grafana.app/securevalues:DECRYPT"})
		identity, allowed = authorizer.Authorize(ctx, "", []string{"identity"})
		require.Equal(t, "identity", identity)
		require.False(t, allowed)
	})
}

func createAuthContext(ctx context.Context, serviceIdentity string, permissions []string) context.Context {
	requester := &identity.StaticRequester{
		AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{
			Rest: authn.AccessTokenClaims{
				Permissions:     permissions,
				ServiceIdentity: serviceIdentity,
			},
		},
	}

	return types.WithAuthInfo(ctx, requester)
}

// Adapted from https://github.com/grafana/authlib/blob/1492b99410603ca15730a1805a9220ce48232bc3/authz/client_test.go#L18
func TestHasPermissionInToken(t *testing.T) {
	t.Parallel()

	tests := []struct {
		test             string
		tokenPermissions []string
		name             string
		want             bool
	}{
		{
			test:             "Permission matches group/resource",
			tokenPermissions: []string{"secret.grafana.app/securevalues:decrypt"},
			want:             true,
		},
		{
			test:             "Permission does not match verb",
			tokenPermissions: []string{"secret.grafana.app/securevalues:create"},
			want:             false,
		},
		{
			test:             "Permission does not have support for wildcard verb",
			tokenPermissions: []string{"secret.grafana.app/securevalues:*"},
			want:             false,
		},
		{
			test:             "Invalid permission missing verb",
			tokenPermissions: []string{"secret.grafana.app/securevalues"},
			want:             false,
		},
		{
			test:             "Permission on the wrong group",
			tokenPermissions: []string{"other-group.grafana.app/securevalues:decrypt"},
			want:             false,
		},
		{
			test:             "Permission on the wrong resource",
			tokenPermissions: []string{"secret.grafana.app/other-resource:decrypt"},
			want:             false,
		},
		{
			test:             "Permission without group are skipped",
			tokenPermissions: []string{":decrypt"},
			want:             false,
		},
		{
			test:             "Group level permission is not supported",
			tokenPermissions: []string{"secret.grafana.app:decrypt"},
			want:             false,
		},
		{
			test:             "Permission with name matches group/resource/name",
			tokenPermissions: []string{"secret.grafana.app/securevalues/name:decrypt"},
			name:             "name",
			want:             true,
		},
		{
			test:             "Permission with name2 does not matche group/resource/name1",
			tokenPermissions: []string{"secret.grafana.app/securevalues/name1:decrypt"},
			name:             "name2",
			want:             false,
		},
		{
			test:             "Parts need an exact match",
			tokenPermissions: []string{"secret.grafana.app/secure:*"},
			want:             false,
		},
		{
			test:             "Resource specific permission should not allow access to all resources",
			tokenPermissions: []string{"secret.grafana.app/securevalues/name:decrypt"},
			name:             "",
			want:             false,
		},
		{
			test:             "Permission at group/resource should allow access to all resources",
			tokenPermissions: []string{"secret.grafana.app/securevalues:decrypt"},
			name:             "name",
			want:             true,
		},
		{
			test:             "Empty name trying to match everything is not allowed",
			tokenPermissions: []string{"secret.grafana.app/securevalues/:decrypt"},
			name:             "",
			want:             false,
		},
		{
			test:             "Empty name trying to match a specific name is not allowed",
			tokenPermissions: []string{"secret.grafana.app/securevalues/:decrypt"},
			name:             "name",
			want:             false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.test, func(t *testing.T) {
			t.Parallel()

			got := hasPermissionInToken(tt.tokenPermissions, tt.name)
			require.Equal(t, tt.want, got)
		})
	}
}

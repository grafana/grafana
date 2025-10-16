package decrypt

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

func TestDecryptAuthorizer(t *testing.T) {
	tracer := noop.NewTracerProvider().Tracer("test")
	defaultNs := xkube.Namespace("default")

	t.Run("when no auth info is present, it returns false", func(t *testing.T) {
		ctx := context.Background()
		authorizer := ProvideDecryptAuthorizer(tracer, nil)

		identity, allowed, _ := authorizer.Authorize(ctx, defaultNs, "", nil, nil)
		require.Empty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when token permissions are empty, it returns false", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), defaultNs.String(), "identity", []string{})
		authorizer := ProvideDecryptAuthorizer(tracer, nil)

		identity, allowed, _ := authorizer.Authorize(ctx, defaultNs, "", nil, nil)
		require.NotEmpty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when service identity is empty, it returns false", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), defaultNs.String(), "", []string{})
		authorizer := ProvideDecryptAuthorizer(tracer, nil)

		identity, allowed, _ := authorizer.Authorize(ctx, defaultNs, "", nil, nil)
		require.Empty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when service identity is empty string, it returns false", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), defaultNs.String(), " ", []string{})
		authorizer := ProvideDecryptAuthorizer(tracer, nil)

		identity, allowed, _ := authorizer.Authorize(ctx, defaultNs, "", nil, nil)
		require.Empty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when permission format is malformed (missing verb), it returns false", func(t *testing.T) {
		authorizer := ProvideDecryptAuthorizer(tracer, nil)

		// nameless
		ctx := createAuthContext(context.Background(), defaultNs.String(), "identity", []string{"secret.grafana.app/securevalues"})
		identity, allowed, _ := authorizer.Authorize(ctx, defaultNs, "", nil, nil)
		require.NotEmpty(t, identity)
		require.False(t, allowed)

		// named
		ctx = createAuthContext(context.Background(), defaultNs.String(), "identity", []string{"secret.grafana.app/securevalues/name"})
		identity, allowed, _ = authorizer.Authorize(ctx, defaultNs, "", nil, nil)
		require.NotEmpty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when permission verb is not exactly `decrypt`, it returns false", func(t *testing.T) {
		authorizer := ProvideDecryptAuthorizer(tracer, nil)

		// nameless
		ctx := createAuthContext(context.Background(), defaultNs.String(), "identity", []string{"secret.grafana.app/securevalues:*"})
		identity, allowed, _ := authorizer.Authorize(ctx, defaultNs, "", nil, nil)
		require.NotEmpty(t, identity)
		require.False(t, allowed)

		// named
		ctx = createAuthContext(context.Background(), defaultNs.String(), "identity", []string{"secret.grafana.app/securevalues/name:something"})
		identity, allowed, _ = authorizer.Authorize(ctx, defaultNs, "", nil, nil)
		require.NotEmpty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when permission does not have 2 or 3 parts, it returns false", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), defaultNs.String(), "identity", []string{"secret.grafana.app:decrypt"})
		authorizer := ProvideDecryptAuthorizer(tracer, nil)

		identity, allowed, _ := authorizer.Authorize(ctx, defaultNs, "", nil, nil)
		require.NotEmpty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when permission has group that is not `secret.grafana.app`, it returns false", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), defaultNs.String(), "identity", []string{"wrong.group/securevalues/invalid:decrypt"})
		authorizer := ProvideDecryptAuthorizer(tracer, nil)

		identity, allowed, _ := authorizer.Authorize(ctx, defaultNs, "", nil, nil)
		require.NotEmpty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when permission has resource that is not `securevalues`, it returns false", func(t *testing.T) {
		authorizer := ProvideDecryptAuthorizer(tracer, nil)

		// nameless
		ctx := createAuthContext(context.Background(), defaultNs.String(), "identity", []string{"secret.grafana.app/invalid-resource:decrypt"})
		identity, allowed, _ := authorizer.Authorize(ctx, defaultNs, "", nil, nil)
		require.NotEmpty(t, identity)
		require.False(t, allowed)

		// named
		ctx = createAuthContext(context.Background(), defaultNs.String(), "identity", []string{"secret.grafana.app/invalid-resource/name:decrypt"})
		identity, allowed, _ = authorizer.Authorize(ctx, defaultNs, "", nil, nil)
		require.NotEmpty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when the allow list is empty, it allows all identities", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), defaultNs.String(), "identity", []string{"secret.grafana.app/securevalues:decrypt"})
		authorizer := ProvideDecryptAuthorizer(tracer, nil)

		identity, allowed, _ := authorizer.Authorize(ctx, defaultNs, "", []string{"identity"}, nil)
		require.NotEmpty(t, identity)
		require.True(t, allowed)
	})

	t.Run("when the identity doesn't match any allowed decrypters, it returns false", func(t *testing.T) {
		authorizer := ProvideDecryptAuthorizer(tracer, nil)

		// nameless
		ctx := createAuthContext(context.Background(), defaultNs.String(), "identity", []string{"secret.grafana.app/securevalues:decrypt"})
		identity, allowed, _ := authorizer.Authorize(ctx, defaultNs, "", []string{"group2"}, nil)
		require.NotEmpty(t, identity)
		require.False(t, allowed)

		// named
		ctx = createAuthContext(context.Background(), defaultNs.String(), "identity", []string{"secret.grafana.app/securevalues/name:decrypt"})
		identity, allowed, _ = authorizer.Authorize(ctx, defaultNs, "", []string{"group2"}, nil)
		require.NotEmpty(t, identity)
		require.False(t, allowed)
	})

	t.Run("when the identity matches an allowed decrypter, it returns true", func(t *testing.T) {
		authorizer := ProvideDecryptAuthorizer(tracer, nil)

		// nameless
		ctx := createAuthContext(context.Background(), defaultNs.String(), "identity", []string{"secret.grafana.app/securevalues:decrypt"})
		identity, allowed, _ := authorizer.Authorize(ctx, defaultNs, "", []string{"identity"}, nil)
		require.True(t, allowed)
		require.Equal(t, "identity", identity)

		// named
		ctx = createAuthContext(context.Background(), defaultNs.String(), "identity", []string{"secret.grafana.app/securevalues/name:decrypt"})
		identity, allowed, _ = authorizer.Authorize(ctx, defaultNs, "name", []string{"identity"}, nil)
		require.True(t, allowed)
		require.Equal(t, "identity", identity)
	})

	t.Run("when there are multiple permissions, some invalid, only valid ones are considered", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), defaultNs.String(), "identity", []string{
			"secret.grafana.app/securevalues/name1:decrypt",
			"secret.grafana.app/securevalues/name2:decrypt",
			"secret.grafana.app/securevalues/invalid:read",
			"wrong.group/securevalues/group2:decrypt",
			"secret.grafana.app/securevalues/identity:decrypt", // old style of identity+permission
		})
		authorizer := ProvideDecryptAuthorizer(tracer, nil)

		identity, allowed, _ := authorizer.Authorize(ctx, defaultNs, "name1", []string{"identity"}, nil)
		require.True(t, allowed)
		require.Equal(t, "identity", identity)

		identity, allowed, _ = authorizer.Authorize(ctx, defaultNs, "name2", []string{"identity"}, nil)
		require.True(t, allowed)
		require.Equal(t, "identity", identity)
	})

	t.Run("when empty secure value name with specific permission, it returns false", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), defaultNs.String(), "identity", []string{"secret.grafana.app/securevalues/name:decrypt"})
		authorizer := ProvideDecryptAuthorizer(tracer, nil)

		identity, allowed, _ := authorizer.Authorize(ctx, defaultNs, "", []string{"identity"}, nil)
		require.Equal(t, "identity", identity)
		require.False(t, allowed)
	})

	t.Run("when permission has an extra / but no name, it returns false", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), defaultNs.String(), "identity", []string{"secret.grafana.app/securevalues/:decrypt"})
		authorizer := ProvideDecryptAuthorizer(tracer, nil)

		identity, allowed, _ := authorizer.Authorize(ctx, defaultNs, "", []string{"identity"}, nil)
		require.Equal(t, "identity", identity)
		require.False(t, allowed)
	})

	t.Run("when the decrypters list is empty, meaning nothing can decrypt the secure value, it returns false", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), defaultNs.String(), "identity", []string{"secret.grafana.app/securevalues:decrypt"})
		authorizer := ProvideDecryptAuthorizer(tracer, nil)

		identity, allowed, _ := authorizer.Authorize(ctx, defaultNs, "name", []string{}, nil)
		require.Equal(t, "identity", identity)
		require.False(t, allowed)
	})

	t.Run("when one of decrypters matches the identity, it returns true", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), defaultNs.String(), "identity1", []string{"secret.grafana.app/securevalues:decrypt"})
		authorizer := ProvideDecryptAuthorizer(tracer, nil)

		identity, allowed, _ := authorizer.Authorize(ctx, defaultNs, "", []string{"identity1", "identity2", "identity3"}, nil)
		require.Equal(t, "identity1", identity)
		require.True(t, allowed)
	})

	t.Run("when one of extra owner decrypters matches the identity, it returns true", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), defaultNs.String(), "identity1", []string{"secret.grafana.app/securevalues:decrypt"})
		authorizer := ProvideDecryptAuthorizer(tracer, []ExtraOwnerDecrypter{
			{
				Identity: "identity1",
				Group:    "test.grafana.app",
			},
		})

		identity, allowed, _ := authorizer.Authorize(ctx, defaultNs, "", []string{}, []metav1.OwnerReference{
			{
				APIVersion: "test.grafana.app/v1",
				Kind:       "Test",
				Name:       "test",
			},
		})
		require.Equal(t, "identity1", identity)
		require.True(t, allowed)
	})

	t.Run("when there are extra owner decrypters but it does not match the identity, it returns false", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), defaultNs.String(), "identity1", []string{"secret.grafana.app/securevalues:decrypt"})
		authorizer := ProvideDecryptAuthorizer(tracer, []ExtraOwnerDecrypter{
			{
				Identity: "identity2",
				Group:    "test.grafana.app",
			},
		})

		_, allowed, _ := authorizer.Authorize(ctx, defaultNs, "", []string{}, []metav1.OwnerReference{
			{
				APIVersion: "test.grafana.app/v1",
				Kind:       "Test",
				Name:       "test",
			},
		})
		require.False(t, allowed)
	})

	t.Run("when one of extra owner decrypters matches the identity but not the group, it returns false", func(t *testing.T) {
		ctx := createAuthContext(context.Background(), defaultNs.String(), "identity1", []string{"secret.grafana.app/securevalues:decrypt"})
		authorizer := ProvideDecryptAuthorizer(tracer, []ExtraOwnerDecrypter{
			{
				Identity: "identity1",
				Group:    "wrong.grafana.app",
			},
		})

		_, allowed, _ := authorizer.Authorize(ctx, defaultNs, "", []string{}, []metav1.OwnerReference{
			{
				APIVersion: "test.grafana.app/v1",
				Kind:       "Test",
				Name:       "test",
			},
		})
		require.False(t, allowed)
	})
	t.Run("permissions must be case-sensitive and return false", func(t *testing.T) {
		authorizer := ProvideDecryptAuthorizer(tracer, nil)

		ctx := createAuthContext(context.Background(), defaultNs.String(), "identity", []string{"SECRET.grafana.app/securevalues:decrypt"})
		identity, allowed, _ := authorizer.Authorize(ctx, defaultNs, "", []string{"identity"}, nil)
		require.Equal(t, "identity", identity)
		require.False(t, allowed)

		ctx = createAuthContext(context.Background(), defaultNs.String(), "identity", []string{"secret.grafana.app/SECUREVALUES:decrypt"})
		identity, allowed, _ = authorizer.Authorize(ctx, defaultNs, "", []string{"identity"}, nil)
		require.Equal(t, "identity", identity)
		require.False(t, allowed)

		ctx = createAuthContext(context.Background(), defaultNs.String(), "identity", []string{"secret.grafana.app/securevalues:DECRYPT"})
		identity, allowed, _ = authorizer.Authorize(ctx, defaultNs, "", []string{"identity"}, nil)
		require.Equal(t, "identity", identity)
		require.False(t, allowed)
	})

	t.Run("when namespace doesn't match the token's, it returns false", func(t *testing.T) {
		authorizer := ProvideDecryptAuthorizer(tracer, nil)

		ctx := createAuthContext(context.Background(), "namespace1", "identity", []string{"secret.grafana.app/securevalues:decrypt"})
		identity, allowed, _ := authorizer.Authorize(ctx, "namespace2", "", []string{"identity"}, nil)
		require.Empty(t, identity)
		require.False(t, allowed)
	})
}

func createAuthContext(ctx context.Context, namespace string, serviceIdentity string, permissions []string) context.Context {
	requester := &identity.StaticRequester{
		Namespace: namespace,
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

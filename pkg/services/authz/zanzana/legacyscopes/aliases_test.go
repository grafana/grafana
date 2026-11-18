package legacyscopes

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/user"
)

type scopeResolverFunc func(context.Context, types.NamespaceInfo, ScopeReference) (string, error)

func (f scopeResolverFunc) ResolveScope(ctx context.Context, ns types.NamespaceInfo, ref ScopeReference) (string, error) {
	return f(ctx, ns, ref)
}

func TestWithAliasesPreservesNumericScopeAndAddsUID(t *testing.T) {
	original := ac.Permission{Action: "teams:read", Scope: "teams:id:42"}
	resolver := scopeResolverFunc(func(ctx context.Context, ns types.NamespaceInfo, ref ScopeReference) (string, error) {
		require.Equal(t, "stacks-123", ns.Value)
		require.Equal(t, ScopeReference{Resource: "teams", Attribute: "id", Value: "42"}, ref)
		return "platform", nil
	})
	got, err := WithAliases(t.Context(), "stacks-123", "", resolver, []ac.Permission{original})
	require.NoError(t, err)
	require.ElementsMatch(t, []ac.Permission{original, {Action: "teams:read", Scope: "teams:uid:platform"}}, got)
}

func TestWithAliasesKeepsActionScopeFamilies(t *testing.T) {
	for _, tc := range []struct{ action, kind, resource string }{
		{"teams:read", "teams", "teams"},
		{"users:read", "global.users", "users"},
		{"users.permissions:read", "users", "users"},
		{"org.users:read", "users", "users"},
		{"serviceaccounts:read", "serviceaccounts", "serviceaccounts"},
	} {
		t.Run(tc.action, func(t *testing.T) {
			resolver := scopeResolverFunc(func(_ context.Context, _ types.NamespaceInfo, ref ScopeReference) (string, error) {
				require.Equal(t, tc.resource, ref.Resource)
				return "42", nil
			})
			input := ac.Permission{Action: tc.action, Scope: ac.Scope(tc.kind, "uid", "target")}
			got, err := WithAliases(t.Context(), "default", "", resolver, []ac.Permission{input})
			require.NoError(t, err)
			require.ElementsMatch(t, []ac.Permission{input, {Action: tc.action, Scope: ac.Scope(tc.kind, "id", "42")}}, got)
		})
	}
}

func TestWithAliasesReusesMappingsAcrossActionsAndDeduplicates(t *testing.T) {
	calls := 0
	resolver := scopeResolverFunc(func(context.Context, types.NamespaceInfo, ScopeReference) (string, error) { calls++; return "7", nil })
	input := []ac.Permission{{Action: "users:read", Scope: "global.users:uid:alice"}, {Action: "org.users:read", Scope: "users:uid:alice"}, {Action: "users:read", Scope: "global.users:uid:alice"}}
	got, err := WithAliases(t.Context(), "default", "", resolver, input)
	require.NoError(t, err)
	require.Len(t, got, 4)
	require.Equal(t, 1, calls)
}

func TestWithAliasesWildcardsNeedNoIAM(t *testing.T) {
	resolver := scopeResolverFunc(func(context.Context, types.NamespaceInfo, ScopeReference) (string, error) {
		t.Fatal("wildcards must not load IAM objects")
		return "", nil
	})
	for _, kind := range []string{"teams", "users", "global.users", "serviceaccounts"} {
		for _, attr := range []string{"id", "uid"} {
			got, err := WithAliases(t.Context(), "default", "", resolver, []ac.Permission{{Action: "read", Scope: ac.Scope(kind, attr, "*")}})
			require.NoError(t, err)
			require.ElementsMatch(t, []ac.Permission{{Action: "read", Scope: ac.Scope(kind, "id", "*")}, {Action: "read", Scope: ac.Scope(kind, "uid", "*")}}, got)
		}
	}
}

func TestWithAliasesFiltersAfterExpansion(t *testing.T) {
	resolver := scopeResolverFunc(func(context.Context, types.NamespaceInfo, ScopeReference) (string, error) { return "platform", nil })
	input := []ac.Permission{{Action: "teams:read", Scope: "teams:id:42"}}
	got, err := WithAliases(t.Context(), "default", "teams:uid:platform", resolver, input)
	require.NoError(t, err)
	require.Equal(t, []ac.Permission{{Action: "teams:read", Scope: "teams:uid:platform"}}, got)
}

func TestWithAliasesPreservesUnmappedGrants(t *testing.T) {
	input := []ac.Permission{{Action: "teams:read", Scope: "teams:uid:only-uid"}}
	for _, value := range []string{"", "0", "-1"} {
		got, err := WithAliases(t.Context(), "default", "", scopeResolverFunc(func(context.Context, types.NamespaceInfo, ScopeReference) (string, error) { return value, nil }), input)
		require.NoError(t, err)
		require.Equal(t, input, got)
	}
}

func TestWithAliasesLookupErrorsPreserveSourceAndCancellationFails(t *testing.T) {
	input := []ac.Permission{{Action: "teams:read", Scope: "teams:id:42"}}
	got, err := WithAliases(t.Context(), "default", "", scopeResolverFunc(func(context.Context, types.NamespaceInfo, ScopeReference) (string, error) {
		return "", errors.New("IAM unavailable")
	}), input)
	require.NoError(t, err)
	require.Equal(t, input, got)
	ctx, cancel := context.WithCancel(t.Context())
	resolver := scopeResolverFunc(func(context.Context, types.NamespaceInfo, ScopeReference) (string, error) {
		cancel()
		return "", ctx.Err()
	})
	got, err = WithAliases(ctx, "default", "", resolver, input)
	require.ErrorIs(t, err, context.Canceled)
	require.Empty(t, got)
}

func TestWithAliasesNeverBroadensObjectGrantToWildcard(t *testing.T) {
	input := []ac.Permission{{Action: "teams:read", Scope: "teams:id:42"}}
	resolver := scopeResolverFunc(func(context.Context, types.NamespaceInfo, ScopeReference) (string, error) { return "*", nil })
	got, err := WithAliases(t.Context(), "default", "", resolver, input)
	require.NoError(t, err)
	require.Equal(t, input, got)
}

func TestAliasLookupUsesTransportTenantForLegacyNamespaceSentinels(t *testing.T) {
	for _, orgID := range []int64{0, -1} {
		caller := &user.SignedInUser{OrgID: orgID, Namespace: types.OrgNamespaceFormatter(orgID)}
		resolver := scopeResolverFunc(func(_ context.Context, ns types.NamespaceInfo, _ ScopeReference) (string, error) {
			require.Equal(t, "stacks-42", ns.Value)
			return "7", nil
		})
		got, err := ResolveUserScopes(request.WithNamespace(t.Context(), "stacks-42"), caller, resolver, []ac.Permission{{Action: "users:read", Scope: "global.users:uid:alice"}})
		require.NoError(t, err)
		require.Contains(t, got, ac.Permission{Action: "users:read", Scope: "global.users:id:7"})
	}
}

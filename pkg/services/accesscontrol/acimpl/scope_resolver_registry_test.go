package acimpl_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestProvideScopeResolverRegistry_SharesLaterRegistrations(t *testing.T) {
	ac := acimpl.ProvideAccessControlTest()
	registry := acimpl.ProvideScopeResolverRegistry(ac)
	require.False(t, registry.HasResolvers())

	calls := 0
	ac.RegisterScopeAttributeResolver("folders:uid:", accesscontrol.ScopeAttributeResolverFunc(func(
		ctx context.Context,
		orgID int64,
		scope string,
	) ([]string, error) {
		calls++
		require.Equal(t, int64(1), orgID)
		require.Equal(t, "folders:uid:child", scope)
		return []string{"folders:uid:parent"}, nil
	}))

	require.Same(t, registry, acimpl.ProvideScopeResolverRegistry(ac))
	require.True(t, registry.HasResolvers())
	resolver, ok := registry.Get("folders:uid:")
	require.True(t, ok)

	ctx := context.Background()
	scopes, err := resolver.Resolve(ctx, 1, "folders:uid:child")
	require.NoError(t, err)
	require.Equal(t, []string{"folders:uid:parent"}, scopes)
	require.Equal(t, 1, calls)

	requester := &user.SignedInUser{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			1: {
				"folders:read": {"folders:uid:parent"},
			},
		},
	}
	evaluator := accesscontrol.EvalPermission("folders:read", "folders:uid:child")

	// Calling the shared callback does not populate Access Control's cache.
	allowed, err := ac.Evaluate(ctx, requester, evaluator)
	require.NoError(t, err)
	require.True(t, allowed)
	require.Equal(t, 2, calls)

	allowed, err = ac.Evaluate(ctx, requester, evaluator)
	require.NoError(t, err)
	require.True(t, allowed)
	require.Equal(t, 2, calls)

	ac.InvalidateResolverCache(1, "folders:uid:child")
	allowed, err = ac.Evaluate(ctx, requester, evaluator)
	require.NoError(t, err)
	require.True(t, allowed)
	require.Equal(t, 3, calls)

	allowed, err = ac.WithoutResolvers().Evaluate(ctx, requester, evaluator)
	require.NoError(t, err)
	require.False(t, allowed)
	require.Equal(t, 3, calls)
}

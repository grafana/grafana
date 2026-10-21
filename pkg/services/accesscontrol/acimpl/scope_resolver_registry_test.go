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
	tests := []struct {
		name             string
		warmCache        bool
		invalidateCache  bool
		withoutResolvers bool
		wantAllowed      bool
		wantCalls        int
	}{
		{
			name:             "shared callback does not populate Access Control cache",
			warmCache:        false,
			invalidateCache:  false,
			withoutResolvers: false,
			wantAllowed:      true,
			wantCalls:        2,
		},
		{
			name:             "Access Control reuses cached resolution",
			warmCache:        true,
			invalidateCache:  false,
			withoutResolvers: false,
			wantAllowed:      true,
			wantCalls:        2,
		},
		{
			name:             "cache invalidation calls resolver again",
			warmCache:        true,
			invalidateCache:  true,
			withoutResolvers: false,
			wantAllowed:      true,
			wantCalls:        3,
		},
		{
			name:             "WithoutResolvers ignores registrations and cached resolutions",
			warmCache:        true,
			invalidateCache:  false,
			withoutResolvers: true,
			wantAllowed:      false,
			wantCalls:        2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
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

			if tt.warmCache {
				allowed, err := ac.Evaluate(ctx, requester, evaluator)
				require.NoError(t, err)
				require.True(t, allowed)
			}
			if tt.invalidateCache {
				ac.InvalidateResolverCache(1, "folders:uid:child")
			}

			var checker accesscontrol.AccessControl = ac
			if tt.withoutResolvers {
				checker = ac.WithoutResolvers()
			}

			allowed, err := checker.Evaluate(ctx, requester, evaluator)

			require.NoError(t, err)
			require.Equal(t, tt.wantAllowed, allowed)
			require.Equal(t, tt.wantCalls, calls)
		})
	}
}

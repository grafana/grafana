package rbac

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/shadow"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestLegacyCheckShadowDoesNotChangeCaches(t *testing.T) {
	for _, warm := range []bool{false, true} {
		t.Run(fmt.Sprintf("warm=%t", warm), func(t *testing.T) {
			service := NewTestService("checked-user", []accesscontrol.Permission{{Action: "folders:read", Scope: "folders:uid:allowed"}}, nil)
			ctx := t.Context()
			idKey := userIdentifierCacheKey("org-12", "checked-user")
			roleKey := userBasicRoleCacheKey("org-12", "checked-user")
			teamsKey := userTeamCacheKey("org-12", "checked-user")
			oldID := store.UserIdentifiers{ID: 99, UID: "checked-user"}
			oldRole := store.BasicRole{Role: "Admin", IsAdmin: true}
			oldTeams := []int64{99}
			if warm {
				service.idCache.Set(ctx, idKey, oldID)
				service.basicRoleCache.Set(ctx, roleKey, oldRole)
				service.userTeamCache.Set(ctx, teamsKey, oldTeams)
			}
			client := newEmbeddedLegacyCheckTestClient(service)
			orgID := int64(12)
			allowed, err := client.LegacyCheck(shadow.WithContext(ctx), legacyclient.LegacyCheckRequest{
				Namespace: "org-12", Subject: "user:checked-user", RequesterOrgID: &orgID,
				Evaluator: accesscontrol.EvalPermission("folders:read", "folders:uid:allowed"),
			})
			require.NoError(t, err)
			require.True(t, allowed)
			id, idFound := service.idCache.Get(ctx, idKey)
			role, roleFound := service.basicRoleCache.Get(ctx, roleKey)
			teams, teamsFound := service.userTeamCache.Get(ctx, teamsKey)
			if warm {
				require.Equal(t, oldID, id)
				require.Equal(t, oldRole, role)
				require.Equal(t, oldTeams, teams)
			}
			require.Equal(t, warm, idFound)
			require.Equal(t, warm, roleFound)
			require.Equal(t, warm, teamsFound)
			_, internalIDFound := service.idCache.Get(ctx, userIdentifierCacheKeyById("org-12", "checked-user"))
			require.False(t, internalIDFound)
		})
	}
}

func TestLegacyCheckShadowNestedResolverUsesLocalEvaluation(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAuthzUseLegacyCheck, featuremgmt.FlagAuthzUseLegacyCheckShadow)
	ac := acimpl.ProvideAccessControlTest()
	service := NewTestService("checked-user", []accesscontrol.Permission{{Action: "folders:read", Scope: "folders:uid:allowed"}}, nil).
		WithLegacyScopeResolvers(acimpl.ProvideScopeResolverRegistry(ac), types.OrgNamespaceFormatter)
	// A nested RPC would fail because no client is attached. The shadow marker must keep it local.
	calls := 0
	ac.RegisterScopeAttributeResolver("test:id:", accesscontrol.ScopeAttributeResolverFunc(func(ctx context.Context, _ int64, _ string) ([]string, error) {
		calls++
		requester, err := identity.GetRequester(ctx)
		if err != nil {
			return nil, err
		}
		allowed, err := ac.Evaluate(ctx, requester, accesscontrol.EvalPermission("folders:read", "folders:uid:allowed"))
		if err != nil {
			return nil, err
		}
		if !allowed {
			return nil, fmt.Errorf("nested evaluation denied")
		}
		return []string{"folders:uid:allowed"}, nil
	}))
	client := newEmbeddedLegacyCheckTestClient(service)
	orgID := int64(12)
	allowed, err := client.LegacyCheck(shadow.WithContext(t.Context()), legacyclient.LegacyCheckRequest{
		Namespace: "org-12", Subject: "user:checked-user", RequesterOrgID: &orgID,
		Evaluator: accesscontrol.EvalPermission("folders:read", "test:id:one"),
	})
	require.NoError(t, err)
	require.True(t, allowed)
	require.Equal(t, 1, calls)
}

func TestLegacyCheckShadowContainsResolverPanic(t *testing.T) {
	ac := acimpl.ProvideAccessControlTest()
	service := NewTestService("checked-user", []accesscontrol.Permission{{Action: "folders:read", Scope: "folders:uid:allowed"}}, nil).
		WithLegacyScopeResolvers(acimpl.ProvideScopeResolverRegistry(ac), types.OrgNamespaceFormatter)
	ac.RegisterScopeAttributeResolver("test:id:", accesscontrol.ScopeAttributeResolverFunc(func(context.Context, int64, string) ([]string, error) {
		panic("resolver failed")
	}))
	client := newEmbeddedLegacyCheckTestClient(service)
	orgID := int64(12)
	allowed, err := client.LegacyCheck(shadow.WithContext(t.Context()), legacyclient.LegacyCheckRequest{
		Namespace: "org-12", Subject: "user:checked-user", RequesterOrgID: &orgID,
		Evaluator: accesscontrol.EvalPermission("folders:read", "test:id:one"),
	})
	require.False(t, allowed)
	require.ErrorContains(t, err, "legacy check shadow panicked: resolver failed")
}

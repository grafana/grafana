package rbac

import (
	"context"
	"fmt"
	"slices"
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
	for _, tc := range []struct {
		name      string
		warmCache bool
	}{
		{name: "cold caches remain empty"},
		{name: "warm caches remain unchanged", warmCache: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			service := NewTestService("checked-user", []accesscontrol.Permission{
				{Action: "folders:read", Scope: "folders:uid:allowed"},
			}, nil)
			ctx := t.Context()
			idKey := userIdentifierCacheKey("org-12", "checked-user")
			roleKey := userBasicRoleCacheKey("org-12", "checked-user")
			teamsKey := userTeamCacheKey("org-12", "checked-user")
			if tc.warmCache {
				service.idCache.Set(ctx, idKey, store.UserIdentifiers{ID: 99, UID: "checked-user"})
				service.basicRoleCache.Set(ctx, roleKey, store.BasicRole{Role: "Admin", IsAdmin: true})
				service.userTeamCache.Set(ctx, teamsKey, []int64{99})
			}

			before := snapshotLegacyCheckCaches(ctx, service)
			client := newEmbeddedLegacyCheckTestClient(service)
			orgID := int64(12)

			allowed, err := client.LegacyCheck(shadow.WithContext(ctx), legacyclient.LegacyCheckRequest{
				Namespace:      "org-12",
				Subject:        "user:checked-user",
				RequesterOrgID: &orgID,
				Evaluator:      accesscontrol.EvalPermission("folders:read", "folders:uid:allowed"),
			})

			require.NoError(t, err)
			require.True(t, allowed)
			require.Equal(t, before, snapshotLegacyCheckCaches(ctx, service))
		})
	}
}

type legacyCheckCacheSnapshot struct {
	id              store.UserIdentifiers
	idFound         bool
	internalID      store.UserIdentifiers
	internalIDFound bool
	role            store.BasicRole
	roleFound       bool
	teams           []int64
	teamsFound      bool
}

func snapshotLegacyCheckCaches(ctx context.Context, service *Service) legacyCheckCacheSnapshot {
	var snapshot legacyCheckCacheSnapshot
	snapshot.id, snapshot.idFound = service.idCache.Get(ctx, userIdentifierCacheKey("org-12", "checked-user"))
	snapshot.internalID, snapshot.internalIDFound = service.idCache.Get(ctx, userIdentifierCacheKeyById("org-12", "checked-user"))
	snapshot.role, snapshot.roleFound = service.basicRoleCache.Get(ctx, userBasicRoleCacheKey("org-12", "checked-user"))
	snapshot.teams, snapshot.teamsFound = service.userTeamCache.Get(ctx, userTeamCacheKey("org-12", "checked-user"))
	snapshot.teams = slices.Clone(snapshot.teams)
	return snapshot
}

func TestLegacyCheckShadowNestedResolverUsesLocalEvaluation(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagAuthzUseLegacyCheck, featuremgmt.FlagAuthzUseLegacyCheckShadow)
	ac := acimpl.ProvideAccessControlTest()
	service := NewTestService("checked-user", []accesscontrol.Permission{
		{Action: "folders:read", Scope: "folders:uid:allowed"},
	}, nil).
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
		Namespace:      "org-12",
		Subject:        "user:checked-user",
		RequesterOrgID: &orgID,
		Evaluator:      accesscontrol.EvalPermission("folders:read", "test:id:one"),
	})

	require.NoError(t, err)
	require.True(t, allowed)
	require.Equal(t, 1, calls)
}

func TestLegacyCheckShadowContainsResolverPanic(t *testing.T) {
	ac := acimpl.ProvideAccessControlTest()
	service := NewTestService("checked-user", []accesscontrol.Permission{
		{Action: "folders:read", Scope: "folders:uid:allowed"},
	}, nil).
		WithLegacyScopeResolvers(acimpl.ProvideScopeResolverRegistry(ac), types.OrgNamespaceFormatter)
	ac.RegisterScopeAttributeResolver("test:id:", accesscontrol.ScopeAttributeResolverFunc(func(context.Context, int64, string) ([]string, error) {
		panic("resolver failed")
	}))
	client := newEmbeddedLegacyCheckTestClient(service)
	orgID := int64(12)

	allowed, err := client.LegacyCheck(shadow.WithContext(t.Context()), legacyclient.LegacyCheckRequest{
		Namespace:      "org-12",
		Subject:        "user:checked-user",
		RequesterOrgID: &orgID,
		Evaluator:      accesscontrol.EvalPermission("folders:read", "test:id:one"),
	})

	require.False(t, allowed)
	require.ErrorContains(t, err, "legacy check shadow panicked: resolver failed")
}

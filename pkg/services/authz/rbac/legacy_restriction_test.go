package rbac

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"slices"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
)

func TestLegacyCheckActionRestrictionParity(t *testing.T) {
	const read = "dashboards:read"
	const write = "dashboards:write"
	const shared = "folders:uid:sharedwithme"
	for _, orgID := range []int64{12, accesscontrol.GlobalOrgID, accesscontrol.NoOrgID} {
		for _, idType := range []types.IdentityType{types.TypeUser, types.TypeServiceAccount} {
			t.Run(fmt.Sprintf("org=%d/%s", orgID, idType), func(t *testing.T) {
				grants := []accesscontrol.Permission{
					{Action: "dashboards:view", Scope: "dashboards:uid:Y"},
					{Action: write, Scope: "dashboards:uid:X"},
				}
				service := NewTestService("checked-user", grants, nil)
				permissions := &legacyPermissionStore{PermissionStore: service.permissionStore}
				service.permissionStore = permissions
				service.actionResolver = legacyActionResolver{}
				if orgID != 12 {
					var globalStore *legacyGlobalPermissionStore
					service, globalStore = newLegacyGlobalTestService(grants)
					permissions = &globalStore.legacyPermissionStore
				}
				client := newEmbeddedLegacyCheckTestClient(service)
				for _, tc := range []struct {
					name      string
					actions   []string
					evaluator accesscontrol.Evaluator
					allowed   bool
				}{
					{name: "unrestricted write", evaluator: accesscontrol.EvalPermission(write, "dashboards:uid:X"), allowed: true},
					{name: "undelegated write", actions: []string{read}, evaluator: accesscontrol.EvalPermission(write, "dashboards:uid:X")},
					{name: "ANY cannot restore write", actions: []string{read}, evaluator: accesscontrol.EvalAny(accesscontrol.EvalPermission(read, "dashboards:uid:X"), accesscontrol.EvalPermission(write, "dashboards:uid:X"))},
					{name: "ANY allows delegated read", actions: []string{read}, evaluator: accesscontrol.EvalAny(accesscontrol.EvalPermission(read, "dashboards:uid:Y"), accesscontrol.EvalPermission(write, "dashboards:uid:X")), allowed: true},
					{name: "ALL requires both actions", actions: []string{read}, evaluator: accesscontrol.EvalAll(accesscontrol.EvalPermission(read, "dashboards:uid:Y"), accesscontrol.EvalPermission(write, "dashboards:uid:X"))},
					{name: "action set grant", actions: []string{read}, evaluator: accesscontrol.EvalPermission(read, "dashboards:uid:Y"), allowed: true},
					{name: "empty restriction", actions: []string{}, evaluator: accesscontrol.EvalPermission(write)},
					{name: "blank action does not select all grants", actions: []string{""}, evaluator: accesscontrol.EvalAll()},
					{name: "empty restriction empty ALL", actions: []string{}, evaluator: accesscontrol.EvalAll()},
					{name: "ungranted delegation empty ALL", actions: []string{"users:delete"}, evaluator: accesscontrol.EvalAll()},
					{name: "unrelated delegated grant empty ALL", actions: []string{read}, evaluator: accesscontrol.EvalAll(), allowed: true},
					{name: "SharedWithMe excluded", actions: []string{read}, evaluator: accesscontrol.EvalPermission("folders:read", shared)},
					{name: "SharedWithMe delegated", actions: []string{"folders:read"}, evaluator: accesscontrol.EvalPermission("folders:read", shared), allowed: true},
					{name: "unrestricted after restricted checks", evaluator: accesscontrol.EvalPermission(write), allowed: true},
				} {
					t.Run(tc.name, func(t *testing.T) {
						effective := map[string][]string{read: {"dashboards:uid:Y"}, write: {"dashboards:uid:X"}, "folders:read": {shared}}
						if tc.actions != nil {
							for action := range effective {
								if !slices.Contains(tc.actions, action) {
									delete(effective, action)
								}
							}
						}
						permissionOrg := orgID
						if orgID == accesscontrol.NoOrgID {
							permissionOrg = accesscontrol.GlobalOrgID
						}
						requester := &identity.StaticRequester{Type: idType, UserID: 1, UserUID: "checked-user", OrgID: orgID, Permissions: map[int64]map[string][]string{permissionOrg: effective}}
						local, err := acimpl.ProvideAccessControlTest().WithoutResolvers().Evaluate(t.Context(), requester, tc.evaluator)
						require.NoError(t, err)
						require.Equal(t, tc.allowed, local)
						req := legacyclient.LegacyCheckRequest{Namespace: "org-12", Subject: requester.GetUID(), Evaluator: tc.evaluator, SkipScopeResolution: true}
						req.Restriction = &legacyclient.LegacyActionRestriction{Actions: slices.Sorted(maps.Keys(effective))}
						if orgID != 12 {
							req.GlobalEvaluation = &legacyclient.LegacyGlobalEvaluation{RequesterOrgID: orgID}
						}
						permissions.queries = nil
						allowed, err := client.LegacyCheck(t.Context(), req)
						require.NoError(t, err)
						require.Equal(t, local, allowed)
						for _, query := range permissions.queries {
							require.Contains(t, effective, query.Action)
						}
						if len(effective) == 0 || tc.name == "unrelated delegated grant empty ALL" {
							require.Empty(t, permissions.queries)
						}
					})
				}
			})
		}
	}
}

func TestLegacyCheckResolverActionRestriction(t *testing.T) {
	for _, global := range []bool{false, true} {
		for _, delegateFolders := range []bool{false, true} {
			t.Run(fmt.Sprintf("global=%t/folders=%t", global, delegateFolders), func(t *testing.T) {
				grants := []accesscontrol.Permission{
					{Action: "library.panels:read", Scope: "folders:uid:parent"},
					{Action: "folders:read", Scope: "folders:uid:parent"},
				}
				service := NewTestService("checked-user", grants, nil)
				permissions := &legacyPermissionStore{PermissionStore: service.permissionStore}
				service.permissionStore = permissions
				if global {
					var globalStore *legacyGlobalPermissionStore
					service, globalStore = newLegacyGlobalTestService(grants)
					permissions = &globalStore.legacyPermissionStore
				}
				actions := []string{"library.panels:read"}
				if delegateFolders {
					actions = append(actions, "folders:read")
				}
				ac := acimpl.ProvideAccessControlTest()
				calls := 0
				ac.RegisterScopeAttributeResolver("library.panels:uid:", accesscontrol.WithRequiredActions(accesscontrol.ScopeAttributeResolverFunc(
					func(ctx context.Context, _ int64, _ string) ([]string, error) {
						calls++
						requester, err := identity.GetRequester(ctx)
						require.NoError(t, err)
						_, hasFolders := requester.GetPermissions()["folders:read"]
						require.Equal(t, delegateFolders, hasFolders)
						allowed, err := ac.WithoutResolvers().Evaluate(ctx, requester, accesscontrol.EvalPermission("folders:read", "folders:uid:parent"))
						if err != nil {
							return nil, err
						}
						if !allowed {
							return nil, errors.New("folder visibility denied")
						}
						return []string{"folders:uid:parent"}, nil
					}), "folders:read"))
				service = service.WithLegacyScopeResolvers(acimpl.ProvideScopeResolverRegistry(ac), types.OrgNamespaceFormatter)
				req := legacyclient.LegacyCheckRequest{Namespace: "org-12", Subject: "user:checked-user", Evaluator: accesscontrol.EvalPermission("library.panels:read", "library.panels:uid:panel"), Restriction: &legacyclient.LegacyActionRestriction{Actions: actions}}
				if global {
					req.GlobalEvaluation = &legacyclient.LegacyGlobalEvaluation{RequesterOrgID: 0}
				}
				allowed, err := newEmbeddedLegacyCheckTestClient(service).LegacyCheck(t.Context(), req)
				require.Equal(t, delegateFolders, allowed)
				require.Equal(t, 1, calls)
				if delegateFolders {
					require.NoError(t, err)
				} else {
					require.ErrorContains(t, err, "folder visibility denied")
				}
				for _, query := range permissions.queries {
					require.Contains(t, actions, query.Action)
				}
			})
		}
	}
}

func TestLegacyCheckInternalRestrictionRejected(t *testing.T) {
	service := NewTestService("checked-user", nil, nil).WithLegacyScopeResolvers(accesscontrol.NewScopeResolverRegistry(), types.OrgNamespaceFormatter)
	allowed, err := newEmbeddedLegacyCheckTestClient(service).LegacyCheck(t.Context(), legacyclient.LegacyCheckRequest{
		Namespace: "org-12", Evaluator: accesscontrol.EvalAll(),
		InternalIdentity: &legacyclient.LegacyInternalIdentity{Profile: legacyclient.LegacyInternalIdentityService},
		Restriction:      &legacyclient.LegacyActionRestriction{},
	})
	require.False(t, allowed)
	require.ErrorContains(t, err, "cannot be combined with an action restriction")
}

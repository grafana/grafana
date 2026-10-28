package rbac

import (
	"fmt"
	"maps"
	"slices"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing/licensingtest"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationLegacyCheckGlobalParity(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	database := db.NewTestStore(t)
	now := time.Now()
	people := []user.User{
		{ID: 7, UID: "regular", Login: "regular", Email: "regular@example.org", IsAdmin: false, Created: now, Updated: now},
		{ID: 8, UID: "administrator", Login: "administrator", Email: "administrator@example.org", IsAdmin: true, Created: now, Updated: now},
	}
	require.NoError(t, database.WithDbSession(t.Context(), func(session *db.Session) error {
		for _, person := range people {
			if _, err := session.Insert(&person); err != nil {
				return err
			}
			if _, err := session.Insert(&org.OrgUser{UserID: person.ID, OrgID: 12, Role: org.RoleViewer, Created: now, Updated: now}); err != nil {
				return err
			}
		}
		return nil
	}))
	for _, person := range people {
		seedLegacyGlobalGrant(t, database, 0, person.ID, "", "extsvc:global", "users:read", "users:id:global")
		seedLegacyGlobalGrant(t, database, 12, person.ID, "", "extsvc:organization", "users:read", "users:id:organization")
		seedLegacyGlobalGrant(t, database, 0, person.ID, "", "custom:global", "users:read", "users:id:custom")
		seedLegacyGlobalGrant(t, database, 0, person.ID, "", "managed:action-set", "dashboards:view", "dashboards:uid:global")
	}
	seedLegacyGlobalGrant(t, database, 0, 0, "Admin", "fixed:global-admin", "users:read", "users:id:admin")
	seedLegacyGlobalGrant(t, database, 0, 0, accesscontrol.RoleGrafanaAdmin, "fixed:grafana-admin", "users:read", "users:id:grafana-admin")
	seedLegacyGlobalGrant(t, database, 12, 0, accesscontrol.RoleGrafanaAdmin, "fixed:org-grafana-admin", "users:read", "users:id:other-org-admin")
	seedLegacyGlobalGrant(t, database, 0, 99, "", "managed:other-user", "users:read", "users:id:other-user")

	for _, enterprise := range []bool{false, true} {
		for _, cached := range []bool{false, true} {
			t.Run(fmt.Sprintf("enterprise=%t/cache=%t", enterprise, cached), func(t *testing.T) {
				catalog := legacypermissions.NewRoleCatalog()
				catalog.Replace(map[string][]accesscontrol.Permission{
					"Admin":                        {{Action: "users:read", Scope: "users:id:admin"}},
					accesscontrol.RoleGrafanaAdmin: {{Action: "users:read", Scope: "users:id:grafana-admin"}},
					"Viewer":                       {{Action: "users:read", Scope: "users:id:organization"}},
				})
				actions := resourcepermissions.NewActionSetService()
				actions.StoreActionSet("dashboards:view", []string{"dashboards:read"})
				license := licensingtest.NewFakeLicensing()
				license.On("FeatureEnabled", "accesscontrol.enforcement").Return(enterprise)
				cfg := setting.NewCfg()
				cfg.RBAC.PermissionCache = cached
				loader := legacypermissions.NewLoader(database, catalog, actions, localcache.New(0, 0), cfg, featuremgmt.WithFeatures(), license, nil)
				s := setupService().WithLegacyScopeResolvers(accesscontrol.NewScopeResolverRegistry(), types.OrgNamespaceFormatter)
				s.store = store.NewStore(legacysql.NewDatabaseProvider(database), tracing.NewNoopTracerService())
				s.userPermissionsEvaluator = loader

				for _, person := range people {
					for _, requesterOrgID := range []int64{accesscontrol.NoOrgID, accesscontrol.GlobalOrgID} {
						t.Run(fmt.Sprintf("%s/org=%d", person.UID, requesterOrgID), func(t *testing.T) {
							requester := &user.SignedInUser{
								UserID: person.ID, UserUID: person.UID, OrgID: accesscontrol.GlobalOrgID,
								OrgRole: org.RoleNone, IsGrafanaAdmin: person.IsAdmin, Namespace: "org-12",
							}
							grants, err := loader.GetUserPermissions(t.Context(), requester, accesscontrol.Options{})
							require.NoError(t, err)
							requester.Permissions = map[int64]map[string][]string{
								accesscontrol.GlobalOrgID: accesscontrol.GroupScopesByActionContext(t.Context(), grants),
								12:                        {"users:read": {"users:id:organization"}},
							}
							requester.OrgID = requesterOrgID

							// An organization-role cache entry must not affect global checks.
							cacheKey := userBasicRoleCacheKey("org-12", person.UID)
							cachedRole := store.BasicRole{Role: "Viewer", IsAdmin: !person.IsAdmin}
							s.basicRoleCache.Set(t.Context(), cacheKey, cachedRole)

							for _, tc := range []struct {
								name            string
								evaluator       accesscontrol.Evaluator
								restrictActions []string
								allowed         bool
							}{
								{
									name:      "global direct",
									evaluator: accesscontrol.EvalPermission("users:read", "users:id:global"),
									allowed:   true,
								},
								{
									name:      "organization excluded",
									evaluator: accesscontrol.EvalPermission("users:read", "users:id:organization"),
									allowed:   false,
								},
								{
									name:      "other user excluded",
									evaluator: accesscontrol.EvalPermission("users:read", "users:id:other-user"),
									allowed:   false,
								},
								{
									name:      "custom role follows licensing",
									evaluator: accesscontrol.EvalPermission("users:read", "users:id:custom"),
									allowed:   enterprise,
								},
								{
									name:      "admin role",
									evaluator: accesscontrol.EvalPermission("users:read", "users:id:admin"),
									allowed:   person.IsAdmin,
								},
								{
									name:      "grafana admin role",
									evaluator: accesscontrol.EvalPermission("users:read", "users:id:grafana-admin"),
									allowed:   person.IsAdmin,
								},
								{
									name:      "other org admin excluded",
									evaluator: accesscontrol.EvalPermission("users:read", "users:id:other-org-admin"),
									allowed:   false,
								},
								{
									name:      "action set",
									evaluator: accesscontrol.EvalPermission("dashboards:read", "dashboards:uid:global"),
									allowed:   true,
								},
								{
									name:      "shared with me",
									evaluator: accesscontrol.EvalPermission("folders:read", "folders:uid:sharedwithme"),
									allowed:   true,
								},
								{
									name:      "empty all",
									evaluator: accesscontrol.EvalAll(),
									allowed:   true,
								},
								{
									name:      "empty any",
									evaluator: accesscontrol.EvalAny(),
									allowed:   false,
								},
								{
									name:            "delegation excludes stored action",
									evaluator:       accesscontrol.EvalPermission("users:read", "users:id:global"),
									restrictActions: []string{"dashboards:read"},
									allowed:         false,
								},
								{
									name:            "delegation preserves permitted action set grant",
									evaluator:       accesscontrol.EvalPermission("dashboards:read", "dashboards:uid:global"),
									restrictActions: []string{"dashboards:read"},
									allowed:         true,
								},
								{
									name:            "delegation excludes shared with me",
									evaluator:       accesscontrol.EvalPermission("folders:read", "folders:uid:sharedwithme"),
									restrictActions: []string{"users:read"},
									allowed:         false,
								},
								{
									name: "any allows permitted alternative",
									evaluator: accesscontrol.EvalAny(
										accesscontrol.EvalPermission("users:read", "users:id:global"),
										accesscontrol.EvalPermission("dashboards:read", "dashboards:uid:global"),
									),
									restrictActions: []string{"dashboards:read"},
									allowed:         true,
								},
								{
									name: "all denies restricted action",
									evaluator: accesscontrol.EvalAll(
										accesscontrol.EvalPermission("users:read", "users:id:global"),
										accesscontrol.EvalPermission("dashboards:read", "dashboards:uid:global"),
									),
									restrictActions: []string{"dashboards:read"},
									allowed:         false,
								},
								{
									name:            "nonempty delegation allows empty all",
									evaluator:       accesscontrol.EvalAll(),
									restrictActions: []string{"users:read"},
									allowed:         true,
								},
								{
									name:            "empty delegation denies empty all",
									evaluator:       accesscontrol.EvalAll(),
									restrictActions: []string{},
									allowed:         false,
								},
							} {
								t.Run(tc.name, func(t *testing.T) {
									checkedRequester := *requester
									if tc.restrictActions != nil {
										// Authentication keeps only delegated action keys, retaining their scopes.
										permitted := make(map[string][]string)
										for _, action := range tc.restrictActions {
											if scopes, ok := requester.GetGlobalPermissions()[action]; ok {
												permitted[action] = scopes
											}
										}
										checkedRequester.Permissions = map[int64]map[string][]string{accesscontrol.GlobalOrgID: permitted}
									}

									allowed, err := acimpl.ProvideAccessControlTest().Evaluate(t.Context(), &checkedRequester, tc.evaluator)
									require.NoError(t, err)
									require.Equal(t, tc.allowed, allowed)
									expression, err := accesscontrol.ToLegacyExpression(tc.evaluator)
									require.NoError(t, err)

									got, err := s.LegacyCheck(legacyCheckContext(t), &authzextv1.LegacyCheckRequest{
										Namespace: "org-12", Subject: requester.GetUID(), Expression: expression,
										GlobalEvaluation: &authzextv1.LegacyGlobalEvaluation{
											RequesterOrgId:   requesterOrgID,
											PermittedActions: slices.Sorted(maps.Keys(checkedRequester.GetGlobalPermissions())),
										},
									})

									require.NoError(t, err)
									require.True(t, proto.Equal(&authzextv1.LegacyCheckResponse{Allowed: allowed}, got), "got %v", got)
								})
							}
							unchanged, ok := s.basicRoleCache.Get(t.Context(), cacheKey)
							require.True(t, ok)
							require.Equal(t, cachedRole, unchanged)
						})
					}
				}
			})
		}
	}
}

func seedLegacyGlobalGrant(
	t *testing.T,
	database db.DB,
	orgID int64,
	userID int64,
	builtin string,
	name string,
	action string,
	scope string,
) {
	t.Helper()
	require.NoError(t, database.WithDbSession(t.Context(), func(session *db.Session) error {
		now := time.Now()
		name = fmt.Sprintf("%s:%d:%d", name, orgID, userID)
		role := accesscontrol.Role{UID: name, Name: name, OrgID: orgID, Created: now, Updated: now}
		if _, err := session.Insert(&role); err != nil {
			return err
		}
		if _, err := session.Insert(&accesscontrol.Permission{RoleID: role.ID, Action: action, Scope: scope, Created: now, Updated: now}); err != nil {
			return err
		}
		if builtin != "" {
			_, err := session.Insert(&accesscontrol.BuiltinRole{RoleID: role.ID, Role: builtin, OrgID: orgID, Created: now, Updated: now})
			return err
		}
		_, err := session.Insert(&accesscontrol.UserRole{RoleID: role.ID, OrgID: orgID, UserID: userID, Created: now})
		return err
	}))
}

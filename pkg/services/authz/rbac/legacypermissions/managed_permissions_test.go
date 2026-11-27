package legacypermissions_test

import (
	"fmt"
	"slices"
	"testing"
	"time"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationGlobalManagedPermissionsParity(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	require.NoError(t, openfeature.SetProviderAndWait(globalPermissionsFeatureProvider{}))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
	const userID int64 = 7
	sql := db.NewTestStore(t)
	for _, grant := range []struct {
		role       string
		permission ac.Permission
	}{
		{"managed:individual", ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:individual", Kind: "dashboards"}},
		{"managed:duplicate", ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:equivalent", Kind: "dashboards"}},
		{"managed:equivalent", ac.Permission{Action: "dashboards:view", Scope: "dashboards:uid:equivalent", Kind: "dashboards"}},
		{"managed:other-scope", ac.Permission{Action: "dashboards:view", Scope: "dashboards:uid:other", Kind: "dashboards"}},
		{"custom:individual", ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:custom", Kind: "dashboards"}},
		{"managed:unrelated", ac.Permission{Action: "users:read", Scope: "users:*", Kind: "users"}},
		{"managed:folder", ac.Permission{Action: "folders:read", Scope: "folders:uid:individual", Kind: "folders"}},
	} {
		seedGrant(t, sql, grant.role, ac.GlobalOrgID, userID, grant.permission)
	}
	seedGlobalBasicGrant(t, sql, "managed:basic-dashboard", ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:basic", Kind: "dashboards"})
	seedGlobalBasicGrant(t, sql, "managed:basic-folder", ac.Permission{Action: "folders:read", Scope: "folders:uid:basic", Kind: "folders"})

	for _, enabled := range []bool{false, true} {
		for _, enforcement := range []bool{false, true} {
			for _, cached := range []bool{false, true} {
				t.Run(fmt.Sprintf("flag=%t/enforcement=%t/cache=%t", enabled, enforcement, cached), func(t *testing.T) {
					actions := resourcepermissions.NewActionSetService()
					actions.StoreActionSet("dashboards:view", []string{"dashboards:read"})
					target := "disabled"
					if enabled {
						target = "enabled"
					}
					ctx := openfeature.WithTransactionContext(t.Context(), openfeature.NewEvaluationContext(target, nil))
					loader := legacypermissions.NewLoader(sql, legacypermissions.NewRoleCatalog(), actions, localcache.New(0, 0), loaderConfig(cached), &enforcementLicense{enabled: enforcement}, nil)
					requester := &user.SignedInUser{UserID: userID, UserUID: "checked-user", OrgID: ac.GlobalOrgID, OrgRole: org.RoleViewer}
					for _, phase := range []struct {
						name    string
						options ac.Options
					}{
						{name: "cold"}, {name: "warm"}, {name: "refresh", options: ac.Options{ReloadCache: true}},
					} {
						t.Run(phase.name, func(t *testing.T) {
							enumerated, err := loader.GetUserPermissions(ctx, requester, phase.options)
							require.NoError(t, err)
							grouped := ac.GroupScopesByActionContext(t.Context(), enumerated)
							want := make(map[string][]string)
							requested := []string{"dashboards:read", "folders:read", "users:read"}
							for _, action := range requested {
								if scopes, ok := grouped[action]; ok {
									want[action] = scopes
								}
							}
							got, err := loader.GetGlobalUserPermissions(ctx, requester, requested)
							require.NoError(t, err)
							// Query grouping may change duplicate counts, but authorization depends on scope membership.
							for _, permissions := range []map[string][]string{want, got} {
								for action, scopes := range permissions {
									permissions[action] = uniqueScopes(scopes)
								}
							}
							require.Equal(t, want, got)
							require.Equal(t, !enabled || cached && enforcement, ac.EvalPermission("dashboards:read", "dashboards:uid:individual").Evaluate(got))
							require.Equal(t, !enabled || cached, ac.EvalPermission("dashboards:read", "dashboards:uid:basic").Evaluate(got))
							require.True(t, ac.EvalPermission("dashboards:read", "dashboards:uid:equivalent").Evaluate(got))
							require.Equal(t, enforcement, ac.EvalPermission("dashboards:read", "dashboards:uid:custom").Evaluate(got))
							require.True(t, ac.EvalPermission("users:read", "users:*").Evaluate(got))
						})
					}
				})
			}
		}
	}
}

func seedGlobalBasicGrant(t *testing.T, sql db.DB, name string, permission ac.Permission) {
	t.Helper()
	require.NoError(t, sql.WithDbSession(t.Context(), func(session *db.Session) error {
		now := time.Now()
		role := ac.Role{Name: name, UID: name, OrgID: ac.GlobalOrgID, Created: now, Updated: now}
		if _, err := session.Insert(&role); err != nil {
			return err
		}
		permission.RoleID, permission.Created, permission.Updated = role.ID, now, now
		if _, err := session.Insert(&permission); err != nil {
			return err
		}
		_, err := session.Insert(&ac.BuiltinRole{RoleID: role.ID, OrgID: ac.GlobalOrgID, Role: string(org.RoleViewer), Created: now, Updated: now})
		return err
	}))
}

func uniqueScopes(scopes []string) []string {
	result := append([]string(nil), scopes...)
	slices.Sort(result)
	return slices.Compact(result)
}

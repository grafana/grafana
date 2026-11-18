package acimpl

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func seedContractGrafanaAdmin(t *testing.T, sql db.DB, storedAdmin bool) {
	t.Helper()
	require.NoError(t, sql.WithDbSession(context.Background(), func(sess *db.Session) error {
		now := time.Now()
		if _, err := sess.Insert(&user.User{
			ID: 7, UID: "admin-contract-user", Login: "admin-contract-user", Email: "admin-contract@example.test",
			OrgID: 1, IsAdmin: storedAdmin, Created: now, Updated: now,
		}); err != nil {
			return err
		}
		if _, err := sess.Insert(&org.OrgUser{OrgID: 1, UserID: 7, Role: org.RoleAdmin, Created: now, Updated: now}); err != nil {
			return err
		}
		for _, grant := range []struct {
			name, builtin, action, scope string
		}{
			{"managed:server-admin", "Grafana Admin", "users:read", "users:*"},
			{"custom:server-admin", "Grafana Admin", "users:create", ""},
			{"managed:viewer", "Viewer", "dashboards:read", "dashboards:uid:viewer"},
			{"managed:editor", "Editor", "dashboards:read", "dashboards:uid:editor"},
			{"managed:admin", "Admin", "dashboards:read", "dashboards:uid:admin"},
			{"managed:none", "None", "dashboards:read", "dashboards:uid:none"},
		} {
			role := accesscontrol.Role{Name: grant.name, UID: grant.name, OrgID: 0, Created: now, Updated: now}
			if _, err := sess.Insert(&role); err != nil {
				return err
			}
			if _, err := sess.Insert(&accesscontrol.Permission{
				RoleID: role.ID, Action: grant.action, Scope: grant.scope, Created: now, Updated: now,
			}); err != nil {
				return err
			}
			if _, err := sess.Insert(&accesscontrol.BuiltinRole{
				RoleID: role.ID, OrgID: 0, Role: grant.builtin, Created: now, Updated: now,
			}); err != nil {
				return err
			}
		}
		return nil
	}))
}

func TestIntegrationGetUserPermissions_ContractGrafanaAdmin(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, cache := range []bool{false, true} {
		for _, storedAdmin := range []bool{false, true} {
			t.Run(fmt.Sprintf("cache=%t/stored-admin=%t", cache, storedAdmin), func(t *testing.T) {
				s := setupTestEnv(t, false)
				s.cfg.RBAC.PermissionCache = cache
				seedContractGrafanaAdmin(t, s.sql, storedAdmin)
				for _, grant := range []struct {
					name  string
					orgID int64
					scope string
				}{
					{"managed:local-direct", 1, "dashboards:uid:local-direct"},
					{"managed:global-direct", 0, "dashboards:uid:global-direct"},
					{"managed:other-org", 2, "dashboards:uid:other-org"},
				} {
					addContractUserGrant(t, s.sql, grant.name, grant.orgID, 7,
						accesscontrol.Permission{Action: "dashboards:read", Scope: grant.scope})
				}
				for _, orgID := range []int64{1, 0} {
					for _, role := range []struct {
						role       org.RoleType
						permission accesscontrol.Permission
					}{
						{org.RoleViewer, accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:viewer"}},
						{org.RoleEditor, accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:editor"}},
						{org.RoleAdmin, accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:admin"}},
						{org.RoleNone, accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:none"}},
					} {
						t.Run(fmt.Sprintf("org=%d/role=%s", orgID, role.role), func(t *testing.T) {
							requester := &user.SignedInUser{UserID: 7, UserUID: "admin-contract-user", OrgID: orgID, OrgRole: role.role}
							// Keep the stored user unchanged while promoting and demoting the
							// trusted requester. Normal reads must reflect each transition
							// even when earlier reads have warmed both role caches.
							for _, requesterAdmin := range []bool{false, true, false, true} {
								requester.IsGrafanaAdmin = requesterAdmin
								basic := role.permission
								if requesterAdmin && orgID == 0 {
									basic = accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:admin"}
								}
								want := []accesscontrol.Permission{
									{Action: "folders:read", Scope: "folders:uid:sharedwithme"},
									{Action: "dashboards:read", Scope: "dashboards:uid:global-direct"},
									basic,
								}
								if orgID == 1 {
									want = append(want, accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:local-direct"})
								}
								if requesterAdmin {
									want = append(want, accesscontrol.Permission{Action: "users:read", Scope: "users:*"})
								}
								check := func(options accesscontrol.Options) {
									t.Helper()
									got, err := s.GetUserPermissions(context.Background(), requester, options)
									require.NoError(t, err)
									require.ElementsMatch(t, want, got, "requester admin=%t, stored admin=%t", requesterAdmin, storedAdmin)
								}
								check(accesscontrol.Options{})
								s.ClearUserPermissionCache(requester)
								check(accesscontrol.Options{})
								check(accesscontrol.Options{ReloadCache: true})
								check(accesscontrol.Options{})
							}
						})
					}
				}
			})
		}
	}
}

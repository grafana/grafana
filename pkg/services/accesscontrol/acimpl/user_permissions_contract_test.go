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

// Fixtures deliberately have no user or membership rows: enumeration accepts the
// trusted requester context rather than reconstructing it from the user table.
func addContractUserGrant(t *testing.T, sql db.DB, name string, orgID, userID int64, permission accesscontrol.Permission) {
	t.Helper()
	require.NoError(t, sql.WithDbSession(context.Background(), func(sess *db.Session) error {
		now := time.Now()
		role := accesscontrol.Role{Name: name, UID: name, OrgID: orgID, Created: now, Updated: now}
		if _, err := sess.Insert(&role); err != nil {
			return err
		}
		permission.RoleID = role.ID
		permission.Created, permission.Updated = now, now
		if _, err := sess.Insert(&permission); err != nil {
			return err
		}
		_, err := sess.Insert(&accesscontrol.UserRole{OrgID: orgID, UserID: userID, RoleID: role.ID, Created: now})
		return err
	}))
}

func TestIntegrationGetUserPermissions_ContractSources(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, cache := range []bool{false, true} {
		t.Run(fmt.Sprintf("cache=%t", cache), func(t *testing.T) {
			s := setupTestEnv(t, false)
			s.cfg.RBAC.PermissionCache = cache
			for _, grant := range []struct {
				name          string
				orgID, userID int64
				scope         string
			}{
				{"managed:direct", 1, 7, "dashboards:uid:direct"},
				{"extsvc:direct", 1, 7, "dashboards:uid:external"},
				{"managed:global", 0, 7, "dashboards:uid:global"},
				{"custom:excluded", 1, 7, "dashboards:uid:custom"},
				{"fixed:excluded", 1, 7, "dashboards:uid:fixed"},
				{"managed:other-user", 1, 8, "dashboards:uid:other-user"},
				{"managed:other-org", 2, 7, "dashboards:uid:other-org"},
			} {
				addContractUserGrant(t, s.sql, grant.name, grant.orgID, grant.userID,
					accesscontrol.Permission{Action: "dashboards:read", Scope: grant.scope})
			}
			for _, role := range []org.RoleType{org.RoleViewer, org.RoleEditor, org.RoleAdmin, org.RoleNone} {
				t.Run(string(role), func(t *testing.T) {
					requester := &user.SignedInUser{UserID: 7, UserUID: "8", OrgID: 1, OrgRole: role}
					got, err := s.GetUserPermissions(context.Background(), requester, accesscontrol.Options{})
					require.NoError(t, err)
					require.ElementsMatch(t, []accesscontrol.Permission{
						{Action: "dashboards:read", Scope: "dashboards:uid:direct"},
						{Action: "dashboards:read", Scope: "dashboards:uid:external"},
						{Action: "dashboards:read", Scope: "dashboards:uid:global"},
						{Action: "folders:read", Scope: "folders:uid:sharedwithme"},
					}, got)
				})
			}
			got, err := s.GetUserPermissions(context.Background(), &user.SignedInUser{
				UserID: 9, UserUID: "unassigned", OrgID: 1, OrgRole: org.RoleNone,
			}, accesscontrol.Options{})
			require.NoError(t, err)
			require.ElementsMatch(t, []accesscontrol.Permission{
				{Action: "folders:read", Scope: "folders:uid:sharedwithme"},
			}, got)
		})
	}
}

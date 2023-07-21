package actest

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
)

// creates a role, connected it to user and store all permission from the user in database
func AddUserPermissionToDB(t testing.TB, db db.DB, user *user.SignedInUser) {
	t.Helper()
	err := db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		var oldRole accesscontrol.Role
		hadOldRole, err := sess.SQL("SELECT * FROM role where uid = 'test_role'").Get(&oldRole)
		if err != nil {
			return err
		}

		_, err = sess.Exec("DELETE FROM role WHERE uid = 'test_role'")
		require.NoError(t, err)

		role := &accesscontrol.Role{
			OrgID:   user.OrgID,
			UID:     "test_role",
			Name:    "test:role",
			Updated: time.Now(),
			Created: time.Now(),
		}

		if _, err := sess.Insert(role); err != nil {
			return err
		}

		_, err = sess.Insert(accesscontrol.UserRole{
			OrgID:   role.OrgID,
			RoleID:  role.ID,
			UserID:  user.UserID,
			Created: time.Now(),
		})
		require.NoError(t, err)

		if hadOldRole {
			if _, err := sess.Exec("DELETE FROM permission WHERE role_id = ?", oldRole.ID); err != nil {
				return err
			}
		}

		var permissions []accesscontrol.Permission
		for action, scopes := range user.Permissions[user.OrgID] {
			for _, scope := range scopes {
				p := accesscontrol.Permission{
					RoleID: role.ID, Action: action, Scope: scope, Created: time.Now(), Updated: time.Now(),
				}
				//p.Kind, p.Attribute, p.Identifier = p.SplitScope()

				permissions = append(permissions, p)
			}
		}

		if _, err := sess.InsertMulti(&permissions); err != nil {
			return err
		}

		return nil
	})

	require.NoError(t, err)
}

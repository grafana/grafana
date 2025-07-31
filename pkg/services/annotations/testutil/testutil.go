package testutil

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardstore "github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func SetupRBACRole(t *testing.T, db db.DB, user *user.SignedInUser) *accesscontrol.Role {
	t.Helper()

	var role *accesscontrol.Role
	err := db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		role = &accesscontrol.Role{
			OrgID:   user.OrgID,
			UID:     "test_role",
			Name:    "test:role",
			Updated: time.Now(),
			Created: time.Now(),
		}
		_, err := sess.Insert(role)
		if err != nil {
			return err
		}

		_, err = sess.Insert(accesscontrol.UserRole{
			OrgID:   role.OrgID,
			RoleID:  role.ID,
			UserID:  user.UserID,
			Created: time.Now(),
		})
		if err != nil {
			return err
		}
		return nil
	})
	require.NoError(t, err)

	return role
}

func SetupRBACPermission(t *testing.T, db db.DB, role *accesscontrol.Role, user *user.SignedInUser) {
	t.Helper()

	err := db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		if _, err := sess.Exec("DELETE FROM permission WHERE role_id = ?", role.ID); err != nil {
			return err
		}

		var acPermission []accesscontrol.Permission
		for action, scopes := range user.Permissions[user.OrgID] {
			for _, scope := range scopes {
				p := accesscontrol.Permission{RoleID: role.ID, Action: action, Scope: scope, Created: time.Now(), Updated: time.Now()}
				p.Kind, p.Attribute, p.Identifier = p.SplitScope()
				acPermission = append(acPermission, p)
			}
		}

		if _, err := sess.InsertMulti(&acPermission); err != nil {
			return err
		}

		return nil
	})

	require.NoError(t, err)
}

func CreateDashboard(t *testing.T, db db.DB, settingsProvider setting.SettingsProvider, features featuremgmt.FeatureToggles, cmd dashboards.SaveDashboardCommand) *dashboards.Dashboard {
	t.Helper()

	dashboardStore, err := dashboardstore.ProvideDashboardStore(
		db,
		settingsProvider,
		features,
		tagimpl.ProvideService(db),
	)
	require.NoError(t, err)

	dash, err := dashboardStore.SaveDashboard(context.Background(), cmd)
	require.NoError(t, err)
	require.NotNil(t, dash)

	return dash
}

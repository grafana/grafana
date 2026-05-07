package testutil

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
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

// NewMockDashboardService returns a FakeDashboardService pre-configured to
// accept SaveDashboard calls and return the dashboard from the DTO with an
// auto-assigned sequential ID.
func NewMockDashboardService(t *testing.T) *dashboards.FakeDashboardService {
	t.Helper()
	var counter int64
	svc := dashboards.NewFakeDashboardService(t)
	svc.On("SaveDashboard", mock.Anything, mock.Anything, mock.Anything).
		Return(
			func(_ context.Context, dto *dashboards.SaveDashboardDTO, _ bool) *dashboards.Dashboard {
				dto.Dashboard.ID = atomic.AddInt64(&counter, 1)
				return dto.Dashboard
			},
			func(_ context.Context, _ *dashboards.SaveDashboardDTO, _ bool) error {
				return nil
			},
		)
	return svc
}

func CreateDashboard(t *testing.T, svc dashboards.DashboardService, cmd dashboards.SaveDashboardCommand) *dashboards.Dashboard {
	t.Helper()

	dash := cmd.GetDashboardModel()
	dash.SetVersion(1)
	if dash.UID == "" {
		dash.SetUID(dash.Slug)
	}
	dto := &dashboards.SaveDashboardDTO{
		OrgID:     cmd.OrgID,
		Dashboard: dash,
	}
	result, err := svc.SaveDashboard(context.Background(), dto, true)
	require.NoError(t, err)
	require.NotNil(t, result)

	return result
}

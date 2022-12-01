package sqlstore

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

func TestIntegrationAccountDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	t.Run("Testing Account DB Access", func(t *testing.T) {
		sqlStore := InitTestDB(t)

		t.Run("Given single org mode", func(t *testing.T) {
			sqlStore.Cfg.AutoAssignOrg = true
			sqlStore.Cfg.AutoAssignOrgId = 1
			sqlStore.Cfg.AutoAssignOrgRole = "Viewer"

			t.Run("Users should be added to default organization", func(t *testing.T) {
				ac1cmd := user.CreateUserCommand{Login: "ac1", Email: "ac1@test.com", Name: "ac1 name"}
				ac2cmd := user.CreateUserCommand{Login: "ac2", Email: "ac2@test.com", Name: "ac2 name"}

				ac1, err := sqlStore.CreateUser(context.Background(), ac1cmd)
				require.NoError(t, err)
				ac2, err := sqlStore.CreateUser(context.Background(), ac2cmd)
				require.NoError(t, err)

				q1 := models.GetUserOrgListQuery{UserId: ac1.ID}
				q2 := models.GetUserOrgListQuery{UserId: ac2.ID}
				err = sqlStore.GetUserOrgList(context.Background(), &q1)
				require.NoError(t, err)
				err = sqlStore.GetUserOrgList(context.Background(), &q2)
				require.NoError(t, err)

				require.Equal(t, q1.Result[0].OrgId, q2.Result[0].OrgId)
				require.Equal(t, string(q1.Result[0].Role), "Viewer")
			})
		})

		t.Run("Given two saved users", func(t *testing.T) {
			sqlStore = InitTestDB(t)
			sqlStore.Cfg.AutoAssignOrg = false

			ac1cmd := user.CreateUserCommand{Login: "ac1", Email: "ac1@test.com", Name: "ac1 name"}
			ac2cmd := user.CreateUserCommand{Login: "ac2", Email: "ac2@test.com", Name: "ac2 name", IsAdmin: true}
			serviceaccountcmd := user.CreateUserCommand{Login: "serviceaccount", Email: "service@test.com", Name: "serviceaccount name", IsAdmin: true, IsServiceAccount: true}

			ac1, err := sqlStore.CreateUser(context.Background(), ac1cmd)
			require.NoError(t, err)
			ac2, err := sqlStore.CreateUser(context.Background(), ac2cmd)
			require.NoError(t, err)
			// user only used for making sure we filter out the service accounts
			_, err = sqlStore.CreateUser(context.Background(), serviceaccountcmd)
			require.NoError(t, err)

			t.Run("Given an added org user", func(t *testing.T) {
				cmd := models.AddOrgUserCommand{
					OrgId:  ac1.OrgID,
					UserId: ac2.ID,
					Role:   org.RoleViewer,
				}

				err := sqlStore.addOrgUser(context.Background(), &cmd)
				t.Run("Should have been saved without error", func(t *testing.T) {
					require.NoError(t, err)
				})

				t.Run("Can get user organizations", func(t *testing.T) {
					query := models.GetUserOrgListQuery{UserId: ac2.ID}
					err := sqlStore.GetUserOrgList(context.Background(), &query)

					require.NoError(t, err)
					require.Equal(t, len(query.Result), 2)
				})

				t.Run("Given an org user with dashboard permissions", func(t *testing.T) {
					ac3cmd := user.CreateUserCommand{Login: "ac3", Email: "ac3@test.com", Name: "ac3 name", IsAdmin: false}
					ac3, err := sqlStore.CreateUser(context.Background(), ac3cmd)
					require.NoError(t, err)

					orgUserCmd := models.AddOrgUserCommand{
						OrgId:  ac1.OrgID,
						UserId: ac3.ID,
						Role:   org.RoleViewer,
					}

					err = sqlStore.addOrgUser(context.Background(), &orgUserCmd)
					require.NoError(t, err)

					dash1 := insertTestDashboard(t, sqlStore, "1 test dash", ac1.OrgID, 0, false, "prod", "webapp")
					dash2 := insertTestDashboard(t, sqlStore, "2 test dash", ac3.OrgID, 0, false, "prod", "webapp")

					err = updateDashboardACL(t, sqlStore, dash1.Id, &models.DashboardACL{
						DashboardID: dash1.Id, OrgID: ac1.OrgID, UserID: ac3.ID, Permission: models.PERMISSION_EDIT,
					})
					require.NoError(t, err)

					err = updateDashboardACL(t, sqlStore, dash2.Id, &models.DashboardACL{
						DashboardID: dash2.Id, OrgID: ac3.OrgID, UserID: ac3.ID, Permission: models.PERMISSION_EDIT,
					})
					require.NoError(t, err)
				})
			})
		})
	})
}

// TODO: Use FakeDashboardStore when org has its own service
func insertTestDashboard(t *testing.T, sqlStore *SQLStore, title string, orgId int64,
	folderId int64, isFolder bool, tags ...interface{}) *models.Dashboard {
	t.Helper()
	cmd := models.SaveDashboardCommand{
		OrgId:    orgId,
		FolderId: folderId,
		IsFolder: isFolder,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"id":    nil,
			"title": title,
			"tags":  tags,
		}),
	}

	var dash *models.Dashboard
	err := sqlStore.WithDbSession(context.Background(), func(sess *DBSession) error {
		dash = cmd.GetDashboardModel()
		dash.SetVersion(1)
		dash.Created = time.Now()
		dash.Updated = time.Now()
		dash.Uid = util.GenerateShortUID()
		_, err := sess.Insert(dash)
		return err
	})

	require.NoError(t, err)
	require.NotNil(t, dash)
	dash.Data.Set("id", dash.Id)
	dash.Data.Set("uid", dash.Uid)

	err = sqlStore.WithDbSession(context.Background(), func(sess *DBSession) error {
		dashVersion := &dashver.DashboardVersion{
			DashboardID:   dash.Id,
			ParentVersion: dash.Version,
			RestoredFrom:  cmd.RestoredFrom,
			Version:       dash.Version,
			Created:       time.Now(),
			CreatedBy:     dash.UpdatedBy,
			Message:       cmd.Message,
			Data:          dash.Data,
		}
		require.NoError(t, err)

		if affectedRows, err := sess.Insert(dashVersion); err != nil {
			return err
		} else if affectedRows == 0 {
			return dashboards.ErrDashboardNotFound
		}

		return nil
	})
	require.NoError(t, err)

	return dash
}

// TODO: Use FakeDashboardStore when org has its own service
func updateDashboardACL(t *testing.T, sqlStore *SQLStore, dashboardID int64, items ...*models.DashboardACL) error {
	t.Helper()

	err := sqlStore.WithDbSession(context.Background(), func(sess *DBSession) error {
		_, err := sess.Exec("DELETE FROM dashboard_acl WHERE dashboard_id=?", dashboardID)
		if err != nil {
			return fmt.Errorf("deleting from dashboard_acl failed: %w", err)
		}

		for _, item := range items {
			item.Created = time.Now()
			item.Updated = time.Now()
			if item.UserID == 0 && item.TeamID == 0 && (item.Role == nil || !item.Role.IsValid()) {
				return models.ErrDashboardACLInfoMissing
			}

			if item.DashboardID == 0 {
				return models.ErrDashboardPermissionDashboardEmpty
			}

			sess.Nullable("user_id", "team_id")
			if _, err := sess.Insert(item); err != nil {
				return err
			}
		}

		// Update dashboard HasACL flag
		dashboard := models.Dashboard{HasACL: true}
		_, err = sess.Cols("has_acl").Where("id=?", dashboardID).Update(&dashboard)
		return err
	})
	return err
}

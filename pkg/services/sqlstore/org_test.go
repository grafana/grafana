package sqlstore

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
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
		testUser := &user.SignedInUser{
			Permissions: map[int64]map[string][]string{
				1: {accesscontrol.ActionOrgUsersRead: []string{accesscontrol.ScopeUsersAll}},
			},
		}

		t.Run("Given we have organizations, we can query them by IDs", func(t *testing.T) {
			var err error
			var cmd *models.CreateOrgCommand
			ids := []int64{}

			for i := 1; i < 4; i++ {
				cmd = &models.CreateOrgCommand{Name: fmt.Sprint("Org #", i)}
				err = sqlStore.CreateOrg(context.Background(), cmd)
				require.NoError(t, err)

				ids = append(ids, cmd.Result.Id)
			}

			query := &models.SearchOrgsQuery{Ids: ids}
			err = sqlStore.SearchOrgs(context.Background(), query)

			require.NoError(t, err)
			require.Equal(t, len(query.Result), 3)
		})

		t.Run("Given we have organizations, we can limit and paginate search", func(t *testing.T) {
			sqlStore = InitTestDB(t)
			for i := 1; i < 4; i++ {
				cmd := &models.CreateOrgCommand{Name: fmt.Sprint("Org #", i)}
				err := sqlStore.CreateOrg(context.Background(), cmd)
				require.NoError(t, err)
			}

			t.Run("Should be able to search with defaults", func(t *testing.T) {
				query := &models.SearchOrgsQuery{}
				err := sqlStore.SearchOrgs(context.Background(), query)

				require.NoError(t, err)
				require.Equal(t, len(query.Result), 3)
			})

			t.Run("Should be able to limit search", func(t *testing.T) {
				query := &models.SearchOrgsQuery{Limit: 1}
				err := sqlStore.SearchOrgs(context.Background(), query)

				require.NoError(t, err)
				require.Equal(t, len(query.Result), 1)
			})

			t.Run("Should be able to limit and paginate search", func(t *testing.T) {
				query := &models.SearchOrgsQuery{Limit: 2, Page: 1}
				err := sqlStore.SearchOrgs(context.Background(), query)

				require.NoError(t, err)
				require.Equal(t, len(query.Result), 1)
			})
		})

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

		t.Run("Given single org and 2 users inserted", func(t *testing.T) {
			sqlStore = InitTestDB(t)
			sqlStore.Cfg.AutoAssignOrg = true
			sqlStore.Cfg.AutoAssignOrgId = 1
			sqlStore.Cfg.AutoAssignOrgRole = "Viewer"

			ac1cmd := user.CreateUserCommand{Login: "ac1", Email: "ac1@test.com", Name: "ac1 name"}
			ac2cmd := user.CreateUserCommand{Login: "ac2", Email: "ac2@test.com", Name: "ac2 name"}

			ac1, err := sqlStore.CreateUser(context.Background(), ac1cmd)
			testUser.OrgID = ac1.OrgID
			require.NoError(t, err)
			_, err = sqlStore.CreateUser(context.Background(), ac2cmd)
			require.NoError(t, err)

			t.Run("Can get organization users paginated with query", func(t *testing.T) {
				query := models.SearchOrgUsersQuery{
					OrgID: ac1.OrgID,
					Page:  1,
					User:  testUser,
				}
				err = sqlStore.SearchOrgUsers(context.Background(), &query)

				require.NoError(t, err)
				require.Equal(t, len(query.Result.OrgUsers), 2)
			})

			t.Run("Can get organization users paginated and limited", func(t *testing.T) {
				query := models.SearchOrgUsersQuery{
					OrgID: ac1.OrgID,
					Limit: 1,
					Page:  1,
					User:  testUser,
				}
				err = sqlStore.SearchOrgUsers(context.Background(), &query)

				require.NoError(t, err)
				require.Equal(t, len(query.Result.OrgUsers), 1)
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

			t.Run("Should be able to read user info projection", func(t *testing.T) {
				query := models.GetUserProfileQuery{UserId: ac1.ID}
				err = sqlStore.GetUserProfile(context.Background(), &query)

				require.NoError(t, err)
				require.Equal(t, query.Result.Email, "ac1@test.com")
				require.Equal(t, query.Result.Login, "ac1")
			})

			t.Run("Can search users", func(t *testing.T) {
				query := models.SearchUsersQuery{Query: "", SignedInUser: &user.SignedInUser{
					OrgID: 1,
					Permissions: map[int64]map[string][]string{
						1: {accesscontrol.ActionUsersRead: {accesscontrol.ScopeGlobalUsersAll}},
					},
				}}
				err := sqlStore.SearchUsers(context.Background(), &query)

				require.NoError(t, err)
				require.Len(t, query.Result.Users, 2)
				require.Equal(t, query.Result.Users[0].Email, "ac1@test.com")
				require.Equal(t, query.Result.Users[1].Email, "ac2@test.com")
			})

			t.Run("Given an added org user", func(t *testing.T) {
				cmd := models.AddOrgUserCommand{
					OrgId:  ac1.OrgID,
					UserId: ac2.ID,
					Role:   org.RoleViewer,
				}

				err := sqlStore.AddOrgUser(context.Background(), &cmd)
				t.Run("Should have been saved without error", func(t *testing.T) {
					require.NoError(t, err)
				})

				t.Run("Can update org user role", func(t *testing.T) {
					updateCmd := models.UpdateOrgUserCommand{OrgId: ac1.OrgID, UserId: ac2.ID, Role: org.RoleAdmin}
					err = sqlStore.UpdateOrgUser(context.Background(), &updateCmd)
					require.NoError(t, err)

					orgUsersQuery := models.GetOrgUsersQuery{
						OrgId: ac1.OrgID,
						User: &user.SignedInUser{
							OrgID:       ac1.OrgID,
							Permissions: map[int64]map[string][]string{ac1.OrgID: {accesscontrol.ActionOrgUsersRead: {accesscontrol.ScopeUsersAll}}},
						},
					}
					err = sqlStore.GetOrgUsers(context.Background(), &orgUsersQuery)
					require.NoError(t, err)

					require.EqualValues(t, orgUsersQuery.Result[1].Role, org.RoleAdmin)
				})

				t.Run("Can get logged in user projection", func(t *testing.T) {
					query := models.GetSignedInUserQuery{UserId: ac2.ID}
					err := sqlStore.GetSignedInUser(context.Background(), &query)

					require.NoError(t, err)
					require.Equal(t, query.Result.Email, "ac2@test.com")
					require.Equal(t, query.Result.OrgID, ac2.OrgID)
					require.Equal(t, query.Result.Name, "ac2 name")
					require.Equal(t, query.Result.Login, "ac2")
					require.EqualValues(t, query.Result.OrgRole, "Admin")
					require.Equal(t, query.Result.OrgName, "ac2@test.com")
					require.Equal(t, query.Result.IsGrafanaAdmin, true)
				})

				t.Run("Can get user organizations", func(t *testing.T) {
					query := models.GetUserOrgListQuery{UserId: ac2.ID}
					err := sqlStore.GetUserOrgList(context.Background(), &query)

					require.NoError(t, err)
					require.Equal(t, len(query.Result), 2)
				})

				t.Run("Can get organization users", func(t *testing.T) {
					query := models.GetOrgUsersQuery{
						OrgId: ac1.OrgID,
						User: &user.SignedInUser{
							OrgID:       ac1.OrgID,
							Permissions: map[int64]map[string][]string{ac1.OrgID: {accesscontrol.ActionOrgUsersRead: {accesscontrol.ScopeUsersAll}}},
						},
					}
					err := sqlStore.GetOrgUsers(context.Background(), &query)

					require.NoError(t, err)
					require.Equal(t, len(query.Result), 2)
					require.Equal(t, query.Result[0].Role, "Admin")
				})

				t.Run("Can get organization users with query", func(t *testing.T) {
					query := models.GetOrgUsersQuery{
						OrgId: ac1.OrgID,
						Query: "ac1",
						User: &user.SignedInUser{
							OrgID:       ac1.OrgID,
							Permissions: map[int64]map[string][]string{ac1.OrgID: {accesscontrol.ActionOrgUsersRead: {accesscontrol.ScopeUsersAll}}},
						},
					}
					err := sqlStore.GetOrgUsers(context.Background(), &query)

					require.NoError(t, err)
					require.Equal(t, len(query.Result), 1)
					require.Equal(t, query.Result[0].Email, ac1.Email)
				})

				t.Run("Can get organization users with query and limit", func(t *testing.T) {
					query := models.GetOrgUsersQuery{
						OrgId: ac1.OrgID,
						Query: "ac",
						Limit: 1,
						User: &user.SignedInUser{
							OrgID:       ac1.OrgID,
							Permissions: map[int64]map[string][]string{ac1.OrgID: {accesscontrol.ActionOrgUsersRead: {accesscontrol.ScopeUsersAll}}},
						},
					}
					err := sqlStore.GetOrgUsers(context.Background(), &query)

					require.NoError(t, err)
					require.Equal(t, len(query.Result), 1)
					require.Equal(t, query.Result[0].Email, ac1.Email)
				})

				t.Run("Can set using org", func(t *testing.T) {
					cmd := models.SetUsingOrgCommand{UserId: ac2.ID, OrgId: ac1.OrgID}
					err := sqlStore.SetUsingOrg(context.Background(), &cmd)
					require.NoError(t, err)

					t.Run("SignedInUserQuery with a different org", func(t *testing.T) {
						query := models.GetSignedInUserQuery{UserId: ac2.ID}
						err := sqlStore.GetSignedInUser(context.Background(), &query)

						require.NoError(t, err)
						require.Equal(t, query.Result.OrgID, ac1.OrgID)
						require.Equal(t, query.Result.Email, "ac2@test.com")
						require.Equal(t, query.Result.Name, "ac2 name")
						require.Equal(t, query.Result.Login, "ac2")
						require.Equal(t, query.Result.OrgName, "ac1@test.com")
					})

					t.Run("Should set last org as current when removing user from current", func(t *testing.T) {
						remCmd := models.RemoveOrgUserCommand{OrgId: ac1.OrgID, UserId: ac2.ID}
						err := sqlStore.RemoveOrgUser(context.Background(), &remCmd)
						require.NoError(t, err)

						query := models.GetSignedInUserQuery{UserId: ac2.ID}
						err = sqlStore.GetSignedInUser(context.Background(), &query)

						require.NoError(t, err)
						require.Equal(t, query.Result.OrgID, ac2.OrgID)
					})
				})

				t.Run("Removing user from org should delete user completely if in no other org", func(t *testing.T) {
					// make sure ac2 has no org
					err := sqlStore.DeleteOrg(context.Background(), &models.DeleteOrgCommand{Id: ac2.OrgID})
					require.NoError(t, err)

					// remove ac2 user from ac1 org
					remCmd := models.RemoveOrgUserCommand{OrgId: ac1.OrgID, UserId: ac2.ID, ShouldDeleteOrphanedUser: true}
					err = sqlStore.RemoveOrgUser(context.Background(), &remCmd)
					require.NoError(t, err)
					require.True(t, remCmd.UserWasDeleted)

					err = sqlStore.GetSignedInUser(context.Background(), &models.GetSignedInUserQuery{UserId: ac2.ID})
					require.Equal(t, err, user.ErrUserNotFound)
				})

				t.Run("Cannot delete last admin org user", func(t *testing.T) {
					cmd := models.RemoveOrgUserCommand{OrgId: ac1.OrgID, UserId: ac1.ID}
					err := sqlStore.RemoveOrgUser(context.Background(), &cmd)
					require.Equal(t, err, models.ErrLastOrgAdmin)
				})

				t.Run("Cannot update role so no one is admin user", func(t *testing.T) {
					cmd := models.UpdateOrgUserCommand{OrgId: ac1.OrgID, UserId: ac1.ID, Role: org.RoleViewer}
					err := sqlStore.UpdateOrgUser(context.Background(), &cmd)
					require.Equal(t, err, models.ErrLastOrgAdmin)
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

					err = sqlStore.AddOrgUser(context.Background(), &orgUserCmd)
					require.NoError(t, err)

					query := models.GetOrgUsersQuery{
						OrgId: ac1.OrgID,
						User: &user.SignedInUser{
							OrgID:       ac1.OrgID,
							Permissions: map[int64]map[string][]string{ac1.OrgID: {accesscontrol.ActionOrgUsersRead: {accesscontrol.ScopeUsersAll}}},
						},
					}
					err = sqlStore.GetOrgUsers(context.Background(), &query)
					require.NoError(t, err)
					// require.Equal(t, len(query.Result), 3)

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

					t.Run("When org user is deleted", func(t *testing.T) {
						cmdRemove := models.RemoveOrgUserCommand{OrgId: ac1.OrgID, UserId: ac3.ID}
						err := sqlStore.RemoveOrgUser(context.Background(), &cmdRemove)
						require.NoError(t, err)

						t.Run("Should remove dependent permissions for deleted org user", func(t *testing.T) {
							permQuery := &models.GetDashboardACLInfoListQuery{DashboardID: dash1.Id, OrgID: ac1.OrgID}

							err = getDashboardACLInfoList(sqlStore, permQuery)
							require.NoError(t, err)

							require.Equal(t, len(permQuery.Result), 0)
						})

						t.Run("Should not remove dashboard permissions for same user in another org", func(t *testing.T) {
							permQuery := &models.GetDashboardACLInfoListQuery{DashboardID: dash2.Id, OrgID: ac3.OrgID}

							err = getDashboardACLInfoList(sqlStore, permQuery)
							require.NoError(t, err)

							require.Equal(t, len(permQuery.Result), 1)
							require.Equal(t, permQuery.Result[0].OrgId, ac3.OrgID)
							require.Equal(t, permQuery.Result[0].UserId, ac3.ID)
						})
					})
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

// This function was copied from pkg/services/dashboards/database to circumvent
// import cycles. When this org-related code is refactored into a service the
// tests can the real GetDashboardACLInfoList functions
func getDashboardACLInfoList(s *SQLStore, query *models.GetDashboardACLInfoListQuery) error {
	outerErr := s.WithDbSession(context.Background(), func(dbSession *DBSession) error {
		query.Result = make([]*models.DashboardACLInfoDTO, 0)
		falseStr := dialect.BooleanStr(false)

		if query.DashboardID == 0 {
			sql := `SELECT
		da.id,
		da.org_id,
		da.dashboard_id,
		da.user_id,
		da.team_id,
		da.permission,
		da.role,
		da.created,
		da.updated,
		'' as user_login,
		'' as user_email,
		'' as team,
		'' as title,
		'' as slug,
		'' as uid,` +
				falseStr + ` AS is_folder,` +
				falseStr + ` AS inherited
		FROM dashboard_acl as da
		WHERE da.dashboard_id = -1`
			return dbSession.SQL(sql).Find(&query.Result)
		}

		rawSQL := `
			-- get permissions for the dashboard and its parent folder
			SELECT
				da.id,
				da.org_id,
				da.dashboard_id,
				da.user_id,
				da.team_id,
				da.permission,
				da.role,
				da.created,
				da.updated,
				u.login AS user_login,
				u.email AS user_email,
				ug.name AS team,
				ug.email AS team_email,
				d.title,
				d.slug,
				d.uid,
				d.is_folder,
				CASE WHEN (da.dashboard_id = -1 AND d.folder_id > 0) OR da.dashboard_id = d.folder_id THEN ` + dialect.BooleanStr(true) + ` ELSE ` + falseStr + ` END AS inherited
			FROM dashboard as d
				LEFT JOIN dashboard folder on folder.id = d.folder_id
				LEFT JOIN dashboard_acl AS da ON
				da.dashboard_id = d.id OR
				da.dashboard_id = d.folder_id OR
				(
					-- include default permissions -->
					da.org_id = -1 AND (
					  (folder.id IS NOT NULL AND folder.has_acl = ` + falseStr + `) OR
					  (folder.id IS NULL AND d.has_acl = ` + falseStr + `)
					)
				)
				LEFT JOIN ` + dialect.Quote("user") + ` AS u ON u.id = da.user_id
				LEFT JOIN team ug on ug.id = da.team_id
			WHERE d.org_id = ? AND d.id = ? AND da.id IS NOT NULL
			ORDER BY da.id ASC
			`

		return dbSession.SQL(rawSQL, query.OrgID, query.DashboardID).Find(&query.Result)
	})

	if outerErr != nil {
		return outerErr
	}

	for _, p := range query.Result {
		p.PermissionName = p.Permission.String()
	}

	return nil
}

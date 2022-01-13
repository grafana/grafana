//go:build integration
// +build integration

package sqlstore

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestAccountDataAccess(t *testing.T) {
	t.Run("Testing Account DB Access", func(t *testing.T) {
		sqlStore := InitTestDB(t)

		t.Run("Given we have organizations, we can query them by IDs", func(t *testing.T) {
			var err error
			var cmd *models.CreateOrgCommand
			ids := []int64{}

			for i := 1; i < 4; i++ {
				cmd = &models.CreateOrgCommand{Name: fmt.Sprint("Org #", i)}
				err = CreateOrg(context.Background(), cmd)
				require.NoError(t, err)

				ids = append(ids, cmd.Result.Id)
			}

			query := &models.SearchOrgsQuery{Ids: ids}
			err = SearchOrgs(context.Background(), query)

			require.NoError(t, err)
			require.Equal(t, len(query.Result), 3)
		})

		t.Run("Given we have organizations, we can limit and paginate search", func(t *testing.T) {
			sqlStore = InitTestDB(t)
			for i := 1; i < 4; i++ {
				cmd := &models.CreateOrgCommand{Name: fmt.Sprint("Org #", i)}
				err := CreateOrg(context.Background(), cmd)
				require.NoError(t, err)
			}

			t.Run("Should be able to search with defaults", func(t *testing.T) {
				query := &models.SearchOrgsQuery{}
				err := SearchOrgs(context.Background(), query)

				require.NoError(t, err)
				require.Equal(t, len(query.Result), 3)
			})

			t.Run("Should be able to limit search", func(t *testing.T) {
				query := &models.SearchOrgsQuery{Limit: 1}
				err := SearchOrgs(context.Background(), query)

				require.NoError(t, err)
				require.Equal(t, len(query.Result), 1)
			})

			t.Run("Should be able to limit and paginate search", func(t *testing.T) {
				query := &models.SearchOrgsQuery{Limit: 2, Page: 1}
				err := SearchOrgs(context.Background(), query)

				require.NoError(t, err)
				require.Equal(t, len(query.Result), 1)
			})
		})

		t.Run("Given single org mode", func(t *testing.T) {
			setting.AutoAssignOrg = true
			setting.AutoAssignOrgId = 1
			setting.AutoAssignOrgRole = "Viewer"

			t.Run("Users should be added to default organization", func(t *testing.T) {
				ac1cmd := models.CreateUserCommand{Login: "ac1", Email: "ac1@test.com", Name: "ac1 name"}
				ac2cmd := models.CreateUserCommand{Login: "ac2", Email: "ac2@test.com", Name: "ac2 name"}

				ac1, err := sqlStore.CreateUser(context.Background(), ac1cmd)
				require.NoError(t, err)
				ac2, err := sqlStore.CreateUser(context.Background(), ac2cmd)
				require.NoError(t, err)

				q1 := models.GetUserOrgListQuery{UserId: ac1.Id}
				q2 := models.GetUserOrgListQuery{UserId: ac2.Id}
				err = GetUserOrgList(context.Background(), &q1)
				require.NoError(t, err)
				err = GetUserOrgList(context.Background(), &q2)
				require.NoError(t, err)

				require.Equal(t, q1.Result[0].OrgId, q2.Result[0].OrgId)
				require.Equal(t, string(q1.Result[0].Role), "Viewer")
			})
		})

		t.Run("Given single org and 2 users inserted", func(t *testing.T) {
			sqlStore = InitTestDB(t)
			setting.AutoAssignOrg = true
			setting.AutoAssignOrgId = 1
			setting.AutoAssignOrgRole = "Viewer"

			ac1cmd := models.CreateUserCommand{Login: "ac1", Email: "ac1@test.com", Name: "ac1 name"}
			ac2cmd := models.CreateUserCommand{Login: "ac2", Email: "ac2@test.com", Name: "ac2 name"}

			ac1, err := sqlStore.CreateUser(context.Background(), ac1cmd)
			require.NoError(t, err)
			_, err = sqlStore.CreateUser(context.Background(), ac2cmd)
			require.NoError(t, err)

			t.Run("Can get organization users paginated with query", func(t *testing.T) {
				query := models.SearchOrgUsersQuery{
					OrgID: ac1.OrgId,
					Page:  1,
				}
				err = sqlStore.SearchOrgUsers(context.Background(), &query)

				require.NoError(t, err)
				require.Equal(t, len(query.Result.OrgUsers), 2)
			})

			t.Run("Can get organization users paginated and limited", func(t *testing.T) {
				query := models.SearchOrgUsersQuery{
					OrgID: ac1.OrgId,
					Limit: 1,
					Page:  1,
				}
				err = sqlStore.SearchOrgUsers(context.Background(), &query)

				require.NoError(t, err)
				require.Equal(t, len(query.Result.OrgUsers), 1)
			})
		})

		t.Run("Given two saved users", func(t *testing.T) {
			sqlStore = InitTestDB(t)
			setting.AutoAssignOrg = false

			ac1cmd := models.CreateUserCommand{Login: "ac1", Email: "ac1@test.com", Name: "ac1 name"}
			ac2cmd := models.CreateUserCommand{Login: "ac2", Email: "ac2@test.com", Name: "ac2 name", IsAdmin: true}
			serviceaccountcmd := models.CreateUserCommand{Login: "serviceaccount", Email: "service@test.com", Name: "serviceaccount name", IsAdmin: true, IsServiceAccount: true}

			ac1, err := sqlStore.CreateUser(context.Background(), ac1cmd)
			require.NoError(t, err)
			ac2, err := sqlStore.CreateUser(context.Background(), ac2cmd)
			require.NoError(t, err)
			// user only used for making sure we filter out the service accounts
			_, err = sqlStore.CreateUser(context.Background(), serviceaccountcmd)
			require.NoError(t, err)

			t.Run("Should be able to read user info projection", func(t *testing.T) {
				query := models.GetUserProfileQuery{UserId: ac1.Id}
				err = sqlStore.GetUserProfile(context.Background(), &query)

				require.NoError(t, err)
				require.Equal(t, query.Result.Email, "ac1@test.com")
				require.Equal(t, query.Result.Login, "ac1")
			})

			t.Run("Can search users", func(t *testing.T) {
				query := models.SearchUsersQuery{Query: ""}
				err := SearchUsers(context.Background(), &query)

				require.NoError(t, err)
				require.Equal(t, query.Result.Users[0].Email, "ac1@test.com")
				require.Equal(t, query.Result.Users[1].Email, "ac2@test.com")
			})

			t.Run("Given an added org user", func(t *testing.T) {
				cmd := models.AddOrgUserCommand{
					OrgId:  ac1.OrgId,
					UserId: ac2.Id,
					Role:   models.ROLE_VIEWER,
				}

				err := sqlStore.AddOrgUser(context.Background(), &cmd)
				t.Run("Should have been saved without error", func(t *testing.T) {
					require.NoError(t, err)
				})

				t.Run("Can update org user role", func(t *testing.T) {
					updateCmd := models.UpdateOrgUserCommand{OrgId: ac1.OrgId, UserId: ac2.Id, Role: models.ROLE_ADMIN}
					err = sqlStore.UpdateOrgUser(context.Background(), &updateCmd)
					require.NoError(t, err)

					orgUsersQuery := models.GetOrgUsersQuery{OrgId: ac1.OrgId}
					err = sqlStore.GetOrgUsers(context.Background(), &orgUsersQuery)
					require.NoError(t, err)

					require.EqualValues(t, orgUsersQuery.Result[1].Role, models.ROLE_ADMIN)
				})

				t.Run("Can get logged in user projection", func(t *testing.T) {
					query := models.GetSignedInUserQuery{UserId: ac2.Id}
					err := GetSignedInUser(context.Background(), &query)

					require.NoError(t, err)
					require.Equal(t, query.Result.Email, "ac2@test.com")
					require.Equal(t, query.Result.OrgId, ac2.OrgId)
					require.Equal(t, query.Result.Name, "ac2 name")
					require.Equal(t, query.Result.Login, "ac2")
					require.EqualValues(t, query.Result.OrgRole, "Admin")
					require.Equal(t, query.Result.OrgName, "ac2@test.com")
					require.Equal(t, query.Result.IsGrafanaAdmin, true)
				})

				t.Run("Can get user organizations", func(t *testing.T) {
					query := models.GetUserOrgListQuery{UserId: ac2.Id}
					err := GetUserOrgList(context.Background(), &query)

					require.NoError(t, err)
					require.Equal(t, len(query.Result), 2)
				})

				t.Run("Can get organization users", func(t *testing.T) {
					query := models.GetOrgUsersQuery{OrgId: ac1.OrgId}
					err := sqlStore.GetOrgUsers(context.Background(), &query)

					require.NoError(t, err)
					require.Equal(t, len(query.Result), 2)
					require.Equal(t, query.Result[0].Role, "Admin")
				})

				t.Run("Can get organization users with query", func(t *testing.T) {
					query := models.GetOrgUsersQuery{
						OrgId: ac1.OrgId,
						Query: "ac1",
					}
					err := sqlStore.GetOrgUsers(context.Background(), &query)

					require.NoError(t, err)
					require.Equal(t, len(query.Result), 1)
					require.Equal(t, query.Result[0].Email, ac1.Email)
				})

				t.Run("Can get organization users with query and limit", func(t *testing.T) {
					query := models.GetOrgUsersQuery{
						OrgId: ac1.OrgId,
						Query: "ac",
						Limit: 1,
					}
					err := sqlStore.GetOrgUsers(context.Background(), &query)

					require.NoError(t, err)
					require.Equal(t, len(query.Result), 1)
					require.Equal(t, query.Result[0].Email, ac1.Email)
				})

				t.Run("Can set using org", func(t *testing.T) {
					cmd := models.SetUsingOrgCommand{UserId: ac2.Id, OrgId: ac1.OrgId}
					err := sqlStore.SetUsingOrg(context.Background(), &cmd)
					require.NoError(t, err)

					t.Run("SignedInUserQuery with a different org", func(t *testing.T) {
						query := models.GetSignedInUserQuery{UserId: ac2.Id}
						err := GetSignedInUser(context.Background(), &query)

						require.NoError(t, err)
						require.Equal(t, query.Result.OrgId, ac1.OrgId)
						require.Equal(t, query.Result.Email, "ac2@test.com")
						require.Equal(t, query.Result.Name, "ac2 name")
						require.Equal(t, query.Result.Login, "ac2")
						require.Equal(t, query.Result.OrgName, "ac1@test.com")
						// require.Equal(t, query.Result.OrgRole, "Viewer")
					})

					t.Run("Should set last org as current when removing user from current", func(t *testing.T) {
						remCmd := models.RemoveOrgUserCommand{OrgId: ac1.OrgId, UserId: ac2.Id}
						err := sqlStore.RemoveOrgUser(context.Background(), &remCmd)
						require.NoError(t, err)

						query := models.GetSignedInUserQuery{UserId: ac2.Id}
						err = GetSignedInUser(context.Background(), &query)

						require.NoError(t, err)
						require.Equal(t, query.Result.OrgId, ac2.OrgId)
					})
				})

				t.Run("Removing user from org should delete user completely if in no other org", func(t *testing.T) {
					// make sure ac2 has no org
					err := DeleteOrg(context.Background(), &models.DeleteOrgCommand{Id: ac2.OrgId})
					require.NoError(t, err)

					// remove ac2 user from ac1 org
					remCmd := models.RemoveOrgUserCommand{OrgId: ac1.OrgId, UserId: ac2.Id, ShouldDeleteOrphanedUser: true}
					err = sqlStore.RemoveOrgUser(context.Background(), &remCmd)
					require.NoError(t, err)
					require.True(t, remCmd.UserWasDeleted)

					err = GetSignedInUser(context.Background(), &models.GetSignedInUserQuery{UserId: ac2.Id})
					require.Equal(t, err, models.ErrUserNotFound)
				})

				t.Run("Cannot delete last admin org user", func(t *testing.T) {
					cmd := models.RemoveOrgUserCommand{OrgId: ac1.OrgId, UserId: ac1.Id}
					err := sqlStore.RemoveOrgUser(context.Background(), &cmd)
					require.Equal(t, err, models.ErrLastOrgAdmin)
				})

				t.Run("Cannot update role so no one is admin user", func(t *testing.T) {
					cmd := models.UpdateOrgUserCommand{OrgId: ac1.OrgId, UserId: ac1.Id, Role: models.ROLE_VIEWER}
					err := sqlStore.UpdateOrgUser(context.Background(), &cmd)
					require.Equal(t, err, models.ErrLastOrgAdmin)
				})

				t.Run("Given an org user with dashboard permissions", func(t *testing.T) {
					ac3cmd := models.CreateUserCommand{Login: "ac3", Email: "ac3@test.com", Name: "ac3 name", IsAdmin: false}
					ac3, err := sqlStore.CreateUser(context.Background(), ac3cmd)
					require.NoError(t, err)

					orgUserCmd := models.AddOrgUserCommand{
						OrgId:  ac1.OrgId,
						UserId: ac3.Id,
						Role:   models.ROLE_VIEWER,
					}

					err = sqlStore.AddOrgUser(context.Background(), &orgUserCmd)
					require.NoError(t, err)

					query := models.GetOrgUsersQuery{OrgId: ac1.OrgId}
					err = sqlStore.GetOrgUsers(context.Background(), &query)
					require.NoError(t, err)
					// require.Equal(t, len(query.Result), 3)

					dash1 := insertTestDashboard(t, sqlStore, "1 test dash", ac1.OrgId, 0, false, "prod", "webapp")
					dash2 := insertTestDashboard(t, sqlStore, "2 test dash", ac3.OrgId, 0, false, "prod", "webapp")

					err = testHelperUpdateDashboardAcl(t, sqlStore, dash1.Id, models.DashboardAcl{
						DashboardID: dash1.Id, OrgID: ac1.OrgId, UserID: ac3.Id, Permission: models.PERMISSION_EDIT,
					})
					require.NoError(t, err)

					err = testHelperUpdateDashboardAcl(t, sqlStore, dash2.Id, models.DashboardAcl{
						DashboardID: dash2.Id, OrgID: ac3.OrgId, UserID: ac3.Id, Permission: models.PERMISSION_EDIT,
					})
					require.NoError(t, err)

					t.Run("When org user is deleted", func(t *testing.T) {
						cmdRemove := models.RemoveOrgUserCommand{OrgId: ac1.OrgId, UserId: ac3.Id}
						err := sqlStore.RemoveOrgUser(context.Background(), &cmdRemove)
						require.NoError(t, err)

						t.Run("Should remove dependent permissions for deleted org user", func(t *testing.T) {
							permQuery := &models.GetDashboardAclInfoListQuery{DashboardID: dash1.Id, OrgID: ac1.OrgId}

							err = sqlStore.GetDashboardAclInfoList(context.Background(), permQuery)
							require.NoError(t, err)

							require.Equal(t, len(permQuery.Result), 0)
						})

						t.Run("Should not remove dashboard permissions for same user in another org", func(t *testing.T) {
							permQuery := &models.GetDashboardAclInfoListQuery{DashboardID: dash2.Id, OrgID: ac3.OrgId}

							err = sqlStore.GetDashboardAclInfoList(context.Background(), permQuery)
							require.NoError(t, err)

							require.Equal(t, len(permQuery.Result), 1)
							require.Equal(t, permQuery.Result[0].OrgId, ac3.OrgId)
							require.Equal(t, permQuery.Result[0].UserId, ac3.Id)
						})
					})
				})
			})
		})
	})
}

func testHelperUpdateDashboardAcl(t *testing.T, sqlStore *SQLStore, dashboardID int64,
	items ...models.DashboardAcl) error {
	t.Helper()

	var itemPtrs []*models.DashboardAcl
	for _, it := range items {
		item := it
		item.Created = time.Now()
		item.Updated = time.Now()
		itemPtrs = append(itemPtrs, &item)
	}
	return sqlStore.UpdateDashboardACL(context.Background(), dashboardID, itemPtrs)
}

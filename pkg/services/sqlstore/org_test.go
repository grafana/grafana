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
				err = CreateOrg(cmd)
				require.NoError(t, err)

				ids = append(ids, cmd.Result.Id)
			}

			query := &models.SearchOrgsQuery{Ids: ids}
			err = SearchOrgs(query)

			require.NoError(t, err)
			require.Equal(t, 3, len(query.Result))
		})

		t.Run("Given we have organizations, we can limit and paginate search", func(t *testing.T) {
			for i := 1; i < 4; i++ {
				cmd := &models.CreateOrgCommand{Name: fmt.Sprint("Org #", i)}
				err := CreateOrg(cmd)
				require.NoError(t, err)
			}

			t.Run("Should be able to search with defaults", func(t *testing.T) {
				query := &models.SearchOrgsQuery{}
				err := SearchOrgs(query)

				require.NoError(t, err)
				require.Equal(t, 3, len(query.Result))
			})

			t.Run("Should be able to limit search", func(t *testing.T) {
				query := &models.SearchOrgsQuery{Limit: 1}
				err := SearchOrgs(query)

				require.NoError(t, err)
				require.Equal(t, 1, len(query.Result))
			})

			t.Run("Should be able to limit and paginate search", func(t *testing.T) {
				query := &models.SearchOrgsQuery{Limit: 2, Page: 1}
				err := SearchOrgs(query)

				require.NoError(t, err)
				require.Equal(t, 1, len(query.Result))
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
				err = GetUserOrgList(&q1)
				require.NoError(t, err)
				err = GetUserOrgList(&q2)
				require.NoError(t, err)

				require.Equal(t, q2.Result[0].OrgId, q1.Result[0].OrgId)
				require.Equal(t, "Viewer", q1.Result[0].Role)
			})
		})

		t.Run("Given single org and 2 users inserted", func(t *testing.T) {
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
				err = sqlStore.SearchOrgUsers(&query)

				require.NoError(t, err)
				require.Equal(t, 2, len(query.Result.OrgUsers))
			})

			t.Run("Can get organization users paginated and limited", func(t *testing.T) {
				query := models.SearchOrgUsersQuery{
					OrgID: ac1.OrgId,
					Limit: 1,
					Page:  1,
				}
				err = sqlStore.SearchOrgUsers(&query)

				require.NoError(t, err)
				require.Equal(t, 1, len(query.Result.OrgUsers))
			})
		})

		t.Run("Given two saved users", func(t *testing.T) {
			setting.AutoAssignOrg = false

			ac1cmd := models.CreateUserCommand{Login: "ac1", Email: "ac1@test.com", Name: "ac1 name"}
			ac2cmd := models.CreateUserCommand{Login: "ac2", Email: "ac2@test.com", Name: "ac2 name", IsAdmin: true}

			ac1, err := sqlStore.CreateUser(context.Background(), ac1cmd)
			ac2, err := sqlStore.CreateUser(context.Background(), ac2cmd)
			require.NoError(t, err)

			t.Run("Should be able to read user info projection", func(t *testing.T) {
				query := models.GetUserProfileQuery{UserId: ac1.Id}
				err = GetUserProfile(&query)

				require.NoError(t, err)
				require.Equal(t, "ac1@test.com", query.Result.Email)
				require.Equal(t, "ac1", query.Result.Login)
			})

			t.Run("Can search users", func(t *testing.T) {
				query := models.SearchUsersQuery{Query: ""}
				err := SearchUsers(&query)

				require.NoError(t, err)
				require.Equal(t, "ac1@test.com", query.Result.Users[0].Email)
				require.Equal(t, "ac2@test.com", query.Result.Users[1].Email)
			})

			t.Run("Given an added org user", func(t *testing.T) {
				cmd := models.AddOrgUserCommand{
					OrgId:  ac1.OrgId,
					UserId: ac2.Id,
					Role:   models.ROLE_VIEWER,
				}

				err := AddOrgUser(&cmd)
				t.Run("Should have been saved without error", func(t *testing.T) {
					require.NoError(t, err)
				})

				t.Run("Can update org user role", func(t *testing.T) {
					updateCmd := models.UpdateOrgUserCommand{OrgId: ac1.OrgId, UserId: ac2.Id, Role: models.ROLE_ADMIN}
					err = UpdateOrgUser(&updateCmd)
					require.NoError(t, err)

					orgUsersQuery := models.GetOrgUsersQuery{OrgId: ac1.OrgId}
					err = GetOrgUsers(&orgUsersQuery)
					require.NoError(t, err)

					require.Equal(t, models.ROLE_ADMIN, orgUsersQuery.Result[1].Role)
				})

				t.Run("Can get logged in user projection", func(t *testing.T) {
					query := models.GetSignedInUserQuery{UserId: ac2.Id}
					err := GetSignedInUser(context.Background(), &query)

					require.NoError(t, err)
					require.Equal(t, "ac2@test.com", query.Result.Email)
					require.Equal(t, ac2.OrgId, query.Result.OrgId)
					require.Equal(t, "ac2 name", query.Result.Name)
					require.Equal(t, "ac2", query.Result.Login)
					require.Equal(t, "Admin", query.Result.OrgRole)
					require.Equal(t, "ac2@test.com", query.Result.OrgName)
					require.True(t, query.Result.IsGrafanaAdmin)
				})

				t.Run("Can get user organizations", func(t *testing.T) {
					query := models.GetUserOrgListQuery{UserId: ac2.Id}
					err := GetUserOrgList(&query)

					require.NoError(t, err)
					require.Equal(t, 2, len(query.Result))
				})

				t.Run("Can get organization users", func(t *testing.T) {
					query := models.GetOrgUsersQuery{OrgId: ac1.OrgId}
					err := GetOrgUsers(&query)

					require.NoError(t, err)
					require.Equal(t, 2, len(query.Result))
					require.Equal(t, "Admin", query.Result[0].Role)
				})

				t.Run("Can get organization users with query", func(t *testing.T) {
					query := models.GetOrgUsersQuery{
						OrgId: ac1.OrgId,
						Query: "ac1",
					}
					err := GetOrgUsers(&query)

					require.NoError(t, err)
					require.Equal(t, 1, len(query.Result))
					require.Equal(t, ac1.Email, query.Result[0].Email)
				})

				t.Run("Can get organization users with query and limit", func(t *testing.T) {
					query := models.GetOrgUsersQuery{
						OrgId: ac1.OrgId,
						Query: "ac",
						Limit: 1,
					}
					err := GetOrgUsers(&query)

					require.NoError(t, err)
					require.Equal(t, 1, len(query.Result))
					require.Equal(t, ac1.Email, query.Result[0].Email)
				})

				t.Run("Can set using org", func(t *testing.T) {
					cmd := models.SetUsingOrgCommand{UserId: ac2.Id, OrgId: ac1.OrgId}
					err := SetUsingOrg(&cmd)
					require.NoError(t, err)

					t.Run("SignedInUserQuery with a different org", func(t *testing.T) {
						query := models.GetSignedInUserQuery{UserId: ac2.Id}
						err := GetSignedInUser(context.Background(), &query)

						require.NoError(t, err)
						require.Equal(t, ac1.OrgId, query.Result.OrgId)
						require.Equal(t, "ac2@test.com", query.Result.Email)
						require.Equal(t, "ac2 name", query.Result.Name)
						require.Equal(t, "ac2", query.Result.Login)
						require.Equal(t, "ac1@test.com", query.Result.OrgName)
						require.Equal(t, "Viewer", query.Result.OrgRole)
					})

					t.Run("Should set last org as current when removing user from current", func(t *testing.T) {
						remCmd := models.RemoveOrgUserCommand{OrgId: ac1.OrgId, UserId: ac2.Id}
						err := RemoveOrgUser(&remCmd)
						require.NoError(t, err)

						query := models.GetSignedInUserQuery{UserId: ac2.Id}
						err = GetSignedInUser(context.Background(), &query)

						require.NoError(t, err)
						require.Equal(t, ac2.OrgId, query.Result.OrgId)
					})
				})

				t.Run("Removing user from org should delete user completely if in no other org", func(t *testing.T) {
					// make sure ac2 has no org
					err := DeleteOrg(&models.DeleteOrgCommand{Id: ac2.OrgId})
					require.NoError(t, err)

					// remove ac2 user from ac1 org
					remCmd := models.RemoveOrgUserCommand{OrgId: ac1.OrgId, UserId: ac2.Id, ShouldDeleteOrphanedUser: true}
					err = RemoveOrgUser(&remCmd)
					require.NoError(t, err)
					require.True(t, remCmd.UserWasDeleted)

					err = GetSignedInUser(context.Background(), &models.GetSignedInUserQuery{UserId: ac2.Id})
					require.Equal(t, models.ErrUserNotFound, err)
				})

				t.Run("Cannot delete last admin org user", func(t *testing.T) {
					cmd := models.RemoveOrgUserCommand{OrgId: ac1.OrgId, UserId: ac1.Id}
					err := RemoveOrgUser(&cmd)
					require.Equal(t, models.ErrLastOrgAdmin, err)
				})

				t.Run("Cannot update role so no one is admin user", func(t *testing.T) {
					cmd := models.UpdateOrgUserCommand{OrgId: ac1.OrgId, UserId: ac1.Id, Role: models.ROLE_VIEWER}
					err := UpdateOrgUser(&cmd)
					require.Equal(t, models.ErrLastOrgAdmin, err)
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

					err = AddOrgUser(&orgUserCmd)
					require.NoError(t, err)

					query := models.GetOrgUsersQuery{OrgId: ac1.OrgId}
					err = GetOrgUsers(&query)
					require.NoError(t, err)
					require.Equal(t, 3, len(query.Result))

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
						err := RemoveOrgUser(&cmdRemove)
						require.NoError(t, err)

						t.Run("Should remove dependent permissions for deleted org user", func(t *testing.T) {
							permQuery := &models.GetDashboardAclInfoListQuery{DashboardID: dash1.Id, OrgID: ac1.OrgId}
							err = GetDashboardAclInfoList(permQuery)
							require.NoError(t, err)

							require.Equal(t, 0, len(permQuery.Result))
						})

						t.Run("Should not remove dashboard permissions for same user in another org", func(t *testing.T) {
							permQuery := &models.GetDashboardAclInfoListQuery{DashboardID: dash2.Id, OrgID: ac3.OrgId}
							err = GetDashboardAclInfoList(permQuery)
							require.NoError(t, err)

							require.Equal(t, 1, len(permQuery.Result))
							require.Equal(t, ac3.OrgId, permQuery.Result[0].OrgId)
							require.Equal(t, ac3.Id, permQuery.Result[0].UserId)
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
	return sqlStore.UpdateDashboardACL(dashboardID, itemPtrs)
}

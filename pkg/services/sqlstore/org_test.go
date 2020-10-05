// +build integration

package sqlstore

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestAccountDataAccess(t *testing.T) {
	Convey("Testing Account DB Access", t, func() {
		InitTestDB(t)

		Convey("Given we have organizations, we can query them by IDs", func() {
			var err error
			var cmd *models.CreateOrgCommand
			ids := []int64{}

			for i := 1; i < 4; i++ {
				cmd = &models.CreateOrgCommand{Name: fmt.Sprint("Org #", i)}
				err = CreateOrg(cmd)
				So(err, ShouldBeNil)

				ids = append(ids, cmd.Result.Id)
			}

			query := &models.SearchOrgsQuery{Ids: ids}
			err = SearchOrgs(query)

			So(err, ShouldBeNil)
			So(len(query.Result), ShouldEqual, 3)
		})

		Convey("Given we have organizations, we can limit and paginate search", func() {
			for i := 1; i < 4; i++ {
				cmd := &models.CreateOrgCommand{Name: fmt.Sprint("Org #", i)}
				err := CreateOrg(cmd)
				So(err, ShouldBeNil)
			}

			Convey("Should be able to search with defaults", func() {
				query := &models.SearchOrgsQuery{}
				err := SearchOrgs(query)

				So(err, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 3)
			})

			Convey("Should be able to limit search", func() {
				query := &models.SearchOrgsQuery{Limit: 1}
				err := SearchOrgs(query)

				So(err, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 1)
			})

			Convey("Should be able to limit and paginate search", func() {
				query := &models.SearchOrgsQuery{Limit: 2, Page: 1}
				err := SearchOrgs(query)

				So(err, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 1)
			})
		})

		Convey("Given single org mode", func() {
			setting.AutoAssignOrg = true
			setting.AutoAssignOrgId = 1
			setting.AutoAssignOrgRole = "Viewer"

			Convey("Users should be added to default organization", func() {
				ac1cmd := models.CreateUserCommand{Login: "ac1", Email: "ac1@test.com", Name: "ac1 name"}
				ac2cmd := models.CreateUserCommand{Login: "ac2", Email: "ac2@test.com", Name: "ac2 name"}

				err := CreateUser(context.Background(), &ac1cmd)
				So(err, ShouldBeNil)
				err = CreateUser(context.Background(), &ac2cmd)
				So(err, ShouldBeNil)

				q1 := models.GetUserOrgListQuery{UserId: ac1cmd.Result.Id}
				q2 := models.GetUserOrgListQuery{UserId: ac2cmd.Result.Id}
				err = GetUserOrgList(&q1)
				So(err, ShouldBeNil)
				err = GetUserOrgList(&q2)
				So(err, ShouldBeNil)

				So(q1.Result[0].OrgId, ShouldEqual, q2.Result[0].OrgId)
				So(q1.Result[0].Role, ShouldEqual, "Viewer")
			})
		})

		Convey("Given two saved users", func() {
			setting.AutoAssignOrg = false

			ac1cmd := models.CreateUserCommand{Login: "ac1", Email: "ac1@test.com", Name: "ac1 name"}
			ac2cmd := models.CreateUserCommand{Login: "ac2", Email: "ac2@test.com", Name: "ac2 name", IsAdmin: true}

			err := CreateUser(context.Background(), &ac1cmd)
			err = CreateUser(context.Background(), &ac2cmd)
			So(err, ShouldBeNil)

			ac1 := ac1cmd.Result
			ac2 := ac2cmd.Result

			Convey("Should be able to read user info projection", func() {
				query := models.GetUserProfileQuery{UserId: ac1.Id}
				err = GetUserProfile(&query)

				So(err, ShouldBeNil)
				So(query.Result.Email, ShouldEqual, "ac1@test.com")
				So(query.Result.Login, ShouldEqual, "ac1")
			})

			Convey("Can search users", func() {
				query := models.SearchUsersQuery{Query: ""}
				err := SearchUsers(&query)

				So(err, ShouldBeNil)
				So(query.Result.Users[0].Email, ShouldEqual, "ac1@test.com")
				So(query.Result.Users[1].Email, ShouldEqual, "ac2@test.com")
			})

			Convey("Given an added org user", func() {
				cmd := models.AddOrgUserCommand{
					OrgId:  ac1.OrgId,
					UserId: ac2.Id,
					Role:   models.ROLE_VIEWER,
				}

				err := AddOrgUser(&cmd)
				Convey("Should have been saved without error", func() {
					So(err, ShouldBeNil)
				})

				Convey("Can update org user role", func() {
					updateCmd := models.UpdateOrgUserCommand{OrgId: ac1.OrgId, UserId: ac2.Id, Role: models.ROLE_ADMIN}
					err = UpdateOrgUser(&updateCmd)
					So(err, ShouldBeNil)

					orgUsersQuery := models.GetOrgUsersQuery{OrgId: ac1.OrgId}
					err = GetOrgUsers(&orgUsersQuery)
					So(err, ShouldBeNil)

					So(orgUsersQuery.Result[1].Role, ShouldEqual, models.ROLE_ADMIN)
				})

				Convey("Can get logged in user projection", func() {
					query := models.GetSignedInUserQuery{UserId: ac2.Id}
					err := GetSignedInUser(&query)

					So(err, ShouldBeNil)
					So(query.Result.Email, ShouldEqual, "ac2@test.com")
					So(query.Result.OrgId, ShouldEqual, ac2.OrgId)
					So(query.Result.Name, ShouldEqual, "ac2 name")
					So(query.Result.Login, ShouldEqual, "ac2")
					So(query.Result.OrgRole, ShouldEqual, "Admin")
					So(query.Result.OrgName, ShouldEqual, "ac2@test.com")
					So(query.Result.IsGrafanaAdmin, ShouldBeTrue)
				})

				Convey("Can get user organizations", func() {
					query := models.GetUserOrgListQuery{UserId: ac2.Id}
					err := GetUserOrgList(&query)

					So(err, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 2)
				})

				Convey("Can get organization users", func() {
					query := models.GetOrgUsersQuery{OrgId: ac1.OrgId}
					err := GetOrgUsers(&query)

					So(err, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 2)
					So(query.Result[0].Role, ShouldEqual, "Admin")
				})

				Convey("Can get organization users with query", func() {
					query := models.GetOrgUsersQuery{
						OrgId: ac1.OrgId,
						Query: "ac1",
					}
					err := GetOrgUsers(&query)

					So(err, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 1)
					So(query.Result[0].Email, ShouldEqual, ac1.Email)
				})

				Convey("Can get organization users with query and limit", func() {
					query := models.GetOrgUsersQuery{
						OrgId: ac1.OrgId,
						Query: "ac",
						Limit: 1,
					}
					err := GetOrgUsers(&query)

					So(err, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 1)
					So(query.Result[0].Email, ShouldEqual, ac1.Email)
				})

				Convey("Can set using org", func() {
					cmd := models.SetUsingOrgCommand{UserId: ac2.Id, OrgId: ac1.OrgId}
					err := SetUsingOrg(&cmd)
					So(err, ShouldBeNil)

					Convey("SignedInUserQuery with a different org", func() {
						query := models.GetSignedInUserQuery{UserId: ac2.Id}
						err := GetSignedInUser(&query)

						So(err, ShouldBeNil)
						So(query.Result.OrgId, ShouldEqual, ac1.OrgId)
						So(query.Result.Email, ShouldEqual, "ac2@test.com")
						So(query.Result.Name, ShouldEqual, "ac2 name")
						So(query.Result.Login, ShouldEqual, "ac2")
						So(query.Result.OrgName, ShouldEqual, "ac1@test.com")
						So(query.Result.OrgRole, ShouldEqual, "Viewer")
					})

					Convey("Should set last org as current when removing user from current", func() {
						remCmd := models.RemoveOrgUserCommand{OrgId: ac1.OrgId, UserId: ac2.Id}
						err := RemoveOrgUser(&remCmd)
						So(err, ShouldBeNil)

						query := models.GetSignedInUserQuery{UserId: ac2.Id}
						err = GetSignedInUser(&query)

						So(err, ShouldBeNil)
						So(query.Result.OrgId, ShouldEqual, ac2.OrgId)
					})
				})

				Convey("Removing user from org should delete user completely if in no other org", func() {
					// make sure ac2 has no org
					err := DeleteOrg(&models.DeleteOrgCommand{Id: ac2.OrgId})
					So(err, ShouldBeNil)

					// remove ac2 user from ac1 org
					remCmd := models.RemoveOrgUserCommand{OrgId: ac1.OrgId, UserId: ac2.Id, ShouldDeleteOrphanedUser: true}
					err = RemoveOrgUser(&remCmd)
					So(err, ShouldBeNil)
					So(remCmd.UserWasDeleted, ShouldBeTrue)

					err = GetSignedInUser(&models.GetSignedInUserQuery{UserId: ac2.Id})
					So(err, ShouldEqual, models.ErrUserNotFound)
				})

				Convey("Cannot delete last admin org user", func() {
					cmd := models.RemoveOrgUserCommand{OrgId: ac1.OrgId, UserId: ac1.Id}
					err := RemoveOrgUser(&cmd)
					So(err, ShouldEqual, models.ErrLastOrgAdmin)
				})

				Convey("Cannot update role so no one is admin user", func() {
					cmd := models.UpdateOrgUserCommand{OrgId: ac1.OrgId, UserId: ac1.Id, Role: models.ROLE_VIEWER}
					err := UpdateOrgUser(&cmd)
					So(err, ShouldEqual, models.ErrLastOrgAdmin)
				})

				Convey("Given an org user with dashboard permissions", func() {
					ac3cmd := models.CreateUserCommand{Login: "ac3", Email: "ac3@test.com", Name: "ac3 name", IsAdmin: false}
					err := CreateUser(context.Background(), &ac3cmd)
					So(err, ShouldBeNil)
					ac3 := ac3cmd.Result

					orgUserCmd := models.AddOrgUserCommand{
						OrgId:  ac1.OrgId,
						UserId: ac3.Id,
						Role:   models.ROLE_VIEWER,
					}

					err = AddOrgUser(&orgUserCmd)
					So(err, ShouldBeNil)

					query := models.GetOrgUsersQuery{OrgId: ac1.OrgId}
					err = GetOrgUsers(&query)
					So(err, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 3)

					dash1 := insertTestDashboard("1 test dash", ac1.OrgId, 0, false, "prod", "webapp")
					dash2 := insertTestDashboard("2 test dash", ac3.OrgId, 0, false, "prod", "webapp")

					err = testHelperUpdateDashboardAcl(dash1.Id, models.DashboardAcl{DashboardId: dash1.Id, OrgId: ac1.OrgId, UserId: ac3.Id, Permission: models.PERMISSION_EDIT})
					So(err, ShouldBeNil)

					err = testHelperUpdateDashboardAcl(dash2.Id, models.DashboardAcl{DashboardId: dash2.Id, OrgId: ac3.OrgId, UserId: ac3.Id, Permission: models.PERMISSION_EDIT})
					So(err, ShouldBeNil)

					Convey("When org user is deleted", func() {
						cmdRemove := models.RemoveOrgUserCommand{OrgId: ac1.OrgId, UserId: ac3.Id}
						err := RemoveOrgUser(&cmdRemove)
						So(err, ShouldBeNil)

						Convey("Should remove dependent permissions for deleted org user", func() {
							permQuery := &models.GetDashboardAclInfoListQuery{DashboardId: 1, OrgId: ac1.OrgId}
							err = GetDashboardAclInfoList(permQuery)
							So(err, ShouldBeNil)

							So(len(permQuery.Result), ShouldEqual, 0)
						})

						Convey("Should not remove dashboard permissions for same user in another org", func() {
							permQuery := &models.GetDashboardAclInfoListQuery{DashboardId: 2, OrgId: ac3.OrgId}
							err = GetDashboardAclInfoList(permQuery)
							So(err, ShouldBeNil)

							So(len(permQuery.Result), ShouldEqual, 1)
							So(permQuery.Result[0].OrgId, ShouldEqual, ac3.OrgId)
							So(permQuery.Result[0].UserId, ShouldEqual, ac3.Id)
						})
					})
				})
			})
		})
	})
}

func testHelperUpdateDashboardAcl(dashboardId int64, items ...models.DashboardAcl) error {
	cmd := models.UpdateDashboardAclCommand{DashboardId: dashboardId}
	for _, i := range items {
		item := i
		item.Created = time.Now()
		item.Updated = time.Now()
		cmd.Items = append(cmd.Items, &item)
	}
	return UpdateDashboardAcl(&cmd)
}

package sqlstore

import (
	"context"
	"testing"
	"time"

	. "github.com/smartystreets/goconvey/convey"

	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

func TestAccountDataAccess(t *testing.T) {
	Convey("Testing Account DB Access", t, func() {
		InitTestDB(t)

		Convey("Given single org mode", func() {
			setting.AutoAssignOrg = true
			setting.AutoAssignOrgId = 1
			setting.AutoAssignOrgRole = "Viewer"

			Convey("Users should be added to default organization", func() {
				ac1cmd := m.CreateUserCommand{Login: "ac1", Email: "ac1@test.com", Name: "ac1 name"}
				ac2cmd := m.CreateUserCommand{Login: "ac2", Email: "ac2@test.com", Name: "ac2 name"}

				err := CreateUser(context.Background(), &ac1cmd)
				So(err, ShouldBeNil)
				err = CreateUser(context.Background(), &ac2cmd)
				So(err, ShouldBeNil)

				q1 := m.GetUserOrgListQuery{UserId: ac1cmd.Result.Id}
				q2 := m.GetUserOrgListQuery{UserId: ac2cmd.Result.Id}
				GetUserOrgList(&q1)
				GetUserOrgList(&q2)

				So(q1.Result[0].OrgId, ShouldEqual, q2.Result[0].OrgId)
				So(q1.Result[0].Role, ShouldEqual, "Viewer")
			})
		})

		Convey("Given two saved users", func() {
			setting.AutoAssignOrg = false

			ac1cmd := m.CreateUserCommand{Login: "ac1", Email: "ac1@test.com", Name: "ac1 name"}
			ac2cmd := m.CreateUserCommand{Login: "ac2", Email: "ac2@test.com", Name: "ac2 name", IsAdmin: true}

			err := CreateUser(context.Background(), &ac1cmd)
			err = CreateUser(context.Background(), &ac2cmd)
			So(err, ShouldBeNil)

			ac1 := ac1cmd.Result
			ac2 := ac2cmd.Result

			Convey("Should be able to read user info projection", func() {
				query := m.GetUserProfileQuery{UserId: ac1.Id}
				err = GetUserProfile(&query)

				So(err, ShouldBeNil)
				So(query.Result.Email, ShouldEqual, "ac1@test.com")
				So(query.Result.Login, ShouldEqual, "ac1")
			})

			Convey("Can search users", func() {
				query := m.SearchUsersQuery{Query: ""}
				err := SearchUsers(&query)

				So(err, ShouldBeNil)
				So(query.Result.Users[0].Email, ShouldEqual, "ac1@test.com")
				So(query.Result.Users[1].Email, ShouldEqual, "ac2@test.com")
			})

			Convey("Given an added org user", func() {
				cmd := m.AddOrgUserCommand{
					OrgId:  ac1.OrgId,
					UserId: ac2.Id,
					Role:   m.ROLE_VIEWER,
				}

				err := AddOrgUser(&cmd)
				Convey("Should have been saved without error", func() {
					So(err, ShouldBeNil)
				})

				Convey("Can update org user role", func() {
					updateCmd := m.UpdateOrgUserCommand{OrgId: ac1.OrgId, UserId: ac2.Id, Role: m.ROLE_ADMIN}
					err = UpdateOrgUser(&updateCmd)
					So(err, ShouldBeNil)

					orgUsersQuery := m.GetOrgUsersQuery{OrgId: ac1.OrgId}
					err = GetOrgUsers(&orgUsersQuery)
					So(err, ShouldBeNil)

					So(orgUsersQuery.Result[1].Role, ShouldEqual, m.ROLE_ADMIN)

				})

				Convey("Can get logged in user projection", func() {
					query := m.GetSignedInUserQuery{UserId: ac2.Id}
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
					query := m.GetUserOrgListQuery{UserId: ac2.Id}
					err := GetUserOrgList(&query)

					So(err, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 2)
				})

				Convey("Can get organization users", func() {
					query := m.GetOrgUsersQuery{OrgId: ac1.OrgId}
					err := GetOrgUsers(&query)

					So(err, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 2)
					So(query.Result[0].Role, ShouldEqual, "Admin")
				})

				Convey("Can get organization users with query", func() {
					query := m.GetOrgUsersQuery{
						OrgId: ac1.OrgId,
						Query: "ac1",
					}
					err := GetOrgUsers(&query)

					So(err, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 1)
					So(query.Result[0].Email, ShouldEqual, ac1.Email)
				})

				Convey("Can get organization users with query and limit", func() {
					query := m.GetOrgUsersQuery{
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
					cmd := m.SetUsingOrgCommand{UserId: ac2.Id, OrgId: ac1.OrgId}
					err := SetUsingOrg(&cmd)
					So(err, ShouldBeNil)

					Convey("SignedInUserQuery with a different org", func() {
						query := m.GetSignedInUserQuery{UserId: ac2.Id}
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
						remCmd := m.RemoveOrgUserCommand{OrgId: ac1.OrgId, UserId: ac2.Id}
						err := RemoveOrgUser(&remCmd)
						So(err, ShouldBeNil)

						query := m.GetSignedInUserQuery{UserId: ac2.Id}
						err = GetSignedInUser(&query)

						So(err, ShouldBeNil)
						So(query.Result.OrgId, ShouldEqual, ac2.OrgId)
					})
				})

				Convey("Removing user from org should delete user completely if in no other org", func() {
					// make sure ac2 has no org
					err := DeleteOrg(&m.DeleteOrgCommand{Id: ac2.OrgId})
					So(err, ShouldBeNil)

					// remove frome ac2 from ac1 org
					remCmd := m.RemoveOrgUserCommand{OrgId: ac1.OrgId, UserId: ac2.Id, ShouldDeleteOrphanedUser: true}
					err = RemoveOrgUser(&remCmd)
					So(err, ShouldBeNil)
					So(remCmd.UserWasDeleted, ShouldBeTrue)

					err = GetSignedInUser(&m.GetSignedInUserQuery{UserId: ac2.Id})
					So(err, ShouldEqual, m.ErrUserNotFound)
				})

				Convey("Cannot delete last admin org user", func() {
					cmd := m.RemoveOrgUserCommand{OrgId: ac1.OrgId, UserId: ac1.Id}
					err := RemoveOrgUser(&cmd)
					So(err, ShouldEqual, m.ErrLastOrgAdmin)
				})

				Convey("Cannot update role so no one is admin user", func() {
					cmd := m.UpdateOrgUserCommand{OrgId: ac1.OrgId, UserId: ac1.Id, Role: m.ROLE_VIEWER}
					err := UpdateOrgUser(&cmd)
					So(err, ShouldEqual, m.ErrLastOrgAdmin)
				})

				Convey("Given an org user with dashboard permissions", func() {
					ac3cmd := m.CreateUserCommand{Login: "ac3", Email: "ac3@test.com", Name: "ac3 name", IsAdmin: false}
					err := CreateUser(context.Background(), &ac3cmd)
					So(err, ShouldBeNil)
					ac3 := ac3cmd.Result

					orgUserCmd := m.AddOrgUserCommand{
						OrgId:  ac1.OrgId,
						UserId: ac3.Id,
						Role:   m.ROLE_VIEWER,
					}

					err = AddOrgUser(&orgUserCmd)
					So(err, ShouldBeNil)

					query := m.GetOrgUsersQuery{OrgId: ac1.OrgId}
					err = GetOrgUsers(&query)
					So(err, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 3)

					dash1 := insertTestDashboard("1 test dash", ac1.OrgId, 0, false, "prod", "webapp")
					dash2 := insertTestDashboard("2 test dash", ac3.OrgId, 0, false, "prod", "webapp")

					err = testHelperUpdateDashboardAcl(dash1.Id, m.DashboardAcl{DashboardId: dash1.Id, OrgId: ac1.OrgId, UserId: ac3.Id, Permission: m.PERMISSION_EDIT})
					So(err, ShouldBeNil)

					err = testHelperUpdateDashboardAcl(dash2.Id, m.DashboardAcl{DashboardId: dash2.Id, OrgId: ac3.OrgId, UserId: ac3.Id, Permission: m.PERMISSION_EDIT})
					So(err, ShouldBeNil)

					Convey("When org user is deleted", func() {
						cmdRemove := m.RemoveOrgUserCommand{OrgId: ac1.OrgId, UserId: ac3.Id}
						err := RemoveOrgUser(&cmdRemove)
						So(err, ShouldBeNil)

						Convey("Should remove dependent permissions for deleted org user", func() {
							permQuery := &m.GetDashboardAclInfoListQuery{DashboardId: 1, OrgId: ac1.OrgId}
							err = GetDashboardAclInfoList(permQuery)
							So(err, ShouldBeNil)

							So(len(permQuery.Result), ShouldEqual, 0)
						})

						Convey("Should not remove dashboard permissions for same user in another org", func() {
							permQuery := &m.GetDashboardAclInfoListQuery{DashboardId: 2, OrgId: ac3.OrgId}
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

func testHelperUpdateDashboardAcl(dashboardId int64, items ...m.DashboardAcl) error {
	cmd := m.UpdateDashboardAclCommand{DashboardId: dashboardId}
	for _, item := range items {
		item.Created = time.Now()
		item.Updated = time.Now()
		cmd.Items = append(cmd.Items, &item)
	}
	return UpdateDashboardAcl(&cmd)
}

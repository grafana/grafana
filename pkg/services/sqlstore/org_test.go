package sqlstore

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	m "github.com/wangy1931/grafana/pkg/models"
	"github.com/wangy1931/grafana/pkg/setting"
)

func TestAccountDataAccess(t *testing.T) {
	Convey("Testing Account DB Access", t, func() {
		InitTestDB(t)

		Convey("Given single org mode", func() {
			setting.AutoAssignOrg = true
			setting.AutoAssignOrgRole = "Viewer"

			Convey("Users should be added to default organization", func() {
				ac1cmd := m.CreateUserCommand{Login: "ac1", Email: "ac1@test.com", Name: "ac1 name"}
				ac2cmd := m.CreateUserCommand{Login: "ac2", Email: "ac2@test.com", Name: "ac2 name"}

				err := CreateUser(&ac1cmd)
				So(err, ShouldBeNil)
				err = CreateUser(&ac2cmd)
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

			err := CreateUser(&ac1cmd)
			err = CreateUser(&ac2cmd)
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
				So(query.Result[0].Email, ShouldEqual, "ac1@test.com")
				So(query.Result[1].Email, ShouldEqual, "ac2@test.com")
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

				Convey("Can set using org", func() {
					cmd := m.SetUsingOrgCommand{UserId: ac2.Id, OrgId: ac1.Id}
					err := SetUsingOrg(&cmd)
					So(err, ShouldBeNil)

					Convey("SignedInUserQuery with a different org", func() {
						query := m.GetSignedInUserQuery{UserId: ac2.Id}
						err := GetSignedInUser(&query)

						So(err, ShouldBeNil)
						So(query.Result.OrgId, ShouldEqual, ac1.Id)
						So(query.Result.Email, ShouldEqual, "ac2@test.com")
						So(query.Result.Name, ShouldEqual, "ac2 name")
						So(query.Result.Login, ShouldEqual, "ac2")
						So(query.Result.OrgName, ShouldEqual, "ac1@test.com")
						So(query.Result.OrgRole, ShouldEqual, "Viewer")
					})
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

			})
		})
	})
}

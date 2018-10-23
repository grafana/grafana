package sqlstore

import (
	"context"
	"fmt"
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	m "github.com/grafana/grafana/pkg/models"
)

func TestUserDataAccess(t *testing.T) {

	Convey("Testing DB", t, func() {
		InitTestDB(t)

		Convey("Creating a user", func() {
			cmd := &m.CreateUserCommand{
				Email: "usertest@test.com",
				Name:  "user name",
				Login: "user_test_login",
			}

			err := CreateUser(context.Background(), cmd)
			So(err, ShouldBeNil)

			Convey("Loading a user", func() {
				query := m.GetUserByIdQuery{Id: cmd.Result.Id}
				err := GetUserById(&query)
				So(err, ShouldBeNil)

				So(query.Result.Email, ShouldEqual, "usertest@test.com")
				So(query.Result.Password, ShouldEqual, "")
				So(query.Result.Rands, ShouldHaveLength, 10)
				So(query.Result.Salt, ShouldHaveLength, 10)
			})
		})

		Convey("Given 5 users", func() {
			var err error
			var cmd *m.CreateUserCommand
			users := []m.User{}
			for i := 0; i < 5; i++ {
				cmd = &m.CreateUserCommand{
					Email: fmt.Sprint("user", i, "@test.com"),
					Name:  fmt.Sprint("user", i),
					Login: fmt.Sprint("loginuser", i),
				}
				err = CreateUser(context.Background(), cmd)
				So(err, ShouldBeNil)
				users = append(users, cmd.Result)
			}

			Convey("Can return the first page of users and a total count", func() {
				query := m.SearchUsersQuery{Query: "", Page: 1, Limit: 3}
				err = SearchUsers(&query)

				So(err, ShouldBeNil)
				So(len(query.Result.Users), ShouldEqual, 3)
				So(query.Result.TotalCount, ShouldEqual, 5)
			})

			Convey("Can return the second page of users and a total count", func() {
				query := m.SearchUsersQuery{Query: "", Page: 2, Limit: 3}
				err = SearchUsers(&query)

				So(err, ShouldBeNil)
				So(len(query.Result.Users), ShouldEqual, 2)
				So(query.Result.TotalCount, ShouldEqual, 5)
			})

			Convey("Can return list of users matching query on user name", func() {
				query := m.SearchUsersQuery{Query: "use", Page: 1, Limit: 3}
				err = SearchUsers(&query)

				So(err, ShouldBeNil)
				So(len(query.Result.Users), ShouldEqual, 3)
				So(query.Result.TotalCount, ShouldEqual, 5)

				query = m.SearchUsersQuery{Query: "ser1", Page: 1, Limit: 3}
				err = SearchUsers(&query)

				So(err, ShouldBeNil)
				So(len(query.Result.Users), ShouldEqual, 1)
				So(query.Result.TotalCount, ShouldEqual, 1)

				query = m.SearchUsersQuery{Query: "USER1", Page: 1, Limit: 3}
				err = SearchUsers(&query)

				So(err, ShouldBeNil)
				So(len(query.Result.Users), ShouldEqual, 1)
				So(query.Result.TotalCount, ShouldEqual, 1)

				query = m.SearchUsersQuery{Query: "idontexist", Page: 1, Limit: 3}
				err = SearchUsers(&query)

				So(err, ShouldBeNil)
				So(len(query.Result.Users), ShouldEqual, 0)
				So(query.Result.TotalCount, ShouldEqual, 0)
			})

			Convey("Can return list of users matching query on email", func() {
				query := m.SearchUsersQuery{Query: "ser1@test.com", Page: 1, Limit: 3}
				err = SearchUsers(&query)

				So(err, ShouldBeNil)
				So(len(query.Result.Users), ShouldEqual, 1)
				So(query.Result.TotalCount, ShouldEqual, 1)
			})

			Convey("Can return list of users matching query on login name", func() {
				query := m.SearchUsersQuery{Query: "loginuser1", Page: 1, Limit: 3}
				err = SearchUsers(&query)

				So(err, ShouldBeNil)
				So(len(query.Result.Users), ShouldEqual, 1)
				So(query.Result.TotalCount, ShouldEqual, 1)
			})

			Convey("when a user is an org member and has been assigned permissions", func() {
				err = AddOrgUser(&m.AddOrgUserCommand{LoginOrEmail: users[1].Login, Role: m.ROLE_VIEWER, OrgId: users[0].OrgId, UserId: users[1].Id})
				So(err, ShouldBeNil)

				testHelperUpdateDashboardAcl(1, m.DashboardAcl{DashboardId: 1, OrgId: users[0].OrgId, UserId: users[1].Id, Permission: m.PERMISSION_EDIT})
				So(err, ShouldBeNil)

				err = SavePreferences(&m.SavePreferencesCommand{UserId: users[1].Id, OrgId: users[0].OrgId, HomeDashboardId: 1, Theme: "dark"})
				So(err, ShouldBeNil)

				Convey("when the user is deleted", func() {
					err = DeleteUser(&m.DeleteUserCommand{UserId: users[1].Id})
					So(err, ShouldBeNil)

					Convey("Should delete connected org users and permissions", func() {
						query := &m.GetOrgUsersQuery{OrgId: users[0].OrgId}
						err = GetOrgUsersForTest(query)
						So(err, ShouldBeNil)

						So(len(query.Result), ShouldEqual, 1)

						permQuery := &m.GetDashboardAclInfoListQuery{DashboardId: 1, OrgId: users[0].OrgId}
						err = GetDashboardAclInfoList(permQuery)
						So(err, ShouldBeNil)

						So(len(permQuery.Result), ShouldEqual, 0)

						prefsQuery := &m.GetPreferencesQuery{OrgId: users[0].OrgId, UserId: users[1].Id}
						err = GetPreferences(prefsQuery)
						So(err, ShouldBeNil)

						So(prefsQuery.Result.OrgId, ShouldEqual, 0)
						So(prefsQuery.Result.UserId, ShouldEqual, 0)
					})
				})
			})
		})
	})
}

func GetOrgUsersForTest(query *m.GetOrgUsersQuery) error {
	query.Result = make([]*m.OrgUserDTO, 0)
	sess := x.Table("org_user")
	sess.Join("LEFT ", "user", fmt.Sprintf("org_user.user_id=%s.id", x.Dialect().Quote("user")))
	sess.Where("org_user.org_id=?", query.OrgId)
	sess.Cols("org_user.org_id", "org_user.user_id", "user.email", "user.login", "org_user.role")

	err := sess.Find(&query.Result)
	return err
}

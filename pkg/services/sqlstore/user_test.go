package sqlstore

import (
	"fmt"
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	"github.com/grafana/grafana/pkg/models"
)

func TestUserDataAccess(t *testing.T) {

	Convey("Testing DB", t, func() {
		InitTestDB(t)

		Convey("Given 5 users", func() {
			var err error
			var cmd *models.CreateUserCommand
			users := []models.User{}
			for i := 0; i < 5; i++ {
				cmd = &models.CreateUserCommand{
					Email: fmt.Sprint("user", i, "@test.com"),
					Name:  fmt.Sprint("user", i),
					Login: fmt.Sprint("loginuser", i),
				}
				err = CreateUser(cmd)
				So(err, ShouldBeNil)
				users = append(users, cmd.Result)
			}

			Convey("Can return the first page of users and a total count", func() {
				query := models.SearchUsersQuery{Query: "", Page: 1, Limit: 3}
				err = SearchUsers(&query)

				So(err, ShouldBeNil)
				So(len(query.Result.Users), ShouldEqual, 3)
				So(query.Result.TotalCount, ShouldEqual, 5)
			})

			Convey("Can return the second page of users and a total count", func() {
				query := models.SearchUsersQuery{Query: "", Page: 2, Limit: 3}
				err = SearchUsers(&query)

				So(err, ShouldBeNil)
				So(len(query.Result.Users), ShouldEqual, 2)
				So(query.Result.TotalCount, ShouldEqual, 5)
			})

			Convey("Can return list of users matching query on user name", func() {
				query := models.SearchUsersQuery{Query: "use", Page: 1, Limit: 3}
				err = SearchUsers(&query)

				So(err, ShouldBeNil)
				So(len(query.Result.Users), ShouldEqual, 3)
				So(query.Result.TotalCount, ShouldEqual, 5)

				query = models.SearchUsersQuery{Query: "ser1", Page: 1, Limit: 3}
				err = SearchUsers(&query)

				So(err, ShouldBeNil)
				So(len(query.Result.Users), ShouldEqual, 1)
				So(query.Result.TotalCount, ShouldEqual, 1)

				query = models.SearchUsersQuery{Query: "USER1", Page: 1, Limit: 3}
				err = SearchUsers(&query)

				So(err, ShouldBeNil)
				So(len(query.Result.Users), ShouldEqual, 1)
				So(query.Result.TotalCount, ShouldEqual, 1)

				query = models.SearchUsersQuery{Query: "idontexist", Page: 1, Limit: 3}
				err = SearchUsers(&query)

				So(err, ShouldBeNil)
				So(len(query.Result.Users), ShouldEqual, 0)
				So(query.Result.TotalCount, ShouldEqual, 0)
			})

			Convey("Can return list of users matching query on email", func() {
				query := models.SearchUsersQuery{Query: "ser1@test.com", Page: 1, Limit: 3}
				err = SearchUsers(&query)

				So(err, ShouldBeNil)
				So(len(query.Result.Users), ShouldEqual, 1)
				So(query.Result.TotalCount, ShouldEqual, 1)
			})

			Convey("Can return list of users matching query on login name", func() {
				query := models.SearchUsersQuery{Query: "loginuser1", Page: 1, Limit: 3}
				err = SearchUsers(&query)

				So(err, ShouldBeNil)
				So(len(query.Result.Users), ShouldEqual, 1)
				So(query.Result.TotalCount, ShouldEqual, 1)
			})

			Convey("when a user is an org member and has been assigned permissions", func() {
				err = AddOrgUser(&models.AddOrgUserCommand{LoginOrEmail: users[0].Login, Role: models.ROLE_VIEWER, OrgId: users[0].OrgId})
				So(err, ShouldBeNil)

				err = AddOrUpdateDashboardPermission(&models.AddOrUpdateDashboardPermissionCommand{DashboardId: 1, OrgId: users[0].OrgId, UserId: users[0].Id, Permissions: models.PERMISSION_EDIT})
				So(err, ShouldBeNil)

				err = SavePreferences(&models.SavePreferencesCommand{UserId: users[0].Id, OrgId: users[0].OrgId, HomeDashboardId: 1, Theme: "dark"})
				So(err, ShouldBeNil)

				Convey("when the user is deleted", func() {
					err = DeleteUser(&models.DeleteUserCommand{UserId: users[0].Id})
					So(err, ShouldBeNil)

					Convey("Should delete connected org users and permissions", func() {
						query := &models.GetOrgUsersQuery{OrgId: 1}
						err = GetOrgUsersForTest(query)
						So(err, ShouldBeNil)

						So(len(query.Result), ShouldEqual, 1)

						permQuery := &models.GetDashboardPermissionsQuery{DashboardId: 1}
						err = GetDashboardPermissions(permQuery)
						So(err, ShouldBeNil)

						So(len(permQuery.Result), ShouldEqual, 0)

						prefsQuery := &models.GetPreferencesQuery{OrgId: users[0].OrgId, UserId: users[0].Id}
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

func GetOrgUsersForTest(query *models.GetOrgUsersQuery) error {
	query.Result = make([]*models.OrgUserDTO, 0)
	sess := x.Table("org_user")
	sess.Join("LEFT ", "user", fmt.Sprintf("org_user.user_id=%s.id", x.Dialect().Quote("user")))
	sess.Where("org_user.org_id=?", query.OrgId)
	sess.Cols("org_user.org_id", "org_user.user_id", "user.email", "user.login", "org_user.role")

	err := sess.Find(&query.Result)
	return err
}

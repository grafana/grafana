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

		Convey("Creating a user", func() {
			cmd := &models.CreateUserCommand{
				Email: "usertest@test.com",
				Name:  "user name",
				Login: "user_test_login",
			}

			err := CreateUser(cmd)
			So(err, ShouldBeNil)

			Convey("Loading a user", func() {
				query := models.GetUserByIdQuery{Id: cmd.Result.Id}
				err := GetUserById(&query)
				So(err, ShouldBeNil)

				So(query.Result.Email, ShouldEqual, "usertest@test.com")
				So(query.Result.Password, ShouldEqual, "")
				So(query.Result.Rands, ShouldHaveLength, 10)
				So(query.Result.Salt, ShouldHaveLength, 10)
			})
		})

		var err error
		for i := 0; i < 5; i++ {
			err = CreateUser(&models.CreateUserCommand{
				Email: fmt.Sprint("user", i, "@test.com"),
				Name:  fmt.Sprint("user", i),
				Login: fmt.Sprint("loginuser", i),
			})
			So(err, ShouldBeNil)
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
	})
}

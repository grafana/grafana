package sqlstore

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
	"golang.org/x/oauth2"
)

//nolint:goconst
func TestUserAuth(t *testing.T) {
	InitTestDB(t)

	Convey("Given 5 users", t, func() {
		var err error
		var cmd *models.CreateUserCommand
		for i := 0; i < 5; i++ {
			cmd = &models.CreateUserCommand{
				Email: fmt.Sprint("user", i, "@test.com"),
				Name:  fmt.Sprint("user", i),
				Login: fmt.Sprint("loginuser", i),
			}
			err = CreateUser(context.Background(), cmd)
			So(err, ShouldBeNil)
		}

		Reset(func() {
			_, err := x.Exec("DELETE FROM org_user WHERE 1=1")
			So(err, ShouldBeNil)
			_, err = x.Exec("DELETE FROM org WHERE 1=1")
			So(err, ShouldBeNil)
			_, err = x.Exec("DELETE FROM " + dialect.Quote("user") + " WHERE 1=1")
			So(err, ShouldBeNil)
			_, err = x.Exec("DELETE FROM user_auth WHERE 1=1")
			So(err, ShouldBeNil)
		})

		Convey("Can find existing user", func() {
			// By Login
			login := "loginuser0"

			query := &models.GetUserByAuthInfoQuery{Login: login}
			err = GetUserByAuthInfo(query)

			So(err, ShouldBeNil)
			So(query.Result.Login, ShouldEqual, login)

			// By ID
			id := query.Result.Id

			query = &models.GetUserByAuthInfoQuery{UserId: id}
			err = GetUserByAuthInfo(query)

			So(err, ShouldBeNil)
			So(query.Result.Id, ShouldEqual, id)

			// By Email
			email := "user1@test.com"

			query = &models.GetUserByAuthInfoQuery{Email: email}
			err = GetUserByAuthInfo(query)

			So(err, ShouldBeNil)
			So(query.Result.Email, ShouldEqual, email)

			// Don't find nonexistent user
			email = "nonexistent@test.com"

			query = &models.GetUserByAuthInfoQuery{Email: email}
			err = GetUserByAuthInfo(query)

			So(err, ShouldEqual, models.ErrUserNotFound)
			So(query.Result, ShouldBeNil)
		})

		Convey("Can set & locate by AuthModule and AuthId", func() {
			// get nonexistent user_auth entry
			query := &models.GetUserByAuthInfoQuery{AuthModule: "test", AuthId: "test"}
			err = GetUserByAuthInfo(query)

			So(err, ShouldEqual, models.ErrUserNotFound)
			So(query.Result, ShouldBeNil)

			// create user_auth entry
			login := "loginuser0"

			query.Login = login
			err = GetUserByAuthInfo(query)

			So(err, ShouldBeNil)
			So(query.Result.Login, ShouldEqual, login)

			// get via user_auth
			query = &models.GetUserByAuthInfoQuery{AuthModule: "test", AuthId: "test"}
			err = GetUserByAuthInfo(query)

			So(err, ShouldBeNil)
			So(query.Result.Login, ShouldEqual, login)

			// get with non-matching id
			id := query.Result.Id

			query.UserId = id + 1
			err = GetUserByAuthInfo(query)

			So(err, ShouldBeNil)
			So(query.Result.Login, ShouldEqual, "loginuser1")

			// get via user_auth
			query = &models.GetUserByAuthInfoQuery{AuthModule: "test", AuthId: "test"}
			err = GetUserByAuthInfo(query)

			So(err, ShouldBeNil)
			So(query.Result.Login, ShouldEqual, "loginuser1")

			// remove user
			_, err = x.Exec("DELETE FROM "+dialect.Quote("user")+" WHERE id=?", query.Result.Id)
			So(err, ShouldBeNil)

			// get via user_auth for deleted user
			query = &models.GetUserByAuthInfoQuery{AuthModule: "test", AuthId: "test"}
			err = GetUserByAuthInfo(query)

			So(err, ShouldEqual, models.ErrUserNotFound)
			So(query.Result, ShouldBeNil)
		})

		Convey("Can set & retrieve oauth token information", func() {
			token := &oauth2.Token{
				AccessToken:  "testaccess",
				RefreshToken: "testrefresh",
				Expiry:       time.Now(),
				TokenType:    "Bearer",
			}

			// Find a user to set tokens on
			login := "loginuser0"

			// Calling GetUserByAuthInfoQuery on an existing user will populate an entry in the user_auth table
			query := &models.GetUserByAuthInfoQuery{Login: login, AuthModule: "test", AuthId: "test"}
			err = GetUserByAuthInfo(query)

			So(err, ShouldBeNil)
			So(query.Result.Login, ShouldEqual, login)

			cmd := &models.UpdateAuthInfoCommand{
				UserId:     query.Result.Id,
				AuthId:     query.AuthId,
				AuthModule: query.AuthModule,
				OAuthToken: token,
			}
			err = UpdateAuthInfo(cmd)

			So(err, ShouldBeNil)

			getAuthQuery := &models.GetAuthInfoQuery{
				UserId: query.Result.Id,
			}

			err = GetAuthInfo(getAuthQuery)

			So(err, ShouldBeNil)
			So(getAuthQuery.Result.OAuthAccessToken, ShouldEqual, token.AccessToken)
			So(getAuthQuery.Result.OAuthRefreshToken, ShouldEqual, token.RefreshToken)
			So(getAuthQuery.Result.OAuthTokenType, ShouldEqual, token.TokenType)
		})

		Convey("Always return the most recently used auth_module", func() {
			// Find a user to set tokens on
			login := "loginuser0"

			// Calling GetUserByAuthInfoQuery on an existing user will populate an entry in the user_auth table
			// Make the first log-in during the past
			getTime = func() time.Time { return time.Now().AddDate(0, 0, -2) }
			query := &models.GetUserByAuthInfoQuery{Login: login, AuthModule: "test1", AuthId: "test1"}
			err = GetUserByAuthInfo(query)
			getTime = time.Now

			So(err, ShouldBeNil)
			So(query.Result.Login, ShouldEqual, login)

			// Add a second auth module for this user
			// Have this module's last log-in be more recent
			getTime = func() time.Time { return time.Now().AddDate(0, 0, -1) }
			query = &models.GetUserByAuthInfoQuery{Login: login, AuthModule: "test2", AuthId: "test2"}
			err = GetUserByAuthInfo(query)
			getTime = time.Now

			So(err, ShouldBeNil)
			So(query.Result.Login, ShouldEqual, login)

			// Get the latest entry by not supply an authmodule or authid
			getAuthQuery := &models.GetAuthInfoQuery{
				UserId: query.Result.Id,
			}

			err = GetAuthInfo(getAuthQuery)

			So(err, ShouldBeNil)
			So(getAuthQuery.Result.AuthModule, ShouldEqual, "test2")

			// "log in" again with the first auth module
			updateAuthCmd := &models.UpdateAuthInfoCommand{UserId: query.Result.Id, AuthModule: "test1", AuthId: "test1"}
			err = UpdateAuthInfo(updateAuthCmd)

			So(err, ShouldBeNil)

			// Get the latest entry by not supply an authmodule or authid
			getAuthQuery = &models.GetAuthInfoQuery{
				UserId: query.Result.Id,
			}

			err = GetAuthInfo(getAuthQuery)

			So(err, ShouldBeNil)
			So(getAuthQuery.Result.AuthModule, ShouldEqual, "test1")
		})
	})
}

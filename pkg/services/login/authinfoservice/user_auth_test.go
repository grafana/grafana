// +build integration

package authinfoservice

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"golang.org/x/oauth2"
)

//nolint:goconst
func TestUserAuth(t *testing.T) {
	sqlStore := sqlstore.InitTestDB(t)
	srv := &Implementation{
		Bus:                   bus.New(),
		SQLStore:              sqlStore,
		UserProtectionService: OSSUserProtectionImpl{},
	}
	srv.Init()

	t.Run("Given 5 users", func(t *testing.T) {
		for i := 0; i < 5; i++ {
			cmd := models.CreateUserCommand{
				Email: fmt.Sprint("user", i, "@test.com"),
				Name:  fmt.Sprint("user", i),
				Login: fmt.Sprint("loginuser", i),
			}
			_, err := srv.SQLStore.CreateUser(context.Background(), cmd)
			require.Nil(t, err)
		}

		t.Run("Can find existing user", func(t *testing.T) {
			// By Login
			login := "loginuser0"

			query := &models.GetUserByAuthInfoQuery{Login: login}
			user, err := srv.LookupAndUpdate(query)

			require.Nil(t, err)
			require.Equal(t, user.Login, login)

			// By ID
			id := user.Id

			_, user, err = srv.LookupByOneOf(id, "", "")

			require.Nil(t, err)
			require.Equal(t, user.Id, id)

			// By Email
			email := "user1@test.com"

			_, user, err = srv.LookupByOneOf(0, email, "")

			require.Nil(t, err)
			require.Equal(t, user.Email, email)

			// Don't find nonexistent user
			email = "nonexistent@test.com"

			_, user, err = srv.LookupByOneOf(0, email, "")

			require.Equal(t, models.ErrUserNotFound, err)
			require.Nil(t, user)
		})

		t.Run("Can set & locate by AuthModule and AuthId", func(t *testing.T) {
			// get nonexistent user_auth entry
			query := &models.GetUserByAuthInfoQuery{AuthModule: "test", AuthId: "test"}
			user, err := srv.LookupAndUpdate(query)

			require.Equal(t, models.ErrUserNotFound, err)
			require.Nil(t, user)

			// create user_auth entry
			login := "loginuser0"

			query.Login = login
			user, err = srv.LookupAndUpdate(query)

			require.Nil(t, err)
			require.Equal(t, user.Login, login)

			// get via user_auth
			query = &models.GetUserByAuthInfoQuery{AuthModule: "test", AuthId: "test"}
			user, err = srv.LookupAndUpdate(query)

			require.Nil(t, err)
			require.Equal(t, user.Login, login)

			// get with non-matching id
			id := user.Id

			query.UserId = id + 1
			user, err = srv.LookupAndUpdate(query)

			require.Nil(t, err)
			require.Equal(t, user.Login, "loginuser1")

			// get via user_auth
			query = &models.GetUserByAuthInfoQuery{AuthModule: "test", AuthId: "test"}
			user, err = srv.LookupAndUpdate(query)

			require.Nil(t, err)
			require.Equal(t, user.Login, "loginuser1")

			// remove user
			srv.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
				sess.Exec("DELETE FROM "+srv.SQLStore.Dialect.Quote("user")+" WHERE id=?", user.Id)
				require.NoError(t, err)

				return nil
			})

			// get via user_auth for deleted user
			query = &models.GetUserByAuthInfoQuery{AuthModule: "test", AuthId: "test"}
			user, err = srv.LookupAndUpdate(query)

			require.Equal(t, err, models.ErrUserNotFound)
			require.Nil(t, user)
		})

		t.Run("Can set & retrieve oauth token information", func(t *testing.T) {
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
			user, err := srv.LookupAndUpdate(query)

			require.Nil(t, err)
			require.Equal(t, user.Login, login)

			cmd := &models.UpdateAuthInfoCommand{
				UserId:     user.Id,
				AuthId:     query.AuthId,
				AuthModule: query.AuthModule,
				OAuthToken: token,
			}
			err = srv.UpdateAuthInfo(cmd)

			require.Nil(t, err)

			getAuthQuery := &models.GetAuthInfoQuery{
				UserId: user.Id,
			}

			err = srv.GetAuthInfo(getAuthQuery)

			require.Nil(t, err)
			require.Equal(t, getAuthQuery.Result.OAuthAccessToken, token.AccessToken)
			require.Equal(t, getAuthQuery.Result.OAuthRefreshToken, token.RefreshToken)
			require.Equal(t, getAuthQuery.Result.OAuthTokenType, token.TokenType)
		})

		t.Run("Always return the most recently used auth_module", func(t *testing.T) {
			// Restore after destructive operation
			sqlStore = sqlstore.InitTestDB(t)

			for i := 0; i < 5; i++ {
				cmd := models.CreateUserCommand{
					Email: fmt.Sprint("user", i, "@test.com"),
					Name:  fmt.Sprint("user", i),
					Login: fmt.Sprint("loginuser", i),
				}
				_, err := sqlStore.CreateUser(context.Background(), cmd)
				require.Nil(t, err)
			}

			// Find a user to set tokens on
			login := "loginuser0"

			// Calling srv.LookupAndUpdateQuery on an existing user will populate an entry in the user_auth table
			// Make the first log-in during the past
			getTime = func() time.Time { return time.Now().AddDate(0, 0, -2) }
			query := &models.GetUserByAuthInfoQuery{Login: login, AuthModule: "test1", AuthId: "test1"}
			user, err := srv.LookupAndUpdate(query)
			getTime = time.Now

			require.Nil(t, err)
			require.Equal(t, user.Login, login)

			// Add a second auth module for this user
			// Have this module's last log-in be more recent
			getTime = func() time.Time { return time.Now().AddDate(0, 0, -1) }
			query = &models.GetUserByAuthInfoQuery{Login: login, AuthModule: "test2", AuthId: "test2"}
			user, err = srv.LookupAndUpdate(query)
			getTime = time.Now

			require.Nil(t, err)
			require.Equal(t, user.Login, login)

			// Get the latest entry by not supply an authmodule or authid
			getAuthQuery := &models.GetAuthInfoQuery{
				UserId: user.Id,
			}

			err = srv.GetAuthInfo(getAuthQuery)

			require.Nil(t, err)
			require.Equal(t, getAuthQuery.Result.AuthModule, "test2")

			// "log in" again with the first auth module
			updateAuthCmd := &models.UpdateAuthInfoCommand{UserId: user.Id, AuthModule: "test1", AuthId: "test1"}
			err = srv.UpdateAuthInfo(updateAuthCmd)

			require.Nil(t, err)

			// Get the latest entry by not supply an authmodule or authid
			getAuthQuery = &models.GetAuthInfoQuery{
				UserId: user.Id,
			}

			err = srv.GetAuthInfo(getAuthQuery)

			require.Nil(t, err)
			require.Equal(t, getAuthQuery.Result.AuthModule, "test1")
		})

		t.Run("Can set & locate by generic oauth auth module and user id", func(t *testing.T) {
			// Find a user to set tokens on
			login := "loginuser0"

			// Expect to pass since there's a matching login user
			getTime = func() time.Time { return time.Now().AddDate(0, 0, -2) }
			query := &models.GetUserByAuthInfoQuery{Login: login, AuthModule: genericOAuthModule, AuthId: ""}
			user, err := srv.LookupAndUpdate(query)
			getTime = time.Now

			require.Nil(t, err)
			require.Equal(t, user.Login, login)

			// Should throw a "user not found" error since there's no matching login user
			getTime = func() time.Time { return time.Now().AddDate(0, 0, -2) }
			query = &models.GetUserByAuthInfoQuery{Login: "aloginuser", AuthModule: genericOAuthModule, AuthId: ""}
			user, err = srv.LookupAndUpdate(query)
			getTime = time.Now

			require.NotNil(t, err)
			require.Nil(t, user)
		})
	})
}

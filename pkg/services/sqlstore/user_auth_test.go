// +build integration

package sqlstore

import (
	"context"
	"fmt"
	"github.com/stretchr/testify/require"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"golang.org/x/oauth2"
)

//nolint:goconst
func TestUserAuth(t *testing.T) {
	sqlStore := InitTestDB(t)

	t.Run("Given 5 users", func(t *testing.T) {
		for i := 0; i < 5; i++ {
			cmd := models.CreateUserCommand{
				Email: fmt.Sprint("user", i, "@test.com"),
				Name:  fmt.Sprint("user", i),
				Login: fmt.Sprint("loginuser", i),
			}
			_, err := sqlStore.CreateUser(context.Background(), cmd)
			require.Nil(t, err)
		}

		t.Run("Can find existing user", func(t *testing.T) {
			// By Login
			login := "loginuser0"

			query := &models.GetUserByAuthInfoQuery{Login: login}
			err := GetUserByAuthInfo(query)

			require.Nil(t, err)
			require.Equal(t, query.Result.Login, login)

			// By ID
			id := query.Result.Id

			query = &models.GetUserByAuthInfoQuery{UserId: id}
			err = GetUserByAuthInfo(query)

			require.Nil(t, err)
			require.Equal(t, query.Result.Id, id)

			// By Email
			email := "user1@test.com"

			query = &models.GetUserByAuthInfoQuery{Email: email}
			err = GetUserByAuthInfo(query)

			require.Nil(t, err)
			require.Equal(t, query.Result.Email, email)

			// Don't find nonexistent user
			email = "nonexistent@test.com"

			query = &models.GetUserByAuthInfoQuery{Email: email}
			err = GetUserByAuthInfo(query)

			require.Equal(t, err, models.ErrUserNotFound)
			require.Nil(t, query.Result)
		})

		t.Run("Can set & locate by AuthModule and AuthId", func(t *testing.T) {
			// get nonexistent user_auth entry
			query := &models.GetUserByAuthInfoQuery{AuthModule: "test", AuthId: "test"}
			err := GetUserByAuthInfo(query)

			require.Equal(t, err, models.ErrUserNotFound)
			require.Nil(t, query.Result)

			// create user_auth entry
			login := "loginuser0"

			query.Login = login
			err = GetUserByAuthInfo(query)

			require.Nil(t, err)
			require.Equal(t, query.Result.Login, login)

			// get via user_auth
			query = &models.GetUserByAuthInfoQuery{AuthModule: "test", AuthId: "test"}
			err = GetUserByAuthInfo(query)

			require.Nil(t, err)
			require.Equal(t, query.Result.Login, login)

			// get with non-matching id
			id := query.Result.Id

			query.UserId = id + 1
			err = GetUserByAuthInfo(query)

			require.Nil(t, err)
			require.Equal(t, query.Result.Login, "loginuser1")

			// get via user_auth
			query = &models.GetUserByAuthInfoQuery{AuthModule: "test", AuthId: "test"}
			err = GetUserByAuthInfo(query)

			require.Nil(t, err)
			require.Equal(t, query.Result.Login, "loginuser1")

			// remove user
			_, err = x.Exec("DELETE FROM "+dialect.Quote("user")+" WHERE id=?", query.Result.Id)
			require.Nil(t, err)

			// get via user_auth for deleted user
			query = &models.GetUserByAuthInfoQuery{AuthModule: "test", AuthId: "test"}
			err = GetUserByAuthInfo(query)

			require.Equal(t, err, models.ErrUserNotFound)
			require.Nil(t, query.Result)
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
			err := GetUserByAuthInfo(query)

			require.Nil(t, err)
			require.Equal(t, query.Result.Login, login)

			cmd := &models.UpdateAuthInfoCommand{
				UserId:     query.Result.Id,
				AuthId:     query.AuthId,
				AuthModule: query.AuthModule,
				OAuthToken: token,
			}
			err = UpdateAuthInfo(cmd)

			require.Nil(t, err)

			getAuthQuery := &models.GetAuthInfoQuery{
				UserId: query.Result.Id,
			}

			err = GetAuthInfo(getAuthQuery)

			require.Nil(t, err)
			require.Equal(t, getAuthQuery.Result.OAuthAccessToken, token.AccessToken)
			require.Equal(t, getAuthQuery.Result.OAuthRefreshToken, token.RefreshToken)
			require.Equal(t, getAuthQuery.Result.OAuthTokenType, token.TokenType)
		})

		t.Run("Always return the most recently used auth_module", func(t *testing.T) {
			// Restore after destructive operation
			sqlStore = InitTestDB(t)

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

			// Calling GetUserByAuthInfoQuery on an existing user will populate an entry in the user_auth table
			// Make the first log-in during the past
			getTime = func() time.Time { return time.Now().AddDate(0, 0, -2) }
			query := &models.GetUserByAuthInfoQuery{Login: login, AuthModule: "test1", AuthId: "test1"}
			err := GetUserByAuthInfo(query)
			getTime = time.Now

			require.Nil(t, err)
			require.Equal(t, query.Result.Login, login)

			// Add a second auth module for this user
			// Have this module's last log-in be more recent
			getTime = func() time.Time { return time.Now().AddDate(0, 0, -1) }
			query = &models.GetUserByAuthInfoQuery{Login: login, AuthModule: "test2", AuthId: "test2"}
			err = GetUserByAuthInfo(query)
			getTime = time.Now

			require.Nil(t, err)
			require.Equal(t, query.Result.Login, login)

			// Get the latest entry by not supply an authmodule or authid
			getAuthQuery := &models.GetAuthInfoQuery{
				UserId: query.Result.Id,
			}

			err = GetAuthInfo(getAuthQuery)

			require.Nil(t, err)
			require.Equal(t, getAuthQuery.Result.AuthModule, "test2")

			// "log in" again with the first auth module
			updateAuthCmd := &models.UpdateAuthInfoCommand{UserId: query.Result.Id, AuthModule: "test1", AuthId: "test1"}
			err = UpdateAuthInfo(updateAuthCmd)

			require.Nil(t, err)

			// Get the latest entry by not supply an authmodule or authid
			getAuthQuery = &models.GetAuthInfoQuery{
				UserId: query.Result.Id,
			}

			err = GetAuthInfo(getAuthQuery)

			require.Nil(t, err)
			require.Equal(t, getAuthQuery.Result.AuthModule, "test1")
		})

		t.Run("Can set & locate by generic oauth auth module and user id", func(t *testing.T) {
			// Find a user to set tokens on
			login := "loginuser0"

			// Expect to pass since there's a matching login user
			getTime = func() time.Time { return time.Now().AddDate(0, 0, -2) }
			query := &models.GetUserByAuthInfoQuery{Login: login, AuthModule: genericOAuthModule, AuthId: ""}
			err := GetUserByAuthInfo(query)
			getTime = time.Now

			require.Nil(t, err)
			require.Equal(t, query.Result.Login, login)

			// Should throw a "user not found" error since there's no matching login user
			getTime = func() time.Time { return time.Now().AddDate(0, 0, -2) }
			query = &models.GetUserByAuthInfoQuery{Login: "aloginuser", AuthModule: genericOAuthModule, AuthId: ""}
			err = GetUserByAuthInfo(query)
			getTime = time.Now

			require.NotNil(t, err)
			require.Nil(t, query.Result)
		})
	})
}

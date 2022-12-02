package authinfoservice

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfoservice/database"
	"github.com/grafana/grafana/pkg/services/user"
)

//nolint:goconst
func TestUserAuth(t *testing.T) {
	sqlStore := db.InitTestDB(t)
	authInfoStore := newFakeAuthInfoStore()
	srv := ProvideAuthInfoService(
		&OSSUserProtectionImpl{},
		authInfoStore,
		&usagestats.UsageStatsMock{},
	)

	t.Run("Given 5 users", func(t *testing.T) {
		for i := 0; i < 5; i++ {
			cmd := user.CreateUserCommand{
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
			authInfoStore.ExpectedUser = &user.User{
				Login: "loginuser0",
				ID:    1,
				Email: "user1@test.com",
			}
			query := &models.GetUserByAuthInfoQuery{UserLookupParams: models.UserLookupParams{Login: &login}}
			usr, err := srv.LookupAndUpdate(context.Background(), query)

			require.Nil(t, err)
			require.Equal(t, usr.Login, login)

			// By ID
			id := usr.ID

			usr, err = srv.LookupByOneOf(context.Background(), &models.UserLookupParams{
				UserID: &id,
			})

			require.Nil(t, err)
			require.Equal(t, usr.ID, id)

			// By Email
			email := "user1@test.com"

			usr, err = srv.LookupByOneOf(context.Background(), &models.UserLookupParams{
				Email: &email,
			})

			require.Nil(t, err)
			require.Equal(t, usr.Email, email)

			authInfoStore.ExpectedUser = nil
			// Don't find nonexistent user
			email = "nonexistent@test.com"

			usr, err = srv.LookupByOneOf(context.Background(), &models.UserLookupParams{
				Email: &email,
			})

			require.Equal(t, user.ErrUserNotFound, err)
			require.Nil(t, usr)
		})

		t.Run("Can set & locate by AuthModule and AuthId", func(t *testing.T) {
			// get nonexistent user_auth entry
			authInfoStore.ExpectedUser = &user.User{}
			authInfoStore.ExpectedError = user.ErrUserNotFound
			query := &models.GetUserByAuthInfoQuery{AuthModule: "test", AuthId: "test"}
			usr, err := srv.LookupAndUpdate(context.Background(), query)

			require.Equal(t, user.ErrUserNotFound, err)
			require.Nil(t, usr)

			// create user_auth entry
			login := "loginuser0"
			authInfoStore.ExpectedUser = &user.User{Login: "loginuser0", ID: 1, Email: ""}
			authInfoStore.ExpectedError = nil
			authInfoStore.ExpectedOAuth = &models.UserAuth{Id: 1}
			query.UserLookupParams.Login = &login
			usr, err = srv.LookupAndUpdate(context.Background(), query)

			require.Nil(t, err)
			require.Equal(t, usr.Login, login)

			// get via user_auth
			query = &models.GetUserByAuthInfoQuery{AuthModule: "test", AuthId: "test"}
			usr, err = srv.LookupAndUpdate(context.Background(), query)

			require.Nil(t, err)
			require.Equal(t, usr.Login, login)

			// get with non-matching id
			idPlusOne := usr.ID + 1

			authInfoStore.ExpectedUser.Login = "loginuser1"
			query.UserLookupParams.UserID = &idPlusOne
			usr, err = srv.LookupAndUpdate(context.Background(), query)

			require.Nil(t, err)
			require.Equal(t, usr.Login, "loginuser1")

			// get via user_auth
			query = &models.GetUserByAuthInfoQuery{AuthModule: "test", AuthId: "test"}
			usr, err = srv.LookupAndUpdate(context.Background(), query)

			require.Nil(t, err)
			require.Equal(t, usr.Login, "loginuser1")

			// remove user
			err = sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
				_, err := sess.Exec("DELETE FROM "+sqlStore.Dialect.Quote("user")+" WHERE id=?", usr.ID)
				return err
			})
			require.NoError(t, err)

			authInfoStore.ExpectedUser = nil
			authInfoStore.ExpectedError = user.ErrUserNotFound
			// get via user_auth for deleted user
			query = &models.GetUserByAuthInfoQuery{AuthModule: "test", AuthId: "test"}
			usr, err = srv.LookupAndUpdate(context.Background(), query)

			require.Equal(t, err, user.ErrUserNotFound)
			require.Nil(t, usr)
		})

		t.Run("Can set & retrieve oauth token information", func(t *testing.T) {
			token := &oauth2.Token{
				AccessToken:  "testaccess",
				RefreshToken: "testrefresh",
				Expiry:       time.Now(),
				TokenType:    "Bearer",
			}
			idToken := "testidtoken"
			token = token.WithExtra(map[string]interface{}{"id_token": idToken})

			// Find a user to set tokens on
			login := "loginuser0"
			authInfoStore.ExpectedUser = &user.User{Login: "loginuser0", ID: 1, Email: ""}
			authInfoStore.ExpectedError = nil
			authInfoStore.ExpectedOAuth = &models.UserAuth{
				Id:                1,
				OAuthAccessToken:  token.AccessToken,
				OAuthRefreshToken: token.RefreshToken,
				OAuthTokenType:    token.TokenType,
				OAuthIdToken:      idToken,
				OAuthExpiry:       token.Expiry,
			}
			// Calling GetUserByAuthInfoQuery on an existing user will populate an entry in the user_auth table
			query := &models.GetUserByAuthInfoQuery{AuthModule: "test", AuthId: "test", UserLookupParams: models.UserLookupParams{
				Login: &login,
			}}
			user, err := srv.LookupAndUpdate(context.Background(), query)

			require.Nil(t, err)
			require.Equal(t, user.Login, login)

			cmd := &models.UpdateAuthInfoCommand{
				UserId:     user.ID,
				AuthId:     query.AuthId,
				AuthModule: query.AuthModule,
				OAuthToken: token,
			}
			err = srv.authInfoStore.UpdateAuthInfo(context.Background(), cmd)

			require.Nil(t, err)

			getAuthQuery := &models.GetAuthInfoQuery{
				UserId: user.ID,
			}

			err = srv.authInfoStore.GetAuthInfo(context.Background(), getAuthQuery)

			require.Nil(t, err)
			require.Equal(t, token.AccessToken, getAuthQuery.Result.OAuthAccessToken)
			require.Equal(t, token.RefreshToken, getAuthQuery.Result.OAuthRefreshToken)
			require.Equal(t, token.TokenType, getAuthQuery.Result.OAuthTokenType)
			require.Equal(t, idToken, getAuthQuery.Result.OAuthIdToken)
		})

		t.Run("Always return the most recently used auth_module", func(t *testing.T) {
			// Restore after destructive operation
			sqlStore = db.InitTestDB(t)

			for i := 0; i < 5; i++ {
				cmd := user.CreateUserCommand{
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
			database.GetTime = func() time.Time { return time.Now().AddDate(0, 0, -2) }
			query := &models.GetUserByAuthInfoQuery{AuthModule: "test1", AuthId: "test1", UserLookupParams: models.UserLookupParams{
				Login: &login,
			}}
			user, err := srv.LookupAndUpdate(context.Background(), query)
			database.GetTime = time.Now

			require.Nil(t, err)
			require.Equal(t, user.Login, login)

			// Add a second auth module for this user
			// Have this module's last log-in be more recent
			database.GetTime = func() time.Time { return time.Now().AddDate(0, 0, -1) }
			query = &models.GetUserByAuthInfoQuery{AuthModule: "test2", AuthId: "test2", UserLookupParams: models.UserLookupParams{
				Login: &login,
			}}
			user, err = srv.LookupAndUpdate(context.Background(), query)
			database.GetTime = time.Now

			require.Nil(t, err)
			require.Equal(t, user.Login, login)
			authInfoStore.ExpectedOAuth.AuthModule = "test2"
			// Get the latest entry by not supply an authmodule or authid
			getAuthQuery := &models.GetAuthInfoQuery{
				UserId: user.ID,
			}

			err = authInfoStore.GetAuthInfo(context.Background(), getAuthQuery)

			require.Nil(t, err)
			require.Equal(t, getAuthQuery.Result.AuthModule, "test2")

			// "log in" again with the first auth module
			updateAuthCmd := &models.UpdateAuthInfoCommand{UserId: user.ID, AuthModule: "test1", AuthId: "test1"}
			err = authInfoStore.UpdateAuthInfo(context.Background(), updateAuthCmd)

			require.Nil(t, err)
			authInfoStore.ExpectedOAuth.AuthModule = "test1"
			// Get the latest entry by not supply an authmodule or authid
			getAuthQuery = &models.GetAuthInfoQuery{
				UserId: user.ID,
			}

			err = authInfoStore.GetAuthInfo(context.Background(), getAuthQuery)

			require.Nil(t, err)
			require.Equal(t, getAuthQuery.Result.AuthModule, "test1")
		})

		t.Run("Keeps track of last used auth_module when not using oauth", func(t *testing.T) {
			// Restore after destructive operation
			sqlStore = db.InitTestDB(t)

			for i := 0; i < 5; i++ {
				cmd := user.CreateUserCommand{
					Email: fmt.Sprint("user", i, "@test.com"),
					Name:  fmt.Sprint("user", i),
					Login: fmt.Sprint("loginuser", i),
				}
				_, err := sqlStore.CreateUser(context.Background(), cmd)
				require.Nil(t, err)
			}

			// Find a user to set tokens on
			login := "loginuser0"

			fixedTime := time.Now()
			// Calling srv.LookupAndUpdateQuery on an existing user will populate an entry in the user_auth table
			// Make the first log-in during the past
			database.GetTime = func() time.Time { return fixedTime.AddDate(0, 0, -2) }
			queryOne := &models.GetUserByAuthInfoQuery{AuthModule: "test1", AuthId: "test1", UserLookupParams: models.UserLookupParams{
				Login: &login,
			}}
			user, err := srv.LookupAndUpdate(context.Background(), queryOne)
			database.GetTime = time.Now

			require.Nil(t, err)
			require.Equal(t, user.Login, login)

			// Add a second auth module for this user
			// Have this module's last log-in be more recent
			database.GetTime = func() time.Time { return fixedTime.AddDate(0, 0, -1) }
			queryTwo := &models.GetUserByAuthInfoQuery{AuthModule: "test2", AuthId: "test2", UserLookupParams: models.UserLookupParams{
				Login: &login,
			}}
			user, err = srv.LookupAndUpdate(context.Background(), queryTwo)
			require.Nil(t, err)
			require.Equal(t, user.Login, login)

			// Get the latest entry by not supply an authmodule or authid
			getAuthQuery := &models.GetAuthInfoQuery{
				UserId: user.ID,
			}
			authInfoStore.ExpectedOAuth.AuthModule = "test2"

			err = authInfoStore.GetAuthInfo(context.Background(), getAuthQuery)

			require.Nil(t, err)
			require.Equal(t, "test2", getAuthQuery.Result.AuthModule)

			// Now reuse first auth module and make sure it's updated to the most recent
			database.GetTime = func() time.Time { return fixedTime }

			// add oauth info to auth_info to make sure update date does not overwrite it
			updateAuthCmd := &models.UpdateAuthInfoCommand{UserId: user.ID, AuthModule: "test1", AuthId: "test1", OAuthToken: &oauth2.Token{
				AccessToken:  "access_token",
				TokenType:    "token_type",
				RefreshToken: "refresh_token",
				Expiry:       fixedTime,
			}}
			err = authInfoStore.UpdateAuthInfo(context.Background(), updateAuthCmd)
			require.Nil(t, err)
			user, err = srv.LookupAndUpdate(context.Background(), queryOne)

			require.Nil(t, err)
			require.Equal(t, user.Login, login)
			authInfoStore.ExpectedOAuth.AuthModule = "test1"
			authInfoStore.ExpectedOAuth.OAuthAccessToken = "access_token"
			err = authInfoStore.GetAuthInfo(context.Background(), getAuthQuery)

			require.Nil(t, err)
			require.Equal(t, "test1", getAuthQuery.Result.AuthModule)
			// make sure oauth info is not overwritten by update date
			require.Equal(t, "access_token", getAuthQuery.Result.OAuthAccessToken)

			// Now reuse second auth module and make sure it's updated to the most recent
			database.GetTime = func() time.Time { return fixedTime.AddDate(0, 0, 1) }
			user, err = srv.LookupAndUpdate(context.Background(), queryTwo)
			require.Nil(t, err)
			require.Equal(t, user.Login, login)
			authInfoStore.ExpectedOAuth.AuthModule = "test2"

			err = authInfoStore.GetAuthInfo(context.Background(), getAuthQuery)
			require.Nil(t, err)
			require.Equal(t, "test2", getAuthQuery.Result.AuthModule)

			// Ensure test 1 did not have its entry modified
			getAuthQueryUnchanged := &models.GetAuthInfoQuery{
				UserId:     user.ID,
				AuthModule: "test1",
			}
			authInfoStore.ExpectedOAuth.AuthModule = "test1"

			err = authInfoStore.GetAuthInfo(context.Background(), getAuthQueryUnchanged)
			require.Nil(t, err)
			require.Equal(t, "test1", getAuthQueryUnchanged.Result.AuthModule)
		})

		t.Run("Can set & locate by generic oauth auth module and user id", func(t *testing.T) {
			// Find a user to set tokens on
			login := "loginuser0"

			// Expect to pass since there's a matching login user
			database.GetTime = func() time.Time { return time.Now().AddDate(0, 0, -2) }
			query := &models.GetUserByAuthInfoQuery{AuthModule: genericOAuthModule, AuthId: "", UserLookupParams: models.UserLookupParams{
				Login: &login,
			}}
			user, err := srv.LookupAndUpdate(context.Background(), query)
			database.GetTime = time.Now

			require.Nil(t, err)
			require.Equal(t, user.Login, login)

			otherLoginUser := "aloginuser"
			// Should throw a "user not found" error since there's no matching login user
			database.GetTime = func() time.Time { return time.Now().AddDate(0, 0, -2) }
			query = &models.GetUserByAuthInfoQuery{AuthModule: genericOAuthModule, AuthId: "", UserLookupParams: models.UserLookupParams{
				Login: &otherLoginUser,
			}}
			authInfoStore.ExpectedError = errors.New("some error")

			user, err = srv.LookupAndUpdate(context.Background(), query)
			database.GetTime = time.Now

			require.NotNil(t, err)
			require.Nil(t, user)
			authInfoStore.ExpectedError = nil
		})

		t.Run("should be able to run loginstats query in all dbs", func(t *testing.T) {
			// we need to see that we can run queries for all db
			// as it is only a concern for postgres/sqllite3
			// where we have duplicate users

			// Restore after destructive operation
			sqlStore = db.InitTestDB(t)
			for i := 0; i < 5; i++ {
				cmd := user.CreateUserCommand{
					Email: fmt.Sprint("user", i, "@test.com"),
					Name:  fmt.Sprint("user", i),
					Login: fmt.Sprint("loginuser", i),
					OrgID: 1,
				}
				_, err := sqlStore.CreateUser(context.Background(), cmd)
				require.Nil(t, err)
			}

			_, err := srv.authInfoStore.GetLoginStats(context.Background())
			require.Nil(t, err)
		})

		t.Run("calculate metrics on duplicate userstats", func(t *testing.T) {
			// Restore after destructive operation
			sqlStore = db.InitTestDB(t)

			for i := 0; i < 5; i++ {
				cmd := user.CreateUserCommand{
					Email: fmt.Sprint("user", i, "@test.com"),
					Name:  fmt.Sprint("user", i),
					Login: fmt.Sprint("loginuser", i),
					OrgID: 1,
				}
				_, err := sqlStore.CreateUser(context.Background(), cmd)
				require.Nil(t, err)
			}

			// "Skipping duplicate users test for mysql as it does make unique constraint case insensitive by default
			if sqlStore.GetDialect().DriverName() != "mysql" {
				dupUserEmailcmd := user.CreateUserCommand{
					Email: "USERDUPLICATETEST1@TEST.COM",
					Name:  "user name 1",
					Login: "USER_DUPLICATE_TEST_1_LOGIN",
				}
				_, err := sqlStore.CreateUser(context.Background(), dupUserEmailcmd)
				require.NoError(t, err)

				// add additional user with duplicate login where DOMAIN is upper case
				dupUserLogincmd := user.CreateUserCommand{
					Email: "userduplicatetest1@test.com",
					Name:  "user name 1",
					Login: "user_duplicate_test_1_login",
				}
				_, err = sqlStore.CreateUser(context.Background(), dupUserLogincmd)
				require.NoError(t, err)
				authInfoStore.ExpectedUser = &user.User{
					Email: "userduplicatetest1@test.com",
					Name:  "user name 1",
					Login: "user_duplicate_test_1_login",
				}
				authInfoStore.ExpectedDuplicateUserEntries = 2
				authInfoStore.ExpectedHasDuplicateUserEntries = 1
				authInfoStore.ExpectedLoginStats = login.LoginStats{
					DuplicateUserEntries: 2,
					MixedCasedUsers:      1,
				}
				// require metrics and statistics to be 2
				m, err := srv.authInfoStore.CollectLoginStats(context.Background())
				require.NoError(t, err)
				require.Equal(t, 2, m["stats.users.duplicate_user_entries"])
				require.Equal(t, 1, m["stats.users.has_duplicate_user_entries"])

				require.Equal(t, 1, m["stats.users.mixed_cased_users"])
			}
		})
	})
}

type FakeAuthInfoStore struct {
	login.AuthInfoService
	ExpectedError                   error
	ExpectedUser                    *user.User
	ExpectedOAuth                   *models.UserAuth
	ExpectedDuplicateUserEntries    int
	ExpectedHasDuplicateUserEntries int
	ExpectedLoginStats              login.LoginStats
}

func newFakeAuthInfoStore() *FakeAuthInfoStore {
	return &FakeAuthInfoStore{}
}

func (f *FakeAuthInfoStore) GetExternalUserInfoByLogin(ctx context.Context, query *models.GetExternalUserInfoByLoginQuery) error {
	return f.ExpectedError
}
func (f *FakeAuthInfoStore) GetAuthInfo(ctx context.Context, query *models.GetAuthInfoQuery) error {
	query.Result = f.ExpectedOAuth
	return f.ExpectedError
}
func (f *FakeAuthInfoStore) SetAuthInfo(ctx context.Context, cmd *models.SetAuthInfoCommand) error {
	return f.ExpectedError
}
func (f *FakeAuthInfoStore) UpdateAuthInfoDate(ctx context.Context, authInfo *models.UserAuth) error {
	return f.ExpectedError
}
func (f *FakeAuthInfoStore) UpdateAuthInfo(ctx context.Context, cmd *models.UpdateAuthInfoCommand) error {
	return f.ExpectedError
}
func (f *FakeAuthInfoStore) DeleteAuthInfo(ctx context.Context, cmd *models.DeleteAuthInfoCommand) error {
	return f.ExpectedError
}
func (f *FakeAuthInfoStore) GetUserById(ctx context.Context, id int64) (*user.User, error) {
	return f.ExpectedUser, f.ExpectedError
}

func (f *FakeAuthInfoStore) GetUserByLogin(ctx context.Context, login string) (*user.User, error) {
	return f.ExpectedUser, f.ExpectedError
}

func (f *FakeAuthInfoStore) GetUserByEmail(ctx context.Context, email string) (*user.User, error) {
	return f.ExpectedUser, f.ExpectedError
}

func (f *FakeAuthInfoStore) CollectLoginStats(ctx context.Context) (map[string]interface{}, error) {
	var res = make(map[string]interface{})
	res["stats.users.duplicate_user_entries"] = f.ExpectedDuplicateUserEntries
	res["stats.users.has_duplicate_user_entries"] = f.ExpectedHasDuplicateUserEntries
	res["stats.users.duplicate_user_entries_by_login"] = 0
	res["stats.users.has_duplicate_user_entries_by_login"] = 0
	res["stats.users.duplicate_user_entries_by_email"] = 0
	res["stats.users.has_duplicate_user_entries_by_email"] = 0
	res["stats.users.mixed_cased_users"] = f.ExpectedLoginStats.MixedCasedUsers
	return res, f.ExpectedError
}

func (f *FakeAuthInfoStore) RunMetricsCollection(ctx context.Context) error {
	return f.ExpectedError
}

func (f *FakeAuthInfoStore) GetLoginStats(ctx context.Context) (login.LoginStats, error) {
	return f.ExpectedLoginStats, f.ExpectedError
}

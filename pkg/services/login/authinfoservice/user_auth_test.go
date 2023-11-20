package authinfoservice

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfoservice/database"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
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
		qs := quotaimpl.ProvideService(sqlStore, sqlStore.Cfg)
		orgSvc, err := orgimpl.ProvideService(sqlStore, sqlStore.Cfg, qs)
		require.NoError(t, err)
		usrSvc, err := userimpl.ProvideService(sqlStore, orgSvc, sqlStore.Cfg, nil, nil, qs, supportbundlestest.NewFakeBundleService())
		require.NoError(t, err)

		for i := 0; i < 5; i++ {
			cmd := user.CreateUserCommand{
				Email: fmt.Sprint("user", i, "@test.com"),
				Name:  fmt.Sprint("user", i),
				Login: fmt.Sprint("loginuser", i),
			}
			_, err := usrSvc.Create(context.Background(), &cmd)
			require.Nil(t, err)
		}

		t.Run("Can find existing user", func(t *testing.T) {
			// By Login
			userlogin := "loginuser0"
			authInfoStore.ExpectedUser = &user.User{
				Login: "loginuser0",
				ID:    1,
				Email: "user1@test.com",
			}
			query := &login.GetUserByAuthInfoQuery{UserLookupParams: login.UserLookupParams{Login: &userlogin}}
			usr, err := srv.LookupAndUpdate(context.Background(), query)

			require.Nil(t, err)
			require.Equal(t, usr.Login, userlogin)

			// By ID
			id := usr.ID

			usr, err = srv.LookupByOneOf(context.Background(), &login.UserLookupParams{
				UserID: &id,
			})

			require.Nil(t, err)
			require.Equal(t, usr.ID, id)

			// By Email
			email := "user1@test.com"

			usr, err = srv.LookupByOneOf(context.Background(), &login.UserLookupParams{
				Email: &email,
			})

			require.Nil(t, err)
			require.Equal(t, usr.Email, email)

			authInfoStore.ExpectedUser = nil
			// Don't find nonexistent user
			email = "nonexistent@test.com"

			usr, err = srv.LookupByOneOf(context.Background(), &login.UserLookupParams{
				Email: &email,
			})

			require.Equal(t, user.ErrUserNotFound, err)
			require.Nil(t, usr)
		})

		t.Run("Can set & locate by AuthModule and AuthId", func(t *testing.T) {
			// get nonexistent user_auth entry
			authInfoStore.ExpectedUser = &user.User{}
			authInfoStore.ExpectedError = user.ErrUserNotFound
			query := &login.GetUserByAuthInfoQuery{AuthModule: "test", AuthId: "test"}
			usr, err := srv.LookupAndUpdate(context.Background(), query)

			require.Equal(t, user.ErrUserNotFound, err)
			require.Nil(t, usr)

			// create user_auth entry
			userlogin := "loginuser0"
			authInfoStore.ExpectedUser = &user.User{Login: "loginuser0", ID: 1, Email: ""}
			authInfoStore.ExpectedError = nil
			authInfoStore.ExpectedOAuth = &login.UserAuth{Id: 1}
			query.UserLookupParams.Login = &userlogin
			usr, err = srv.LookupAndUpdate(context.Background(), query)

			require.Nil(t, err)
			require.Equal(t, usr.Login, userlogin)

			// get via user_auth
			query = &login.GetUserByAuthInfoQuery{AuthModule: "test", AuthId: "test"}
			usr, err = srv.LookupAndUpdate(context.Background(), query)

			require.Nil(t, err)
			require.Equal(t, usr.Login, userlogin)

			// get with non-matching id
			idPlusOne := usr.ID + 1

			authInfoStore.ExpectedUser.Login = "loginuser1"
			query.UserLookupParams.UserID = &idPlusOne
			usr, err = srv.LookupAndUpdate(context.Background(), query)

			require.Nil(t, err)
			require.Equal(t, usr.Login, "loginuser1")

			// get via user_auth
			query = &login.GetUserByAuthInfoQuery{AuthModule: "test", AuthId: "test"}
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
			query = &login.GetUserByAuthInfoQuery{AuthModule: "test", AuthId: "test"}
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
			token = token.WithExtra(map[string]any{"id_token": idToken})

			// Find a user to set tokens on
			userlogin := "loginuser0"
			authInfoStore.ExpectedUser = &user.User{Login: "loginuser0", ID: 1, Email: ""}
			authInfoStore.ExpectedError = nil
			authInfoStore.ExpectedOAuth = &login.UserAuth{
				Id:                1,
				OAuthAccessToken:  token.AccessToken,
				OAuthRefreshToken: token.RefreshToken,
				OAuthTokenType:    token.TokenType,
				OAuthIdToken:      idToken,
				OAuthExpiry:       token.Expiry,
			}
			// Calling GetUserByAuthInfoQuery on an existing user will populate an entry in the user_auth table
			query := &login.GetUserByAuthInfoQuery{AuthModule: "test", AuthId: "test", UserLookupParams: login.UserLookupParams{
				Login: &userlogin,
			}}
			user, err := srv.LookupAndUpdate(context.Background(), query)

			require.Nil(t, err)
			require.Equal(t, user.Login, userlogin)

			cmd := &login.UpdateAuthInfoCommand{
				UserId:     user.ID,
				AuthId:     query.AuthId,
				AuthModule: query.AuthModule,
				OAuthToken: token,
			}
			err = srv.authInfoStore.UpdateAuthInfo(context.Background(), cmd)

			require.Nil(t, err)

			getAuthQuery := &login.GetAuthInfoQuery{
				UserId: user.ID,
			}

			authInfo, err := srv.authInfoStore.GetAuthInfo(context.Background(), getAuthQuery)

			require.Nil(t, err)
			require.Equal(t, token.AccessToken, authInfo.OAuthAccessToken)
			require.Equal(t, token.RefreshToken, authInfo.OAuthRefreshToken)
			require.Equal(t, token.TokenType, authInfo.OAuthTokenType)
			require.Equal(t, idToken, authInfo.OAuthIdToken)
		})

		t.Run("Always return the most recently used auth_module", func(t *testing.T) {
			// Restore after destructive operation
			sqlStore = db.InitTestDB(t)
			qs := quotaimpl.ProvideService(sqlStore, sqlStore.Cfg)
			orgSvc, err := orgimpl.ProvideService(sqlStore, sqlStore.Cfg, qs)
			require.NoError(t, err)
			usrSvc, err := userimpl.ProvideService(sqlStore, orgSvc, sqlStore.Cfg, nil, nil, qs, supportbundlestest.NewFakeBundleService())
			require.NoError(t, err)

			for i := 0; i < 5; i++ {
				cmd := user.CreateUserCommand{
					Email: fmt.Sprint("user", i, "@test.com"),
					Name:  fmt.Sprint("user", i),
					Login: fmt.Sprint("loginuser", i),
				}
				_, err = usrSvc.Create(context.Background(), &cmd)
				require.NoError(t, err)
			}

			// Find a user to set tokens on
			userlogin := "loginuser0"

			// Calling srv.LookupAndUpdateQuery on an existing user will populate an entry in the user_auth table
			// Make the first log-in during the past
			database.GetTime = func() time.Time { return time.Now().AddDate(0, 0, -2) }
			query := &login.GetUserByAuthInfoQuery{AuthModule: "test1", AuthId: "test1", UserLookupParams: login.UserLookupParams{
				Login: &userlogin,
			}}
			user, err := srv.LookupAndUpdate(context.Background(), query)
			database.GetTime = time.Now

			require.Nil(t, err)
			require.Equal(t, user.Login, userlogin)

			// Add a second auth module for this user
			// Have this module's last log-in be more recent
			database.GetTime = func() time.Time { return time.Now().AddDate(0, 0, -1) }
			query = &login.GetUserByAuthInfoQuery{AuthModule: "test2", AuthId: "test2", UserLookupParams: login.UserLookupParams{
				Login: &userlogin,
			}}
			user, err = srv.LookupAndUpdate(context.Background(), query)
			database.GetTime = time.Now

			require.Nil(t, err)
			require.Equal(t, user.Login, userlogin)
			authInfoStore.ExpectedOAuth.AuthModule = "test2"
			// Get the latest entry by not supply an authmodule or authid
			getAuthQuery := &login.GetAuthInfoQuery{
				UserId: user.ID,
			}

			authInfo, err := authInfoStore.GetAuthInfo(context.Background(), getAuthQuery)

			require.Nil(t, err)
			require.Equal(t, authInfo.AuthModule, "test2")

			// "log in" again with the first auth module
			updateAuthCmd := &login.UpdateAuthInfoCommand{UserId: user.ID, AuthModule: "test1", AuthId: "test1"}
			err = authInfoStore.UpdateAuthInfo(context.Background(), updateAuthCmd)

			require.Nil(t, err)
			authInfoStore.ExpectedOAuth.AuthModule = "test1"
			// Get the latest entry by not supply an authmodule or authid
			getAuthQuery = &login.GetAuthInfoQuery{
				UserId: user.ID,
			}

			authInfo, err = authInfoStore.GetAuthInfo(context.Background(), getAuthQuery)

			require.Nil(t, err)
			require.Equal(t, authInfo.AuthModule, "test1")
		})

		t.Run("Keeps track of last used auth_module when not using oauth", func(t *testing.T) {
			// Restore after destructive operation
			sqlStore = db.InitTestDB(t)
			qs := quotaimpl.ProvideService(sqlStore, sqlStore.Cfg)
			orgSvc, err := orgimpl.ProvideService(sqlStore, sqlStore.Cfg, qs)
			require.NoError(t, err)
			usrSvc, err := userimpl.ProvideService(sqlStore, orgSvc, sqlStore.Cfg, nil, nil, qs, supportbundlestest.NewFakeBundleService())
			require.NoError(t, err)

			for i := 0; i < 5; i++ {
				cmd := user.CreateUserCommand{
					Email: fmt.Sprint("user", i, "@test.com"),
					Name:  fmt.Sprint("user", i),
					Login: fmt.Sprint("loginuser", i),
				}
				_, err := usrSvc.Create(context.Background(), &cmd)
				require.Nil(t, err)
			}

			// Find a user to set tokens on
			userlogin := "loginuser0"

			fixedTime := time.Now()
			// Calling srv.LookupAndUpdateQuery on an existing user will populate an entry in the user_auth table
			// Make the first log-in during the past
			database.GetTime = func() time.Time { return fixedTime.AddDate(0, 0, -2) }
			queryOne := &login.GetUserByAuthInfoQuery{AuthModule: "test1", AuthId: "test1", UserLookupParams: login.UserLookupParams{
				Login: &userlogin,
			}}
			user, err := srv.LookupAndUpdate(context.Background(), queryOne)
			database.GetTime = time.Now

			require.Nil(t, err)
			require.Equal(t, user.Login, userlogin)

			// Add a second auth module for this user
			// Have this module's last log-in be more recent
			database.GetTime = func() time.Time { return fixedTime.AddDate(0, 0, -1) }
			queryTwo := &login.GetUserByAuthInfoQuery{AuthModule: "test2", AuthId: "test2", UserLookupParams: login.UserLookupParams{
				Login: &userlogin,
			}}
			user, err = srv.LookupAndUpdate(context.Background(), queryTwo)
			require.Nil(t, err)
			require.Equal(t, user.Login, userlogin)

			// Get the latest entry by not supply an authmodule or authid
			getAuthQuery := &login.GetAuthInfoQuery{
				UserId: user.ID,
			}
			authInfoStore.ExpectedOAuth.AuthModule = "test2"

			authInfo, err := authInfoStore.GetAuthInfo(context.Background(), getAuthQuery)

			require.Nil(t, err)
			require.Equal(t, "test2", authInfo.AuthModule)

			// Now reuse first auth module and make sure it's updated to the most recent
			database.GetTime = func() time.Time { return fixedTime }

			// add oauth info to auth_info to make sure update date does not overwrite it
			updateAuthCmd := &login.UpdateAuthInfoCommand{UserId: user.ID, AuthModule: "test1", AuthId: "test1", OAuthToken: &oauth2.Token{
				AccessToken:  "access_token",
				TokenType:    "token_type",
				RefreshToken: "refresh_token",
				Expiry:       fixedTime,
			}}
			err = authInfoStore.UpdateAuthInfo(context.Background(), updateAuthCmd)
			require.Nil(t, err)
			user, err = srv.LookupAndUpdate(context.Background(), queryOne)

			require.Nil(t, err)
			require.Equal(t, user.Login, userlogin)
			authInfoStore.ExpectedOAuth.AuthModule = "test1"
			authInfoStore.ExpectedOAuth.OAuthAccessToken = "access_token"
			authInfo, err = authInfoStore.GetAuthInfo(context.Background(), getAuthQuery)

			require.Nil(t, err)
			require.Equal(t, "test1", authInfo.AuthModule)
			// make sure oauth info is not overwritten by update date
			require.Equal(t, "access_token", authInfo.OAuthAccessToken)

			// Now reuse second auth module and make sure it's updated to the most recent
			database.GetTime = func() time.Time { return fixedTime.AddDate(0, 0, 1) }
			user, err = srv.LookupAndUpdate(context.Background(), queryTwo)
			require.Nil(t, err)
			require.Equal(t, user.Login, userlogin)
			authInfoStore.ExpectedOAuth.AuthModule = "test2"

			authInfo, err = authInfoStore.GetAuthInfo(context.Background(), getAuthQuery)
			require.Nil(t, err)
			require.Equal(t, "test2", authInfo.AuthModule)

			// Ensure test 1 did not have its entry modified
			getAuthQueryUnchanged := &login.GetAuthInfoQuery{
				UserId:     user.ID,
				AuthModule: "test1",
			}
			authInfoStore.ExpectedOAuth.AuthModule = "test1"

			authInfo, err = authInfoStore.GetAuthInfo(context.Background(), getAuthQueryUnchanged)
			require.Nil(t, err)
			require.Equal(t, "test1", authInfo.AuthModule)
		})
	})
}

type FakeAuthInfoStore struct {
	login.AuthInfoService
	ExpectedError                   error
	ExpectedUser                    *user.User
	ExpectedOAuth                   *login.UserAuth
	ExpectedDuplicateUserEntries    int
	ExpectedHasDuplicateUserEntries int
	ExpectedLoginStats              login.LoginStats
}

func newFakeAuthInfoStore() *FakeAuthInfoStore {
	return &FakeAuthInfoStore{}
}

func (f *FakeAuthInfoStore) GetAuthInfo(ctx context.Context, query *login.GetAuthInfoQuery) (*login.UserAuth, error) {
	return f.ExpectedOAuth, f.ExpectedError
}
func (f *FakeAuthInfoStore) SetAuthInfo(ctx context.Context, cmd *login.SetAuthInfoCommand) error {
	return f.ExpectedError
}
func (f *FakeAuthInfoStore) UpdateAuthInfoDate(ctx context.Context, authInfo *login.UserAuth) error {
	return f.ExpectedError
}
func (f *FakeAuthInfoStore) UpdateAuthInfo(ctx context.Context, cmd *login.UpdateAuthInfoCommand) error {
	return f.ExpectedError
}
func (f *FakeAuthInfoStore) DeleteAuthInfo(ctx context.Context, cmd *login.DeleteAuthInfoCommand) error {
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

func (f *FakeAuthInfoStore) CollectLoginStats(ctx context.Context) (map[string]any, error) {
	return make(map[string]any), f.ExpectedError
}

func (f *FakeAuthInfoStore) RunMetricsCollection(ctx context.Context) error {
	return f.ExpectedError
}

func (f *FakeAuthInfoStore) GetLoginStats(ctx context.Context) (login.LoginStats, error) {
	return f.ExpectedLoginStats, f.ExpectedError
}

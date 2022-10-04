package userimpl

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestIntegrationUserDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ss := sqlstore.InitTestDB(t)
	userStore := ProvideStore(ss, setting.NewCfg())

	t.Run("user not found", func(t *testing.T) {
		_, err := userStore.Get(context.Background(),
			&user.User{
				Email: "test@email.com",
				Name:  "test1",
				Login: "test1",
			},
		)
		require.Error(t, err, user.ErrUserNotFound)
	})

	t.Run("insert user", func(t *testing.T) {
		_, err := userStore.Insert(context.Background(),
			&user.User{
				Email:   "test@email.com",
				Name:    "test1",
				Login:   "test1",
				Created: time.Now(),
				Updated: time.Now(),
			},
		)
		require.NoError(t, err)
	})

	t.Run("get user", func(t *testing.T) {
		_, err := userStore.Get(context.Background(),
			&user.User{
				Email: "test@email.com",
				Name:  "test1",
				Login: "test1",
			},
		)
		require.NoError(t, err)
	})

	t.Run("Testing DB - creates and loads user", func(t *testing.T) {
		ss := sqlstore.InitTestDB(t)
		cmd := user.CreateUserCommand{
			Email: "usertest@test.com",
			Name:  "user name",
			Login: "user_test_login",
		}
		usr, err := ss.CreateUser(context.Background(), cmd)
		require.NoError(t, err)

		result, err := userStore.GetByID(context.Background(), usr.ID)
		require.Nil(t, err)

		require.Equal(t, result.Email, "usertest@test.com")
		require.Equal(t, result.Password, "")
		require.Len(t, result.Rands, 10)
		require.Len(t, result.Salt, 10)
		require.False(t, result.IsDisabled)

		result, err = userStore.GetByID(context.Background(), usr.ID)
		require.Nil(t, err)

		require.Equal(t, result.Email, "usertest@test.com")
		require.Equal(t, result.Password, "")
		require.Len(t, result.Rands, 10)
		require.Len(t, result.Salt, 10)
		require.False(t, result.IsDisabled)

		t.Run("Get User by email case insensitive", func(t *testing.T) {
			userStore.cfg.CaseInsensitiveLogin = true
			query := user.GetUserByEmailQuery{Email: "USERtest@TEST.COM"}
			result, err := userStore.GetByEmail(context.Background(), &query)
			require.Nil(t, err)

			require.Equal(t, result.Email, "usertest@test.com")
			require.Equal(t, result.Password, "")
			require.Len(t, result.Rands, 10)
			require.Len(t, result.Salt, 10)
			require.False(t, result.IsDisabled)

			userStore.cfg.CaseInsensitiveLogin = false
		})

		t.Run("Testing DB - creates and loads user", func(t *testing.T) {
			result, err = userStore.GetByID(context.Background(), usr.ID)
			require.Nil(t, err)

			require.Equal(t, result.Email, "usertest@test.com")
			require.Equal(t, result.Password, "")
			require.Len(t, result.Rands, 10)
			require.Len(t, result.Salt, 10)
			require.False(t, result.IsDisabled)

			result, err = userStore.GetByID(context.Background(), usr.ID)
			require.Nil(t, err)

			require.Equal(t, result.Email, "usertest@test.com")
			require.Equal(t, result.Password, "")
			require.Len(t, result.Rands, 10)
			require.Len(t, result.Salt, 10)
			require.False(t, result.IsDisabled)
			ss.Cfg.CaseInsensitiveLogin = false
		})
	})

	t.Run("Testing DB - error on case insensitive conflict", func(t *testing.T) {
		if ss.GetDBType() == migrator.MySQL {
			t.Skip("Skipping on MySQL due to case insensitive indexes")
		}
		userStore.cfg.CaseInsensitiveLogin = true
		cmd := user.CreateUserCommand{
			Email: "confusertest@test.com",
			Name:  "user name",
			Login: "user_email_conflict",
		}
		// userEmailConflict
		_, err := ss.CreateUser(context.Background(), cmd)
		require.NoError(t, err)

		cmd = user.CreateUserCommand{
			Email: "confusertest@TEST.COM",
			Name:  "user name",
			Login: "user_email_conflict_two",
		}
		_, err = ss.CreateUser(context.Background(), cmd)
		require.NoError(t, err)

		cmd = user.CreateUserCommand{
			Email: "user_test_login_conflict@test.com",
			Name:  "user name",
			Login: "user_test_login_conflict",
		}
		// userLoginConflict
		_, err = ss.CreateUser(context.Background(), cmd)
		require.NoError(t, err)

		cmd = user.CreateUserCommand{
			Email: "user_test_login_conflict_two@test.com",
			Name:  "user name",
			Login: "user_test_login_CONFLICT",
		}
		_, err = ss.CreateUser(context.Background(), cmd)
		require.NoError(t, err)

		ss.Cfg.CaseInsensitiveLogin = true

		t.Run("GetByEmail - email conflict", func(t *testing.T) {
			query := user.GetUserByEmailQuery{Email: "confusertest@test.com"}
			_, err = userStore.GetByEmail(context.Background(), &query)
			require.Error(t, err)
		})

		t.Run("GetByEmail - login conflict", func(t *testing.T) {
			query := user.GetUserByEmailQuery{Email: "user_test_login_conflict@test.com"}
			_, err = userStore.GetByEmail(context.Background(), &query)
			require.Error(t, err)
		})

		t.Run("GetByLogin - email conflict", func(t *testing.T) {
			query := user.GetUserByLoginQuery{LoginOrEmail: "user_email_conflict_two"}
			_, err = userStore.GetByLogin(context.Background(), &query)
			require.Error(t, err)
		})

		t.Run("GetByLogin - login conflict", func(t *testing.T) {
			query := user.GetUserByLoginQuery{LoginOrEmail: "user_test_login_conflict"}
			_, err = userStore.GetByLogin(context.Background(), &query)
			require.Error(t, err)
		})

		t.Run("GetByLogin - login conflict by email", func(t *testing.T) {
			query := user.GetUserByLoginQuery{LoginOrEmail: "user_test_login_conflict@test.com"}
			_, err = userStore.GetByLogin(context.Background(), &query)
			require.Error(t, err)
		})

		ss.Cfg.CaseInsensitiveLogin = false
	})

	t.Run("Change user password", func(t *testing.T) {
		err := userStore.ChangePassword(context.Background(), &user.ChangeUserPasswordCommand{})
		require.NoError(t, err)
	})

	t.Run("update last seen at", func(t *testing.T) {
		err := userStore.UpdateLastSeenAt(context.Background(), &user.UpdateUserLastSeenAtCommand{})
		require.NoError(t, err)
	})

	t.Run("get signed in user", func(t *testing.T) {
		users := createFiveTestUsers(t, ss, func(i int) *user.CreateUserCommand {
			return &user.CreateUserCommand{
				Email:      fmt.Sprint("user", i, "@test.com"),
				Name:       fmt.Sprint("user", i),
				Login:      fmt.Sprint("loginuser", i),
				IsDisabled: false,
			}
		})
		err := ss.AddOrgUser(context.Background(), &models.AddOrgUserCommand{
			LoginOrEmail: users[1].Login, Role: org.RoleViewer,
			OrgId: users[0].OrgID, UserId: users[1].ID,
		})
		require.Nil(t, err)

		err = updateDashboardACL(t, ss, 1, &models.DashboardACL{
			DashboardID: 1, OrgID: users[0].OrgID, UserID: users[1].ID,
			Permission: models.PERMISSION_EDIT,
		})
		require.Nil(t, err)

		ss.CacheService.Flush()

		query := &user.GetSignedInUserQuery{OrgID: users[1].OrgID, UserID: users[1].ID}
		result, err := userStore.GetSignedInUser(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, result.Email, "user1@test.com")
	})

	t.Run("update user", func(t *testing.T) {
		err := userStore.UpdateUser(context.Background(), &user.User{ID: 1, Name: "testtestest", Login: "loginloginlogin"})
		require.NoError(t, err)
		result, err := userStore.GetByID(context.Background(), 1)
		require.NoError(t, err)
		assert.Equal(t, result.Name, "testtestest")
		assert.Equal(t, result.Login, "loginloginlogin")
	})

	t.Run("Testing DB - grafana admin users", func(t *testing.T) {
		ss = sqlstore.InitTestDB(t)

		createUserCmd := user.CreateUserCommand{
			Email:   fmt.Sprint("admin", "@test.com"),
			Name:    "admin",
			Login:   "admin",
			IsAdmin: true,
		}
		usr, err := ss.CreateUser(context.Background(), createUserCmd)
		require.Nil(t, err)

		// Cannot make themselves a non-admin
		updatePermsError := userStore.UpdatePermissions(context.Background(), usr.ID, false)

		require.Equal(t, user.ErrLastGrafanaAdmin, updatePermsError)

		query := models.GetUserByIdQuery{Id: usr.ID}
		getUserError := ss.GetUserById(context.Background(), &query)
		require.Nil(t, getUserError)

		require.True(t, query.Result.IsAdmin)

		// One user
		const email = "user@test.com"
		const username = "user"
		createUserCmd = user.CreateUserCommand{
			Email: email,
			Name:  "user",
			Login: username,
		}
		_, err = ss.CreateUser(context.Background(), createUserCmd)
		require.Nil(t, err)

		// When trying to create a new user with the same email, an error is returned
		createUserCmd = user.CreateUserCommand{
			Email:        email,
			Name:         "user2",
			Login:        "user2",
			SkipOrgSetup: true,
		}
		_, err = ss.CreateUser(context.Background(), createUserCmd)
		require.Equal(t, err, user.ErrUserAlreadyExists)

		// When trying to create a new user with the same login, an error is returned
		createUserCmd = user.CreateUserCommand{
			Email:        "user2@test.com",
			Name:         "user2",
			Login:        username,
			SkipOrgSetup: true,
		}
		_, err = ss.CreateUser(context.Background(), createUserCmd)
		require.Equal(t, err, user.ErrUserAlreadyExists)
	})

	t.Run("GetProfile", func(t *testing.T) {
		_, err := userStore.GetProfile(context.Background(), &user.GetUserProfileQuery{UserID: 1})
		require.NoError(t, err)
	})

	t.Run("SetHelpFlag", func(t *testing.T) {
		err := userStore.SetHelpFlag(context.Background(), &user.SetUserHelpFlagCommand{UserID: 1, HelpFlags1: user.HelpFlags1(1)})
		require.NoError(t, err)
	})
}

func TestIntegrationUserUpdate(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ss := sqlstore.InitTestDB(t)
	userStore := ProvideStore(ss, setting.NewCfg())

	users := createFiveTestUsers(t, ss, func(i int) *user.CreateUserCommand {
		return &user.CreateUserCommand{
			Email:      fmt.Sprint("USER", i, "@test.com"),
			Name:       fmt.Sprint("USER", i),
			Login:      fmt.Sprint("loginUSER", i),
			IsDisabled: false,
		}
	})

	userStore.cfg.CaseInsensitiveLogin = true

	t.Run("Testing DB - update generates duplicate user", func(t *testing.T) {
		err := userStore.Update(context.Background(), &user.UpdateUserCommand{
			Login:  "loginuser2",
			UserID: users[0].ID,
		})

		require.Error(t, err)
	})

	t.Run("Testing DB - update lowercases existing user", func(t *testing.T) {
		err := userStore.Update(context.Background(), &user.UpdateUserCommand{
			Login:  "loginUSER0",
			Email:  "USER0@test.com",
			UserID: users[0].ID,
		})
		require.NoError(t, err)

		result, err := userStore.GetByID(context.Background(), users[0].ID)
		require.NoError(t, err)

		require.Equal(t, "loginuser0", result.Login)
		require.Equal(t, "user0@test.com", result.Email)
	})

	t.Run("Testing DB - no user info provided", func(t *testing.T) {
		err := userStore.Update(context.Background(), &user.UpdateUserCommand{
			Login:  "",
			Email:  "",
			Name:   "Change Name",
			UserID: users[3].ID,
		})
		require.NoError(t, err)

		// query := user.GetUserByIDQuery{ID: users[3].ID}
		result, err := userStore.GetByID(context.Background(), users[3].ID)
		require.NoError(t, err)

		// Changed
		require.Equal(t, "Change Name", result.Name)

		// Unchanged
		require.Equal(t, "loginUSER3", result.Login)
		require.Equal(t, "USER3@test.com", result.Email)
	})

	ss.Cfg.CaseInsensitiveLogin = false
}

func createFiveTestUsers(t *testing.T, sqlStore *sqlstore.SQLStore, fn func(i int) *user.CreateUserCommand) []user.User {
	t.Helper()

	users := []user.User{}
	for i := 0; i < 5; i++ {
		cmd := fn(i)

		user, err := sqlStore.CreateUser(context.Background(), *cmd)
		users = append(users, *user)

		require.Nil(t, err)
	}

	return users
}

// TODO: Use FakeDashboardStore when org has its own service
func updateDashboardACL(t *testing.T, sqlStore *sqlstore.SQLStore, dashboardID int64, items ...*models.DashboardACL) error {
	t.Helper()

	err := sqlStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		_, err := sess.Exec("DELETE FROM dashboard_acl WHERE dashboard_id=?", dashboardID)
		if err != nil {
			return fmt.Errorf("deleting from dashboard_acl failed: %w", err)
		}

		for _, item := range items {
			item.Created = time.Now()
			item.Updated = time.Now()
			if item.UserID == 0 && item.TeamID == 0 && (item.Role == nil || !item.Role.IsValid()) {
				return models.ErrDashboardACLInfoMissing
			}

			if item.DashboardID == 0 {
				return models.ErrDashboardPermissionDashboardEmpty
			}

			sess.Nullable("user_id", "team_id")
			if _, err := sess.Insert(item); err != nil {
				return err
			}
		}

		// Update dashboard HasACL flag
		dashboard := models.Dashboard{HasACL: true}
		_, err = sess.Cols("has_acl").Where("id=?", dashboardID).Update(&dashboard)
		return err
	})
	return err
}

package userimpl

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

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
}

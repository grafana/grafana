package sqlstore

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
)

func TestIntegrationUserDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	ss := InitTestDB(t)

	t.Run("Get User by login - user_2 uses user_1.email as login", func(t *testing.T) {
		ss = InitTestDB(t)

		// create user_1
		cmd := user.CreateUserCommand{
			Email:      "user_1@mail.com",
			Name:       "user_1",
			Login:      "user_1",
			Password:   "user_1_password",
			IsDisabled: true,
		}
		user_1, err := ss.CreateUser(context.Background(), cmd)
		require.Nil(t, err)

		// create user_2
		cmd = user.CreateUserCommand{
			Email:      "user_2@mail.com",
			Name:       "user_2",
			Login:      "user_1@mail.com",
			Password:   "user_2_password",
			IsDisabled: true,
		}
		user_2, err := ss.CreateUser(context.Background(), cmd)
		require.Nil(t, err)

		// query user database for user_1 email
		query := models.GetUserByLoginQuery{LoginOrEmail: "user_1@mail.com"}
		err = ss.GetUserByLogin(context.Background(), &query)
		require.Nil(t, err)

		// expect user_1 as result
		require.Equal(t, user_1.Email, query.Result.Email)
		require.Equal(t, user_1.Login, query.Result.Login)
		require.Equal(t, user_1.Name, query.Result.Name)
		require.NotEqual(t, user_2.Email, query.Result.Email)
		require.NotEqual(t, user_2.Login, query.Result.Login)
		require.NotEqual(t, user_2.Name, query.Result.Name)
	})

	t.Run("Testing DB - creates and loads disabled user", func(t *testing.T) {
		ss = InitTestDB(t)
		cmd := user.CreateUserCommand{
			Email:      "usertest@test.com",
			Name:       "user name",
			Login:      "user_test_login",
			IsDisabled: true,
		}

		user, err := ss.CreateUser(context.Background(), cmd)
		require.Nil(t, err)

		query := models.GetUserByIdQuery{Id: user.ID}
		err = ss.GetUserById(context.Background(), &query)
		require.Nil(t, err)

		require.Equal(t, query.Result.Email, "usertest@test.com")
		require.Equal(t, query.Result.Password, "")
		require.Len(t, query.Result.Rands, 10)
		require.Len(t, query.Result.Salt, 10)
		require.True(t, query.Result.IsDisabled)
	})

	t.Run("Testing DB - create user assigned to other organization", func(t *testing.T) {
		ss = InitTestDB(t)

		autoAssignOrg := ss.Cfg.AutoAssignOrg
		ss.Cfg.AutoAssignOrg = true
		defer func() {
			ss.Cfg.AutoAssignOrg = autoAssignOrg
		}()

		orgCmd := &models.CreateOrgCommand{Name: "Some Test Org"}
		err := ss.CreateOrg(context.Background(), orgCmd)
		require.Nil(t, err)

		cmd := user.CreateUserCommand{
			Email: "usertest@test.com",
			Name:  "user name",
			Login: "user_test_login",
			OrgID: orgCmd.Result.Id,
		}

		usr, err := ss.CreateUser(context.Background(), cmd)
		require.Nil(t, err)

		query := models.GetUserByIdQuery{Id: usr.ID}
		err = ss.GetUserById(context.Background(), &query)
		require.Nil(t, err)

		require.Equal(t, query.Result.Email, "usertest@test.com")
		require.Equal(t, query.Result.Password, "")
		require.Len(t, query.Result.Rands, 10)
		require.Len(t, query.Result.Salt, 10)
		require.False(t, query.Result.IsDisabled)
		require.Equal(t, query.Result.OrgID, orgCmd.Result.Id)

		const nonExistingOrgID = 10000
		cmd = user.CreateUserCommand{
			Email: "usertest@test.com",
			Name:  "user name",
			Login: "user_test_login",
			OrgID: nonExistingOrgID,
		}

		_, err = ss.CreateUser(context.Background(), cmd)
		require.Equal(t, err, models.ErrOrgNotFound)
	})

	ss = InitTestDB(t)

	t.Run("Testing DB - search users", func(t *testing.T) {
		// Since previous tests were destructive
		createFiveTestUsers(t, ss, func(i int) *user.CreateUserCommand {
			return &user.CreateUserCommand{
				Email:      fmt.Sprint("user", i, "@test.com"),
				Name:       fmt.Sprint("user", i),
				Login:      fmt.Sprint("loginuser", i),
				IsDisabled: false,
			}
		})
	})
}

func (ss *SQLStore) GetOrgUsersForTest(ctx context.Context, query *models.GetOrgUsersQuery) error {
	return ss.WithDbSession(ctx, func(dbSess *DBSession) error {
		query.Result = make([]*models.OrgUserDTO, 0)
		sess := dbSess.Table("org_user")
		sess.Join("LEFT ", ss.Dialect.Quote("user"), fmt.Sprintf("org_user.user_id=%s.id", ss.Dialect.Quote("user")))
		sess.Where("org_user.org_id=?", query.OrgId)
		sess.Cols("org_user.org_id", "org_user.user_id", "user.email", "user.login", "org_user.role")

		err := sess.Find(&query.Result)
		return err
	})
}

func createFiveTestUsers(t *testing.T, sqlStore *SQLStore, fn func(i int) *user.CreateUserCommand) []user.User {
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

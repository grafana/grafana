package sqlstore

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIntegrationUserDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	ss := InitTestDB(t)
	usr := &user.SignedInUser{
		OrgID:       1,
		Permissions: map[int64]map[string][]string{1: {"users:read": {"global.users:*"}}},
	}

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

	t.Run("Testing DB - return list of users that the SignedInUser has permission to read", func(t *testing.T) {
		ss := InitTestDB(t)
		createFiveTestUsers(t, ss, func(i int) *user.CreateUserCommand {
			return &user.CreateUserCommand{
				Email: fmt.Sprint("user", i, "@test.com"),
				Name:  fmt.Sprint("user", i),
				Login: fmt.Sprint("loginuser", i),
			}
		})

		testUser := &user.SignedInUser{
			OrgID:       1,
			Permissions: map[int64]map[string][]string{1: {"users:read": {"global.users:id:1", "global.users:id:3"}}},
		}
		query := models.SearchUsersQuery{SignedInUser: testUser}
		err := ss.SearchUsers(context.Background(), &query)
		assert.Nil(t, err)
		assert.Len(t, query.Result.Users, 2)
	})

	ss = InitTestDB(t)

	t.Run("Testing DB - enable all users", func(t *testing.T) {
		users := createFiveTestUsers(t, ss, func(i int) *user.CreateUserCommand {
			return &user.CreateUserCommand{
				Email:      fmt.Sprint("user", i, "@test.com"),
				Name:       fmt.Sprint("user", i),
				Login:      fmt.Sprint("loginuser", i),
				IsDisabled: true,
			}
		})

		disableCmd := models.BatchDisableUsersCommand{
			UserIds:    []int64{users[0].ID, users[1].ID, users[2].ID, users[3].ID, users[4].ID},
			IsDisabled: false,
		}

		err := ss.BatchDisableUsers(context.Background(), &disableCmd)
		require.Nil(t, err)

		isDisabled := false
		query := &models.SearchUsersQuery{IsDisabled: &isDisabled, SignedInUser: usr}
		err = ss.SearchUsers(context.Background(), query)

		require.Nil(t, err)
		require.EqualValues(t, query.Result.TotalCount, 5)
	})

	ss = InitTestDB(t)

	t.Run("Testing DB - disable only specific users", func(t *testing.T) {
		users := createFiveTestUsers(t, ss, func(i int) *user.CreateUserCommand {
			return &user.CreateUserCommand{
				Email:      fmt.Sprint("user", i, "@test.com"),
				Name:       fmt.Sprint("user", i),
				Login:      fmt.Sprint("loginuser", i),
				IsDisabled: false,
			}
		})

		userIdsToDisable := []int64{}
		for i := 0; i < 3; i++ {
			userIdsToDisable = append(userIdsToDisable, users[i].ID)
		}
		disableCmd := models.BatchDisableUsersCommand{
			UserIds:    userIdsToDisable,
			IsDisabled: true,
		}

		err := ss.BatchDisableUsers(context.Background(), &disableCmd)
		require.Nil(t, err)

		query := models.SearchUsersQuery{SignedInUser: usr}
		err = ss.SearchUsers(context.Background(), &query)

		require.Nil(t, err)
		require.EqualValues(t, query.Result.TotalCount, 5)
		for _, user := range query.Result.Users {
			shouldBeDisabled := false

			// Check if user id is in the userIdsToDisable list
			for _, disabledUserId := range userIdsToDisable {
				if user.Id == disabledUserId {
					require.True(t, user.IsDisabled)
					shouldBeDisabled = true
				}
			}

			// Otherwise user shouldn't be disabled
			if !shouldBeDisabled {
				require.False(t, user.IsDisabled)
			}
		}
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

	t.Run("Testing DB - grafana admin users", func(t *testing.T) {
		ss = InitTestDB(t)

		createUserCmd := user.CreateUserCommand{
			Email:   fmt.Sprint("admin", "@test.com"),
			Name:    "admin",
			Login:   "admin",
			IsAdmin: true,
		}
		usr, err := ss.CreateUser(context.Background(), createUserCmd)
		require.Nil(t, err)

		// Cannot make themselves a non-admin
		updatePermsError := ss.UpdateUserPermissions(usr.ID, false)

		require.Equal(t, updatePermsError, user.ErrLastGrafanaAdmin)

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

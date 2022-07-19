package sqlstore

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIntegrationUserUpdate(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ss := InitTestDB(t)

	users := createFiveTestUsers(t, ss, func(i int) *user.CreateUserCommand {
		return &user.CreateUserCommand{
			Email:      fmt.Sprint("USER", i, "@test.com"),
			Name:       fmt.Sprint("USER", i),
			Login:      fmt.Sprint("loginUSER", i),
			IsDisabled: false,
		}
	})

	ss.Cfg.CaseInsensitiveLogin = true

	t.Run("Testing DB - update generates duplicate user", func(t *testing.T) {
		err := ss.UpdateUser(context.Background(), &models.UpdateUserCommand{
			Login:  "loginuser2",
			UserId: users[0].ID,
		})

		require.Error(t, err)
	})

	t.Run("Testing DB - update lowercases existing user", func(t *testing.T) {
		err := ss.UpdateUser(context.Background(), &models.UpdateUserCommand{
			Login:  "loginUSER0",
			Email:  "USER0@test.com",
			UserId: users[0].ID,
		})
		require.NoError(t, err)

		query := models.GetUserByIdQuery{Id: users[0].ID}
		err = ss.GetUserById(context.Background(), &query)
		require.NoError(t, err)

		require.Equal(t, "loginuser0", query.Result.Login)
		require.Equal(t, "user0@test.com", query.Result.Email)
	})

	t.Run("Testing DB - no user info provided", func(t *testing.T) {
		err := ss.UpdateUser(context.Background(), &models.UpdateUserCommand{
			Login:  "",
			Email:  "",
			Name:   "Change Name",
			UserId: users[3].ID,
		})
		require.NoError(t, err)

		query := models.GetUserByIdQuery{Id: users[3].ID}
		err = ss.GetUserById(context.Background(), &query)
		require.NoError(t, err)

		// Changed
		require.Equal(t, "Change Name", query.Result.Name)

		// Unchanged
		require.Equal(t, "loginUSER3", query.Result.Login)
		require.Equal(t, "USER3@test.com", query.Result.Email)
	})

	ss.Cfg.CaseInsensitiveLogin = false
}

func TestIntegrationUserDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	ss := InitTestDB(t)
	usr := &models.SignedInUser{
		OrgId:       1,
		Permissions: map[int64]map[string][]string{1: {"users:read": {"global.users:*"}}},
	}

	t.Run("Testing DB - creates and loads user", func(t *testing.T) {
		cmd := user.CreateUserCommand{
			Email: "usertest@test.com",
			Name:  "user name",
			Login: "user_test_login",
		}
		user, err := ss.CreateUser(context.Background(), cmd)
		require.NoError(t, err)

		query := models.GetUserByIdQuery{Id: user.ID}
		err = ss.GetUserById(context.Background(), &query)
		require.Nil(t, err)

		require.Equal(t, query.Result.Email, "usertest@test.com")
		require.Equal(t, query.Result.Password, "")
		require.Len(t, query.Result.Rands, 10)
		require.Len(t, query.Result.Salt, 10)
		require.False(t, query.Result.IsDisabled)

		query = models.GetUserByIdQuery{Id: user.ID}
		err = ss.GetUserById(context.Background(), &query)
		require.Nil(t, err)

		require.Equal(t, query.Result.Email, "usertest@test.com")
		require.Equal(t, query.Result.Password, "")
		require.Len(t, query.Result.Rands, 10)
		require.Len(t, query.Result.Salt, 10)
		require.False(t, query.Result.IsDisabled)

		t.Run("Get User by email case insensitive", func(t *testing.T) {
			ss.Cfg.CaseInsensitiveLogin = true
			query := models.GetUserByEmailQuery{Email: "USERtest@TEST.COM"}
			err = ss.GetUserByEmail(context.Background(), &query)
			require.Nil(t, err)

			require.Equal(t, query.Result.Email, "usertest@test.com")
			require.Equal(t, query.Result.Password, "")
			require.Len(t, query.Result.Rands, 10)
			require.Len(t, query.Result.Salt, 10)
			require.False(t, query.Result.IsDisabled)

			ss.Cfg.CaseInsensitiveLogin = false
		})

		t.Run("Get User by login - case insensitive", func(t *testing.T) {
			ss.Cfg.CaseInsensitiveLogin = true

			query := models.GetUserByLoginQuery{LoginOrEmail: "USER_test_login"}
			err = ss.GetUserByLogin(context.Background(), &query)
			require.Nil(t, err)

			require.Equal(t, query.Result.Email, "usertest@test.com")
			require.Equal(t, query.Result.Password, "")
			require.Len(t, query.Result.Rands, 10)
			require.Len(t, query.Result.Salt, 10)
			require.False(t, query.Result.IsDisabled)

			ss.Cfg.CaseInsensitiveLogin = false
		})

		t.Run("Get User by login - email fallback case insensitive", func(t *testing.T) {
			ss.Cfg.CaseInsensitiveLogin = true
			query := models.GetUserByLoginQuery{LoginOrEmail: "USERtest@TEST.COM"}
			err = ss.GetUserByLogin(context.Background(), &query)
			require.Nil(t, err)

			require.Equal(t, query.Result.Email, "usertest@test.com")
			require.Equal(t, query.Result.Password, "")
			require.Len(t, query.Result.Rands, 10)
			require.Len(t, query.Result.Salt, 10)
			require.False(t, query.Result.IsDisabled)

			ss.Cfg.CaseInsensitiveLogin = false
		})
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

	t.Run("Testing DB - multiple users", func(t *testing.T) {
		ss = InitTestDB(t)

		createFiveTestUsers(t, ss, func(i int) *user.CreateUserCommand {
			return &user.CreateUserCommand{
				Email:      fmt.Sprint("user", i, "@test.com"),
				Name:       fmt.Sprint("user", i),
				Login:      fmt.Sprint("loginuser", i),
				IsDisabled: false,
			}
		})

		// Return the first page of users and a total count
		query := models.SearchUsersQuery{Query: "", Page: 1, Limit: 3, SignedInUser: usr}
		err := ss.SearchUsers(context.Background(), &query)

		require.Nil(t, err)
		require.Len(t, query.Result.Users, 3)
		require.EqualValues(t, query.Result.TotalCount, 5)

		// Return the second page of users and a total count
		query = models.SearchUsersQuery{Query: "", Page: 2, Limit: 3, SignedInUser: usr}
		err = ss.SearchUsers(context.Background(), &query)

		require.Nil(t, err)
		require.Len(t, query.Result.Users, 2)
		require.EqualValues(t, query.Result.TotalCount, 5)

		// Return list of users matching query on user name
		query = models.SearchUsersQuery{Query: "use", Page: 1, Limit: 3, SignedInUser: usr}
		err = ss.SearchUsers(context.Background(), &query)

		require.Nil(t, err)
		require.Len(t, query.Result.Users, 3)
		require.EqualValues(t, query.Result.TotalCount, 5)

		query = models.SearchUsersQuery{Query: "ser1", Page: 1, Limit: 3, SignedInUser: usr}
		err = ss.SearchUsers(context.Background(), &query)

		require.Nil(t, err)
		require.Len(t, query.Result.Users, 1)
		require.EqualValues(t, query.Result.TotalCount, 1)

		query = models.SearchUsersQuery{Query: "USER1", Page: 1, Limit: 3, SignedInUser: usr}
		err = ss.SearchUsers(context.Background(), &query)

		require.Nil(t, err)
		require.Len(t, query.Result.Users, 1)
		require.EqualValues(t, query.Result.TotalCount, 1)

		query = models.SearchUsersQuery{Query: "idontexist", Page: 1, Limit: 3, SignedInUser: usr}
		err = ss.SearchUsers(context.Background(), &query)

		require.Nil(t, err)
		require.Len(t, query.Result.Users, 0)
		require.EqualValues(t, query.Result.TotalCount, 0)

		// Return list of users matching query on email
		query = models.SearchUsersQuery{Query: "ser1@test.com", Page: 1, Limit: 3, SignedInUser: usr}
		err = ss.SearchUsers(context.Background(), &query)

		require.Nil(t, err)
		require.Len(t, query.Result.Users, 1)
		require.EqualValues(t, query.Result.TotalCount, 1)

		// Return list of users matching query on login name
		query = models.SearchUsersQuery{Query: "loginuser1", Page: 1, Limit: 3, SignedInUser: usr}
		err = ss.SearchUsers(context.Background(), &query)

		require.Nil(t, err)
		require.Len(t, query.Result.Users, 1)
		require.EqualValues(t, query.Result.TotalCount, 1)
	})

	t.Run("Testing DB - return list users based on their is_disabled flag", func(t *testing.T) {
		ss = InitTestDB(t)
		createFiveTestUsers(t, ss, func(i int) *user.CreateUserCommand {
			return &user.CreateUserCommand{
				Email:      fmt.Sprint("user", i, "@test.com"),
				Name:       fmt.Sprint("user", i),
				Login:      fmt.Sprint("loginuser", i),
				IsDisabled: i%2 == 0,
			}
		})

		isDisabled := false
		query := models.SearchUsersQuery{IsDisabled: &isDisabled, SignedInUser: usr}
		err := ss.SearchUsers(context.Background(), &query)
		require.Nil(t, err)

		require.Len(t, query.Result.Users, 2)

		first, third := false, false
		for _, user := range query.Result.Users {
			if user.Name == "user1" {
				first = true
			}

			if user.Name == "user3" {
				third = true
			}
		}

		require.True(t, first)
		require.True(t, third)

		// Re-init DB
		ss = InitTestDB(t)
		users := createFiveTestUsers(t, ss, func(i int) *user.CreateUserCommand {
			return &user.CreateUserCommand{
				Email:      fmt.Sprint("user", i, "@test.com"),
				Name:       fmt.Sprint("user", i),
				Login:      fmt.Sprint("loginuser", i),
				IsDisabled: false,
			}
		})

		err = ss.AddOrgUser(context.Background(), &models.AddOrgUserCommand{
			LoginOrEmail: users[1].Login, Role: models.ROLE_VIEWER,
			OrgId: users[0].OrgID, UserId: users[1].ID,
		})
		require.Nil(t, err)

		err = updateDashboardACL(t, ss, 1, &models.DashboardACL{
			DashboardID: 1, OrgID: users[0].OrgID, UserID: users[1].ID,
			Permission: models.PERMISSION_EDIT,
		})
		require.Nil(t, err)

		// When the user is deleted
		err = ss.DeleteUser(context.Background(), &models.DeleteUserCommand{UserId: users[1].ID})
		require.Nil(t, err)

		query1 := &models.GetOrgUsersQuery{OrgId: users[0].OrgID, User: usr}
		err = ss.GetOrgUsersForTest(context.Background(), query1)
		require.Nil(t, err)

		require.Len(t, query1.Result, 1)

		permQuery := &models.GetDashboardACLInfoListQuery{DashboardID: 1, OrgID: users[0].OrgID}
		err = getDashboardACLInfoList(ss, permQuery)
		require.Nil(t, err)

		require.Len(t, permQuery.Result, 0)

		// A user is an org member and has been assigned permissions
		// Re-init DB
		ss = InitTestDB(t)
		users = createFiveTestUsers(t, ss, func(i int) *user.CreateUserCommand {
			return &user.CreateUserCommand{
				Email:      fmt.Sprint("user", i, "@test.com"),
				Name:       fmt.Sprint("user", i),
				Login:      fmt.Sprint("loginuser", i),
				IsDisabled: false,
			}
		})
		err = ss.AddOrgUser(context.Background(), &models.AddOrgUserCommand{
			LoginOrEmail: users[1].Login, Role: models.ROLE_VIEWER,
			OrgId: users[0].OrgID, UserId: users[1].ID,
		})
		require.Nil(t, err)

		err = updateDashboardACL(t, ss, 1, &models.DashboardACL{
			DashboardID: 1, OrgID: users[0].OrgID, UserID: users[1].ID,
			Permission: models.PERMISSION_EDIT,
		})
		require.Nil(t, err)

		ss.CacheService.Flush()

		query3 := &models.GetSignedInUserQuery{OrgId: users[1].OrgID, UserId: users[1].ID}
		err = ss.GetSignedInUserWithCacheCtx(context.Background(), query3)
		require.Nil(t, err)
		require.NotNil(t, query3.Result)
		require.Equal(t, query3.OrgId, users[1].OrgID)
		err = ss.SetUsingOrg(context.Background(), &models.SetUsingOrgCommand{UserId: users[1].ID, OrgId: users[0].OrgID})
		require.Nil(t, err)
		query4 := &models.GetSignedInUserQuery{OrgId: 0, UserId: users[1].ID}
		err = ss.GetSignedInUserWithCacheCtx(context.Background(), query4)
		require.Nil(t, err)
		require.NotNil(t, query4.Result)
		require.Equal(t, query4.Result.OrgId, users[0].OrgID)

		cacheKey := newSignedInUserCacheKey(query4.Result.OrgId, query4.UserId)
		_, found := ss.CacheService.Get(cacheKey)
		require.True(t, found)

		disableCmd := models.BatchDisableUsersCommand{
			UserIds:    []int64{users[0].ID, users[1].ID, users[2].ID, users[3].ID, users[4].ID},
			IsDisabled: true,
		}

		err = ss.BatchDisableUsers(context.Background(), &disableCmd)
		require.Nil(t, err)

		isDisabled = true
		query5 := &models.SearchUsersQuery{IsDisabled: &isDisabled, SignedInUser: usr}
		err = ss.SearchUsers(context.Background(), query5)

		require.Nil(t, err)
		require.EqualValues(t, query5.Result.TotalCount, 5)

		// the user is deleted
		err = ss.DeleteUser(context.Background(), &models.DeleteUserCommand{UserId: users[1].ID})
		require.Nil(t, err)

		// delete connected org users and permissions
		query2 := &models.GetOrgUsersQuery{OrgId: users[0].OrgID}
		err = ss.GetOrgUsersForTest(context.Background(), query2)
		require.Nil(t, err)

		require.Len(t, query2.Result, 1)

		permQuery = &models.GetDashboardACLInfoListQuery{DashboardID: 1, OrgID: users[0].OrgID}
		err = getDashboardACLInfoList(ss, permQuery)
		require.Nil(t, err)

		require.Len(t, permQuery.Result, 0)
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

		testUser := &models.SignedInUser{
			OrgId:       1,
			Permissions: map[int64]map[string][]string{1: {"users:read": {"global.users:id:1", "global.users:id:3"}}},
		}
		query := models.SearchUsersQuery{SignedInUser: testUser}
		err := ss.SearchUsers(context.Background(), &query)
		assert.Nil(t, err)
		assert.Len(t, query.Result.Users, 2)
	})

	t.Run("Testing DB - error on case insensitive conflict", func(t *testing.T) {
		if ss.engine.Dialect().DBType() == migrator.MySQL {
			t.Skip("Skipping on MySQL due to case insensitive indexes")
		}

		cmd := user.CreateUserCommand{
			Email: "confusertest@test.com",
			Name:  "user name",
			Login: "user_email_conflict",
		}
		userEmailConflict, err := ss.CreateUser(context.Background(), cmd)
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
		userLoginConflict, err := ss.CreateUser(context.Background(), cmd)
		require.NoError(t, err)

		cmd = user.CreateUserCommand{
			Email: "user_test_login_conflict_two@test.com",
			Name:  "user name",
			Login: "user_test_login_CONFLICT",
		}
		_, err = ss.CreateUser(context.Background(), cmd)
		require.NoError(t, err)

		ss.Cfg.CaseInsensitiveLogin = true

		t.Run("GetUserByEmail - email conflict", func(t *testing.T) {
			query := models.GetUserByEmailQuery{Email: "confusertest@test.com"}
			err = ss.GetUserByEmail(context.Background(), &query)
			require.Error(t, err)
		})

		t.Run("GetUserByEmail - login conflict", func(t *testing.T) {
			query := models.GetUserByEmailQuery{Email: "user_test_login_conflict@test.com"}
			err = ss.GetUserByEmail(context.Background(), &query)
			require.Error(t, err)
		})

		t.Run("GetUserByID - email conflict", func(t *testing.T) {
			query := models.GetUserByIdQuery{Id: userEmailConflict.ID}
			err = ss.GetUserById(context.Background(), &query)
			require.Error(t, err)
		})

		t.Run("GetUserByID - login conflict", func(t *testing.T) {
			query := models.GetUserByIdQuery{Id: userLoginConflict.ID}
			err = ss.GetUserById(context.Background(), &query)
			require.Error(t, err)
		})

		t.Run("GetUserByLogin - email conflict", func(t *testing.T) {
			query := models.GetUserByLoginQuery{LoginOrEmail: "user_email_conflict_two"}
			err = ss.GetUserByLogin(context.Background(), &query)
			require.Error(t, err)
		})

		t.Run("GetUserByLogin - login conflict", func(t *testing.T) {
			query := models.GetUserByLoginQuery{LoginOrEmail: "user_test_login_conflict"}
			err = ss.GetUserByLogin(context.Background(), &query)
			require.Error(t, err)
		})

		t.Run("GetUserByLogin - login conflict by email", func(t *testing.T) {
			query := models.GetUserByLoginQuery{LoginOrEmail: "user_test_login_conflict@test.com"}
			err = ss.GetUserByLogin(context.Background(), &query)
			require.Error(t, err)
		})

		ss.Cfg.CaseInsensitiveLogin = false
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

		require.Equal(t, updatePermsError, models.ErrLastGrafanaAdmin)

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
		require.Equal(t, err, models.ErrUserAlreadyExists)

		// When trying to create a new user with the same login, an error is returned
		createUserCmd = user.CreateUserCommand{
			Email:        "user2@test.com",
			Name:         "user2",
			Login:        username,
			SkipOrgSetup: true,
		}
		_, err = ss.CreateUser(context.Background(), createUserCmd)
		require.Equal(t, err, models.ErrUserAlreadyExists)
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

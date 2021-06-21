// +build integration

package sqlstore

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestUserDataAccess(t *testing.T) {

	ss := InitTestDB(t)

	t.Run("Testing DB - creates and loads user", func(t *testing.T) {
		cmd := models.CreateUserCommand{
			Email: "usertest@test.com",
			Name:  "user name",
			Login: "user_test_login",
		}
		user, err := ss.CreateUser(context.Background(), cmd)
		require.NoError(t, err)

		query := models.GetUserByIdQuery{Id: user.Id}
		err = GetUserById(context.Background(), &query)
		require.Nil(t, err)

		require.Equal(t, query.Result.Email, "usertest@test.com")
		require.Equal(t, query.Result.Password, "")
		require.Len(t, query.Result.Rands, 10)
		require.Len(t, query.Result.Salt, 10)
		require.False(t, query.Result.IsDisabled)

		query = models.GetUserByIdQuery{Id: user.Id}
		err = GetUserById(context.Background(), &query)
		require.Nil(t, err)

		require.Equal(t, query.Result.Email, "usertest@test.com")
		require.Equal(t, query.Result.Password, "")
		require.Len(t, query.Result.Rands, 10)
		require.Len(t, query.Result.Salt, 10)
		require.False(t, query.Result.IsDisabled)
	})

	t.Run("Testing DB - creates and loads disabled user", func(t *testing.T) {
		ss = InitTestDB(t)
		cmd := models.CreateUserCommand{
			Email:      "usertest@test.com",
			Name:       "user name",
			Login:      "user_test_login",
			IsDisabled: true,
		}

		user, err := ss.CreateUser(context.Background(), cmd)
		require.Nil(t, err)

		query := models.GetUserByIdQuery{Id: user.Id}
		err = GetUserById(context.Background(), &query)
		require.Nil(t, err)

		require.Equal(t, query.Result.Email, "usertest@test.com")
		require.Equal(t, query.Result.Password, "")
		require.Len(t, query.Result.Rands, 10)
		require.Len(t, query.Result.Salt, 10)
		require.True(t, query.Result.IsDisabled)
	})

	t.Run("Testing DB - create user assigned to other organization", func(t *testing.T) {
		ss = InitTestDB(t)

		autoAssignOrg := setting.AutoAssignOrg
		setting.AutoAssignOrg = true
		defer func() {
			setting.AutoAssignOrg = autoAssignOrg
		}()

		orgCmd := &models.CreateOrgCommand{Name: "Some Test Org"}
		err := CreateOrg(orgCmd)
		require.Nil(t, err)

		cmd := models.CreateUserCommand{
			Email: "usertest@test.com",
			Name:  "user name",
			Login: "user_test_login",
			OrgId: orgCmd.Result.Id,
		}

		user, err := ss.CreateUser(context.Background(), cmd)
		require.Nil(t, err)

		query := models.GetUserByIdQuery{Id: user.Id}
		err = GetUserById(context.Background(), &query)
		require.Nil(t, err)

		require.Equal(t, query.Result.Email, "usertest@test.com")
		require.Equal(t, query.Result.Password, "")
		require.Len(t, query.Result.Rands, 10)
		require.Len(t, query.Result.Salt, 10)
		require.False(t, query.Result.IsDisabled)
		require.Equal(t, query.Result.OrgId, orgCmd.Result.Id)

		const nonExistingOrgID = 10000
		cmd = models.CreateUserCommand{
			Email: "usertest@test.com",
			Name:  "user name",
			Login: "user_test_login",
			OrgId: nonExistingOrgID,
		}

		_, err = ss.CreateUser(context.Background(), cmd)
		require.Equal(t, err, models.ErrOrgNotFound)
	})

	t.Run("Testing DB - multiple users", func(t *testing.T) {
		ss = InitTestDB(t)

		users := createFiveTestUsers(t, ss, func(i int) *models.CreateUserCommand {
			return &models.CreateUserCommand{
				Email:      fmt.Sprint("user", i, "@test.com"),
				Name:       fmt.Sprint("user", i),
				Login:      fmt.Sprint("loginuser", i),
				IsDisabled: false,
			}
		})

		// Return the first page of users and a total count
		query := models.SearchUsersQuery{Query: "", Page: 1, Limit: 3}
		err := SearchUsers(&query)

		require.Nil(t, err)
		require.Len(t, query.Result.Users, 3)
		require.EqualValues(t, query.Result.TotalCount, 5)

		// Return the second page of users and a total count
		query = models.SearchUsersQuery{Query: "", Page: 2, Limit: 3}
		err = SearchUsers(&query)

		require.Nil(t, err)
		require.Len(t, query.Result.Users, 2)
		require.EqualValues(t, query.Result.TotalCount, 5)

		// Return list of users matching query on user name
		query = models.SearchUsersQuery{Query: "use", Page: 1, Limit: 3}
		err = SearchUsers(&query)

		require.Nil(t, err)
		require.Len(t, query.Result.Users, 3)
		require.EqualValues(t, query.Result.TotalCount, 5)

		query = models.SearchUsersQuery{Query: "ser1", Page: 1, Limit: 3}
		err = SearchUsers(&query)

		require.Nil(t, err)
		require.Len(t, query.Result.Users, 1)
		require.EqualValues(t, query.Result.TotalCount, 1)

		query = models.SearchUsersQuery{Query: "USER1", Page: 1, Limit: 3}
		err = SearchUsers(&query)

		require.Nil(t, err)
		require.Len(t, query.Result.Users, 1)
		require.EqualValues(t, query.Result.TotalCount, 1)

		query = models.SearchUsersQuery{Query: "idontexist", Page: 1, Limit: 3}
		err = SearchUsers(&query)

		require.Nil(t, err)
		require.Len(t, query.Result.Users, 0)
		require.EqualValues(t, query.Result.TotalCount, 0)

		// Return list of users matching query on email
		query = models.SearchUsersQuery{Query: "ser1@test.com", Page: 1, Limit: 3}
		err = SearchUsers(&query)

		require.Nil(t, err)
		require.Len(t, query.Result.Users, 1)
		require.EqualValues(t, query.Result.TotalCount, 1)

		// Return list of users matching query on login name
		query = models.SearchUsersQuery{Query: "loginuser1", Page: 1, Limit: 3}
		err = SearchUsers(&query)

		require.Nil(t, err)
		require.Len(t, query.Result.Users, 1)
		require.EqualValues(t, query.Result.TotalCount, 1)

		// Return list users based on their auth type
		for index, user := range users {
			authModule := "killa"

			// define every second user as ldap
			if index%2 == 0 {
				authModule = "ldap"
			}

			cmd2 := &models.SetAuthInfoCommand{
				UserId:     user.Id,
				AuthModule: authModule,
				AuthId:     "gorilla",
			}
			err := SetAuthInfo(cmd2)
			require.Nil(t, err)
		}
		query = models.SearchUsersQuery{AuthModule: "ldap"}
		err = SearchUsers(&query)
		require.Nil(t, err)

		require.Len(t, query.Result.Users, 3)

		zero, second, fourth := false, false, false
		for _, user := range query.Result.Users {
			if user.Name == "user0" {
				zero = true
			}

			if user.Name == "user2" {
				second = true
			}

			if user.Name == "user4" {
				fourth = true
			}
		}

		require.True(t, zero)
		require.True(t, second)
		require.True(t, fourth)
	})

	t.Run("Testing DB - return list users based on their is_disabled flag", func(t *testing.T) {
		ss = InitTestDB(t)
		createFiveTestUsers(t, ss, func(i int) *models.CreateUserCommand {
			return &models.CreateUserCommand{
				Email:      fmt.Sprint("user", i, "@test.com"),
				Name:       fmt.Sprint("user", i),
				Login:      fmt.Sprint("loginuser", i),
				IsDisabled: i%2 == 0,
			}
		})

		isDisabled := false
		query := models.SearchUsersQuery{IsDisabled: &isDisabled}
		err := SearchUsers(&query)
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
		users := createFiveTestUsers(t, ss, func(i int) *models.CreateUserCommand {
			return &models.CreateUserCommand{
				Email:      fmt.Sprint("user", i, "@test.com"),
				Name:       fmt.Sprint("user", i),
				Login:      fmt.Sprint("loginuser", i),
				IsDisabled: false,
			}
		})

		err = AddOrgUser(&models.AddOrgUserCommand{
			LoginOrEmail: users[1].Login, Role: models.ROLE_VIEWER,
			OrgId: users[0].OrgId, UserId: users[1].Id,
		})
		require.Nil(t, err)

		err = testHelperUpdateDashboardAcl(t, ss, 1, models.DashboardAcl{
			DashboardID: 1, OrgID: users[0].OrgId, UserID: users[1].Id,
			Permission: models.PERMISSION_EDIT,
		})
		require.Nil(t, err)

		err = SavePreferences(&models.SavePreferencesCommand{
			UserId: users[1].Id, OrgId: users[0].OrgId, HomeDashboardId: 1, Theme: "dark",
		})
		require.Nil(t, err)

		// When the user is deleted
		err = DeleteUser(&models.DeleteUserCommand{UserId: users[1].Id})
		require.Nil(t, err)

		query1 := &models.GetOrgUsersQuery{OrgId: users[0].OrgId}
		err = GetOrgUsersForTest(query1)
		require.Nil(t, err)

		require.Len(t, query1.Result, 1)

		permQuery := &models.GetDashboardAclInfoListQuery{DashboardID: 1, OrgID: users[0].OrgId}
		err = GetDashboardAclInfoList(permQuery)
		require.Nil(t, err)

		require.Len(t, permQuery.Result, 0)

		prefsQuery := &models.GetPreferencesQuery{OrgId: users[0].OrgId, UserId: users[1].Id}
		err = GetPreferences(prefsQuery)
		require.Nil(t, err)

		require.EqualValues(t, prefsQuery.Result.OrgId, 0)
		require.EqualValues(t, prefsQuery.Result.UserId, 0)

		// A user is an org member and has been assigned permissions
		// Re-init DB
		ss = InitTestDB(t)
		users = createFiveTestUsers(t, ss, func(i int) *models.CreateUserCommand {
			return &models.CreateUserCommand{
				Email:      fmt.Sprint("user", i, "@test.com"),
				Name:       fmt.Sprint("user", i),
				Login:      fmt.Sprint("loginuser", i),
				IsDisabled: false,
			}
		})
		err = AddOrgUser(&models.AddOrgUserCommand{
			LoginOrEmail: users[1].Login, Role: models.ROLE_VIEWER,
			OrgId: users[0].OrgId, UserId: users[1].Id,
		})
		require.Nil(t, err)

		err = testHelperUpdateDashboardAcl(t, ss, 1, models.DashboardAcl{
			DashboardID: 1, OrgID: users[0].OrgId, UserID: users[1].Id,
			Permission: models.PERMISSION_EDIT,
		})
		require.Nil(t, err)

		err = SavePreferences(&models.SavePreferencesCommand{
			UserId: users[1].Id, OrgId: users[0].OrgId, HomeDashboardId: 1, Theme: "dark",
		})
		require.Nil(t, err)

		ss.CacheService.Flush()

		query3 := &models.GetSignedInUserQuery{OrgId: users[1].OrgId, UserId: users[1].Id}
		err = ss.GetSignedInUserWithCacheCtx(context.Background(), query3)
		require.Nil(t, err)
		require.NotNil(t, query3.Result)
		require.Equal(t, query3.OrgId, users[1].OrgId)
		err = SetUsingOrg(&models.SetUsingOrgCommand{UserId: users[1].Id, OrgId: users[0].OrgId})
		require.Nil(t, err)
		query4 := &models.GetSignedInUserQuery{OrgId: 0, UserId: users[1].Id}
		err = ss.GetSignedInUserWithCacheCtx(context.Background(), query4)
		require.Nil(t, err)
		require.NotNil(t, query4.Result)
		require.Equal(t, query4.Result.OrgId, users[0].OrgId)

		cacheKey := newSignedInUserCacheKey(query4.Result.OrgId, query4.UserId)
		_, found := ss.CacheService.Get(cacheKey)
		require.True(t, found)

		disableCmd := models.BatchDisableUsersCommand{
			UserIds:    []int64{users[0].Id, users[1].Id, users[2].Id, users[3].Id, users[4].Id},
			IsDisabled: true,
		}

		err = BatchDisableUsers(&disableCmd)
		require.Nil(t, err)

		isDisabled = true
		query5 := &models.SearchUsersQuery{IsDisabled: &isDisabled}
		err = SearchUsers(query5)

		require.Nil(t, err)
		require.EqualValues(t, query5.Result.TotalCount, 5)

		// the user is deleted
		err = DeleteUser(&models.DeleteUserCommand{UserId: users[1].Id})
		require.Nil(t, err)

		// delete connected org users and permissions
		query2 := &models.GetOrgUsersQuery{OrgId: users[0].OrgId}
		err = GetOrgUsersForTest(query2)
		require.Nil(t, err)

		require.Len(t, query2.Result, 1)

		permQuery = &models.GetDashboardAclInfoListQuery{DashboardID: 1, OrgID: users[0].OrgId}
		err = GetDashboardAclInfoList(permQuery)
		require.Nil(t, err)

		require.Len(t, permQuery.Result, 0)

		prefsQuery = &models.GetPreferencesQuery{OrgId: users[0].OrgId, UserId: users[1].Id}
		err = GetPreferences(prefsQuery)
		require.Nil(t, err)

		require.EqualValues(t, prefsQuery.Result.OrgId, 0)
		require.EqualValues(t, prefsQuery.Result.UserId, 0)
	})

	ss = InitTestDB(t)

	t.Run("Testing DB - enable all users", func(t *testing.T) {

		users := createFiveTestUsers(t, ss, func(i int) *models.CreateUserCommand {
			return &models.CreateUserCommand{
				Email:      fmt.Sprint("user", i, "@test.com"),
				Name:       fmt.Sprint("user", i),
				Login:      fmt.Sprint("loginuser", i),
				IsDisabled: true,
			}
		})

		disableCmd := models.BatchDisableUsersCommand{
			UserIds:    []int64{users[0].Id, users[1].Id, users[2].Id, users[3].Id, users[4].Id},
			IsDisabled: false,
		}

		err := BatchDisableUsers(&disableCmd)
		require.Nil(t, err)

		isDisabled := false
		query := &models.SearchUsersQuery{IsDisabled: &isDisabled}
		err = SearchUsers(query)

		require.Nil(t, err)
		require.EqualValues(t, query.Result.TotalCount, 5)
	})

	ss = InitTestDB(t)

	t.Run("Testing DB - disable only specific users", func(t *testing.T) {
		users := createFiveTestUsers(t, ss, func(i int) *models.CreateUserCommand {
			return &models.CreateUserCommand{
				Email:      fmt.Sprint("user", i, "@test.com"),
				Name:       fmt.Sprint("user", i),
				Login:      fmt.Sprint("loginuser", i),
				IsDisabled: false,
			}
		})

		userIdsToDisable := []int64{}
		for i := 0; i < 3; i++ {
			userIdsToDisable = append(userIdsToDisable, users[i].Id)
		}
		disableCmd := models.BatchDisableUsersCommand{
			UserIds:    userIdsToDisable,
			IsDisabled: true,
		}

		err := BatchDisableUsers(&disableCmd)
		require.Nil(t, err)

		query := models.SearchUsersQuery{}
		err = SearchUsers(&query)

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
		createFiveTestUsers(t, ss, func(i int) *models.CreateUserCommand {
			return &models.CreateUserCommand{
				Email:      fmt.Sprint("user", i, "@test.com"),
				Name:       fmt.Sprint("user", i),
				Login:      fmt.Sprint("loginuser", i),
				IsDisabled: false,
			}
		})
		// Find a user to set tokens on
		login := "loginuser0"

		// Calling GetUserByAuthInfoQuery on an existing user will populate an entry in the user_auth table
		// Make the first log-in during the past
		getTime = func() time.Time { return time.Now().AddDate(0, 0, -2) }
		query := &models.GetUserByAuthInfoQuery{Login: login, AuthModule: "ldap", AuthId: "ldap0"}
		err := GetUserByAuthInfo(query)
		getTime = time.Now

		require.Nil(t, err)
		require.Equal(t, query.Result.Login, login)

		// Add a second auth module for this user
		// Have this module's last log-in be more recent
		getTime = func() time.Time { return time.Now().AddDate(0, 0, -1) }
		query = &models.GetUserByAuthInfoQuery{Login: login, AuthModule: "oauth", AuthId: "oauth0"}
		err = GetUserByAuthInfo(query)
		getTime = time.Now

		require.Nil(t, err)
		require.Equal(t, query.Result.Login, login)

		// Return the only most recently used auth_module
		searchUserQuery := &models.SearchUsersQuery{}
		err = SearchUsers(searchUserQuery)

		require.Nil(t, err)
		require.Len(t, searchUserQuery.Result.Users, 5)
		for _, user := range searchUserQuery.Result.Users {
			if user.Login == login {
				require.Len(t, user.AuthModule, 1)
				require.Equal(t, user.AuthModule[0], "oauth")
			}
		}

		// "log in" again with the first auth module
		updateAuthCmd := &models.UpdateAuthInfoCommand{UserId: query.Result.Id, AuthModule: "ldap", AuthId: "ldap1"}
		err = UpdateAuthInfo(updateAuthCmd)
		require.Nil(t, err)

		searchUserQuery = &models.SearchUsersQuery{}
		err = SearchUsers(searchUserQuery)

		require.Nil(t, err)
		for _, user := range searchUserQuery.Result.Users {
			if user.Login == login {
				require.Len(t, user.AuthModule, 1)
				require.Equal(t, user.AuthModule[0], "ldap")
			}
		}

		// Re-init DB
		ss = InitTestDB(t)
		createFiveTestUsers(t, ss, func(i int) *models.CreateUserCommand {
			return &models.CreateUserCommand{
				Email:      fmt.Sprint("user", i, "@test.com"),
				Name:       fmt.Sprint("user", i),
				Login:      fmt.Sprint("loginuser", i),
				IsDisabled: false,
			}
		})

		// Search LDAP users
		for i := 0; i < 5; i++ {
			// Find a user to set tokens on
			login = fmt.Sprint("loginuser", i)

			// Calling GetUserByAuthInfoQuery on an existing user will populate an entry in the user_auth table
			// Make the first log-in during the past
			getTime = func() time.Time { return time.Now().AddDate(0, 0, -2) }
			query = &models.GetUserByAuthInfoQuery{Login: login, AuthModule: "ldap", AuthId: fmt.Sprint("ldap", i)}
			err = GetUserByAuthInfo(query)
			getTime = time.Now

			require.Nil(t, err)
			require.Equal(t, query.Result.Login, login)
		}

		// Log in first user with oauth
		login = "loginuser0"
		getTime = func() time.Time { return time.Now().AddDate(0, 0, -1) }
		query = &models.GetUserByAuthInfoQuery{Login: login, AuthModule: "oauth", AuthId: "oauth0"}
		err = GetUserByAuthInfo(query)
		getTime = time.Now

		require.Nil(t, err)
		require.Equal(t, query.Result.Login, login)

		// Should only return users recently logged in with ldap when filtered by ldap auth module
		searchUserQuery = &models.SearchUsersQuery{AuthModule: "ldap"}
		err = SearchUsers(searchUserQuery)

		require.Nil(t, err)
		require.Len(t, searchUserQuery.Result.Users, 4)
		for _, user := range searchUserQuery.Result.Users {
			if user.Login == login {
				require.Len(t, user.AuthModule, 1)
				require.Equal(t, user.AuthModule[0], "ldap")
			}
		}
	})

	t.Run("Testing DB - grafana admin users", func(t *testing.T) {

		ss = InitTestDB(t)

		createUserCmd := models.CreateUserCommand{
			Email:   fmt.Sprint("admin", "@test.com"),
			Name:    "admin",
			Login:   "admin",
			IsAdmin: true,
		}
		user, err := ss.CreateUser(context.Background(), createUserCmd)
		require.Nil(t, err)

		// Cannot make themselves a non-admin
		updatePermsError := ss.UpdateUserPermissions(user.Id, false)

		require.Equal(t, updatePermsError, models.ErrLastGrafanaAdmin)

		query := models.GetUserByIdQuery{Id: user.Id}
		getUserError := GetUserById(context.Background(), &query)
		require.Nil(t, getUserError)

		require.True(t, query.Result.IsAdmin)

		// One user
		const email = "user@test.com"
		const username = "user"
		createUserCmd = models.CreateUserCommand{
			Email: email,
			Name:  "user",
			Login: username,
		}
		_, err = ss.CreateUser(context.Background(), createUserCmd)
		require.Nil(t, err)

		// When trying to create a new user with the same email, an error is returned
		createUserCmd = models.CreateUserCommand{
			Email:        email,
			Name:         "user2",
			Login:        "user2",
			SkipOrgSetup: true,
		}
		_, err = ss.CreateUser(context.Background(), createUserCmd)
		require.Equal(t, err, models.ErrUserAlreadyExists)

		// When trying to create a new user with the same login, an error is returned
		createUserCmd = models.CreateUserCommand{
			Email:        "user2@test.com",
			Name:         "user2",
			Login:        username,
			SkipOrgSetup: true,
		}
		_, err = ss.CreateUser(context.Background(), createUserCmd)
		require.Equal(t, err, models.ErrUserAlreadyExists)
	})
}

func GetOrgUsersForTest(query *models.GetOrgUsersQuery) error {
	query.Result = make([]*models.OrgUserDTO, 0)
	sess := x.Table("org_user")
	sess.Join("LEFT ", x.Dialect().Quote("user"), fmt.Sprintf("org_user.user_id=%s.id", x.Dialect().Quote("user")))
	sess.Where("org_user.org_id=?", query.OrgId)
	sess.Cols("org_user.org_id", "org_user.user_id", "user.email", "user.login", "org_user.role")

	err := sess.Find(&query.Result)
	return err
}

func createFiveTestUsers(t *testing.T, sqlStore *SQLStore, fn func(i int) *models.CreateUserCommand) []models.User {
	t.Helper()

	users := []models.User{}
	for i := 0; i < 5; i++ {
		cmd := fn(i)

		user, err := sqlStore.CreateUser(context.Background(), *cmd)
		users = append(users, *user)

		require.Nil(t, err)
	}

	return users
}

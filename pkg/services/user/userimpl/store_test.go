package userimpl

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestIntegrationUserGet(t *testing.T) {
	testCases := []struct {
		name            string
		wantErr         error
		searchLogin     string
		searchEmail     string
		caseInsensitive bool
	}{
		{
			name:            "user not found non exact - not case insensitive",
			wantErr:         user.ErrUserNotFound,
			searchLogin:     "Test",
			searchEmail:     "Test@email.com",
			caseInsensitive: false,
		},
		{
			name:            "user found exact - not case insensitive",
			wantErr:         nil,
			searchLogin:     "test",
			searchEmail:     "test@email.com",
			caseInsensitive: false,
		},
		{
			name:            "user found non exact - case insensitive",
			wantErr:         nil,
			searchLogin:     "Test",
			searchEmail:     "Test@email.com",
			caseInsensitive: true,
		},
		{
			name:            "user found exact - case insensitive",
			wantErr:         nil,
			searchLogin:     "Test",
			searchEmail:     "Test@email.com",
			caseInsensitive: true,
		},
		{
			name:            "user not found - case insensitive",
			wantErr:         user.ErrUserNotFound,
			searchLogin:     "Test_login",
			searchEmail:     "Test*@email.com",
			caseInsensitive: true,
		},
	}

	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ss := db.InitTestDB(t)
	cfg := ss.Cfg
	userStore := ProvideStore(ss, cfg)

	_, errUser := userStore.Insert(context.Background(),
		&user.User{
			Email:   "test@email.com",
			Name:    "test",
			Login:   "test",
			Created: time.Now(),
			Updated: time.Now(),
		},
	)
	require.NoError(t, errUser)

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			if !tc.caseInsensitive && db.IsTestDbMySQL() {
				t.Skip("mysql is always case insensitive")
			}
			cfg.CaseInsensitiveLogin = tc.caseInsensitive
			usr, err := userStore.Get(context.Background(),
				&user.User{
					Email: tc.searchEmail,
					Login: tc.searchLogin,
				},
			)

			if tc.wantErr != nil {
				require.Error(t, err)
				require.Nil(t, usr)
			} else {
				require.NoError(t, err)
				require.NotNil(t, usr)
			}
		})
	}
}

func TestIntegrationUserDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ss := db.InitTestDB(t)
	quotaService := quotaimpl.ProvideService(ss, ss.Cfg)
	orgService, err := orgimpl.ProvideService(ss, ss.Cfg, quotaService)
	require.NoError(t, err)
	userStore := ProvideStore(ss, setting.NewCfg())
	usrSvc, err := ProvideService(ss, orgService, ss.Cfg, nil, nil, quotaService, supportbundlestest.NewFakeBundleService())
	require.NoError(t, err)
	usr := &user.SignedInUser{
		OrgID:       1,
		Permissions: map[int64]map[string][]string{1: {"users:read": {"global.users:*"}}},
	}

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
		ss := db.InitTestDB(t)
		_, usrSvc := createOrgAndUserSvc(t, ss, ss.Cfg)

		cmd := user.CreateUserCommand{
			Email: "usertest@test.com",
			Name:  "user name",
			Login: "user_test_login",
		}
		usr, err := usrSvc.Create(context.Background(), &cmd)
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
		_, err = usrSvc.Create(context.Background(), &cmd)
		require.NoError(t, err)

		cmd = user.CreateUserCommand{
			Email: "confusertest@TEST.COM",
			Name:  "user name",
			Login: "user_email_conflict_two",
		}
		_, err := usrSvc.Create(context.Background(), &cmd)
		require.NoError(t, err)

		cmd = user.CreateUserCommand{
			Email: "user_test_login_conflict@test.com",
			Name:  "user name",
			Login: "user_test_login_conflict",
		}
		// userLoginConflict
		_, err = usrSvc.Create(context.Background(), &cmd)
		require.NoError(t, err)

		cmd = user.CreateUserCommand{
			Email: "user_test_login_conflict_two@test.com",
			Name:  "user name",
			Login: "user_test_login_CONFLICT",
		}
		_, err = usrSvc.Create(context.Background(), &cmd)
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

		t.Run("GetByLogin - user2 uses user1.email as login", func(t *testing.T) {
			// create user_1
			user1 := &user.User{
				Email:      "user_1@mail.com",
				Name:       "user_1",
				Login:      "user_1",
				Password:   "user_1_password",
				Created:    time.Now(),
				Updated:    time.Now(),
				IsDisabled: true,
			}
			_, err := userStore.Insert(context.Background(), user1)
			require.Nil(t, err)

			// create user_2
			user2 := &user.User{
				Email:      "user_2@mail.com",
				Name:       "user_2",
				Login:      "user_1@mail.com",
				Password:   "user_2_password",
				Created:    time.Now(),
				Updated:    time.Now(),
				IsDisabled: true,
			}
			_, err = userStore.Insert(context.Background(), user2)
			require.Nil(t, err)

			// query user database for user_1 email
			query := user.GetUserByLoginQuery{LoginOrEmail: "user_1@mail.com"}
			result, err := userStore.GetByLogin(context.Background(), &query)
			require.Nil(t, err)

			// expect user_1 as result
			require.Equal(t, user1.Email, result.Email)
			require.Equal(t, user1.Login, result.Login)
			require.Equal(t, user1.Name, result.Name)
			require.NotEqual(t, user2.Email, result.Email)
			require.NotEqual(t, user2.Login, result.Login)
			require.NotEqual(t, user2.Name, result.Name)
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
		ss := db.InitTestDB(t)
		orgService, usrSvc := createOrgAndUserSvc(t, ss, ss.Cfg)
		users := createFiveTestUsers(t, usrSvc, func(i int) *user.CreateUserCommand {
			return &user.CreateUserCommand{
				Email:      fmt.Sprint("user", i, "@test.com"),
				Name:       fmt.Sprint("user", i),
				Login:      fmt.Sprint("loginuser", i),
				IsDisabled: false,
			}
		})
		err := orgService.AddOrgUser(context.Background(), &org.AddOrgUserCommand{
			LoginOrEmail: users[1].Login, Role: org.RoleViewer,
			OrgID: users[0].OrgID, UserID: users[1].ID,
		})
		require.Nil(t, err)

		err = updateDashboardACL(t, ss, 1, &dashboards.DashboardACL{
			DashboardID: 1, OrgID: users[0].OrgID, UserID: users[1].ID,
			Permission: dashboards.PERMISSION_EDIT,
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
		ss := db.InitTestDB(t)
		_, usrSvc := createOrgAndUserSvc(t, ss, ss.Cfg)
		createUserCmd := user.CreateUserCommand{
			Email:   fmt.Sprint("admin", "@test.com"),
			Name:    "admin",
			Login:   "admin",
			IsAdmin: true,
		}
		usr, err := usrSvc.Create(context.Background(), &createUserCmd)
		require.Nil(t, err)

		// Cannot make themselves a non-admin
		updatePermsError := userStore.UpdatePermissions(context.Background(), usr.ID, false)
		require.Equal(t, user.ErrLastGrafanaAdmin, updatePermsError)

		query := user.GetUserByIDQuery{ID: usr.ID}
		queryResult, getUserError := userStore.GetByID(context.Background(), query.ID)
		require.Nil(t, getUserError)
		require.True(t, queryResult.IsAdmin)

		// One user
		const email = "user@test.com"
		const username = "user"
		createUserCmd = user.CreateUserCommand{
			Email: email,
			Name:  "user",
			Login: username,
		}
		_, err = usrSvc.Create(context.Background(), &createUserCmd)
		require.Nil(t, err)

		// When trying to create a new user with the same email, an error is returned
		createUserCmd = user.CreateUserCommand{
			Email:        email,
			Name:         "user2",
			Login:        "user2",
			SkipOrgSetup: true,
		}
		_, err = usrSvc.Create(context.Background(), &createUserCmd)
		require.Equal(t, user.ErrUserAlreadyExists, err)

		// When trying to create a new user with the same login, an error is returned
		createUserCmd = user.CreateUserCommand{
			Email:        "user2@test.com",
			Name:         "user2",
			Login:        username,
			SkipOrgSetup: true,
		}
		_, err = usrSvc.Create(context.Background(), &createUserCmd)
		require.Equal(t, user.ErrUserAlreadyExists, err)
	})

	t.Run("GetProfile", func(t *testing.T) {
		_, err := userStore.GetProfile(context.Background(), &user.GetUserProfileQuery{UserID: 1})
		require.NoError(t, err)
	})

	t.Run("SetHelpFlag", func(t *testing.T) {
		err := userStore.SetHelpFlag(context.Background(), &user.SetUserHelpFlagCommand{UserID: 1, HelpFlags1: user.HelpFlags1(1)})
		require.NoError(t, err)
	})

	t.Run("Testing DB - return list users based on their is_disabled flag", func(t *testing.T) {
		ss = db.InitTestDB(t)
		_, usrSvc := createOrgAndUserSvc(t, ss, ss.Cfg)
		userStore := ProvideStore(ss, ss.Cfg)

		createFiveTestUsers(t, usrSvc, func(i int) *user.CreateUserCommand {
			return &user.CreateUserCommand{
				Email:      fmt.Sprint("user", i, "@test.com"),
				Name:       fmt.Sprint("user", i),
				Login:      fmt.Sprint("loginuser", i),
				IsDisabled: i%2 == 0,
			}
		})

		isDisabled := false
		query := user.SearchUsersQuery{IsDisabled: &isDisabled, SignedInUser: usr}
		result, err := userStore.Search(context.Background(), &query)
		require.Nil(t, err)
		require.Len(t, result.Users, 2)

		first, third := false, false
		for _, user := range result.Users {
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
		ss := db.InitTestDB(t)
		orgService, usrSvc = createOrgAndUserSvc(t, ss, ss.Cfg)

		users := createFiveTestUsers(t, usrSvc, func(i int) *user.CreateUserCommand {
			return &user.CreateUserCommand{
				Email:      fmt.Sprint("user", i, "@test.com"),
				Name:       fmt.Sprint("user", i),
				Login:      fmt.Sprint("loginuser", i),
				IsDisabled: false,
			}
		})

		err = orgService.AddOrgUser(context.Background(), &org.AddOrgUserCommand{
			LoginOrEmail: users[1].Login, Role: org.RoleViewer,
			OrgID: users[0].OrgID, UserID: users[1].ID,
		})
		require.Nil(t, err)

		err = updateDashboardACL(t, ss, 1, &dashboards.DashboardACL{
			DashboardID: 1, OrgID: users[0].OrgID, UserID: users[1].ID,
			Permission: dashboards.PERMISSION_EDIT,
		})
		require.Nil(t, err)

		// When the user is deleted
		err = userStore.Delete(context.Background(), users[1].ID)
		require.Nil(t, err)

		permQuery := &dashboards.GetDashboardACLInfoListQuery{DashboardID: 1, OrgID: users[0].OrgID}
		permQueryResult, err := userStore.getDashboardACLInfoList(permQuery)
		require.Nil(t, err)

		require.Len(t, permQueryResult, 0)

		// A user is an org member and has been assigned permissions
		// Re-init DB
		ss = db.InitTestDB(t)
		orgService, usrSvc = createOrgAndUserSvc(t, ss, ss.Cfg)
		users = createFiveTestUsers(t, usrSvc, func(i int) *user.CreateUserCommand {
			return &user.CreateUserCommand{
				Email:      fmt.Sprint("user", i, "@test.com"),
				Name:       fmt.Sprint("user", i),
				Login:      fmt.Sprint("loginuser", i),
				IsDisabled: false,
			}
		})
		err = orgService.AddOrgUser(context.Background(), &org.AddOrgUserCommand{
			LoginOrEmail: users[1].Login, Role: org.RoleViewer,
			OrgID: users[0].OrgID, UserID: users[1].ID,
		})
		require.Nil(t, err)

		err = updateDashboardACL(t, ss, 1, &dashboards.DashboardACL{
			DashboardID: 1, OrgID: users[0].OrgID, UserID: users[1].ID,
			Permission: dashboards.PERMISSION_EDIT,
		})
		require.Nil(t, err)

		ss.CacheService.Flush()

		query3 := &user.GetSignedInUserQuery{OrgID: users[1].OrgID, UserID: users[1].ID}
		query3Result, err := userStore.GetSignedInUser(context.Background(), query3)
		require.Nil(t, err)
		require.NotNil(t, query3Result)
		require.Equal(t, query3.OrgID, users[1].OrgID)

		disableCmd := user.BatchDisableUsersCommand{
			UserIDs:    []int64{users[0].ID, users[1].ID, users[2].ID, users[3].ID, users[4].ID},
			IsDisabled: true,
		}

		err = userStore.BatchDisableUsers(context.Background(), &disableCmd)
		require.Nil(t, err)

		isDisabled = true
		query5 := &user.SearchUsersQuery{IsDisabled: &isDisabled, SignedInUser: usr}
		query5Result, err := userStore.Search(context.Background(), query5)
		require.Nil(t, err)
		require.EqualValues(t, query5Result.TotalCount, 5)

		// the user is deleted
		err = userStore.Delete(context.Background(), users[1].ID)
		require.Nil(t, err)

		permQuery = &dashboards.GetDashboardACLInfoListQuery{DashboardID: 1, OrgID: users[0].OrgID}
		permQueryResult, err = userStore.getDashboardACLInfoList(permQuery)
		require.Nil(t, err)

		require.Len(t, permQueryResult, 0)
	})

	t.Run("Testing DB - return list of users that the SignedInUser has permission to read", func(t *testing.T) {
		ss := db.InitTestDB(t)
		orgService, err := orgimpl.ProvideService(ss, ss.Cfg, quotaService)
		require.NoError(t, err)
		usrSvc, err := ProvideService(ss, orgService, ss.Cfg, nil, nil, quotaService, supportbundlestest.NewFakeBundleService())
		require.NoError(t, err)

		createFiveTestUsers(t, usrSvc, func(i int) *user.CreateUserCommand {
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
		query := user.SearchUsersQuery{SignedInUser: testUser}
		queryResult, err := userStore.Search(context.Background(), &query)
		assert.Nil(t, err)
		assert.Len(t, queryResult.Users, 2)
	})

	ss = db.InitTestDB(t)

	t.Run("Testing DB - enable all users", func(t *testing.T) {
		users := createFiveTestUsers(t, usrSvc, func(i int) *user.CreateUserCommand {
			return &user.CreateUserCommand{
				Email:      fmt.Sprint("user", i, "@test.com"),
				Name:       fmt.Sprint("user", i),
				Login:      fmt.Sprint("loginuser", i),
				IsDisabled: true,
			}
		})

		disableCmd := user.BatchDisableUsersCommand{
			UserIDs:    []int64{users[0].ID, users[1].ID, users[2].ID, users[3].ID, users[4].ID},
			IsDisabled: false,
		}

		err := userStore.BatchDisableUsers(context.Background(), &disableCmd)
		require.Nil(t, err)

		isDisabled := false
		query := &user.SearchUsersQuery{IsDisabled: &isDisabled, SignedInUser: usr}
		queryResult, err := userStore.Search(context.Background(), query)

		require.Nil(t, err)
		require.EqualValues(t, queryResult.TotalCount, 5)
	})

	t.Run("Can search users", func(t *testing.T) {
		ss = db.InitTestDB(t)
		userStore.cfg.AutoAssignOrg = false

		ac1cmd := user.CreateUserCommand{Login: "ac1", Email: "ac1@test.com", Name: "ac1 name"}
		ac2cmd := user.CreateUserCommand{Login: "ac2", Email: "ac2@test.com", Name: "ac2 name", IsAdmin: true}
		serviceaccountcmd := user.CreateUserCommand{Login: "serviceaccount", Email: "service@test.com", Name: "serviceaccount name", IsAdmin: true, IsServiceAccount: true}

		_, err := usrSvc.Create(context.Background(), &ac1cmd)
		require.NoError(t, err)
		_, err = usrSvc.Create(context.Background(), &ac2cmd)
		require.NoError(t, err)
		// user only used for making sure we filter out the service accounts
		_, err = usrSvc.Create(context.Background(), &serviceaccountcmd)
		require.NoError(t, err)
		query := user.SearchUsersQuery{Query: "", SignedInUser: &user.SignedInUser{
			OrgID: 1,
			Permissions: map[int64]map[string][]string{
				1: {accesscontrol.ActionUsersRead: {accesscontrol.ScopeGlobalUsersAll}},
			},
		}}
		queryResult, err := userStore.Search(context.Background(), &query)
		require.NoError(t, err)
		require.Len(t, queryResult.Users, 2)
		require.Equal(t, queryResult.Users[0].Email, "ac1@test.com")
		require.Equal(t, queryResult.Users[1].Email, "ac2@test.com")
	})

	ss = db.InitTestDB(t)

	t.Run("Testing DB - disable only specific users", func(t *testing.T) {
		users := createFiveTestUsers(t, usrSvc, func(i int) *user.CreateUserCommand {
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
		disableCmd := user.BatchDisableUsersCommand{
			UserIDs:    userIdsToDisable,
			IsDisabled: true,
		}

		err := userStore.BatchDisableUsers(context.Background(), &disableCmd)
		require.Nil(t, err)

		query := user.SearchUsersQuery{SignedInUser: usr}
		queryResult, err := userStore.Search(context.Background(), &query)
		require.Nil(t, err)
		require.EqualValues(t, queryResult.TotalCount, 5)
		for _, user := range queryResult.Users {
			shouldBeDisabled := false

			// Check if user id is in the userIdsToDisable list
			for _, disabledUserId := range userIdsToDisable {
				if user.ID == disabledUserId {
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

	ss = db.InitTestDB(t)

	t.Run("Testing DB - search users", func(t *testing.T) {
		// Since previous tests were destructive
		createFiveTestUsers(t, usrSvc, func(i int) *user.CreateUserCommand {
			return &user.CreateUserCommand{
				Email:      fmt.Sprint("user", i, "@test.com"),
				Name:       fmt.Sprint("user", i),
				Login:      fmt.Sprint("loginuser", i),
				IsDisabled: false,
			}
		})
	})

	t.Run("Disable user", func(t *testing.T) {
		id, err := userStore.Insert(context.Background(), &user.User{
			Name:    "user111",
			Created: time.Now(),
			Updated: time.Now(),
		})
		require.NoError(t, err)
		err = userStore.Disable(context.Background(), &user.DisableUserCommand{UserID: id})
		require.NoError(t, err)
	})

	t.Run("Testing DB - multiple users", func(t *testing.T) {
		ss = db.InitTestDB(t)

		createFiveTestUsers(t, usrSvc, func(i int) *user.CreateUserCommand {
			return &user.CreateUserCommand{
				Email:      fmt.Sprint("user", i, "@test.com"),
				Name:       fmt.Sprint("user", i),
				Login:      fmt.Sprint("loginuser", i),
				IsDisabled: false,
			}
		})

		// Return the first page of users and a total count
		query := user.SearchUsersQuery{Query: "", Page: 1, Limit: 3, SignedInUser: usr}
		queryResult, err := userStore.Search(context.Background(), &query)

		require.Nil(t, err)
		require.Len(t, queryResult.Users, 3)
		require.EqualValues(t, queryResult.TotalCount, 5)

		// Return the second page of users and a total count
		query = user.SearchUsersQuery{Query: "", Page: 2, Limit: 3, SignedInUser: usr}
		queryResult, err = userStore.Search(context.Background(), &query)

		require.Nil(t, err)
		require.Len(t, queryResult.Users, 2)
		require.EqualValues(t, queryResult.TotalCount, 5)

		// Return list of users matching query on user name
		query = user.SearchUsersQuery{Query: "use", Page: 1, Limit: 3, SignedInUser: usr}
		queryResult, err = userStore.Search(context.Background(), &query)

		require.Nil(t, err)
		require.Len(t, queryResult.Users, 3)
		require.EqualValues(t, queryResult.TotalCount, 5)

		query = user.SearchUsersQuery{Query: "ser1", Page: 1, Limit: 3, SignedInUser: usr}
		queryResult, err = userStore.Search(context.Background(), &query)

		require.Nil(t, err)
		require.Len(t, queryResult.Users, 1)
		require.EqualValues(t, queryResult.TotalCount, 1)

		query = user.SearchUsersQuery{Query: "USER1", Page: 1, Limit: 3, SignedInUser: usr}
		queryResult, err = userStore.Search(context.Background(), &query)

		require.Nil(t, err)
		require.Len(t, queryResult.Users, 1)
		require.EqualValues(t, queryResult.TotalCount, 1)

		query = user.SearchUsersQuery{Query: "idontexist", Page: 1, Limit: 3, SignedInUser: usr}
		queryResult, err = userStore.Search(context.Background(), &query)

		require.Nil(t, err)
		require.Len(t, queryResult.Users, 0)
		require.EqualValues(t, queryResult.TotalCount, 0)

		// Return list of users matching query on email
		query = user.SearchUsersQuery{Query: "ser1@test.com", Page: 1, Limit: 3, SignedInUser: usr}
		queryResult, err = userStore.Search(context.Background(), &query)

		require.Nil(t, err)
		require.Len(t, queryResult.Users, 1)
		require.EqualValues(t, queryResult.TotalCount, 1)

		// Return list of users matching query on login name
		query = user.SearchUsersQuery{Query: "loginuser1", Page: 1, Limit: 3, SignedInUser: usr}
		queryResult, err = userStore.Search(context.Background(), &query)

		require.Nil(t, err)
		require.Len(t, queryResult.Users, 1)
		require.EqualValues(t, queryResult.TotalCount, 1)
	})

	t.Run("Can get logged in user projection", func(t *testing.T) {
		query := user.GetSignedInUserQuery{UserID: 2}
		queryResult, err := userStore.GetSignedInUser(context.Background(), &query)

		require.NoError(t, err)
		assert.Equal(t, queryResult.Email, "user1@test.com")
		assert.EqualValues(t, queryResult.OrgID, 2)
		assert.Equal(t, queryResult.Name, "user1")
		assert.Equal(t, queryResult.Login, "loginuser1")
		assert.EqualValues(t, queryResult.OrgRole, "Admin")
		assert.Equal(t, queryResult.OrgName, "user1@test.com")
		assert.Equal(t, queryResult.IsGrafanaAdmin, false)
	})
}

func TestIntegrationUserUpdate(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ss := db.InitTestDB(t)
	userStore := ProvideStore(ss, setting.NewCfg())
	_, usrSvc := createOrgAndUserSvc(t, ss, ss.Cfg)

	users := createFiveTestUsers(t, usrSvc, func(i int) *user.CreateUserCommand {
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

func createFiveTestUsers(t *testing.T, svc user.Service, fn func(i int) *user.CreateUserCommand) []user.User {
	t.Helper()

	users := make([]user.User, 5)
	for i := 0; i < 5; i++ {
		cmd := fn(i)
		user, err := svc.Create(context.Background(), cmd)
		require.Nil(t, err)
		users[i] = *user
	}

	return users
}

// TODO: Use FakeDashboardStore when org has its own service
func updateDashboardACL(t *testing.T, sqlStore db.DB, dashboardID int64, items ...*dashboards.DashboardACL) error {
	t.Helper()

	err := sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.Exec("DELETE FROM dashboard_acl WHERE dashboard_id=?", dashboardID)
		if err != nil {
			return fmt.Errorf("deleting from dashboard_acl failed: %w", err)
		}

		for _, item := range items {
			item.Created = time.Now()
			item.Updated = time.Now()
			if item.UserID == 0 && item.TeamID == 0 && (item.Role == nil || !item.Role.IsValid()) {
				return dashboards.ErrDashboardACLInfoMissing
			}

			if item.DashboardID == 0 {
				return dashboards.ErrDashboardPermissionDashboardEmpty
			}

			sess.Nullable("user_id", "team_id")
			if _, err := sess.Insert(item); err != nil {
				return err
			}
		}

		// Update dashboard HasACL flag
		dashboard := dashboards.Dashboard{HasACL: true}
		_, err = sess.Cols("has_acl").Where("id=?", dashboardID).Update(&dashboard)
		return err
	})
	return err
}

// This function was copied from pkg/services/dashboards/database to circumvent
// import cycles. When this org-related code is refactored into a service the
// tests can the real GetDashboardACLInfoList functions
func (ss *sqlStore) getDashboardACLInfoList(query *dashboards.GetDashboardACLInfoListQuery) ([]*dashboards.DashboardACLInfoDTO, error) {
	queryResult := make([]*dashboards.DashboardACLInfoDTO, 0)
	outerErr := ss.db.WithDbSession(context.Background(), func(dbSession *db.Session) error {
		falseStr := ss.dialect.BooleanStr(false)

		if query.DashboardID == 0 {
			sql := `SELECT
		da.id,
		da.org_id,
		da.dashboard_id,
		da.user_id,
		da.team_id,
		da.permission,
		da.role,
		da.created,
		da.updated,
		'' as user_login,
		'' as user_email,
		'' as team,
		'' as title,
		'' as slug,
		'' as uid,` +
				falseStr + ` AS is_folder,` +
				falseStr + ` AS inherited
		FROM dashboard_acl as da
		WHERE da.dashboard_id = -1`
			return dbSession.SQL(sql).Find(&queryResult)
		}

		rawSQL := `
			-- get permissions for the dashboard and its parent folder
			SELECT
				da.id,
				da.org_id,
				da.dashboard_id,
				da.user_id,
				da.team_id,
				da.permission,
				da.role,
				da.created,
				da.updated,
				u.login AS user_login,
				u.email AS user_email,
				ug.name AS team,
				ug.email AS team_email,
				d.title,
				d.slug,
				d.uid,
				d.is_folder,
				CASE WHEN (da.dashboard_id = -1 AND d.folder_id > 0) OR da.dashboard_id = d.folder_id THEN ` + ss.dialect.BooleanStr(true) + ` ELSE ` + falseStr + ` END AS inherited
			FROM dashboard as d
				LEFT JOIN dashboard folder on folder.id = d.folder_id
				LEFT JOIN dashboard_acl AS da ON
				da.dashboard_id = d.id OR
				da.dashboard_id = d.folder_id OR
				(
					-- include default permissions -->
					da.org_id = -1 AND (
					  (folder.id IS NOT NULL AND folder.has_acl = ` + falseStr + `) OR
					  (folder.id IS NULL AND d.has_acl = ` + falseStr + `)
					)
				)
				LEFT JOIN ` + ss.dialect.Quote("user") + ` AS u ON u.id = da.user_id
				LEFT JOIN team ug on ug.id = da.team_id
			WHERE d.org_id = ? AND d.id = ? AND da.id IS NOT NULL
			ORDER BY da.id ASC
			`

		return dbSession.SQL(rawSQL, query.OrgID, query.DashboardID).Find(&queryResult)
	})

	if outerErr != nil {
		return nil, outerErr
	}

	for _, p := range queryResult {
		p.PermissionName = p.Permission.String()
	}

	return queryResult, nil
}

func createOrgAndUserSvc(t *testing.T, store db.DB, cfg *setting.Cfg) (org.Service, user.Service) {
	t.Helper()

	quotaService := quotaimpl.ProvideService(store, cfg)
	orgService, err := orgimpl.ProvideService(store, cfg, quotaService)
	require.NoError(t, err)
	usrSvc, err := ProvideService(store, orgService, cfg, nil, nil, quotaService, supportbundlestest.NewFakeBundleService())
	require.NoError(t, err)

	return orgService, usrSvc
}

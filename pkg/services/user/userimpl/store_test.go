package userimpl

import (
	"context"
	"fmt"
	"sort"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/searchusers/sortopts"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationUserDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ss, cfg := db.InitTestDBWithCfg(t)
	quotaService := quotaimpl.ProvideService(ss, configprovider.ProvideService(cfg))
	orgService, err := orgimpl.ProvideService(ss, cfg, quotaService)
	require.NoError(t, err)
	userStore := ProvideStore(ss, setting.NewCfg())
	usrSvc, err := ProvideService(
		ss, orgService, cfg, nil, nil, tracing.InitializeTracerForTest(),
		quotaService, supportbundlestest.NewFakeBundleService(),
	)
	require.NoError(t, err)
	usr := &user.SignedInUser{
		OrgID:       1,
		Permissions: map[int64]map[string][]string{1: {"users:read": {"global.users:*"}}},
	}

	t.Run("user not found", func(t *testing.T) {
		_, err := userStore.GetByEmail(context.Background(),
			&user.GetUserByEmailQuery{Email: "test@email.com"},
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

	t.Run("error on duplicated user", func(t *testing.T) {
		_, err := userStore.Insert(context.Background(),
			&user.User{
				Email:   "test@email.com",
				Name:    "test1",
				Login:   "test1",
				Created: time.Now(),
				Updated: time.Now(),
			},
		)
		require.ErrorIs(t, err, user.ErrUserAlreadyExists)
	})

	t.Run("get user", func(t *testing.T) {
		_, err := userStore.GetByEmail(context.Background(),
			&user.GetUserByEmailQuery{Email: "test@email.com"},
		)
		require.NoError(t, err)
	})

	t.Run("insert user (with known UID)", func(t *testing.T) {
		ctx := context.Background()
		id, err := userStore.Insert(ctx,
			&user.User{
				UID:     "abcd",
				Email:   "next-test@email.com",
				Name:    "next-test1",
				Login:   "next-test1",
				Created: time.Now(),
				Updated: time.Now(),
			},
		)
		require.NoError(t, err)

		found, err := userStore.GetByID(ctx, id)
		require.NoError(t, err)
		require.Equal(t, "abcd", found.UID)

		siu, err := userStore.GetSignedInUser(ctx, &user.GetSignedInUserQuery{
			UserID: id,
			OrgID:  found.OrgID,
		})
		require.NoError(t, err)
		require.Equal(t, "abcd", siu.UserUID)

		query := user.GetUserByUIDQuery{UID: "abcd"}
		result, err := userStore.GetByUID(context.Background(), query.UID)
		require.Nil(t, err)
		require.Equal(t, result.UID, "abcd")
		require.Equal(t, result.Email, "next-test@email.com")
	})

	t.Run("Testing DB - creates and loads user", func(t *testing.T) {
		ss := db.InitTestDB(t)
		_, usrSvc := createOrgAndUserSvc(t, ss, cfg)

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
		require.Equal(t, string(result.Password), "")
		require.Len(t, result.Rands, 10)
		require.Len(t, result.Salt, 10)
		require.False(t, result.IsDisabled)

		result, err = userStore.GetByID(context.Background(), usr.ID)
		require.Nil(t, err)

		require.Equal(t, result.Email, "usertest@test.com")
		require.Equal(t, string(result.Password), "")
		require.Len(t, result.Rands, 10)
		require.Len(t, result.Salt, 10)
		require.False(t, result.IsDisabled)

		t.Run("Get User by email case insensitive", func(t *testing.T) {
			query := user.GetUserByEmailQuery{Email: "USERtest@TEST.COM"}
			result, err := userStore.GetByEmail(context.Background(), &query)
			require.Nil(t, err)

			require.Equal(t, result.Email, "usertest@test.com")
			require.Equal(t, string(result.Password), "")
			require.Len(t, result.Rands, 10)
			require.Len(t, result.Salt, 10)
			require.False(t, result.IsDisabled)
		})

		t.Run("Testing DB - creates and loads user", func(t *testing.T) {
			result, err = userStore.GetByID(context.Background(), usr.ID)
			require.Nil(t, err)

			require.Equal(t, result.Email, "usertest@test.com")
			require.Equal(t, string(result.Password), "")
			require.Len(t, result.Rands, 10)
			require.Len(t, result.Salt, 10)
			require.False(t, result.IsDisabled)

			result, err = userStore.GetByID(context.Background(), usr.ID)
			require.Nil(t, err)

			require.Equal(t, result.Email, "usertest@test.com")
			require.Equal(t, string(result.Password), "")
			require.Len(t, result.Rands, 10)
			require.Len(t, result.Salt, 10)
			require.False(t, result.IsDisabled)
		})
	})

	t.Run("Testing DB - error on case insensitive conflict", func(t *testing.T) {
		if ss.GetDBType() == migrator.MySQL {
			t.Skip("Skipping on MySQL due to case insensitive indexes")
		}
		testOrgID := int64(1)
		err := ss.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
			// create a user
			// add additional user with conflicting login where DOMAIN is upper case
			cmd := user.User{
				Email:   "confusertest@test.com",
				Name:    "user name",
				Login:   "user_email_conflict",
				OrgID:   testOrgID,
				Created: time.Now(),
				Updated: time.Now(),
			}
			rawSQL := fmt.Sprintf(
				"INSERT INTO %s (email, login, org_id, version, is_admin, created, updated) VALUES (?,?,?,0,%s,?,?)",
				ss.Quote("user"),
				ss.GetDialect().BooleanStr(false),
			)
			_, err := sess.Exec(rawSQL, cmd.Email, cmd.Login, cmd.OrgID, cmd.Created, cmd.Updated)
			if err != nil {
				return err
			}
			return nil
		})
		require.NoError(t, err)
		err = ss.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
			// create a user
			// add additional user with conflicting login where DOMAIN is upper case
			cmd := user.User{
				Email:   "confusertest@TEST.COM",
				Name:    "user name",
				Login:   "user_email_conflict_two",
				OrgID:   testOrgID,
				Created: time.Now(),
				Updated: time.Now(),
			}
			rawSQL := fmt.Sprintf(
				"INSERT INTO %s (email, login, org_id, version, is_admin, created, updated) VALUES (?,?,?,0,%s,?,?)",
				ss.Quote("user"),
				ss.GetDialect().BooleanStr(false),
			)
			_, err := sess.Exec(rawSQL, cmd.Email, cmd.Login, cmd.OrgID, cmd.Created, cmd.Updated)
			if err != nil {
				return err
			}
			return nil
		})
		require.NoError(t, err)

		err = ss.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
			// create a user
			// add additional user with conflicting login where DOMAIN is upper case
			// userLoginConflict
			cmd := user.User{
				Email:   "user_test_login_conflict@test.com",
				Name:    "user name",
				Login:   "user_test_login_conflict",
				OrgID:   testOrgID,
				Created: time.Now(),
				Updated: time.Now(),
			}
			rawSQL := fmt.Sprintf(
				"INSERT INTO %s (email, login, org_id, version, is_admin, created, updated) VALUES (?,?,?,0,%s,?,?)",
				ss.Quote("user"),
				ss.GetDialect().BooleanStr(false),
			)
			_, err := sess.Exec(rawSQL, cmd.Email, cmd.Login, cmd.OrgID, cmd.Created, cmd.Updated)
			if err != nil {
				return err
			}
			return nil
		})
		require.NoError(t, err)

		err = ss.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
			// create a user
			// add additional user with conflicting login where DOMAIN is upper case
			// userLoginConflict
			cmd := user.User{
				Email:   "user_test_login_conflict_two@test.com",
				Name:    "user name",
				Login:   "user_test_login_CONFLICT",
				OrgID:   testOrgID,
				Created: time.Now(),
				Updated: time.Now(),
			}
			rawSQL := fmt.Sprintf(
				"INSERT INTO %s (email, login, org_id, version, is_admin, created, updated) VALUES (?,?,?,0,%s,?,?)",
				ss.Quote("user"),
				ss.GetDialect().BooleanStr(false),
			)
			_, err := sess.Exec(rawSQL, cmd.Email, cmd.Login, cmd.OrgID, cmd.Created, cmd.Updated)
			if err != nil {
				return err
			}
			return nil
		})
		require.NoError(t, err)
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
	})

	t.Run("Change user password", func(t *testing.T) {
		id, err := userStore.Insert(context.Background(), &user.User{
			Email:    "password@test.com",
			Name:     "password",
			Login:    "password",
			Password: "password",
			Salt:     "salt",
			Created:  time.Now(),
			Updated:  time.Now(),
		})
		require.NoError(t, err)

		err = userStore.Update(context.Background(), &user.UpdateUserCommand{
			UserID:   id,
			Password: passwordPtr("updated"),
		})
		require.NoError(t, err)

		updated, err := userStore.GetByID(context.Background(), id)
		require.NoError(t, err)

		assert.Equal(t, updated.Salt, "salt")
		assert.Equal(t, updated.Name, "password")
		assert.Equal(t, updated.Login, "password")
		assert.Equal(t, updated.Email, "password@test.com")
		assert.Equal(t, updated.Password, user.Password("updated"))
	})

	t.Run("update last seen at", func(t *testing.T) {
		err := userStore.UpdateLastSeenAt(context.Background(), &user.UpdateUserLastSeenAtCommand{
			UserID: 10, // Requires UserID
		})
		require.NoError(t, err)

		err = userStore.UpdateLastSeenAt(context.Background(), &user.UpdateUserLastSeenAtCommand{
			UserID: -1,
		})
		require.Error(t, err)
	})

	t.Run("get signed in user", func(t *testing.T) {
		ss := db.InitTestDB(t)
		orgService, usrSvc := createOrgAndUserSvc(t, ss, cfg)
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

		query := &user.GetSignedInUserQuery{OrgID: users[1].OrgID, UserID: users[1].ID}
		result, err := userStore.GetSignedInUser(context.Background(), query)
		require.NoError(t, err)
		require.Equal(t, result.Email, "user1@test.com")

		// Throw errors for invalid user IDs
		for _, userID := range []int64{-1, 0} {
			_, err = userStore.GetSignedInUser(context.Background(),
				&user.GetSignedInUserQuery{
					OrgID:  users[1].OrgID,
					UserID: userID,
				}) // zero
			require.Error(t, err)
		}
	})

	t.Run("Testing DB - grafana admin users", func(t *testing.T) {
		ss := db.InitTestDB(t)
		_, usrSvc := createOrgAndUserSvc(t, ss, cfg)
		usr, err := usrSvc.Create(context.Background(), &user.CreateUserCommand{
			Email:   "admin@test.com",
			Name:    "admin",
			Login:   "admin",
			IsAdmin: true,
		})
		require.Nil(t, err)

		// Cannot make user non grafana admin if it is the last one
		err = userStore.Update(context.Background(), &user.UpdateUserCommand{
			UserID:         usr.ID,
			IsGrafanaAdmin: boolPtr(false),
		})
		require.ErrorIs(t, err, user.ErrLastGrafanaAdmin)

		usr, err = userStore.GetByID(context.Background(), usr.ID)
		require.NoError(t, err)
		require.True(t, usr.IsAdmin)

		// Create another admin user
		_, err = usrSvc.Create(context.Background(), &user.CreateUserCommand{
			Email:   "admin2@test.com",
			Name:    "admin2",
			Login:   "admin2",
			IsAdmin: true,
		})
		require.NoError(t, err)

		// Now first admin user should be able to be downgraded
		err = userStore.Update(context.Background(), &user.UpdateUserCommand{
			UserID:         usr.ID,
			IsGrafanaAdmin: boolPtr(false),
		})
		require.NoError(t, err)

		updated, err := userStore.GetByID(context.Background(), usr.ID)
		require.NoError(t, err)
		require.False(t, updated.IsAdmin)
		require.Equal(t, usr.Email, updated.Email)
		require.Equal(t, usr.Login, updated.Login)
		require.Equal(t, usr.Name, updated.Name)
	})

	t.Run("GetProfile", func(t *testing.T) {
		_, err := userStore.GetProfile(context.Background(), &user.GetUserProfileQuery{UserID: 1})
		require.NoError(t, err)
	})

	t.Run("Update HelpFlags", func(t *testing.T) {
		id, err := userStore.Insert(context.Background(), &user.User{
			Email:      "help@test.com",
			Name:       "help",
			Login:      "help",
			Updated:    time.Now(),
			Created:    time.Now(),
			LastSeenAt: time.Now(),
		})
		require.NoError(t, err)
		original, err := userStore.GetByID(context.Background(), id)
		require.NoError(t, err)

		helpflags := user.HelpFlags1(1)
		err = userStore.Update(context.Background(), &user.UpdateUserCommand{UserID: id, HelpFlags1: &helpflags})
		require.NoError(t, err)

		got, err := userStore.GetByID(context.Background(), id)
		require.NoError(t, err)

		original.HelpFlags1 = helpflags
		assertEqualUser(t, original, got)
	})

	t.Run("Testing DB - return list users based on their is_disabled flag", func(t *testing.T) {
		ss = db.InitTestDB(t)
		_, usrSvc := createOrgAndUserSvc(t, ss, cfg)
		userStore := ProvideStore(ss, cfg)

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
		orgService, usrSvc = createOrgAndUserSvc(t, ss, cfg)

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

		// When the user is deleted
		err = userStore.Delete(context.Background(), users[1].ID)
		require.Nil(t, err)

		// A user is an org member and has been assigned permissions
		// Re-init DB
		ss = db.InitTestDB(t)
		orgService, usrSvc = createOrgAndUserSvc(t, ss, cfg)
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
	})

	t.Run("Testing DB - return list of users that the SignedInUser has permission to read", func(t *testing.T) {
		ss := db.InitTestDB(t)
		orgService, err := orgimpl.ProvideService(ss, cfg, quotaService)
		require.NoError(t, err)
		usrSvc, err := ProvideService(
			ss, orgService, cfg, nil, nil, tracing.InitializeTracerForTest(),
			quotaService, supportbundlestest.NewFakeBundleService(),
		)
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

		err = userStore.Update(context.Background(), &user.UpdateUserCommand{
			UserID:     id,
			IsDisabled: boolPtr(true),
		})
		require.NoError(t, err)

		usr, err := userStore.GetByID(context.Background(), id)
		require.NoError(t, err)
		require.True(t, usr.IsDisabled)
	})

	t.Run("Update IsProvisioned", func(t *testing.T) {
		// Create a user with IsProvisioned set to false (default)
		id, err := userStore.Insert(context.Background(), &user.User{
			Name:    "provisioned_user",
			Email:   "provisioned@test.com",
			Login:   "provisioned_user",
			Created: time.Now(),
			Updated: time.Now(),
		})
		require.NoError(t, err)

		// Verify initial state
		usr, err := userStore.GetByID(context.Background(), id)
		require.NoError(t, err)
		require.False(t, usr.IsProvisioned)

		// Update user to set IsProvisioned to true
		err = userStore.Update(context.Background(), &user.UpdateUserCommand{
			UserID:        id,
			IsProvisioned: boolPtr(true),
		})
		require.NoError(t, err)

		// Verify IsProvisioned is now true
		usr, err = userStore.GetByID(context.Background(), id)
		require.NoError(t, err)
		require.True(t, usr.IsProvisioned)

		// Update user to set IsProvisioned to false
		err = userStore.Update(context.Background(), &user.UpdateUserCommand{
			UserID:        id,
			IsProvisioned: boolPtr(false),
		})
		require.NoError(t, err)

		// Verify IsProvisioned is now false
		usr, err = userStore.GetByID(context.Background(), id)
		require.NoError(t, err)
		require.False(t, usr.IsProvisioned)
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

		// Custom ordering
		sortOpts, err := sortopts.ParseSortQueryParam("login-asc,email-asc")
		require.NoError(t, err)
		query = user.SearchUsersQuery{Query: "", Page: 1, Limit: 3, SignedInUser: usr, SortOpts: sortOpts}
		queryResult, err = userStore.Search(context.Background(), &query)

		require.Nil(t, err)
		require.Len(t, queryResult.Users, 3)
		require.EqualValues(t, queryResult.TotalCount, 5)
		for i := 0; i < 3; i++ {
			require.Equal(t, fmt.Sprint("loginuser", i), queryResult.Users[i].Login)
		}

		sortOpts2, err := sortopts.ParseSortQueryParam("login-desc,email-asc")
		require.NoError(t, err)
		query = user.SearchUsersQuery{Query: "", Page: 1, Limit: 3, SignedInUser: usr, SortOpts: sortOpts2}
		queryResult, err = userStore.Search(context.Background(), &query)

		require.Nil(t, err)
		require.Len(t, queryResult.Users, 3)
		require.EqualValues(t, queryResult.TotalCount, 5)
		for i := 0; i < 3; i++ {
			require.Equal(t, fmt.Sprint("loginuser", 4-i), queryResult.Users[i].Login)
		}
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

	t.Run("Can get users by UID list", func(t *testing.T) {
		users := createFiveTestUsers(t, usrSvc, func(i int) *user.CreateUserCommand {
			return &user.CreateUserCommand{
				Email:      fmt.Sprint("USERLISTUIDTEST", i, "@test.com"),
				Name:       fmt.Sprint("USERLISTUIDTEST", i),
				Login:      fmt.Sprint("loginUSERLISTUIDTEST", i),
				IsDisabled: false,
			}
		})

		sort.Slice(users, func(i, j int) bool {
			return users[i].ID < users[j].ID
		})

		alluids := make([]string, 0, 5)
		for _, user := range users {
			alluids = append(alluids, user.UID)
		}

		resultOnlyUIDs, err := userStore.ListByIdOrUID(context.Background(), alluids, []int64{})
		require.NoError(t, err)

		sort.Slice(resultOnlyUIDs, func(i, j int) bool {
			return resultOnlyUIDs[i].ID < resultOnlyUIDs[j].ID
		})
		require.Equal(t, len(resultOnlyUIDs), len(users))
		ignoreTimeFields := cmpopts.IgnoreFields(user.User{}, "Created", "Updated", "LastSeenAt")
		if diff := cmp.Diff(users, resultOnlyUIDs, ignoreTimeFields); diff != "" {
			t.Errorf("structs don't match (-want +got):\n%s", diff)
		}
	})

	t.Run("Can get users by ID list", func(t *testing.T) {
		users := createFiveTestUsers(t, usrSvc, func(i int) *user.CreateUserCommand {
			return &user.CreateUserCommand{
				Email:      fmt.Sprint("USERLISTIDTEST", i, "@test.com"),
				Name:       fmt.Sprint("USERLISTIDTEST", i),
				Login:      fmt.Sprint("loginUSERLISTIDTEST", i),
				IsDisabled: false,
			}
		})

		sort.Slice(users, func(i, j int) bool {
			return users[i].ID < users[j].ID
		})

		allids := make([]int64, 0, 5)
		for _, user := range users {
			allids = append(allids, user.ID)
		}

		resultOnlyIDs, err := userStore.ListByIdOrUID(context.Background(), []string{}, allids)
		require.NoError(t, err)

		sort.Slice(resultOnlyIDs, func(i, j int) bool {
			return resultOnlyIDs[i].ID < resultOnlyIDs[j].ID
		})
		ignoreTimeFields := cmpopts.IgnoreFields(user.User{}, "Created", "Updated", "LastSeenAt")
		if diff := cmp.Diff(users, resultOnlyIDs, ignoreTimeFields); diff != "" {
			t.Errorf("structs don't match (-want +got):\n%s", diff)
		}
	})

	t.Run("Can get users by UID and ID list", func(t *testing.T) {
		users := createFiveTestUsers(t, usrSvc, func(i int) *user.CreateUserCommand {
			return &user.CreateUserCommand{
				Email:      fmt.Sprint("USERLISTUIDANDIDTEST", i, "@test.com"),
				Name:       fmt.Sprint("USERLISTUIDANDIDTEST", i),
				Login:      fmt.Sprint("loginUSERLISTUIDANDIDTEST", i),
				IsDisabled: false,
			}
		})

		sort.Slice(users, func(i, j int) bool {
			return users[i].ID < users[j].ID
		})

		ids := make([]int64, 0, 2)
		uids := make([]string, 0, 3)
		for i, user := range users {
			if i < 2 {
				ids = append(ids, user.ID)
			} else {
				uids = append(uids, user.UID)
			}
		}

		resultOnlyIDs, err := userStore.ListByIdOrUID(context.Background(), uids, ids)
		require.NoError(t, err)

		sort.Slice(resultOnlyIDs, func(i, j int) bool {
			return resultOnlyIDs[i].ID < resultOnlyIDs[j].ID
		})
		ignoreTimeFields := cmpopts.IgnoreFields(user.User{}, "Created", "Updated", "LastSeenAt")
		if diff := cmp.Diff(users, resultOnlyIDs, ignoreTimeFields); diff != "" {
			t.Errorf("structs don't match (-want +got):\n%s", diff)
		}
	})
}

func TestIntegrationUserUpdate(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ss, cfg := db.InitTestDBWithCfg(t)
	userStore := ProvideStore(ss, cfg)
	_, usrSvc := createOrgAndUserSvc(t, ss, cfg)

	users := createFiveTestUsers(t, usrSvc, func(i int) *user.CreateUserCommand {
		return &user.CreateUserCommand{
			Email:      fmt.Sprint("USER", i, "@test.com"),
			Name:       fmt.Sprint("USER", i),
			Login:      fmt.Sprint("loginUSER", i),
			IsDisabled: false,
		}
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
		require.Equal(t, "loginuser3", result.Login)
		require.Equal(t, "user3@test.com", result.Email)
	})
}

func createFiveTestUsers(t *testing.T, svc user.Service, fn func(i int) *user.CreateUserCommand) []*user.User {
	t.Helper()

	users := make([]*user.User, 5)
	for i := 0; i < 5; i++ {
		cmd := fn(i)
		user, err := svc.Create(context.Background(), cmd)
		require.Nil(t, err)
		users[i] = user
	}

	return users
}

func TestIntegrationMetricsUsage(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	ss, cfg := db.InitTestDBWithCfg(t)
	userStore := ProvideStore(ss, setting.NewCfg())
	quotaService := quotaimpl.ProvideService(ss, configprovider.ProvideService(cfg))
	orgService, err := orgimpl.ProvideService(ss, cfg, quotaService)
	require.NoError(t, err)

	_, usrSvc := createOrgAndUserSvc(t, ss, cfg)

	t.Run("Get empty role metrics for an org", func(t *testing.T) {
		orgId := int64(1)

		// create first user
		createFirtUserCmd := &user.CreateUserCommand{
			Login: "admin",
			Email: "admin@admin.com",
			Name:  "admin",
			OrgID: orgId,
		}
		_, err := usrSvc.Create(context.Background(), createFirtUserCmd)
		require.NoError(t, err)

		// create second user
		createSecondUserCmd := &user.CreateUserCommand{
			Login: "userWithoutRole",
			Email: "userWithoutRole@userWithoutRole.com",
			Name:  "userWithoutRole",
		}
		secondUser, err := usrSvc.Create(context.Background(), createSecondUserCmd)
		require.NoError(t, err)

		// assign the user to the org
		cmd := org.AddOrgUserCommand{
			OrgID:  secondUser.OrgID,
			UserID: orgId,
			Role:   org.RoleNone,
		}
		err = orgService.AddOrgUser(context.Background(), &cmd)
		require.NoError(t, err)

		// get metric usage
		stats, err := userStore.CountUserAccountsWithEmptyRole(context.Background())
		require.NoError(t, err)
		assert.Equal(t, int64(1), stats)
	})
}

func assertEqualUser(t *testing.T, expected, got *user.User) {
	// zero out time fields
	expected.Updated = time.Time{}
	expected.Created = time.Time{}
	expected.LastSeenAt = time.Time{}
	got.Updated = time.Time{}
	got.Created = time.Time{}
	got.LastSeenAt = time.Time{}

	assert.Equal(t, expected, got)
}

func createOrgAndUserSvc(t *testing.T, store db.DB, cfg *setting.Cfg) (org.Service, user.Service) {
	t.Helper()

	quotaService := quotaimpl.ProvideService(store, configprovider.ProvideService(cfg))
	orgService, err := orgimpl.ProvideService(store, cfg, quotaService)
	require.NoError(t, err)
	usrSvc, err := ProvideService(
		store, orgService, cfg, nil, nil, tracing.InitializeTracerForTest(),
		quotaService, supportbundlestest.NewFakeBundleService(),
	)
	require.NoError(t, err)

	return orgService, usrSvc
}

func passwordPtr(s string) *user.Password {
	password := user.Password(s)
	return &password
}

func boolPtr(b bool) *bool {
	return &b
}

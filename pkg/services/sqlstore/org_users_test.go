package sqlstore

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/user"
)

type getOrgUsersTestCase struct {
	desc             string
	query            *models.GetOrgUsersQuery
	expectedNumUsers int
}

func TestSQLStore_GetOrgUsers(t *testing.T) {
	tests := []getOrgUsersTestCase{
		{
			desc: "should return all users",
			query: &models.GetOrgUsersQuery{
				OrgId: 1,
				User: &user.SignedInUser{
					OrgID:       1,
					Permissions: map[int64]map[string][]string{1: {ac.ActionOrgUsersRead: {ac.ScopeUsersAll}}},
				},
			},
			expectedNumUsers: 10,
		},
		{
			desc: "should return no users",
			query: &models.GetOrgUsersQuery{
				OrgId: 1,
				User: &user.SignedInUser{
					OrgID:       1,
					Permissions: map[int64]map[string][]string{1: {ac.ActionOrgUsersRead: {""}}},
				},
			},
			expectedNumUsers: 0,
		},
		{
			desc: "should return some users",
			query: &models.GetOrgUsersQuery{
				OrgId: 1,
				User: &user.SignedInUser{
					OrgID: 1,
					Permissions: map[int64]map[string][]string{1: {ac.ActionOrgUsersRead: {
						"users:id:1",
						"users:id:5",
						"users:id:9",
					}}},
				},
			},
			expectedNumUsers: 3,
		},
	}

	store := InitTestDB(t, InitTestDBOpt{})
	store.Cfg.IsEnterprise = true
	defer func() {
		store.Cfg.IsEnterprise = false
	}()
	seedOrgUsers(t, store, 10)

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			err := store.GetOrgUsers(context.Background(), tt.query)
			require.NoError(t, err)
			require.Len(t, tt.query.Result, tt.expectedNumUsers)

			if !hasWildcardScope(tt.query.User, ac.ActionOrgUsersRead) {
				for _, u := range tt.query.Result {
					assert.Contains(t, tt.query.User.Permissions[tt.query.User.OrgID][ac.ActionOrgUsersRead], fmt.Sprintf("users:id:%d", u.UserId))
				}
			}
		})
	}
}

func TestSQLStore_GetOrgUsers_PopulatesCorrectly(t *testing.T) {
	// The millisecond part is not stored in the DB
	constNow := time.Date(2022, 8, 17, 20, 34, 58, 0, time.UTC)
	MockTimeNow(constNow)
	defer ResetTimeNow()

	store := InitTestDB(t, InitTestDBOpt{})
	_, err := store.CreateUser(context.Background(), user.CreateUserCommand{
		Login: "Admin",
		Email: "admin@localhost",
		OrgID: 1,
	})
	require.NoError(t, err)

	newUser, err := store.CreateUser(context.Background(), user.CreateUserCommand{
		Login:      "Viewer",
		Email:      "viewer@localhost",
		OrgID:      1,
		IsDisabled: true,
		Name:       "Viewer Localhost",
	})
	require.NoError(t, err)

	err = store.AddOrgUser(context.Background(), &models.AddOrgUserCommand{
		Role:   "Viewer",
		OrgId:  1,
		UserId: newUser.ID,
	})
	require.NoError(t, err)

	query := &models.GetOrgUsersQuery{
		OrgId:  1,
		UserID: newUser.ID,
		User: &user.SignedInUser{
			OrgID:       1,
			Permissions: map[int64]map[string][]string{1: {ac.ActionOrgUsersRead: {ac.ScopeUsersAll}}},
		},
	}
	err = store.GetOrgUsers(context.Background(), query)
	require.NoError(t, err)
	require.Len(t, query.Result, 1)

	actual := query.Result[0]
	assert.Equal(t, int64(1), actual.OrgId)
	assert.Equal(t, newUser.ID, actual.UserId)
	assert.Equal(t, "viewer@localhost", actual.Email)
	assert.Equal(t, "Viewer Localhost", actual.Name)
	assert.Equal(t, "Viewer", actual.Login)
	assert.Equal(t, "Viewer", actual.Role)
	assert.Equal(t, constNow.AddDate(-10, 0, 0), actual.LastSeenAt)
	assert.Equal(t, constNow, actual.Created)
	assert.Equal(t, constNow, actual.Updated)
	assert.Equal(t, true, actual.IsDisabled)
}

type searchOrgUsersTestCase struct {
	desc             string
	query            *models.SearchOrgUsersQuery
	expectedNumUsers int
}

func TestSQLStore_SearchOrgUsers(t *testing.T) {
	tests := []searchOrgUsersTestCase{
		{
			desc: "should return all users",
			query: &models.SearchOrgUsersQuery{
				OrgID: 1,
				User: &user.SignedInUser{
					OrgID:       1,
					Permissions: map[int64]map[string][]string{1: {ac.ActionOrgUsersRead: {ac.ScopeUsersAll}}},
				},
			},
			expectedNumUsers: 10,
		},
		{
			desc: "should return no users",
			query: &models.SearchOrgUsersQuery{
				OrgID: 1,
				User: &user.SignedInUser{
					OrgID:       1,
					Permissions: map[int64]map[string][]string{1: {ac.ActionOrgUsersRead: {""}}},
				},
			},
			expectedNumUsers: 0,
		},
		{
			desc: "should return some users",
			query: &models.SearchOrgUsersQuery{
				OrgID: 1,
				User: &user.SignedInUser{
					OrgID: 1,
					Permissions: map[int64]map[string][]string{1: {ac.ActionOrgUsersRead: {
						"users:id:1",
						"users:id:5",
						"users:id:9",
					}}},
				},
			},
			expectedNumUsers: 3,
		},
	}

	store := InitTestDB(t, InitTestDBOpt{})
	seedOrgUsers(t, store, 10)

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			err := store.SearchOrgUsers(context.Background(), tt.query)
			require.NoError(t, err)
			assert.Len(t, tt.query.Result.OrgUsers, tt.expectedNumUsers)

			if !hasWildcardScope(tt.query.User, ac.ActionOrgUsersRead) {
				for _, u := range tt.query.Result.OrgUsers {
					assert.Contains(t, tt.query.User.Permissions[tt.query.User.OrgID][ac.ActionOrgUsersRead], fmt.Sprintf("users:id:%d", u.UserId))
				}
			}
		})
	}
}

func TestSQLStore_AddOrgUser(t *testing.T) {
	var orgID int64 = 1
	store := InitTestDB(t)

	// create org and admin
	_, err := store.CreateUser(context.Background(), user.CreateUserCommand{
		Login: "admin",
		OrgID: orgID,
	})
	require.NoError(t, err)

	// create a service account with no org
	sa, err := store.CreateUser(context.Background(), user.CreateUserCommand{
		Login:            "sa-no-org",
		IsServiceAccount: true,
		SkipOrgSetup:     true,
	})

	require.NoError(t, err)
	require.Equal(t, int64(-1), sa.OrgID)

	// assign the sa to the org but without the override. should fail
	err = store.AddOrgUser(context.Background(), &models.AddOrgUserCommand{
		Role:   "Viewer",
		OrgId:  orgID,
		UserId: sa.ID,
	})
	require.Error(t, err)

	// assign the sa to the org with the override. should succeed
	err = store.AddOrgUser(context.Background(), &models.AddOrgUserCommand{
		Role:                      "Viewer",
		OrgId:                     orgID,
		UserId:                    sa.ID,
		AllowAddingServiceAccount: true,
	})

	require.NoError(t, err)

	// assert the org has been correctly set
	saFound := new(user.User)
	err = store.WithDbSession(context.Background(), func(sess *DBSession) error {
		has, err := sess.ID(sa.ID).Get(saFound)
		if err != nil {
			return err
		} else if !has {
			return user.ErrUserNotFound
		}
		return nil
	})

	require.NoError(t, err)
	require.Equal(t, saFound.OrgID, orgID)
}

func TestSQLStore_RemoveOrgUser(t *testing.T) {
	store := InitTestDB(t)

	// create org and admin
	_, err := store.CreateUser(context.Background(), user.CreateUserCommand{
		Login: "admin",
		OrgID: 1,
	})
	require.NoError(t, err)

	// create a user with no org
	_, err = store.CreateUser(context.Background(), user.CreateUserCommand{
		Login:        "user",
		OrgID:        1,
		SkipOrgSetup: true,
	})
	require.NoError(t, err)

	// assign the user to the org
	err = store.AddOrgUser(context.Background(), &models.AddOrgUserCommand{
		Role:   "Viewer",
		OrgId:  1,
		UserId: 2,
	})
	require.NoError(t, err)

	// assert the org has been assigned
	user := &models.GetUserByIdQuery{Id: 2}
	err = store.GetUserById(context.Background(), user)
	require.NoError(t, err)
	require.Equal(t, user.Result.OrgID, int64(1))

	// remove the user org
	err = store.RemoveOrgUser(context.Background(), &models.RemoveOrgUserCommand{
		UserId:                   2,
		OrgId:                    1,
		ShouldDeleteOrphanedUser: false,
	})
	require.NoError(t, err)

	// assert the org has been removed
	user = &models.GetUserByIdQuery{Id: 2}
	err = store.GetUserById(context.Background(), user)
	require.NoError(t, err)
	require.Equal(t, user.Result.OrgID, int64(0))
}

func seedOrgUsers(t *testing.T, store *SQLStore, numUsers int) {
	t.Helper()
	// Seed users
	for i := 1; i <= numUsers; i++ {
		user, err := store.CreateUser(context.Background(), user.CreateUserCommand{
			Login: fmt.Sprintf("user-%d", i),
			OrgID: 1,
		})
		require.NoError(t, err)

		if i != 1 {
			err = store.AddOrgUser(context.Background(), &models.AddOrgUserCommand{
				Role:   "Viewer",
				OrgId:  1,
				UserId: user.ID,
			})
			require.NoError(t, err)
		}
	}
}

func hasWildcardScope(user *user.SignedInUser, action string) bool {
	for _, scope := range user.Permissions[user.OrgID][action] {
		if strings.HasSuffix(scope, ":*") {
			return true
		}
	}
	return false
}

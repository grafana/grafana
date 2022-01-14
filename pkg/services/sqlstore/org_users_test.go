package sqlstore

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
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
				User: &models.SignedInUser{
					OrgId:       1,
					Permissions: map[int64]map[string][]string{1: {ac.ActionOrgUsersRead: {ac.ScopeUsersAll}}},
				},
			},
			expectedNumUsers: 10,
		},
		{
			desc: "should return no users",
			query: &models.GetOrgUsersQuery{
				OrgId: 1,
				User: &models.SignedInUser{
					OrgId:       1,
					Permissions: map[int64]map[string][]string{1: {ac.ActionOrgUsersRead: {""}}},
				},
			},
			expectedNumUsers: 0,
		},
		{
			desc: "should return some users",
			query: &models.GetOrgUsersQuery{
				OrgId: 1,
				User: &models.SignedInUser{
					OrgId: 1,
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

	store := InitTestDB(t)
	store.Cfg.FeatureToggles = map[string]bool{"accesscontrol": true}
	seedOrgUsers(t, store, 10)

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			err := store.GetOrgUsers(context.Background(), tt.query)
			require.NoError(t, err)
			require.Len(t, tt.query.Result, tt.expectedNumUsers)

			if !hasWildcardScope(tt.query.User, ac.ActionOrgUsersRead) {
				for _, u := range tt.query.Result {
					assert.Contains(t, tt.query.User.Permissions[tt.query.User.OrgId][ac.ActionOrgUsersRead], fmt.Sprintf("users:id:%d", u.UserId))
				}
			}
		})
	}
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
				User: &models.SignedInUser{
					OrgId:       1,
					Permissions: map[int64]map[string][]string{1: {ac.ActionOrgUsersRead: {ac.ScopeUsersAll}}},
				},
			},
			expectedNumUsers: 10,
		},
		{
			desc: "should return no users",
			query: &models.SearchOrgUsersQuery{
				OrgID: 1,
				User: &models.SignedInUser{
					OrgId:       1,
					Permissions: map[int64]map[string][]string{1: {ac.ActionOrgUsersRead: {""}}},
				},
			},
			expectedNumUsers: 0,
		},
		{
			desc: "should return some users",
			query: &models.SearchOrgUsersQuery{
				OrgID: 1,
				User: &models.SignedInUser{
					OrgId: 1,
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

	store := InitTestDB(t)
	store.Cfg.FeatureToggles = map[string]bool{"accesscontrol": true}
	seedOrgUsers(t, store, 10)

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			err := store.SearchOrgUsers(context.Background(), tt.query)
			require.NoError(t, err)
			assert.Len(t, tt.query.Result.OrgUsers, tt.expectedNumUsers)

			if !hasWildcardScope(tt.query.User, ac.ActionOrgUsersRead) {
				for _, u := range tt.query.Result.OrgUsers {
					assert.Contains(t, tt.query.User.Permissions[tt.query.User.OrgId][ac.ActionOrgUsersRead], fmt.Sprintf("users:id:%d", u.UserId))
				}
			}
		})
	}
}

func seedOrgUsers(t *testing.T, store *SQLStore, numUsers int) {
	t.Helper()
	// Seed users
	for i := 1; i <= numUsers; i++ {
		user, err := store.CreateUser(context.Background(), models.CreateUserCommand{
			Login: fmt.Sprintf("user-%d", i),
			OrgId: 1,
		})
		require.NoError(t, err)

		if i != 1 {
			err = store.AddOrgUser(context.Background(), &models.AddOrgUserCommand{
				Role:   "Viewer",
				OrgId:  1,
				UserId: user.Id,
			})
			require.NoError(t, err)
		}
	}
}

func hasWildcardScope(user *models.SignedInUser, action string) bool {
	for _, scope := range user.Permissions[user.OrgId][action] {
		if strings.HasSuffix(scope, ":*") {
			return true
		}
	}
	return false
}

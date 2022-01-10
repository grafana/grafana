package sqlstore

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
)

type getOrgUsersTestCase struct {
	desc             string
	query            *models.GetOrgUsersQuery
	expectedErr      error
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
					Permissions: map[int64]map[string][]string{1: {"org.users:read": {"users:*"}}},
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
					Permissions: map[int64]map[string][]string{1: {"org.users:read": {""}}},
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
					Permissions: map[int64]map[string][]string{1: {"org.users:read": {
						"users:id:1",
						"users:id:5",
						"users:id:9",
					}}},
				},
			},
			expectedNumUsers: 3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			store := InitTestDB(t)
			store.Cfg.FeatureToggles = map[string]bool{"accesscontrol": true}

			// Seed users
			for i := 1; i <= 10; i++ {
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

			err := store.GetOrgUsers(context.Background(), tt.query)
			require.NoError(t, err)
			require.Len(t, tt.query.Result, tt.expectedNumUsers)

			hasWildcard := false
			for _, scope := range tt.query.User.Permissions[tt.query.User.OrgId]["org.users:read"] {
				if scope == "*" || scope == "users:*" || scope == "users:id:*" {
					hasWildcard = true
				}
			}

			if !hasWildcard {
				for _, u := range tt.query.Result {
					assert.Contains(t, tt.query.User.Permissions[tt.query.User.OrgId]["org.users:read"], fmt.Sprintf("users:id:%d", u.UserId))
				}
			}
		})
	}
}

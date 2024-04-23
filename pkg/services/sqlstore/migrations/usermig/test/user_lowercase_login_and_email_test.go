package test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations/usermig"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestLowerCaseMigration(t *testing.T) {
	// Run initial migration to have a working DB
	x := setupTestDB(t)

	type migrationTestCase struct {
		desc      string
		users     []*user.User
		wantUsers []*user.User
	}
	testCases := []migrationTestCase{
		{
			desc: "basic case updates login and email to lowercase",
			users: []*user.User{
				{
					ID:      1,
					UID:     "u1",
					Login:   "User1",
					Email:   "USER1@domain.com",
					Name:    "user1",
					OrgID:   1,
					Created: now,
					Updated: now,
				},
				{
					ID:      2,
					UID:     "u2",
					Login:   "User2",
					Email:   "USER2@domain.com",
					Name:    "user2",
					OrgID:   1,
					Created: now,
					Updated: now,
				},
			},
			wantUsers: []*user.User{
				{
					ID:    1,
					Login: "user1",
					Email: "user1@domain.com",
				},
				{
					ID:    2,
					Login: "user2",
					Email: "user2@domain.com",
				},
			},
		},
		// {
		// 	desc: "basic case",
		// 	users: []*user.User{
		// 		{
		// 			ID:      1,
		// 			UID:     "u1",
		// 			Login:   "User1",
		// 			Email:   "user2@domain.com",
		// 			Name:    "user1",
		// 			OrgID:   1,
		// 			Created: now,
		// 			Updated: now,
		// 		},
		// 		{
		// 			ID:      2,
		// 			UID:     "u2",
		// 			Login:   "User2",
		// 			Email:   "user2@domain.com",
		// 			Name:    "user2",
		// 			OrgID:   1,
		// 			Created: now,
		// 			Updated: now,
		// 		},
		// 	},
		// 	wantUsers: []*user.User{
		// 		{
		// 			ID:    1,
		// 			Login: "user1",
		// 		},
		// 		{
		// 			ID:    2,
		// 			Login: "user2",
		// 		},
		// 	},
		// },
		// Add more test cases as needed
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			// Remove migration
			_, errDeleteMig := x.Exec(`DELETE FROM migration_log WHERE migration_id = ?`, usermig.LowerCaseUserLoginAndEmail)
			require.NoError(t, errDeleteMig)

			// insert users
			usersCount, err := x.Insert(tc.users)
			require.NoError(t, err)
			require.Equal(t, int64(len(tc.users)), usersCount)

			// run the migration
			usermigrator := migrator.NewMigrator(x, &setting.Cfg{Logger: log.New("usermigration.test")})
			usermig.AddLowerCaseUserLoginAndEmail(usermigrator)
			errRunningMig := usermigrator.Start(false, 0)
			require.NoError(t, errRunningMig)

			// Check users
			resultingUsers := []user.User{}
			err = x.Table("user").Find(&resultingUsers)
			require.NoError(t, err)

			// Check that the users have been updated
			require.Equal(t, len(tc.wantUsers), len(resultingUsers))

			for i := range tc.wantUsers {
				for _, u := range resultingUsers {
					if u.ID == tc.wantUsers[i].ID {
						assert.Equal(t, tc.wantUsers[i].Login, u.Login)
						assert.Equal(t, tc.wantUsers[i].Email, u.Email)
					}
				}
			}
		})
	}
}

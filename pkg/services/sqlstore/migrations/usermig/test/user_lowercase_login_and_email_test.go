package test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations/usermig"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestLowerCaseMigration(t *testing.T) {
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
		// "2 users - same login, one already lowercase"
		{
			desc: "2 users with same login one already has lowercase so we keep both",
			users: []*user.User{
				{
					ID:      1,
					UID:     "u1",
					Login:   "user1",
					Email:   "user1@email.com",
					Name:    "user1",
					OrgID:   1,
					Created: now,
					Updated: now,
				},
				{
					ID:      2,
					UID:     "u2",
					Login:   "User1",
					Email:   "user1-new@email.com",
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
					Email: "user1@email.com",
				},
				{
					ID:    2,
					Login: "User1",
					Email: "user1-new@email.com",
				},
			},
		},
		// "2 users - same login, one already lowercase"
		{
			desc: "2 users with same login one already has lowercase so we keep both case for uppercasing comes first in our loop",
			users: []*user.User{
				{
					ID:      1,
					UID:     "u1",
					Login:   "User1",
					Email:   "user1@email.com",
					Name:    "user1",
					OrgID:   1,
					Created: now,
					Updated: now,
				},
				{
					ID:      2,
					UID:     "u2",
					Login:   "user1",
					Email:   "user1-new@email.com",
					Name:    "user2",
					OrgID:   1,
					Created: now,
					Updated: now,
				},
			},
			wantUsers: []*user.User{
				{
					ID:    1,
					Login: "User1",
					Email: "user1@email.com",
				},
				{
					ID:    2,
					Login: "user1",
					Email: "user1-new@email.com",
				},
			},
		},
		// "2 users - same email, one already lowercase"
		{
			desc: "2 users with same email one already has lowercase so we keep both",
			users: []*user.User{
				{
					ID:      1,
					UID:     "u1",
					Login:   "user1",
					Email:   "USER1@email.com",
					Name:    "user1",
					OrgID:   1,
					Created: now,
					Updated: now,
				},
				{
					ID:      2,
					UID:     "u2",
					Login:   "user1-new-login",
					Email:   "user1@email.com",
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
					Email: "USER1@email.com",
				},
				{
					ID:    2,
					Login: "user1-new-login",
					Email: "user1@email.com",
				},
			},
		},

		// "2 users - same login, none lowercase"
		{
			desc: "2 users with same login noone is lowercased we pick the most recent user to lowercase",
			users: []*user.User{
				{
					ID:      1,
					UID:     "u1",
					Login:   "USER1",
					Email:   "user1@mail.com",
					Name:    "user1",
					OrgID:   1,
					Created: now.Add(-1 * time.Hour),
					Updated: now.Add(-1 * time.Hour),
				},
				{
					ID:      2,
					UID:     "u2",
					Login:   "User1",
					Email:   "user1-new@mail.com",
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
					Email: "user1@mail.com",
				},
				{
					ID:    2,
					Login: "User1",
					Email: "user1-new@mail.com",
				},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			// Run initial migration to have a working DB
			x := setupTestDB(t)
			// Remove migration
			_, errDeleteMig := x.Exec(`DELETE FROM migration_log WHERE migration_id = ?`, usermig.LowerCaseUserLoginAndEmail)
			require.NoError(t, errDeleteMig)

			// insert users
			usersCount, err := x.Insert(tc.users)
			require.NoError(t, err)
			require.Equal(t, int64(len(tc.users)), usersCount)

			// run the migration
			usermigrator := migrator.NewMigrator(x, setting.ProvideService(&setting.Cfg{Logger: log.New("usermigration.test")}))
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

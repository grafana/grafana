package commands

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
)

func TestUserManagerListConflictingUsers(t *testing.T) {
	t.Run("should get conflicting users", func(t *testing.T) {
		// Restore after destructive operation
		sqlStore := sqlstore.InitTestDB(t)

		for i := 0; i < 5; i++ {
			cmd := user.CreateUserCommand{
				Email: fmt.Sprint("user", i, "@test.com"),
				Name:  fmt.Sprint("user", i),
				Login: fmt.Sprint("loginuser", i),
				OrgID: 1,
			}
			_, err := sqlStore.CreateUser(context.Background(), cmd)
			require.Nil(t, err)
		}

		// "Skipping conflicting users test for mysql as it does make unique constraint case insensitive by default
		if sqlStore.GetDialect().DriverName() != "mysql" {
			dupUserEmailcmd := user.CreateUserCommand{
				Email: "USERDUPLICATETEST1@TEST.COM",
				Name:  "user name 1",
				Login: "USER_DUPLICATE_TEST_1_LOGIN",
			}
			_, err := sqlStore.CreateUser(context.Background(), dupUserEmailcmd)
			require.NoError(t, err)

			// add additional user with conflicting login where DOMAIN is upper case
			dupUserLogincmd := user.CreateUserCommand{
				Email: "userduplicatetest1@test.com",
				Name:  "user name 1",
				Login: "user_duplicate_test_1_login",
			}
			_, err = sqlStore.CreateUser(context.Background(), dupUserLogincmd)
			require.NoError(t, err)
			m, err := GetUsersWithConflictingEmailsOrLogins(context.Background(), sqlStore)
			require.NoError(t, err)
			require.Equal(t, 1, len(m))
		}
	})
}

func TestMergeUser(t *testing.T) {
	t.Run("should be able to merge user", func(t *testing.T) {
		// Restore after destructive operation
		sqlStore := sqlstore.InitTestDB(t)

		const testOrgID int64 = 1
		// "Skipping conflicting users test for mysql as it does make unique constraint case insensitive by default
		if sqlStore.GetDialect().DriverName() != "mysql" {

			// setup
			dupUserEmailcmd := user.CreateUserCommand{
				Email: "USERDUPLICATETEST1@TEST.COM",
				Name:  "user name 1",
				Login: "USER_DUPLICATE_TEST_1_LOGIN",
				OrgID: testOrgID,
			}
			userWithUpperCase, err := sqlStore.CreateUser(context.Background(), dupUserEmailcmd)
			require.NoError(t, err)

			// add additional user with conflicting login where DOMAIN is upper case
			dupUserLogincmd := user.CreateUserCommand{
				Email: "userduplicatetest1@test.com",
				Name:  "user name 1",
				Login: "user_duplicate_test_1_login",
				OrgID: testOrgID,
			}
			userWithLowerCase, err := sqlStore.CreateUser(context.Background(), dupUserLogincmd)
			require.NoError(t, err)
			// fromUser should be replaced by userWithLowerCase
			team1, err := sqlStore.CreateTeam("group1 name", "test1@test.com", testOrgID)
			require.NoError(t, err)
			err = sqlStore.AddTeamMember(userWithUpperCase.ID, testOrgID, team1.Id, false, 0)
			require.NoError(t, err)
			// setup finished

			_, err = GetUsersWithConflictingEmailsOrLogins(context.Background(), sqlStore)
			require.NoError(t, err)
			// TODO: fix this test
			mergeErr := mergeUser(context.Background(), userWithLowerCase.ID, nil, sqlStore)
			require.NoError(t, mergeErr)

			// start test
			// fromUser should be deleted after merger
			t.Logf("testing getting user")
			query := &models.GetUserByIdQuery{Id: userWithUpperCase.ID}
			err = sqlStore.GetUserById(context.Background(), query)
			require.Error(t, user.ErrUserNotFound, err)

			testUser := &models.SignedInUser{
				OrgId: testOrgID,
				Permissions: map[int64]map[string][]string{
					1: {
						ac.ActionTeamsRead:    []string{ac.ScopeTeamsAll},
						ac.ActionOrgUsersRead: []string{ac.ScopeUsersAll},
					},
				},
			}
			t.Logf("testing getting team member")
			q1 := &models.GetTeamMembersQuery{OrgId: testOrgID, TeamId: team1.Id, SignedInUser: testUser}
			err = sqlStore.GetTeamMembers(context.Background(), q1)
			require.NoError(t, err)
			require.Equal(t, 0, len(q1.Result))
		}
	})
}

func TestUserFileOutput(t *testing.T) {
}

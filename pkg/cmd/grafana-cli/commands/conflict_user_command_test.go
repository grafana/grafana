package commands

import (
	"context"
	"fmt"
	"io/ioutil"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
	"github.com/urfave/cli/v2"
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
			m, err := GetUsersWithConflictingEmailsOrLogins(&cli.Context{Context: context.Background()}, sqlStore)
			require.NoError(t, err)
			require.Equal(t, 2, len(m))
		}
	})
}

func TestRunValidateConflictUserFile(t *testing.T) {
	t.Run("should validate file thats gets created", func(t *testing.T) {
		// Restore after destructive operation
		sqlStore := sqlstore.InitTestDB(t)

		const testOrgID int64 = 1
		for i := 0; i < 5; i++ {
			cmd := user.CreateUserCommand{
				Email: fmt.Sprint("user", i, "@test.com"),
				Name:  fmt.Sprint("user", i),
				Login: fmt.Sprint("loginuser", i),
				OrgID: testOrgID,
			}
			_, err := sqlStore.CreateUser(context.Background(), cmd)
			require.Nil(t, err)
		}

		// "Skipping conflicting users test for mysql as it does make unique constraint case insensitive by default
		if sqlStore.GetDialect().DriverName() != "mysql" {
			// add additional user with conflicting login where DOMAIN is upper case
			dupUserLogincmd := user.CreateUserCommand{
				Email: "userduplicatetest1@test.com",
				Name:  "user name 1",
				Login: "user_duplicate_test_1_login",
				OrgID: testOrgID,
			}
			_, err := sqlStore.CreateUser(context.Background(), dupUserLogincmd)
			require.NoError(t, err)
			dupUserEmailcmd := user.CreateUserCommand{
				Email: "USERDUPLICATETEST1@TEST.COM",
				Name:  "user name 1",
				Login: "USER_DUPLICATE_TEST_1_LOGIN",
				OrgID: testOrgID,
			}
			_, err = sqlStore.CreateUser(context.Background(), dupUserEmailcmd)
			require.NoError(t, err)

			// get users
			conflictUsers, err := GetUsersWithConflictingEmailsOrLogins(&cli.Context{Context: context.Background()}, sqlStore)
			require.NoError(t, err)
			tmpFile, err := generateConflictUsersFile(&conflictUsers)
			require.NoError(t, err)

			b, err := ioutil.ReadFile(tmpFile.Name())
			require.NoError(t, err)

			newConflicts, validErr := getValidConflictUsers(&cli.Context{Context: context.Background()}, sqlStore, b)
			require.NoError(t, validErr)
			require.Equal(t, 2, len(newConflicts))
		}
	})
}

func TestMarshalConflictUser(t *testing.T) {
	// TODO: add more testcases
	testCases := []struct {
		name         string
		inputRow     string
		expectedUser ConflictingUser
	}{{
		name:     "should be able to marshal expected input row",
		inputRow: "+ id: 4, email: userduplicatetest1@test.com, login: userduplicatetest1@test.com, last_seen_at: 2012-07-26T16:08:11Z, auth_module:",
		expectedUser: ConflictingUser{
			Direction:  "+",
			Id:         "4",
			Email:      "userduplicatetest1@test.com",
			Login:      "userduplicatetest1@test.com",
			LastSeenAt: "2012-07-26T16:08:11Z",
			AuthModule: "",
		},
	}}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			user := ConflictingUser{}
			err := user.Marshal(tc.inputRow)
			require.NoError(t, err)
			require.Equal(t, tc.expectedUser.Direction, user.Direction)
			require.Equal(t, tc.expectedUser.Id, user.Id)
			require.Equal(t, tc.expectedUser.Email, user.Email)
			require.Equal(t, tc.expectedUser.Login, user.Login)
			require.Equal(t, tc.expectedUser.LastSeenAt, user.LastSeenAt)
		})
	}

}

func TestMergeUser(t *testing.T) {
	t.Run("should be able to merge user", func(t *testing.T) {
		// Restore after destructive operation
		sqlStore := sqlstore.InitTestDB(t)
		team1, err := sqlStore.CreateTeam("team1 name", "", 1)
		require.Nil(t, err)
		const testOrgID int64 = 1
		for i := 0; i < 5; i++ {
			cmd := user.CreateUserCommand{
				Email: fmt.Sprint("user", i, "@test.com"),
				Name:  fmt.Sprint("user", i),
				Login: fmt.Sprint("loginuser", i),
				OrgID: testOrgID,
			}
			_, err := sqlStore.CreateUser(context.Background(), cmd)
			require.Nil(t, err)
		}

		// "Skipping conflicting users test for mysql as it does make unique constraint case insensitive by default
		if sqlStore.GetDialect().DriverName() != "mysql" {
			// add additional user with conflicting login where DOMAIN is upper case

			// the order of adding the conflict matters
			dupUserLogincmd := user.CreateUserCommand{
				Email: "userduplicatetest1@test.com",
				Name:  "user name 1",
				Login: "user_duplicate_test_1_login",
				OrgID: testOrgID,
			}
			userWithLowerCase, err := sqlStore.CreateUser(context.Background(), dupUserLogincmd)
			require.NoError(t, err)
			dupUserEmailcmd := user.CreateUserCommand{
				Email: "USERDUPLICATETEST1@TEST.COM",
				Name:  "user name 1",
				Login: "USER_DUPLICATE_TEST_1_LOGIN",
				OrgID: testOrgID,
			}
			userWithUpperCase, err := sqlStore.CreateUser(context.Background(), dupUserEmailcmd)
			require.NoError(t, err)

			// this is the user we want to update to another team
			err = sqlStore.AddTeamMember(userWithUpperCase.ID, testOrgID, team1.Id, false, 0)
			require.NoError(t, err)

			// get users
			conflictUsers, err := GetUsersWithConflictingEmailsOrLogins(&cli.Context{Context: context.Background()}, sqlStore)
			require.NoError(t, err)
			tmpFile, err := generateConflictUsersFile(&conflictUsers)
			require.NoError(t, err)
			// validation to get newConflicts
			b, err := ioutil.ReadFile(tmpFile.Name())
			require.NoError(t, err)
			newConflicts, validErr := getValidConflictUsers(&cli.Context{Context: context.Background()}, sqlStore, b)
			require.NoError(t, validErr)
			require.Equal(t, 2, len(newConflicts))

			// test starts here
			err = newConflicts.MergeConflictingUsers(context.Background(), sqlStore)
			require.NoError(t, err)

			t.Logf("testing getting user with uppercase")
			// user with uppercaseemail should not exist
			query := &models.GetUserByIdQuery{Id: userWithUpperCase.ID}
			err = sqlStore.GetUserById(context.Background(), query)
			require.Error(t, user.ErrUserNotFound, err)

			testUser := &models.SignedInUser{OrgId: testOrgID, Permissions: map[int64]map[string][]string{1: {
				ac.ActionTeamsRead:    []string{ac.ScopeTeamsAll},
				ac.ActionOrgUsersRead: []string{ac.ScopeUsersAll},
			}}}
			t.Logf("testing getting team member")

			// test that we have updated the tables with userWithLowerCaseEmail
			q1 := &models.GetTeamMembersQuery{OrgId: testOrgID, TeamId: team1.Id, SignedInUser: testUser}
			err = sqlStore.GetTeamMembers(context.Background(), q1)
			require.NoError(t, err)
			require.Equal(t, 1, len(q1.Result))
			teamMember := q1.Result[0]
			require.Equal(t, userWithLowerCase.ID, teamMember.UserId)
			require.Equal(t, userWithLowerCase.Email, teamMember.Email)

			// test that we have updated the tables with userWithLowerCaseEmail
			q2 := &models.GetOrgUsersQuery{OrgId: testOrgID, User: testUser}
			err = sqlStore.GetOrgUsers(context.Background(), q2)
			require.NoError(t, err)
			require.Equal(t, 1, len(q1.Result))
			require.Equal(t, userWithLowerCase.ID, teamMember.UserId)
			require.Equal(t, userWithLowerCase.Email, teamMember.Email)
		}
	})
}

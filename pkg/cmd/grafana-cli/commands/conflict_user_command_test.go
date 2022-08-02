package commands

import (
	"context"
	"fmt"
	"testing"

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

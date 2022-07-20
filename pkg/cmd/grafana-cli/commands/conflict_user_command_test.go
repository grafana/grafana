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
			// require metrics and statistics to be 2
			m, err := GetUsersWithConflictingEmailsOrLogins(context.Background(), sqlStore)
			t.Logf("%v+", m)
			require.NoError(t, err)
			require.Equal(t, 1, len(m))
		}
	})
}

package database

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	secretstest "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
)

func TestIntegrationAuthInfoStoreStats(t *testing.T) {
	sql := db.InitTestDB(t)
	cfg := setting.NewCfg()
	InitDuplicateUserMetrics()

	now := time.Now()

	usrStore := userimpl.ProvideStore(sql, cfg)
	for i := 0; i < 5; i++ {
		usr := &user.User{
			Email:      fmt.Sprint("user", i, "@test.com"),
			Login:      fmt.Sprint("user", i),
			Name:       fmt.Sprint("user", i),
			Created:    now,
			Updated:    now,
			LastSeenAt: now,
		}
		_, err := usrStore.Insert(context.Background(), usr)
		require.Nil(t, err)
	}

	var (
		duplicatedUsers    int
		mixedCasedUsers    int
		hasDuplicatedUsers int
	)

	if sql.GetDialect().DriverName() != "mysql" {
		duplicatedUsers, mixedCasedUsers, hasDuplicatedUsers = 2, 1, 1
		_, err := usrStore.Insert(context.Background(), &user.User{
			Email:      "USERDUPLICATETEST1@TEST.COM",
			Name:       "user name 1",
			Login:      "USER_DUPLICATE_TEST_1_LOGIN",
			Created:    now,
			Updated:    now,
			LastSeenAt: now,
		})
		require.NoError(t, err)

		// add additional user with duplicate login where DOMAIN is upper case
		_, err = usrStore.Insert(context.Background(), &user.User{
			Email:      "userduplicatetest1@test.com",
			Name:       "user name 1",
			Login:      "user_duplicate_test_1_login",
			Created:    now,
			Updated:    now,
			LastSeenAt: now,
		})
		require.NoError(t, err)
	}

	store := ProvideAuthInfoStore(sql, secretstest.NewFakeSecretsService(), nil)
	stats, err := store.CollectLoginStats(context.Background())
	require.NoError(t, err)

	require.Equal(t, duplicatedUsers, stats["stats.users.duplicate_user_entries"])
	require.Equal(t, mixedCasedUsers, stats["stats.users.mixed_cased_users"])
	require.Equal(t, hasDuplicatedUsers, stats["stats.users.has_duplicate_user_entries"])
}

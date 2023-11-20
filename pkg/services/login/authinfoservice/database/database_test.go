package database

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/login"
	secretstest "github.com/grafana/grafana/pkg/services/secrets/fakes"
)

func TestIntegrationAuthInfoStore(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	sql := db.InitTestDB(t)
	store := ProvideAuthInfoStore(sql, secretstest.NewFakeSecretsService(), nil)

	t.Run("should remove duplicates on update", func(t *testing.T) {
		ctx := context.Background()
		setCmd := &login.SetAuthInfoCommand{
			AuthModule: login.GenericOAuthModule,
			AuthId:     "1",
			UserId:     1,
		}

		require.NoError(t, store.SetAuthInfo(ctx, setCmd))
		require.NoError(t, store.SetAuthInfo(ctx, setCmd))

		count := countEntries(t, sql, setCmd.AuthModule, setCmd.AuthId, setCmd.UserId)
		require.Equal(t, 2, count)

		err := store.UpdateAuthInfo(ctx, &login.UpdateAuthInfoCommand{
			AuthModule: setCmd.AuthModule,
			AuthId:     setCmd.AuthId,
			UserId:     setCmd.UserId,
			OAuthToken: &oauth2.Token{
				AccessToken:  "atoken",
				RefreshToken: "rtoken",
				Expiry:       time.Now(),
			},
		})
		require.NoError(t, err)

		count = countEntries(t, sql, setCmd.AuthModule, setCmd.AuthId, setCmd.UserId)
		require.Equal(t, 1, count)
	})
}

func countEntries(t *testing.T, sql db.DB, authModule, authID string, userID int64) int {
	var result int

	err := sql.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.SQL(
			"SELECT COUNT(*) FROM user_auth WHERE auth_module = ? AND auth_id = ? AND user_id = ?",
			authModule, authID, userID,
		).Get(&result)
		return err
	})

	require.NoError(t, err)
	return result
}

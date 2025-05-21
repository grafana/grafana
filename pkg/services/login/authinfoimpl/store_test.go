package authinfoimpl

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/login"
	secretstest "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationAuthInfoStore(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	sql := db.InitTestDB(t)
	store := ProvideStore(sql, secretstest.NewFakeSecretsService())

	t.Run("should be able to auth lables for users", func(t *testing.T) {
		ctx := context.Background()
		require.NoError(t, store.SetAuthInfo(ctx, &login.SetAuthInfoCommand{
			AuthModule: login.LDAPAuthModule,
			AuthId:     "1",
			UserId:     1,
		}))
		require.NoError(t, store.SetAuthInfo(ctx, &login.SetAuthInfoCommand{
			AuthModule: login.AzureADAuthModule,
			AuthId:     "1",
			UserId:     1,
		}))
		require.NoError(t, store.SetAuthInfo(ctx, &login.SetAuthInfoCommand{
			AuthModule: login.GoogleAuthModule,
			AuthId:     "10",
			UserId:     2,
		}))

		labels, err := store.GetUserLabels(ctx, login.GetUserLabelsQuery{UserIDs: []int64{1, 2}})
		require.NoError(t, err)
		require.Len(t, labels, 2)

		// There is no guarantee that user with user_id=1 gets "oauth_azuread" or "ldap".
		// Both are valid results for the query (basically SELECT * FROM `user_auth` WHERE `user_id` IN (1,2) ORDER BY created),
		// Spanner emulator will randomize its output, so test cannot rely on the ordering (other than "Created" column, which is equal here).
		require.True(t, labels[1] == login.AzureADAuthModule || labels[1] == login.LDAPAuthModule)
		require.Equal(t, login.GoogleAuthModule, labels[2])
	})

	t.Run("should always get the latest used", func(t *testing.T) {
		ctx := context.Background()
		require.NoError(t, store.SetAuthInfo(ctx, &login.SetAuthInfoCommand{
			AuthModule: login.LDAPAuthModule,
			AuthId:     "1",
			UserId:     1,
		}))

		defer func() {
			GetTime = time.Now
		}()

		GetTime = func() time.Time {
			return time.Now().Add(1 * time.Hour)
		}

		require.NoError(t, store.SetAuthInfo(ctx, &login.SetAuthInfoCommand{
			AuthModule: login.AzureADAuthModule,
			AuthId:     "2",
			UserId:     1,
		}))

		info, err := store.GetAuthInfo(ctx, &login.GetAuthInfoQuery{
			UserId: 1,
		})
		require.NoError(t, err)

		assert.Equal(t, login.AzureADAuthModule, info.AuthModule)
		assert.Equal(t, "2", info.AuthId)
	})

	t.Run("should return error when userID and authID is zero value", func(t *testing.T) {
		ctx := context.Background()
		info, err := store.GetAuthInfo(ctx, &login.GetAuthInfoQuery{
			AuthModule: login.GoogleAuthModule,
		})

		require.ErrorIs(t, err, user.ErrUserNotFound)
		require.Nil(t, info)
	})

	t.Run("should remove duplicates on update", func(t *testing.T) {
		ctx := context.Background()
		setCmd := &login.SetAuthInfoCommand{
			AuthModule: login.GenericOAuthModule,
			AuthId:     "1",
			UserId:     10,
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

package userimpl

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationUserLifecycleRevokesPersonalAccessTokens(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ss, cfg := db.InitTestDBWithCfg(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	userStore := ProvideStore(legacysql.NewDatabaseProvider(ss), cfg)
	ctx := context.Background()

	newUser := func(login string) int64 {
		id, err := userStore.Insert(ctx, &user.User{
			Email: login + "@test.com", Name: login, Login: login, Created: time.Now(), Updated: time.Now(),
		})
		require.NoError(t, err)
		return id
	}
	insertToken := func(uid string, userID int64) {
		err := ss.WithDbSession(ctx, func(sess *db.Session) error {
			_, err := sess.Exec("INSERT INTO personal_access_token (uid, org_id, user_id, name, token_hash, prefix_hint, scopes, created_at) VALUES (?, 1, ?, ?, ?, 'x', '{}', ?)",
				uid, userID, uid, uid+"-hash", time.Now())
			return err
		})
		require.NoError(t, err)
	}
	reason := func(uid string) string {
		var out []string
		err := ss.WithDbSession(ctx, func(sess *db.Session) error {
			return sess.SQL("SELECT revoked_reason FROM personal_access_token WHERE uid = ? AND revoked_at IS NOT NULL", uid).Find(&out)
		})
		require.NoError(t, err)
		if len(out) == 0 {
			return ""
		}
		return out[0]
	}

	u1, u2, u3 := newUser("pat1"), newUser("pat2"), newUser("pat3")
	insertToken("t1", u1)
	insertToken("t2", u2)
	insertToken("t3", u3)

	disabled := true
	require.NoError(t, userStore.Update(ctx, &user.UpdateUserCommand{UserID: u1, IsDisabled: &disabled}))
	require.Equal(t, "user_disabled", reason("t1"))

	require.NoError(t, userStore.BatchDisableUsers(ctx, &user.BatchDisableUsersCommand{UserIDs: []int64{u2}, IsDisabled: true}))
	require.Equal(t, "user_disabled", reason("t2"))

	require.Equal(t, "", reason("t3"))

	pw := "new-password-hash"
	require.NoError(t, userStore.Update(ctx, &user.UpdateUserCommand{UserID: u3, Password: (*user.Password)(&pw)}))
	require.Equal(t, "password_changed", reason("t3"))
}

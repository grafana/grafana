package legacy

import (
	"context"
	"testing"
	"time"

	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationUserMutationsHandlePersonalAccessTokens(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ss := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	store := NewLegacySQLStores(legacysql.NewDatabaseProvider(ss))
	ctx := context.Background()
	ns := claims.NamespaceInfo{Value: "default", OrgID: 1}

	newUser := func(login string) (uid string, id int64) {
		res, err := store.CreateUser(ctx, ns, CreateUserCommand{UID: login + "-uid", Login: login, Email: login + "@test.com", Name: login})
		require.NoError(t, err)
		return res.User.UID, res.User.ID
	}
	insertToken := func(uid string, userID int64) {
		require.NoError(t, ss.WithDbSession(ctx, func(sess *db.Session) error {
			_, err := sess.Exec("INSERT INTO personal_access_token (uid, org_id, user_id, name, token_hash, prefix_hint, scopes, created_at) VALUES (?, 1, ?, ?, ?, 'x', '{}', ?)",
				uid, userID, uid, uid+"-hash", time.Now())
			return err
		}))
	}
	state := func(uid string) (exists bool, reason string) {
		var rows []string
		require.NoError(t, ss.WithDbSession(ctx, func(sess *db.Session) error {
			return sess.SQL("SELECT COALESCE(revoked_reason, '') FROM personal_access_token WHERE uid = ?", uid).Find(&rows)
		}))
		if len(rows) == 0 {
			return false, ""
		}
		return true, rows[0]
	}

	uidA, idA := newUser("iamA")
	uidB, idB := newUser("iamB")
	insertToken("tokA", idA)
	insertToken("tokB", idB)

	_, err := store.UpdateUser(ctx, ns, UpdateUserCommand{UID: uidA, Login: "iama", Email: "iama@test.com", Name: "iamA", IsDisabled: true})
	require.NoError(t, err)
	_, reason := state("tokA")
	require.Equal(t, "user_disabled", reason)
	_, reason = state("tokB")
	require.Equal(t, "", reason)

	require.NoError(t, store.DeleteUser(ctx, ns, DeleteUserCommand{UID: uidB}))
	exists, _ := state("tokB")
	require.False(t, exists)
}

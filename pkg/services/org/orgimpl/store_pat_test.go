package orgimpl

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationOrgLifecycleHandlesPersonalAccessTokens(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ss, cfg := db.InitTestDBWithCfg(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	store := sqlStore{sql: legacysql.NewDatabaseProvider(ss), log: log.NewNopLogger()}
	orgSvc, usrSvc := createOrgAndUserSvc(t, ss, cfg)
	ctx := context.Background()

	o1, err := orgSvc.CreateWithMember(ctx, &org.CreateOrgCommand{Name: MainOrgName})
	require.NoError(t, err)
	o2, err := orgSvc.CreateWithMember(ctx, &org.CreateOrgCommand{Name: "pat org 2"})
	require.NoError(t, err)
	u, err := usrSvc.Create(ctx, &user.CreateUserCommand{Login: "patuser", SkipOrgSetup: true})
	require.NoError(t, err)
	for _, id := range []int64{o1.ID, o2.ID} {
		require.NoError(t, store.AddOrgUser(ctx, &org.AddOrgUserCommand{OrgID: id, UserID: u.ID, Role: org.RoleViewer}))
	}

	insertToken := func(uid string, orgID, userID int64) {
		require.NoError(t, ss.WithDbSession(ctx, func(sess *db.Session) error {
			_, err := sess.Exec("INSERT INTO personal_access_token (uid, org_id, user_id, name, token_hash, prefix_hint, scopes, created_at) VALUES (?, ?, ?, ?, ?, 'x', '{}', ?)",
				uid, orgID, userID, uid, uid+"-hash", time.Now())
			return err
		}))
	}
	state := func(uid string) (exists bool, reason string) {
		var rows []struct {
			Reason string `xorm:"revoked_reason"`
		}
		require.NoError(t, ss.WithDbSession(ctx, func(sess *db.Session) error {
			return sess.SQL("SELECT COALESCE(revoked_reason, '') AS revoked_reason FROM personal_access_token WHERE uid = ?", uid).Find(&rows)
		}))
		if len(rows) == 0 {
			return false, ""
		}
		return true, rows[0].Reason
	}

	insertToken("in-org1", o1.ID, u.ID)
	insertToken("in-org2", o2.ID, u.ID)

	t.Run("removing a user from an org revokes only that org's tokens", func(t *testing.T) {
		require.NoError(t, store.RemoveOrgUser(ctx, &org.RemoveOrgUserCommand{OrgID: o1.ID, UserID: u.ID, ShouldDeleteOrphanedUser: false}))
		_, reason := state("in-org1")
		require.Equal(t, "org_removed", reason)
		_, reason = state("in-org2")
		require.Equal(t, "", reason)
	})

	t.Run("deleting an org deletes its tokens", func(t *testing.T) {
		require.NoError(t, store.Delete(ctx, &org.DeleteOrgCommand{ID: o2.ID}))
		exists, _ := state("in-org2")
		require.False(t, exists)
	})

	t.Run("deleting an orphaned user deletes their tokens", func(t *testing.T) {
		require.NoError(t, store.AddOrgUser(ctx, &org.AddOrgUserCommand{OrgID: o1.ID, UserID: u.ID, Role: org.RoleViewer}))
		insertToken("owned", o1.ID, u.ID)
		cmd := &org.RemoveOrgUserCommand{OrgID: o1.ID, UserID: u.ID, ShouldDeleteOrphanedUser: true}
		require.NoError(t, store.RemoveOrgUser(ctx, cmd))
		require.True(t, cmd.UserWasDeleted)
		exists, _ := state("owned")
		require.False(t, exists)
	})
}

package authimpl

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationUserAuthTokenCleanup(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	setup := func() *testContext {
		ctx := createTestContext(t)
		maxInactiveLifetime, _ := time.ParseDuration("168h")
		maxLifetime, _ := time.ParseDuration("720h")
		ctx.cfg.LoginMaxInactiveLifetime = maxInactiveLifetime
		ctx.cfg.LoginMaxLifetime = maxLifetime
		return ctx
	}

	insertToken := func(ctx *testContext, token string, createdAt, seenAt int64) {
		ut := userAuthToken{AuthToken: token, CreatedAt: createdAt, SeenAt: seenAt, UserAgent: "", ClientIp: ""}
		err := ctx.sqlstore.WithDbSession(context.Background(), func(sess *db.Session) error {
			_, err := sess.Insert(&ut)
			require.Nil(t, err)
			return nil
		})
		require.NoError(t, err)
	}

	now := time.Date(2018, 12, 13, 13, 45, 0, 0, time.UTC)
	getTime = func() time.Time { return now }
	t.Cleanup(func() { getTime = time.Now })

	t.Run("should delete tokens where last activity is older than or equal 7 days", func(t *testing.T) {
		ctx := setup()
		from := now.Add(-168 * time.Hour)

		// insert three old tokens that should be deleted
		for i := range 3 {
			insertToken(ctx, fmt.Sprintf("oldA%d", i), from.Unix(), from.Unix())
		}

		// insert three active tokens that should not be deleted
		for i := range 3 {
			from = from.Add(time.Second)
			insertToken(ctx, fmt.Sprintf("newA%d", i), from.Unix(), from.Unix())
		}

		affected, err := ctx.tokenService.deleteExpiredTokens(context.Background(), 168*time.Hour, 30*24*time.Hour)
		require.Nil(t, err)
		require.Equal(t, int64(3), affected)
	})

	t.Run("should delete tokens where token age is older than or equal 30 days", func(t *testing.T) {
		ctx := setup()
		from := now.Add(-30 * 24 * time.Hour)
		lastActivity := now.Add(-time.Second)

		// insert three old tokens that should be deleted
		for i := range 3 {
			insertToken(ctx, fmt.Sprintf("oldA%d", i), from.Unix(), lastActivity.Unix())
		}

		// insert three active tokens that should not be deleted
		for i := range 3 {
			from = from.Add(time.Second)
			insertToken(ctx, fmt.Sprintf("newA%d", i), from.Unix(), lastActivity.Unix())
		}

		affected, err := ctx.tokenService.deleteExpiredTokens(context.Background(), 7*24*time.Hour, 30*24*time.Hour)
		require.Nil(t, err)
		require.Equal(t, int64(3), affected)
	})
}

func TestIntegrationOrphanedExternalSessionsCleanup(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	setup := func() *testContext {
		ctx := createTestContext(t)
		return ctx
	}

	insertExternalSession := func(ctx *testContext, id int64) {
		es := &auth.ExternalSession{ID: id, UserAuthID: 1, UserID: 1}
		err := ctx.sqlstore.WithDbSession(context.Background(), func(sess *db.Session) error {
			_, err := sess.Insert(es)
			require.Nil(t, err)
			return nil
		})
		require.NoError(t, err)
	}

	insertAuthToken := func(ctx *testContext, token string, externalSessionId int64) {
		ut := userAuthToken{AuthToken: token, ExternalSessionId: externalSessionId}
		err := ctx.sqlstore.WithDbSession(context.Background(), func(sess *db.Session) error {
			_, err := sess.Insert(&ut)
			require.Nil(t, err)
			return nil
		})
		require.NoError(t, err)
	}

	t.Run("should delete orphaned external sessions", func(t *testing.T) {
		ctx := setup()

		// insert three external sessions
		for i := int64(1); i <= 3; i++ {
			insertExternalSession(ctx, i)
		}

		// insert two auth tokens linked to external sessions
		insertAuthToken(ctx, "token1", 1)
		insertAuthToken(ctx, "token2", 2)

		// delete orphaned external sessions
		err := ctx.tokenService.deleteOrphanedExternalSessions(context.Background())
		require.NoError(t, err)

		// verify that only the orphaned external session is deleted
		var count int64
		err = ctx.sqlstore.WithDbSession(context.Background(), func(sess *db.Session) error {
			count, err = sess.Count(&auth.ExternalSession{})
			require.Nil(t, err)
			return nil
		})
		require.NoError(t, err)
		require.Equal(t, int64(2), count)
	})
}

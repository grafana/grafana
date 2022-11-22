package authimpl

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
)

func TestUserAuthTokenCleanup(t *testing.T) {
	setup := func() *testContext {
		ctx := createTestContext(t)
		maxInactiveLifetime, _ := time.ParseDuration("168h")
		maxLifetime, _ := time.ParseDuration("720h")
		ctx.tokenService.cfg.LoginMaxInactiveLifetime = maxInactiveLifetime
		ctx.tokenService.cfg.LoginMaxLifetime = maxLifetime
		return ctx
	}

	insertToken := func(ctx *testContext, token string, prev string, createdAt, rotatedAt int64) {
		ut := userAuthToken{AuthToken: token, PrevAuthToken: prev, CreatedAt: createdAt, RotatedAt: rotatedAt, UserAgent: "", ClientIp: ""}
		err := ctx.sqlstore.WithDbSession(context.Background(), func(sess *db.Session) error {
			_, err := sess.Insert(&ut)
			require.Nil(t, err)
			return nil
		})
		require.NoError(t, err)
	}

	now := time.Date(2018, 12, 13, 13, 45, 0, 0, time.UTC)
	getTime = func() time.Time { return now }

	t.Run("should delete tokens where token rotation age is older than or equal 7 days", func(t *testing.T) {
		ctx := setup()
		from := now.Add(-168 * time.Hour)

		// insert three old tokens that should be deleted
		for i := 0; i < 3; i++ {
			insertToken(ctx, fmt.Sprintf("oldA%d", i), fmt.Sprintf("oldB%d", i), from.Unix(), from.Unix())
		}

		// insert three active tokens that should not be deleted
		for i := 0; i < 3; i++ {
			from = from.Add(time.Second)
			insertToken(ctx, fmt.Sprintf("newA%d", i), fmt.Sprintf("newB%d", i), from.Unix(), from.Unix())
		}

		affected, err := ctx.tokenService.deleteExpiredTokens(context.Background(), 168*time.Hour, 30*24*time.Hour)
		require.Nil(t, err)
		require.Equal(t, int64(3), affected)
	})

	t.Run("should delete tokens where token age is older than or equal 30 days", func(t *testing.T) {
		ctx := setup()
		from := now.Add(-30 * 24 * time.Hour)
		fromRotate := now.Add(-time.Second)

		// insert three old tokens that should be deleted
		for i := 0; i < 3; i++ {
			insertToken(ctx, fmt.Sprintf("oldA%d", i), fmt.Sprintf("oldB%d", i), from.Unix(), fromRotate.Unix())
		}

		// insert three active tokens that should not be deleted
		for i := 0; i < 3; i++ {
			from = from.Add(time.Second)
			insertToken(ctx, fmt.Sprintf("newA%d", i), fmt.Sprintf("newB%d", i), from.Unix(), fromRotate.Unix())
		}

		affected, err := ctx.tokenService.deleteExpiredTokens(context.Background(), 7*24*time.Hour, 30*24*time.Hour)
		require.Nil(t, err)
		require.Equal(t, int64(3), affected)
	})
}

package auth

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestUserAuthTokenCleanup(t *testing.T) {
	t.Run("Test user auth token cleanup", func(t *testing.T) {
		ctx := createTestContext(t)
		maxInactiveLifetime, _ := time.ParseDuration("168h")
		maxLifetime, _ := time.ParseDuration("720h")
		ctx.tokenService.Cfg.LoginMaxInactiveLifetime = maxInactiveLifetime
		ctx.tokenService.Cfg.LoginMaxLifetime = maxLifetime

		insertToken := func(token string, prev string, createdAt, rotatedAt int64) {
			ut := userAuthToken{AuthToken: token, PrevAuthToken: prev, CreatedAt: createdAt, RotatedAt: rotatedAt, UserAgent: "", ClientIp: ""}
			_, err := ctx.sqlstore.NewSession(context.Background()).Insert(&ut)
			require.NoError(t, err)
		}

		t := time.Date(2018, 12, 13, 13, 45, 0, 0, time.UTC)
		getTime = func() time.Time {
			return t
		}

		t.Run("should delete tokens where token rotation age is older than or equal 7 days", func(t *testing.T) {
			from := t.Add(-168 * time.Hour)

			// insert three old tokens that should be deleted
			for i := 0; i < 3; i++ {
				insertToken(fmt.Sprintf("oldA%d", i), fmt.Sprintf("oldB%d", i), from.Unix(), from.Unix())
			}

			// insert three active tokens that should not be deleted
			for i := 0; i < 3; i++ {
				from = from.Add(time.Second)
				insertToken(fmt.Sprintf("newA%d", i), fmt.Sprintf("newB%d", i), from.Unix(), from.Unix())
			}

			affected, err := ctx.tokenService.deleteExpiredTokens(context.Background(), 168*time.Hour, 30*24*time.Hour)
			require.NoError(t, err)
			require.Equal(t, 3, affected)
		})

		t.Run("should delete tokens where token age is older than or equal 30 days", func(t *testing.T) {
			from := t.Add(-30 * 24 * time.Hour)
			fromRotate := t.Add(-time.Second)

			// insert three old tokens that should be deleted
			for i := 0; i < 3; i++ {
				insertToken(fmt.Sprintf("oldA%d", i), fmt.Sprintf("oldB%d", i), from.Unix(), fromRotate.Unix())
			}

			// insert three active tokens that should not be deleted
			for i := 0; i < 3; i++ {
				from = from.Add(time.Second)
				insertToken(fmt.Sprintf("newA%d", i), fmt.Sprintf("newB%d", i), from.Unix(), fromRotate.Unix())
			}

			affected, err := ctx.tokenService.deleteExpiredTokens(context.Background(), 7*24*time.Hour, 30*24*time.Hour)
			require.NoError(t, err)
			require.Equal(t, 3, affected)
		})
	})
}

package authimpl

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationStableSession(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	start := time.Date(2026, 9, 14, 12, 0, 0, 0, time.UTC)
	now := start
	getTime = func() time.Time { return now }
	t.Cleanup(func() { getTime = time.Now })

	setup := func(t *testing.T) (*testContext, *auth.UserToken) {
		t.Helper()
		now = start
		ctx := createTestContext(t)
		ctx.cfg.LoginMaxInactiveLifetime = 10 * time.Minute
		ctx.cfg.LoginMaxLifetime = time.Hour
		token, err := ctx.tokenService.CreateToken(context.Background(), &auth.CreateTokenCommand{User: &user.User{ID: 10}})
		require.NoError(t, err)
		return ctx, token
	}

	t.Run("activity extends idle lifetime with an unchanged credential", func(t *testing.T) {
		ctx, original := setup(t)
		for elapsed := 5 * time.Minute; elapsed <= 55*time.Minute; elapsed += 5 * time.Minute {
			now = start.Add(elapsed)
			token, err := ctx.tokenService.LookupToken(context.Background(), original.UnhashedToken)
			require.NoError(t, err)
			require.Equal(t, original.Id, token.Id)
			require.Equal(t, original.UnhashedToken, token.UnhashedToken)
			require.Equal(t, original.AuthToken, token.AuthToken)
		}
		stored, err := ctx.getAuthTokenByID(original.Id)
		require.NoError(t, err)
		require.Equal(t, start.Add(55*time.Minute).Unix(), stored.SeenAt)
		require.Equal(t, start.Unix(), stored.CreatedAt)
		count, err := ctx.tokenService.ActiveTokenCount(context.Background(), nil)
		require.NoError(t, err)
		require.Equal(t, int64(1), count)

		now = start.Add(time.Hour)
		_, err = ctx.tokenService.LookupToken(context.Background(), original.UnhashedToken)
		require.ErrorAs(t, err, new(*auth.TokenExpiredError))
		count, err = ctx.tokenService.ActiveTokenCount(context.Background(), nil)
		require.NoError(t, err)
		require.Zero(t, count)
		deleted, err := ctx.tokenService.deleteExpiredTokens(context.Background(), ctx.cfg.LoginMaxInactiveLifetime, ctx.cfg.LoginMaxLifetime)
		require.NoError(t, err)
		require.Equal(t, int64(1), deleted)
	})

	t.Run("idle expiry cannot be renewed by presenting the cookie", func(t *testing.T) {
		ctx, token := setup(t)
		now = start.Add(10 * time.Minute)
		_, err := ctx.tokenService.LookupToken(context.Background(), token.UnhashedToken)
		require.ErrorAs(t, err, new(*auth.TokenExpiredError))
		stored, err := ctx.getAuthTokenByID(token.Id)
		require.NoError(t, err)
		require.Equal(t, start.Unix(), stored.SeenAt)
		tokens, err := ctx.tokenService.GetUserTokens(context.Background(), token.UserId)
		require.NoError(t, err)
		require.Empty(t, tokens)
	})

	t.Run("coalesces activity writes", func(t *testing.T) {
		ctx, token := setup(t)
		now = start.Add(30 * time.Second)
		_, err := ctx.tokenService.LookupToken(context.Background(), token.UnhashedToken)
		require.NoError(t, err)
		stored, err := ctx.getAuthTokenByID(token.Id)
		require.NoError(t, err)
		require.Equal(t, start.Unix(), stored.SeenAt)
		now = start.Add(time.Minute)
		_, err = ctx.tokenService.LookupToken(context.Background(), token.UnhashedToken)
		require.NoError(t, err)
		stored, err = ctx.getAuthTokenByID(token.Id)
		require.NoError(t, err)
		require.Equal(t, start.Add(time.Minute).Unix(), stored.SeenAt)
	})

	t.Run("concurrent requests on multiple service instances share the same credential", func(t *testing.T) {
		ctx, token := setup(t)
		now = start.Add(2 * time.Minute)
		secondInstance := *ctx.tokenService
		services := []*UserAuthTokenService{ctx.tokenService, &secondInstance}
		var wg sync.WaitGroup
		results := make(chan *auth.UserToken, 8)
		errors := make(chan error, 8)
		for i := range 8 {
			wg.Go(func() {
				result, err := services[i%2].LookupToken(context.Background(), token.UnhashedToken)
				results <- result
				errors <- err
			})
		}
		wg.Wait()
		for range 8 {
			require.NoError(t, <-errors)
			result := <-results
			require.Equal(t, token.UnhashedToken, result.UnhashedToken)
			require.Equal(t, token.Id, result.Id)
		}
		stored, err := ctx.getAuthTokenByID(token.Id)
		require.NoError(t, err)
		require.Equal(t, start.Add(2*time.Minute).Unix(), stored.SeenAt)
		require.Equal(t, token.AuthToken, stored.AuthToken)
	})

	t.Run("revocation invalidates a copied credential", func(t *testing.T) {
		ctx, token := setup(t)
		now = start.Add(2 * time.Minute)
		require.NoError(t, ctx.tokenService.RevokeToken(context.Background(), token, true))
		_, err := ctx.tokenService.LookupToken(context.Background(), token.UnhashedToken)
		require.ErrorAs(t, err, new(*auth.TokenRevokedError))
		stored, err := ctx.getAuthTokenByID(token.Id)
		require.NoError(t, err)
		require.Equal(t, start.Unix(), stored.SeenAt)
		require.NoError(t, ctx.tokenService.RevokeToken(context.Background(), token, false))
		_, err = ctx.tokenService.LookupToken(context.Background(), token.UnhashedToken)
		require.ErrorIs(t, err, auth.ErrUserTokenNotFound)
	})
}

package personalaccesstokens

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"strings"
	"time"

	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/patstore"
	"github.com/grafana/grafana/pkg/services/user"
)

const (
	revalidateConcurrency = 4
	revalidateJitterMax   = 2 * time.Second
)

// RevalidateIdP revokes the tokens of owners authenticated by an external OAuth provider whose
// provider session can no longer be renewed: the stored access token expired and there is no
// refresh token. Locally authenticated owners are skipped. The provider is not contacted, so a
// provider-side revocation is only detected through the refresh failure hook or logout.
func (m *Maintenance) RevalidateIdP(ctx context.Context) error {
	if m.authInfo == nil {
		return nil
	}
	tokens, err := m.store.ListActive(ctx)
	if err != nil {
		return fmt.Errorf("failed to list active tokens: %w", err)
	}
	owners := map[int64]struct{}{}
	for _, t := range tokens {
		owners[t.UserID] = struct{}{}
	}

	var g errgroup.Group
	g.SetLimit(revalidateConcurrency)
	for id := range owners {
		g.Go(func() error {
			// Spread provider-bound lookups so many owners don't hit the database at once.
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(time.Duration(rand.Int64N(int64(revalidateJitterMax)))):
			}
			m.revalidateOwner(ctx, id)
			return nil
		})
	}
	return g.Wait()
}

func (m *Maintenance) revalidateOwner(ctx context.Context, userID int64) {
	info, err := m.authInfo.GetAuthInfo(ctx, &login.GetAuthInfoQuery{UserId: userID})
	if err != nil {
		if !errors.Is(err, user.ErrUserNotFound) {
			m.log.Warn("Failed to look up auth info for personal access token owner", "error", err, "user_id", userID)
		}
		return
	}
	if !strings.HasPrefix(info.AuthModule, "oauth_") {
		return
	}
	if info.OAuthExpiry.IsZero() || m.now().Before(info.OAuthExpiry) || info.OAuthRefreshToken != "" {
		return
	}
	if _, err := m.store.RevokeAllForUser(ctx, userID, patstore.ReasonIDPRevoked); err != nil {
		m.log.Error("Failed to revoke personal access tokens of owner with expired IdP session", "error", err, "user_id", userID)
		return
	}
	m.log.Warn("Revoked personal access tokens: IdP session expired", "audit", true, "action", "idp_revalidate", "user_id", userID, "auth_module", info.AuthModule)
}

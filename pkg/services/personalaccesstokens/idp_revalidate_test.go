package personalaccesstokens

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/patstore"
	"github.com/grafana/grafana/pkg/services/user"
)

type revalStore struct {
	patstore.Store
	mu      sync.Mutex
	active  []*patstore.Token
	revoked map[int64]string
}

func (s *revalStore) ListActive(context.Context) ([]*patstore.Token, error) { return s.active, nil }
func (s *revalStore) RevokeAllForUser(_ context.Context, id int64, reason string) (int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.revoked[id] = reason
	return 1, nil
}

type fakeAuthInfo struct {
	login.AuthInfoService
	byUser map[int64]*login.UserAuth
}

func (f fakeAuthInfo) GetAuthInfo(_ context.Context, q *login.GetAuthInfoQuery) (*login.UserAuth, error) {
	if a, ok := f.byUser[q.UserId]; ok {
		return a, nil
	}
	return nil, user.ErrUserNotFound
}

func TestRevalidateIdP(t *testing.T) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	past, future := now.Add(-time.Hour), now.Add(time.Hour)
	st := &revalStore{revoked: map[int64]string{}, active: []*patstore.Token{
		{ID: 1, UserID: 1}, {ID: 2, UserID: 2}, {ID: 3, UserID: 3}, {ID: 4, UserID: 4}, {ID: 5, UserID: 5}, {ID: 6, UserID: 1},
	}}
	m := &Maintenance{store: st, log: log.NewNopLogger(), now: func() time.Time { return now }, authInfo: fakeAuthInfo{byUser: map[int64]*login.UserAuth{
		1: {AuthModule: "oauth_generic_oauth", OAuthExpiry: past},                         // expired, no refresh token
		2: {AuthModule: "oauth_generic_oauth", OAuthExpiry: past, OAuthRefreshToken: "r"}, // refreshable
		3: {AuthModule: "oauth_generic_oauth", OAuthExpiry: future},                       // still valid
		4: {AuthModule: "ldap", OAuthExpiry: past},                                        // not OAuth
		// 5: local user, no auth info
	}}}

	require.NoError(t, m.RevalidateIdP(context.Background()))
	require.Equal(t, map[int64]string{1: patstore.ReasonIDPRevoked}, st.revoked)
}

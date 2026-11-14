package personalaccesstokens

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/personalaccesstokens/patscope"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/patstore"
	"github.com/grafana/grafana/pkg/setting"
)

type memStore struct {
	patstore.Store
	tokens []*patstore.Token
}

func (m *memStore) Create(_ context.Context, c patstore.CreateCommand) (*patstore.Token, error) {
	t := &patstore.Token{ID: int64(len(m.tokens) + 1), UID: "uid", UserID: c.UserID, OrgID: c.OrgID, Name: c.Name,
		TokenHash: c.TokenHash, Scopes: c.Scopes, ExpiresAt: c.ExpiresAt}
	m.tokens = append(m.tokens, t)
	return t, nil
}

func (m *memStore) CountActiveByUser(context.Context, int64, int64) (int64, error) {
	return int64(len(m.tokens)), nil
}

func (m *memStore) Revoke(_ context.Context, _, _ int64, uid, _ string) error {
	if uid != "uid" {
		return patstore.ErrNotFound
	}
	return nil
}

type cfgPolicy struct{ cfg *setting.Cfg }

func (p cfgPolicy) InstanceEnabled(context.Context) bool { return p.cfg.PersonalAccessTokens.Enabled }
func (p cfgPolicy) OrgEnabled(context.Context, int64) bool {
	return p.cfg.PersonalAccessTokens.Enabled
}

func newSvc(mut func(*setting.PersonalAccessTokensSettings)) (*ServiceImpl, *memStore) {
	cfg := setting.NewCfg()
	cfg.PersonalAccessTokens = setting.PersonalAccessTokensSettings{
		Enabled: true, DefaultLifetimeDays: 30, MaxLifetimeDays: 90, MaxTokensPerUser: 2,
	}
	if mut != nil {
		mut(&cfg.PersonalAccessTokens)
	}
	st := &memStore{}
	s := ProvideService(st, cfg, cfgPolicy{cfg})
	s.now = func() time.Time { return time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC) }
	return s, st
}

var (
	actor = Actor{UserID: 1, OrgID: 1}
	owner = map[string][]string{"dashboards:read": {"dashboards:*"}, "users:write": {"users:*"}}
)

func TestCreate(t *testing.T) {
	ctx := context.Background()

	t.Run("stores only hash and returns secret once", func(t *testing.T) {
		s, st := newSvc(nil)
		res, err := s.Create(ctx, actor, CreateRequest{Name: "ci", Scopes: patscope.Scopes{"dashboards:read": nil}, OwnerPermissions: owner})
		require.NoError(t, err)
		require.True(t, len(res.Secret) > 10)
		require.NotEqual(t, res.Secret, st.tokens[0].TokenHash)
		require.Equal(t, time.Date(2026, 1, 31, 0, 0, 0, 0, time.UTC), *res.Token.ExpiresAt)
	})

	tests := []struct {
		name string
		mut  func(*setting.PersonalAccessTokensSettings)
		req  CreateRequest
	}{
		{"feature disabled", func(c *setting.PersonalAccessTokensSettings) { c.Enabled = false }, CreateRequest{Name: "a"}},
		{"empty name", nil, CreateRequest{Name: "  "}},
		{"lifetime over max", nil, CreateRequest{Name: "a", LifetimeDays: 91}},
		{"no expiry not allowed", nil, CreateRequest{Name: "a", LifetimeDays: -1}},
		{"scopes required", func(c *setting.PersonalAccessTokensSettings) { c.RequireScopes = true }, CreateRequest{Name: "a"}},
		{"scope exceeds owner", nil, CreateRequest{Name: "a", Scopes: patscope.Scopes{"alert.rules:write": nil}, OwnerPermissions: owner}},
		{"denied action without admin switch", nil, CreateRequest{Name: "a", Scopes: patscope.Scopes{"users:write": nil}, OwnerPermissions: owner}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s, st := newSvc(tt.mut)
			_, err := s.Create(ctx, actor, tt.req)
			require.Error(t, err)
			require.Empty(t, st.tokens)
		})
	}

	t.Run("no expiry when allowed", func(t *testing.T) {
		s, _ := newSvc(func(c *setting.PersonalAccessTokensSettings) { c.AllowNoExpiry = true })
		res, err := s.Create(ctx, actor, CreateRequest{Name: "a", LifetimeDays: -1})
		require.NoError(t, err)
		require.Nil(t, res.Token.ExpiresAt)
	})

	t.Run("per-user limit", func(t *testing.T) {
		s, _ := newSvc(nil)
		for range 2 {
			_, err := s.Create(ctx, actor, CreateRequest{Name: "a"})
			require.NoError(t, err)
		}
		_, err := s.Create(ctx, actor, CreateRequest{Name: "a"})
		require.ErrorIs(t, err, ErrLimit)
	})

	t.Run("creation rate limit", func(t *testing.T) {
		s, _ := newSvc(func(c *setting.PersonalAccessTokensSettings) { c.MaxTokensPerUser = 0 })
		var err error
		for range 6 {
			_, err = s.Create(ctx, actor, CreateRequest{Name: "a"})
		}
		require.ErrorIs(t, err, ErrRateLimited)
	})
}

func TestRevokeNotFound(t *testing.T) {
	s, _ := newSvc(nil)
	require.ErrorIs(t, s.Revoke(context.Background(), actor, 1, "nope", patstore.ReasonUser), ErrNotFound)
	require.NoError(t, s.Revoke(context.Background(), actor, 1, "uid", patstore.ReasonUser))
}

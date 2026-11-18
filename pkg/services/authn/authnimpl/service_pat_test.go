package authnimpl

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/clients"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/patstore"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/pattoken"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
)

type patTestStore struct {
	patstore.Store
	tokens map[string]*patstore.Token
}

func (s *patTestStore) GetByHash(_ context.Context, hash string) (*patstore.Token, error) {
	if t, ok := s.tokens[hash]; ok {
		return t, nil
	}
	return nil, patstore.ErrNotFound
}

func (s *patTestStore) TouchLastUsed(context.Context, int64, patstore.UsageInfo) error { return nil }

// bearerCatchAll mimics the API key client, which claims every bearer token and runs after the PAT client.
type bearerCatchAll struct{}

func (bearerCatchAll) Name() string                              { return "catchall" }
func (bearerCatchAll) IsEnabled(context.Context) bool            { return true }
func (bearerCatchAll) Priority() uint                            { return 30 }
func (bearerCatchAll) Test(context.Context, *authn.Request) bool { return true }
func (bearerCatchAll) Authenticate(context.Context, *authn.Request) (*authn.Identity, error) {
	return nil, errors.New("invalid")
}

func TestServicePersonalTokenAuthentication(t *testing.T) {
	now := time.Now()
	past := now.Add(-time.Hour)

	tests := []struct {
		name     string
		enabled  bool
		mutate   func(*patstore.Token)
		ownerOff bool
		orgs     []*org.UserOrgDTO
		wantErr  bool
	}{
		{name: "valid", enabled: true},
		{name: "policy off", enabled: false, wantErr: true},
		{name: "expired", enabled: true, mutate: func(tk *patstore.Token) { tk.ExpiresAt = &past }, wantErr: true},
		{name: "revoked", enabled: true, mutate: func(tk *patstore.Token) { tk.RevokedAt = &past }, wantErr: true},
		{name: "owner disabled", enabled: true, ownerOff: true, wantErr: true},
		{name: "owner removed from org", enabled: true, orgs: []*org.UserOrgDTO{{OrgID: 9}}, wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tok, err := pattoken.New()
			require.NoError(t, err)
			stored := &patstore.Token{ID: 1, UID: "u", UserID: 3, OrgID: 1, TokenHash: tok.Hash, Scopes: `{"dashboards:read":[]}`}
			if tt.mutate != nil {
				tt.mutate(stored)
			}
			orgs := tt.orgs
			if orgs == nil {
				orgs = []*org.UserOrgDTO{{OrgID: 1}}
			}
			client := clients.ProvidePersonalToken(
				&patTestStore{tokens: map[string]*patstore.Token{tok.Hash: stored}},
				&usertest.FakeUserService{ExpectedUser: &user.User{ID: 3, IsDisabled: tt.ownerOff}},
				&orgtest.FakeOrgService{ExpectedUserOrgDTO: orgs},
				func(context.Context) bool { return tt.enabled },
				func(context.Context, int64) bool { return true },
				func() bool { return false },
				noop.NewTracerProvider().Tracer("t"),
			)
			svc := setupTests(t, func(s *Service) {
				s.RegisterClient(client)
				s.RegisterClient(bearerCatchAll{})
			})

			h := http.Header{}
			h.Set("Authorization", "Bearer "+tok.Secret)
			req := &authn.Request{HTTPRequest: &http.Request{Header: h, Method: http.MethodGet, URL: &url.URL{Path: "/api/dashboards/home"}}}
			ident, err := svc.Authenticate(context.Background(), req)
			if tt.wantErr {
				require.Error(t, err)
				require.Nil(t, ident)
				require.NotContains(t, err.Error(), tok.Secret)
				return
			}
			require.NoError(t, err)
			require.Equal(t, "3", ident.ID)
			require.Contains(t, ident.PersonalTokenScopes, "dashboards:read")
		})
	}
}

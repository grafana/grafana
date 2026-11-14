package clients

import (
	"context"
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/patstore"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/pattoken"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
)

type fakePATStore struct {
	patstore.Store
	tokens  map[string]*patstore.Token
	touched chan int64
}

func (f *fakePATStore) GetByHash(_ context.Context, hash string) (*patstore.Token, error) {
	if t, ok := f.tokens[hash]; ok {
		return t, nil
	}
	return nil, patstore.ErrNotFound
}

func (f *fakePATStore) TouchLastUsed(_ context.Context, id int64, _ patstore.UsageInfo) error {
	f.touched <- id
	return nil
}

func TestPersonalToken_Authenticate(t *testing.T) {
	now := time.Now()
	past, future := now.Add(-time.Hour), now.Add(time.Hour)

	tests := []struct {
		name       string
		enabled    bool
		mutate     func(*patstore.Token)
		unknown    bool
		ownerOff   bool
		orgOff     bool
		ownerOrgs  []*org.UserOrgDTO
		reqOrg     int64
		wantErr    bool
		wantTouch  bool
		lastUsedAt *time.Time
	}{
		{name: "valid", enabled: true, wantTouch: true},
		{name: "recently used skips touch", enabled: true, lastUsedAt: &now},
		{name: "feature off", enabled: false, wantErr: true},
		{name: "unknown token", enabled: true, unknown: true, wantErr: true},
		{name: "expired", enabled: true, mutate: func(tk *patstore.Token) { tk.ExpiresAt = &past }, wantErr: true},
		{name: "not expired", enabled: true, mutate: func(tk *patstore.Token) { tk.ExpiresAt = &future }, wantTouch: true},
		{name: "revoked", enabled: true, mutate: func(tk *patstore.Token) { tk.RevokedAt = &past }, wantErr: true},
		{name: "wrong org requested", enabled: true, reqOrg: 2, wantErr: true},
		{name: "org switch off", enabled: true, orgOff: true, wantErr: true},
		{name: "owner disabled", enabled: true, ownerOff: true, wantErr: true},
		{name: "owner left org", enabled: true, ownerOrgs: []*org.UserOrgDTO{{OrgID: 5}}, wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tok, err := pattoken.New()
			require.NoError(t, err)
			stored := &patstore.Token{ID: 7, UID: "u", UserID: 3, OrgID: 1, TokenHash: tok.Hash, LastUsedAt: tt.lastUsedAt,
				Scopes: `{"dashboards:read":[]}`}
			if tt.mutate != nil {
				tt.mutate(stored)
			}
			st := &fakePATStore{tokens: map[string]*patstore.Token{tok.Hash: stored}, touched: make(chan int64, 1)}
			if tt.unknown {
				st.tokens = nil
			}
			orgs := tt.ownerOrgs
			if orgs == nil {
				orgs = []*org.UserOrgDTO{{OrgID: 1}}
			}
			us := &usertest.FakeUserService{ExpectedUser: &user.User{ID: 3, IsDisabled: tt.ownerOff}}
			os := &orgtest.FakeOrgService{ExpectedUserOrgDTO: orgs}
			c := ProvidePersonalToken(st, us, os, func(context.Context) bool { return tt.enabled }, func(context.Context, int64) bool { return !tt.orgOff }, func() bool { return false }, noop.NewTracerProvider().Tracer("t"))
			c.now = func() time.Time { return now }

			h := http.Header{}
			h.Set("Authorization", "Bearer "+tok.Secret)
			req := &authn.Request{OrgID: tt.reqOrg, HTTPRequest: &http.Request{Header: h}}
			require.True(t, c.Test(context.Background(), req))

			ident, err := c.Authenticate(context.Background(), req)
			if tt.wantErr {
				require.Error(t, err)
				require.Nil(t, ident)
				require.NotContains(t, err.Error(), tok.Secret)
				return
			}
			require.NoError(t, err)
			require.Equal(t, "3", ident.ID)
			require.Equal(t, int64(1), ident.OrgID)
			require.Equal(t, int64(7), ident.PersonalTokenID)
			require.Contains(t, ident.PersonalTokenScopes, "dashboards:read")

			require.NoError(t, c.Hook(context.Background(), ident, req))
			if tt.wantTouch {
				select {
				case id := <-st.touched:
					require.Equal(t, int64(7), id)
				case <-time.After(2 * time.Second):
					t.Fatal("last used not updated")
				}
			} else {
				require.Empty(t, st.touched)
			}
		})
	}
}

func TestPersonalToken_Test(t *testing.T) {
	c := ProvidePersonalToken(nil, nil, nil, nil, nil, nil, noop.NewTracerProvider().Tracer("t"))
	for hdr, want := range map[string]bool{
		"Bearer glpat_abc": true, "Bearer glsa_abc": false, "Bearer other": false, "": false,
	} {
		h := http.Header{}
		h.Set("Authorization", hdr)
		require.Equal(t, want, c.Test(context.Background(), &authn.Request{HTTPRequest: &http.Request{Header: h}}), hdr)
	}
	require.Less(t, c.Priority(), (&APIKey{}).Priority())
}

func TestPersonalToken_RejectsKubernetesAPIs(t *testing.T) {
	tok, err := pattoken.New()
	require.NoError(t, err)
	stored := &patstore.Token{ID: 7, UID: "u", UserID: 3, OrgID: 1, TokenHash: tok.Hash, Scopes: `{"dashboards:read":[]}`}
	st := &fakePATStore{tokens: map[string]*patstore.Token{tok.Hash: stored}, touched: make(chan int64, 1)}
	us := &usertest.FakeUserService{ExpectedUser: &user.User{ID: 3}}
	os := &orgtest.FakeOrgService{ExpectedUserOrgDTO: []*org.UserOrgDTO{{OrgID: 1}}}

	paths := []string{
		"/apis", "/apis/", "/apis/dashboard.grafana.app/v1beta1/namespaces/default/dashboards",
		"/apis/iam.grafana.app/v0alpha1/namespaces/default/users", "/apis/folder.grafana.app/v1beta1/namespaces/default/folders/x",
		"/apis/secret.grafana.app/v1beta1/namespaces/default/securevalues", "/openapi/v3",
	}
	for _, allowAdmin := range []bool{false, true} {
		c := ProvidePersonalToken(st, us, os, func(context.Context) bool { return true }, func(context.Context, int64) bool { return true }, func() bool { return allowAdmin }, noop.NewTracerProvider().Tracer("t"))
		for _, method := range []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete} {
			for _, p := range paths {
				h := http.Header{}
				h.Set("Authorization", "Bearer "+tok.Secret)
				req := &authn.Request{HTTPRequest: &http.Request{Method: method, Header: h, URL: &url.URL{Path: p}}}
				ident, err := c.Authenticate(context.Background(), req)
				require.Error(t, err, "%s %s allowAdmin=%v", method, p, allowAdmin)
				require.Nil(t, ident)
			}
		}
	}
	// legacy API is unaffected
	c := ProvidePersonalToken(st, us, os, func(context.Context) bool { return true }, func(context.Context, int64) bool { return true }, func() bool { return false }, noop.NewTracerProvider().Tracer("t"))
	h := http.Header{}
	h.Set("Authorization", "Bearer "+tok.Secret)
	ident, err := c.Authenticate(context.Background(), &authn.Request{HTTPRequest: &http.Request{Method: http.MethodGet, Header: h, URL: &url.URL{Path: "/api/dashboards/home"}}})
	require.NoError(t, err)
	require.NotNil(t, ident)
}

package tokenexchange

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

type subjectLookup func(context.Context, *user.GetSignedInUserQuery) (*user.SignedInUser, error)

func (f subjectLookup) GetSignedInUser(ctx context.Context, q *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
	return f(ctx, q)
}

func TestAssertedSubjectHTTP(t *testing.T) {
	credential, err := v3.IssueLocalAccessPolicyToken("allowed-app", testManifest)
	require.NoError(t, err)
	t.Cleanup(func() { v3.RevokeLocalAccessPolicyToken(credential) })
	other, err := v3.IssueLocalAccessPolicyToken("other-app", testManifest)
	require.NoError(t, err)
	t.Cleanup(func() { v3.RevokeLocalAccessPolicyToken(other) })
	s := &Service{
		cfg: &setting.Cfg{ExtJWTAuth: setting.ExtJWTSettings{Audiences: []string{"grafana"}}}, log: log.NewNopLogger(),
		subjectPolicies: map[string]*v3.LocalSubjectPolicy{"allowed-app": {DelegatedPermissions: []string{"datasources:read"}}},
		plugins:         pluginstore.NewFakePluginStore(pluginstore.Plugin{JSONData: plugins.JSONData{ID: "allowed-app", Type: plugins.TypeApp}}),
		pluginSettings: appSettingsLookup(func(_ context.Context, q *pluginsettings.GetByPluginIDArgs) (*pluginsettings.DTO, error) {
			require.Equal(t, &pluginsettings.GetByPluginIDArgs{PluginID: "allowed-app", OrgID: 1}, q)
			return &pluginsettings.DTO{Enabled: true}, nil
		}),
	}
	account := &user.SignedInUser{UserID: 42, UserUID: "uid-42", OrgID: 1}
	var lookupError error
	s.users = subjectLookup(func(_ context.Context, q *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
		require.Equal(t, int64(42), q.UserID)
		require.Equal(t, int64(1), q.OrgID)
		return account, lookupError
	})
	request := func(token, typ, uid string) (int, exchangeResponse) {
		body, err := json.Marshal(authnlib.TokenExchangeRequest{Namespace: "default", Audiences: []string{"grafana"}, Subject: &authnlib.TokenExchangeSubject{Sub: typ + ":42", Type: typ, Identifier: uid, Namespace: "default"}})
		require.NoError(t, err)
		req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(string(body)))
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		c := &contextmodel.ReqContext{Context: &web.Context{Req: req, Resp: web.NewResponseWriter(req.Method, rec)}}
		s.signAccessToken(c).WriteTo(c)
		var result exchangeResponse
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &result))
		return rec.Code, result
	}
	for _, sa := range []bool{false, true} {
		account.IsServiceAccount = sa
		typ := "user"
		if sa {
			typ = "service-account"
		}
		status, result := request(credential, typ, "uid-42")
		require.Equal(t, http.StatusOK, status, result.Error)
		keys, err := v3.LocalKeyRetriever()
		require.NoError(t, err)
		verifier := authnlib.NewAccessTokenVerifier(authnlib.VerifierConfig{AllowedAudiences: []string{"grafana"}}, keys)
		claims, err := verifier.Verify(context.Background(), result.Data.Token)
		require.NoError(t, err)
		require.Equal(t, typ+":42", authnlib.NewAccessTokenAuthInfo(*claims).GetSubject())
		require.Empty(t, claims.Rest.Permissions)
	}
	account.IsServiceAccount = false
	for _, tc := range []struct{ name, token, typ, uid string }{
		{"other plugin", other, "user", "uid-42"},
		{"UID mismatch", credential, "user", "other-uid"},
		{"type mismatch", credential, "service-account", "uid-42"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			status, _ := request(tc.token, tc.typ, tc.uid)
			require.Equal(t, http.StatusForbidden, status)
		})
	}
	account.IsDisabled = true
	status, _ := request(credential, "user", "uid-42")
	require.Equal(t, http.StatusForbidden, status)
	account.IsDisabled = false
	account.OrgID = -1
	status, _ = request(credential, "user", "uid-42")
	require.Equal(t, http.StatusForbidden, status)
	account.OrgID = 1
	lookupError = user.ErrUserNotFound
	status, _ = request(credential, "user", "uid-42")
	require.Equal(t, http.StatusForbidden, status)
	lookupError = errors.New("database unavailable")
	status, _ = request(credential, "user", "uid-42")
	require.Equal(t, http.StatusInternalServerError, status)
}

func TestUnconfiguredSubjectSigningPreservesRejections(t *testing.T) {
	credential, err := v3.IssueLocalAccessPolicyToken("unconfigured-app", testManifest)
	require.NoError(t, err)
	t.Cleanup(func() { v3.RevokeLocalAccessPolicyToken(credential) })

	const unsupported = "local plugin token exchange: access denied: signing for an asserted subject is not supported"
	const requiredFields = "local plugin token exchange: namespace and audiences are required"
	tests := []struct {
		name   string
		body   string
		status int
		error  string
	}{
		{name: "subject", body: `{"namespace":"default","audiences":["grafana"],"subject":{}}`, status: http.StatusForbidden, error: unsupported},
		{name: "both subject forms", body: `{"namespace":"default","audiences":["grafana"],"subject":{},"subjectToken":"unused"}`, status: http.StatusForbidden, error: unsupported},
		{name: "disallowed audience", body: `{"namespace":"default","audiences":["other"],"subject":{}}`, status: http.StatusForbidden, error: unsupported},
		{name: "both forms and disallowed audience", body: `{"namespace":"default","audiences":["other"],"subject":{},"subjectToken":"unused"}`, status: http.StatusForbidden, error: unsupported},
		{name: "custom expiry", body: `{"namespace":"default","audiences":["grafana"],"subject":{},"expiresIn":300}`, status: http.StatusForbidden, error: unsupported},
		{name: "missing namespace", body: `{"audiences":["grafana"],"subject":{},"subjectToken":"unused"}`, status: http.StatusBadRequest, error: requiredFields},
		{name: "missing audiences", body: `{"namespace":"default","subject":{},"subjectToken":"unused"}`, status: http.StatusBadRequest, error: requiredFields},
	}
	for _, configuration := range []struct {
		name     string
		policies map[string]*v3.LocalSubjectPolicy
	}{
		{name: "no plugin configured"},
		{name: "another plugin configured", policies: map[string]*v3.LocalSubjectPolicy{
			"other-app": {DelegatedPermissions: []string{"datasources:read"}},
		}},
	} {
		t.Run(configuration.name, func(t *testing.T) {
			for _, tt := range tests {
				t.Run(tt.name, func(t *testing.T) {
					s := &Service{
						cfg:             &setting.Cfg{ExtJWTAuth: setting.ExtJWTSettings{Audiences: []string{"grafana"}}},
						log:             log.NewNopLogger(),
						subjectPolicies: configuration.policies,
						users: subjectLookup(func(context.Context, *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
							require.FailNow(t, "an unconfigured plugin must not resolve asserted accounts")
							return nil, nil
						}),
					}
					req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(tt.body))
					req.Header.Set("Authorization", "Bearer "+credential)
					rec := httptest.NewRecorder()
					c := &contextmodel.ReqContext{Context: &web.Context{Req: req, Resp: web.NewResponseWriter(req.Method, rec)}}
					s.signAccessToken(c).WriteTo(c)
					require.Equal(t, tt.status, rec.Code)
					var result exchangeResponse
					require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &result))
					require.Equal(t, exchangeResponse{Status: "error", Error: tt.error}, result)
				})
			}
		})
	}
}

func TestAssertedSubjectBindsResolvedIdentity(t *testing.T) {
	for _, tt := range []struct {
		name    string
		account user.SignedInUser
	}{
		{name: "numeric lookup returned different UID", account: user.SignedInUser{UserID: 42, UserUID: "other-uid", OrgID: 1}},
		{name: "UID lookup returned different numeric ID", account: user.SignedInUser{UserID: 43, UserUID: "uid-42", OrgID: 1}},
		{name: "different identity type", account: user.SignedInUser{UserID: 42, UserUID: "uid-42", OrgID: 1, IsServiceAccount: true}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{users: subjectLookup(func(_ context.Context, query *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
				require.Equal(t, &user.GetSignedInUserQuery{UserID: 42, UserUID: "uid-42", OrgID: 1}, query)
				return &tt.account, nil
			})}
			err := s.validateSubject(context.Background(), &authnlib.TokenExchangeSubject{
				Sub: "user:42", Identifier: "uid-42", Type: "user", Namespace: "default",
			})
			require.ErrorIs(t, err, v3.ErrLocalAccessDenied)
		})
	}
}

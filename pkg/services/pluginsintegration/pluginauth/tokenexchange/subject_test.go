package tokenexchange

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/plugins/config"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func TestSubjectSigningHTTPClient(t *testing.T) {
	credential, err := v3.IssueLocalAccessPolicyToken("allowed-app", testManifest)
	require.NoError(t, err)
	t.Cleanup(func() { v3.RevokeLocalAccessPolicyToken(credential) })
	s := &Service{
		cfg: &setting.Cfg{
			ExtJWTAuth: setting.ExtJWTSettings{Audiences: []string{"grafana"}},
			PluginSettings: config.PluginSettings{"allowed-app": {
				"allow_subject_signing":              "true",
				"subject_signing_permissions":        "datasources:read datasources:write",
				"subject_signing_max_token_lifetime": "15m",
			}},
		},
		log: log.NewNopLogger(),
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c := &contextmodel.ReqContext{Context: &web.Context{Req: r, Resp: web.NewResponseWriter(r.Method, w)}}
		s.signAccessToken(c).WriteTo(c)
	}))
	t.Cleanup(srv.Close)
	exchange, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
		Token: credential, TokenExchangeURL: srv.URL,
	})
	require.NoError(t, err)
	keys, err := v3.LocalKeyRetriever()
	require.NoError(t, err)
	verifier := authnlib.NewAccessTokenVerifier(authnlib.VerifierConfig{AllowedAudiences: []string{"grafana"}}, keys)
	for _, tc := range []struct {
		name, typ, sub, uid, namespace string
		expiresIn                      *int
		lifetime                       time.Duration
	}{
		{name: "user in default org", typ: "user", sub: "user:42", uid: "uid-42", namespace: "default", lifetime: 5 * time.Minute},
		{name: "user in another org", typ: "user", sub: "user:43", uid: "uid-43", namespace: "org-2", expiresIn: new(600), lifetime: 10 * time.Minute},
		{name: "service account in default org", typ: "service-account", sub: "service-account:7", uid: "uid-7", namespace: "default", lifetime: 5 * time.Minute},
		{name: "service account in another org", typ: "service-account", sub: "service-account:8", uid: "uid-8", namespace: "org-3", expiresIn: new(60), lifetime: time.Minute},
	} {
		t.Run(tc.name, func(t *testing.T) {
			result, err := exchange.Exchange(context.Background(), authnlib.TokenExchangeRequest{
				Namespace: tc.namespace, Audiences: []string{"grafana"}, ExpiresIn: tc.expiresIn,
				Subject:                        &authnlib.TokenExchangeSubject{Sub: tc.sub, Identifier: tc.uid, Type: tc.typ, Namespace: tc.namespace},
				RestrictedDelegatedPermissions: []string{"datasources:read"},
			})
			require.NoError(t, err)
			claims, err := verifier.Verify(context.Background(), result.Token)
			require.NoError(t, err)
			require.Equal(t, "access-policy:allowed-app", claims.Subject)
			require.Equal(t, tc.namespace, claims.Rest.Namespace)
			require.Equal(t, tc.sub, claims.Rest.Actor.Subject)
			require.Equal(t, tc.uid, claims.Rest.Actor.Identifier)
			require.Equal(t, tc.typ, string(claims.Rest.Actor.Type))
			require.Equal(t, tc.namespace, claims.Rest.Actor.Namespace)
			require.Empty(t, claims.Rest.Permissions)
			require.Equal(t, []string{"datasources:read"}, claims.Rest.DelegatedPermissions)
			require.Equal(t, tc.lifetime, claims.Expiry.Time().Sub(claims.IssuedAt.Time()))
		})
	}
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
		settings config.PluginSettings
	}{
		{name: "no plugin configured"},
		{name: "another plugin configured", settings: config.PluginSettings{
			"other-app": {"allow_subject_signing": "true", "subject_signing_permissions": "datasources:read"},
		}},
	} {
		t.Run(configuration.name, func(t *testing.T) {
			for _, tt := range tests {
				t.Run(tt.name, func(t *testing.T) {
					s := &Service{
						cfg: &setting.Cfg{
							ExtJWTAuth:     setting.ExtJWTSettings{Audiences: []string{"grafana"}},
							PluginSettings: configuration.settings,
						},
						log: log.NewNopLogger(),
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

func TestSubjectSettingsApplyOnlyToSubjectRequests(t *testing.T) {
	credential, err := v3.IssueLocalAccessPolicyToken("example-app", testManifest)
	require.NoError(t, err)
	t.Cleanup(func() { v3.RevokeLocalAccessPolicyToken(credential) })
	keys, err := v3.LocalKeyRetriever()
	require.NoError(t, err)
	verifier := authnlib.NewAccessTokenVerifier(authnlib.VerifierConfig{AllowedAudiences: []string{"grafana"}}, keys)
	exchanger, err := v3.LocalTokenExchanger()
	require.NoError(t, err)
	inbound, err := exchanger.Exchange(context.Background(), authnlib.TokenExchangeRequest{
		Namespace: "default", Audiences: []string{"example-app"}, SubjectToken: sdkTestIDToken(t, "default"),
	})
	require.NoError(t, err)
	manifestGrant := []string{
		"example.ext.grafana.app:*",
		"dashboard.grafana.app/dashboards:get",
		"dashboard.grafana.app/dashboards:list",
		"folder.grafana.app/folders:get",
	}
	for _, enabled := range []string{"true", "invalid"} {
		t.Run(enabled, func(t *testing.T) {
			s := &Service{
				cfg: &setting.Cfg{
					ExtJWTAuth: setting.ExtJWTSettings{Audiences: []string{"grafana"}},
					PluginSettings: config.PluginSettings{"example-app": {
						"allow_subject_signing":              enabled,
						"subject_signing_permissions":        "datasources:read",
						"subject_signing_max_token_lifetime": "1h",
					}},
				},
				log: log.NewNopLogger(),
			}
			for _, mode := range []string{"subject", "service", "subjectToken"} {
				t.Run(mode, func(t *testing.T) {
					request := authnlib.TokenExchangeRequest{Namespace: "default", Audiences: []string{"grafana"}, ExpiresIn: new(600)}
					switch mode {
					case "subject":
						request.Subject = &authnlib.TokenExchangeSubject{Sub: "user:42", Identifier: "uid-42", Type: "user", Namespace: "default"}
					case "subjectToken":
						request.SubjectToken = inbound.Token
					}
					body, err := json.Marshal(request)
					require.NoError(t, err)
					req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(string(body)))
					req.Header.Set("Authorization", "Bearer "+credential)
					rec := httptest.NewRecorder()
					c := &contextmodel.ReqContext{Context: &web.Context{Req: req, Resp: web.NewResponseWriter(req.Method, rec)}}
					s.signAccessToken(c).WriteTo(c)
					var result exchangeResponse
					require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &result))
					if mode == "subject" && enabled == "invalid" {
						require.Equal(t, http.StatusInternalServerError, rec.Code)
						require.Nil(t, result.Data)
						require.Equal(t, "invalid subject signing configuration", result.Error)
						return
					}
					require.Equal(t, http.StatusOK, rec.Code, result.Error)
					claims, err := verifier.Verify(context.Background(), result.Data.Token)
					require.NoError(t, err)
					lifetime := 5 * time.Minute
					switch mode {
					case "subject":
						lifetime = 10 * time.Minute
						require.Empty(t, claims.Rest.Permissions)
						require.Equal(t, []string{"datasources:read"}, claims.Rest.DelegatedPermissions)
					case "service":
						require.Equal(t, manifestGrant, claims.Rest.Permissions)
						require.Empty(t, claims.Rest.DelegatedPermissions)
					case "subjectToken":
						require.Empty(t, claims.Rest.Permissions)
						require.Equal(t, append([]string{"plugins.app:access"}, manifestGrant...), claims.Rest.DelegatedPermissions)
					}
					require.Equal(t, lifetime, claims.Expiry.Time().Sub(claims.IssuedAt.Time()))
				})
			}
		})
	}
}

package tokenexchange

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

var testManifest = &app.ManifestData{
	Group: "example.ext.grafana.app",
	ExtraPermissions: &app.Permissions{AccessKinds: []app.KindPermission{
		{Group: "dashboard.grafana.app", Resource: "dashboards", Actions: []app.KindPermissionAction{"get", "list"}},
		{Group: "folder.grafana.app", Resource: "folders", Actions: []app.KindPermissionAction{"get"}},
	}},
}

func TestPolicyFor(t *testing.T) {
	policy := policyFor("example-app", []string{"grafana"}, []*app.ManifestData{testManifest, {Group: ""}, nil})
	require.Equal(t, v3.LocalAccessPolicy{
		PluginID:  "example-app",
		Audiences: []string{"grafana", "example.ext.grafana.app", "dashboard.grafana.app", "folder.grafana.app"},
		Permissions: []string{
			"plugins.app:access",
			"example.ext.grafana.app:*",
			"dashboard.grafana.app/dashboards:get",
			"dashboard.grafana.app/dashboards:list",
			"folder.grafana.app/folders:get",
		},
	}, policy)

	require.Empty(t, policyFor("example-app", []string{"grafana"}, nil).Permissions, "a plugin without a manifest may do nothing")

	core := policyFor("example-app", []string{"grafana"}, []*app.ManifestData{{Group: "dashboard.grafana.app"}})
	require.NotContains(t, core.Permissions, "dashboard.grafana.app:*", "a manifest does not own a core group")
}

// newTestServer serves the token exchange as Grafana's HTTP server would.
func newTestServer(t *testing.T, manifests func(context.Context, string) ([]*app.ManifestData, error)) *httptest.Server {
	t.Helper()
	s := &Service{
		cfg:       &setting.Cfg{ExtJWTAuth: setting.ExtJWTSettings{Audiences: []string{"grafana"}}},
		log:       log.NewNopLogger(),
		manifests: manifests,
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c := &contextmodel.ReqContext{
			Context:      &web.Context{Req: r, Resp: web.NewResponseWriter(r.Method, w)},
			SignedInUser: &user.SignedInUser{},
		}
		s.signAccessToken(c).WriteTo(c)
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestSignAccessToken(t *testing.T) {
	srv := newTestServer(t, func(_ context.Context, pluginID string) ([]*app.ManifestData, error) {
		if pluginID == "example-app" {
			return []*app.ManifestData{testManifest}, nil
		}
		return nil, nil
	})
	capToken, err := v3.IssueLocalAccessPolicyToken("example-app")
	require.NoError(t, err)
	// The client the app SDK uses for API_ACCESS_TOKEN_EXCHANGE_URL and API_ACCESS_CAP_TOKEN.
	exchange := func(token string, req authnlib.TokenExchangeRequest) (string, error) {
		client, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{Token: token, TokenExchangeURL: srv.URL})
		require.NoError(t, err)
		rsp, err := client.Exchange(context.Background(), req)
		if err != nil {
			return "", err
		}
		return rsp.Token, nil
	}
	keys, err := v3.LocalKeyRetriever()
	require.NoError(t, err)
	grafana := authnlib.NewAccessTokenVerifier(authnlib.VerifierConfig{AllowedAudiences: []string{"grafana"}}, keys)

	t.Run("signs the plugin's token", func(t *testing.T) {
		token, err := exchange(capToken, authnlib.TokenExchangeRequest{Namespace: "*", Audiences: []string{"example.ext.grafana.app", "grafana"}})
		require.NoError(t, err)
		claims, err := grafana.Verify(context.Background(), token)
		require.NoError(t, err)
		require.Equal(t, "access-policy:example-app", claims.Subject)
		require.Contains(t, claims.Rest.Permissions, "dashboard.grafana.app/dashboards:list")
	})

	t.Run("rejects unknown access policy tokens", func(t *testing.T) {
		_, err := exchange("not-a-cap-token", authnlib.TokenExchangeRequest{Namespace: "*", Audiences: []string{"grafana"}})
		require.ErrorContains(t, err, "invalid access policy token")
	})

	t.Run("rejects the token of a stopped plugin process", func(t *testing.T) {
		stopped, err := v3.IssueLocalAccessPolicyToken("stopped-app")
		require.NoError(t, err)
		v3.RevokeLocalAccessPolicyToken(stopped)
		_, err = exchange(stopped, authnlib.TokenExchangeRequest{Namespace: "*", Audiences: []string{"grafana"}})
		require.ErrorContains(t, err, "invalid access policy token")
	})

	t.Run("rejects audiences outside the manifest", func(t *testing.T) {
		_, err := exchange(capToken, authnlib.TokenExchangeRequest{Namespace: "*", Audiences: []string{"grafana", "other.ext.grafana.app"}})
		require.ErrorContains(t, err, "audience \"other.ext.grafana.app\" is not allowed")
	})

	t.Run("a plugin without a manifest gets no permissions", func(t *testing.T) {
		otherCAP, err := v3.IssueLocalAccessPolicyToken("other-app")
		require.NoError(t, err)
		token, err := exchange(otherCAP, authnlib.TokenExchangeRequest{Namespace: "*", Audiences: []string{"grafana"}})
		require.NoError(t, err)
		claims, err := grafana.Verify(context.Background(), token)
		require.NoError(t, err)
		require.Equal(t, "access-policy:other-app", claims.Subject)
		require.Empty(t, claims.Rest.Permissions)
	})
}

func TestSignAccessTokenRequests(t *testing.T) {
	failing := newTestServer(t, func(context.Context, string) ([]*app.ManifestData, error) {
		return nil, errors.New("disk error")
	})
	capToken, err := v3.IssueLocalAccessPolicyToken("example-app")
	require.NoError(t, err)

	for _, tc := range []struct {
		name          string
		authorization string
		body          string
		want          int
	}{
		{name: "no access policy token", body: `{}`, want: http.StatusUnauthorized},
		{name: "not a bearer token", authorization: capToken, body: `{}`, want: http.StatusUnauthorized},
		{name: "invalid body", authorization: "Bearer " + capToken, body: `{`, want: http.StatusBadRequest},
		{name: "manifests fail to load", authorization: "Bearer " + capToken, body: `{"namespace":"*","audiences":["grafana"]}`, want: http.StatusInternalServerError},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodPost, failing.URL, strings.NewReader(tc.body))
			require.NoError(t, err)
			if tc.authorization != "" {
				req.Header.Set("Authorization", tc.authorization)
			}
			rsp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			_ = rsp.Body.Close()
			require.Equal(t, tc.want, rsp.StatusCode)
		})
	}
}

func TestSignAccessTokenLoopbackOnly(t *testing.T) {
	capToken, err := v3.IssueLocalAccessPolicyToken("example-app")
	require.NoError(t, err)
	t.Cleanup(func() { v3.RevokeLocalAccessPolicyToken(capToken) })
	s := &Service{
		cfg:          &setting.Cfg{ExtJWTAuth: setting.ExtJWTSettings{Audiences: []string{"grafana"}}},
		log:          log.NewNopLogger(),
		loopbackOnly: true,
		manifests: func(context.Context, string) ([]*app.ManifestData, error) {
			return []*app.ManifestData{testManifest}, nil
		},
	}
	call := func(remoteAddr, forwardedFor string) int {
		req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"namespace":"*","audiences":["grafana"]}`))
		req.RemoteAddr = remoteAddr
		req.Header.Set("Authorization", "Bearer "+capToken)
		if forwardedFor != "" {
			req.Header.Set("X-Forwarded-For", forwardedFor)
		}
		rec := httptest.NewRecorder()
		c := &contextmodel.ReqContext{Context: &web.Context{Req: req, Resp: web.NewResponseWriter(req.Method, rec)}, SignedInUser: &user.SignedInUser{}}
		s.signAccessToken(c).WriteTo(c)
		return rec.Code
	}

	require.Equal(t, http.StatusOK, call("127.0.0.1:51234", ""))
	require.Equal(t, http.StatusOK, call("[::1]:51234", ""))
	require.Equal(t, http.StatusForbidden, call("192.0.2.10:51234", ""), "a valid CAP token from another host is refused")
	require.Equal(t, http.StatusForbidden, call("192.0.2.10:51234", "127.0.0.1"), "forwarding headers are not trusted")
}

func TestProvideServiceLocalAPIURL(t *testing.T) {
	for _, tc := range []struct {
		name, override, jwksURL string
		registered              bool
		wantRemoteStatus        int
	}{
		{name: "automatic loopback", registered: true, wantRemoteStatus: http.StatusForbidden},
		{name: "explicit loopback", override: "http://127.0.0.1:4321", registered: true, wantRemoteStatus: http.StatusForbidden},
		{name: "explicit localhost", override: "http://LOCALHOST:4321", registered: true, wantRemoteStatus: http.StatusForbidden},
		{name: "explicit interface", override: "http://192.0.2.10:4321", registered: true, wantRemoteStatus: http.StatusOK},
		{name: "explicit hostname", override: "https://grafana.internal:8443", registered: true, wantRemoteStatus: http.StatusOK},
		{name: "invalid override", override: "/relative"},
		{name: "external signer", jwksURL: "https://auth.example.com/keys"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := &setting.Cfg{Raw: ini.Empty(), Protocol: setting.HTTPScheme, HTTPPort: "4321", ExtJWTAuth: setting.ExtJWTSettings{JWKSUrl: tc.jwksURL, Audiences: []string{"grafana"}}}
			cfg.Raw.Section("plugins").Key("local_api_url").SetValue(tc.override)
			routes := &exchangeRoutes{}
			s := ProvideService(cfg, routes, nil)
			require.Equal(t, tc.registered, routes.registered)
			if !tc.registered {
				return
			}
			s.manifests = func(context.Context, string) ([]*app.ManifestData, error) {
				return []*app.ManifestData{testManifest}, nil
			}
			token, err := v3.IssueLocalAccessPolicyToken("example-app")
			require.NoError(t, err)
			t.Cleanup(func() { v3.RevokeLocalAccessPolicyToken(token) })
			for _, credential := range []string{token, "invalid"} {
				req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"namespace":"*","audiences":["grafana"]}`))
				req.RemoteAddr = "192.0.2.10:51234"
				req.Header.Set("Authorization", "Bearer "+credential)
				rec := httptest.NewRecorder()
				c := &contextmodel.ReqContext{Context: &web.Context{Req: req, Resp: web.NewResponseWriter(req.Method, rec)}}
				s.signAccessToken(c).WriteTo(c)
				want := tc.wantRemoteStatus
				if credential == "invalid" && want == http.StatusOK {
					want = http.StatusUnauthorized
				}
				require.Equal(t, want, rec.Code)
			}
		})
	}
}

type exchangeRoutes struct {
	routing.RouteRegister
	registered bool
}

func (r *exchangeRoutes) Post(string, ...web.Handler) { r.registered = true }

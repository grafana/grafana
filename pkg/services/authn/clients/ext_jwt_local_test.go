package clients

import (
	"context"
	"net/http"
	"net/url"
	"testing"
	"time"

	jose "github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	authlib "github.com/grafana/authlib/authn"
	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/infra/tracing"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginauth"
	"github.com/grafana/grafana/pkg/setting"
)

func TestExtendedJWT_localPluginTokens(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagApppluginsLoadAppManifest)
	cfgWith := func(jwksURL string) *setting.Cfg {
		return &setting.Cfg{
			Raw:        ini.Empty(),
			ExtJWTAuth: setting.ExtJWTSettings{JWKSUrl: jwksURL, Audiences: []string{"grafana"}},
		}
	}
	policy := v3.LocalAccessPolicy{
		PluginID:             "example-app",
		Audiences:            []string{"grafana", "iam.grafana.app"},
		Permissions:          []string{"dashboard.grafana.app/dashboards:get"},
		DelegatedPermissions: []string{"dashboard.grafana.app/dashboards:get"},
	}
	sign := func(t *testing.T, req authlib.TokenExchangeRequest) string {
		t.Helper()
		token, err := v3.SignLocalAccessToken(context.Background(), policy, req)
		require.NoError(t, err)
		return token
	}
	request := func(token string) *authn.Request {
		return &authn.Request{HTTPRequest: &http.Request{Header: http.Header{"X-Access-Token": {token}}}}
	}

	t.Run("enabled without configuration, and authenticates the plugin", func(t *testing.T) {
		client := localExtendedJWT(t, cfgWith(""))
		require.True(t, client.IsEnabled(context.Background()))

		token := sign(t, authlib.TokenExchangeRequest{Namespace: "*", Audiences: []string{"grafana"}})
		require.True(t, client.Test(context.Background(), request(token)))
		identity, err := client.Authenticate(context.Background(), request(token))
		require.NoError(t, err)
		require.Equal(t, claims.TypeAccessPolicy, identity.Type)
		require.Equal(t, "example-app", identity.ID)
		require.Equal(t, policy.Permissions, identity.ClientParams.FetchPermissionsParams.K8s)
	})

	t.Run("authenticates the caller of the plugin", func(t *testing.T) {
		exchanger, err := v3.LocalTokenExchanger()
		require.NoError(t, err)
		// The token Grafana sends the plugin with a request from user u1. The
		// local exchanger takes the caller from Grafana's own ID token.
		idToken := generateIDToken(t, idTokenClaims{Claims: jwt.Claims{Subject: "user:u1", Expiry: jwt.NewNumericDate(time.Now().Add(time.Hour))}, Rest: authlib.IDTokenClaims{Identifier: "u1", Type: claims.TypeUser, Namespace: "default"}}, pk, jose.ES256)
		inbound, err := exchanger.Exchange(context.Background(), authlib.TokenExchangeRequest{Namespace: "default", Audiences: []string{"example-app"}, SubjectToken: idToken})
		require.NoError(t, err)

		client := localExtendedJWT(t, cfgWith(""))
		_, err = client.Authenticate(context.Background(), request(inbound.Token))
		require.Error(t, err, "tokens for plugins are not valid for Grafana")

		token := sign(t, authlib.TokenExchangeRequest{Namespace: "default", Audiences: []string{"grafana"}, SubjectToken: inbound.Token})
		identity, err := client.Authenticate(context.Background(), request(token))
		require.NoError(t, err)
		require.Equal(t, claims.TypeUser, identity.Type)
		require.Equal(t, "u1", identity.UID)
		require.Equal(t, "default", identity.Namespace)
		require.Equal(t, "access-policy:example-app", identity.AuthID)
		require.Equal(t, policy.DelegatedPermissions, identity.ClientParams.FetchPermissionsParams.K8sRestrictedActions,
			"the caller's permissions are limited to what the plugin may do")
	})

	t.Run("authenticates a token for the API group of the request", func(t *testing.T) {
		client := localExtendedJWT(t, cfgWith(""))
		token := sign(t, authlib.TokenExchangeRequest{Namespace: "*", Audiences: []string{"iam.grafana.app"}})
		at := func(path string) *authn.Request {
			r := request(token)
			r.HTTPRequest.URL = &url.URL{Path: path}
			return r
		}

		identity, err := client.Authenticate(context.Background(), at("/apis/iam.grafana.app/v0alpha1/whoami"))
		require.NoError(t, err)
		require.Equal(t, claims.TypeAccessPolicy, identity.Type)
		require.Equal(t, "example-app", identity.ID)

		for _, path := range []string{"/apis/folder.grafana.app/v1/namespaces/default/folders", "/api/user", "/apis"} {
			_, err := client.Authenticate(context.Background(), at(path))
			require.ErrorIs(t, err, authlib.ErrInvalidAudience, "a token for iam.grafana.app is not valid for %s", path)
		}
	})

	t.Run("a token Grafana sends a plugin is only valid for that plugin's own API", func(t *testing.T) {
		exchanger, err := v3.LocalTokenExchanger()
		require.NoError(t, err)
		idToken := generateIDToken(t, idTokenClaims{Claims: jwt.Claims{Subject: "user:u1", Expiry: jwt.NewNumericDate(time.Now().Add(time.Hour))}, Rest: authlib.IDTokenClaims{Identifier: "u1", Type: claims.TypeUser, Namespace: "default"}}, pk, jose.ES256)
		inbound, err := exchanger.Exchange(context.Background(), authlib.TokenExchangeRequest{Namespace: "default", Audiences: []string{"example-app"}, SubjectToken: idToken})
		require.NoError(t, err)

		client := localExtendedJWT(t, cfgWith(""))
		at := func(path string) *authn.Request {
			r := request(inbound.Token)
			r.HTTPRequest.URL = &url.URL{Path: path}
			return r
		}

		// /apis/<plugin-id>/... is the plugin's own API, so the plugin may call it
		// as its caller. The token delegates no permissions, so the caller keeps
		// none of their RBAC permissions there.
		identity, err := client.Authenticate(context.Background(), at("/apis/example-app/v0alpha1/namespaces/default/settings/example-app"))
		require.NoError(t, err)
		require.Equal(t, claims.TypeUser, identity.Type)
		require.Equal(t, "u1", identity.UID)
		require.NotNil(t, identity.ClientParams.FetchPermissionsParams.RestrictedActions)
		require.Empty(t, identity.ClientParams.FetchPermissionsParams.RestrictedActions)
		require.NotNil(t, identity.ClientParams.FetchPermissionsParams.K8sRestrictedActions)
		require.Empty(t, identity.ClientParams.FetchPermissionsParams.K8sRestrictedActions)

		for _, path := range []string{"/apis/other-app/v0alpha1/namespaces/default/settings/other-app", "/apis/iam.grafana.app/v0alpha1/whoami", "/api/plugins/example-app/settings", "/apis", "/apis/example-app/../other-app/v0alpha1"} {
			_, err := client.Authenticate(context.Background(), at(path))
			require.ErrorIs(t, err, authlib.ErrInvalidAudience, "a token for the example-app plugin is not valid for %s", path)
		}
	})

	t.Run("still authenticates a token for only the grafana audience", func(t *testing.T) {
		client := localExtendedJWT(t, cfgWith(""))
		token := sign(t, authlib.TokenExchangeRequest{Namespace: "*", Audiences: []string{"grafana"}})

		for _, path := range []string{"/apis/iam.grafana.app/v0alpha1/whoami", "/apis/folder.grafana.app/v1/namespaces/default/folders", "/api/user", "/apis"} {
			r := request(token)
			r.HTTPRequest.URL = &url.URL{Path: path}
			identity, err := client.Authenticate(context.Background(), r)
			require.NoError(t, err, "a token for grafana is valid for %s", path)
			require.Equal(t, claims.TypeAccessPolicy, identity.Type)
			require.Equal(t, "example-app", identity.ID)
		}
	})

	t.Run("leaves other ES256 tokens to other clients", func(t *testing.T) {
		client := localExtendedJWT(t, cfgWith(""))
		local := sign(t, authlib.TokenExchangeRequest{Namespace: "*", Audiences: []string{"grafana"}})
		require.True(t, client.Test(context.Background(), request(local)))

		other := generateToken(t, accessTokenClaims{Claims: jwt.Claims{Subject: "access-policy:other", Expiry: jwt.NewNumericDate(time.Now().Add(time.Hour))}}, pk, jose.ES256)
		require.False(t, client.Test(context.Background(), request(other)), "a token the local key cannot verify must not stop a session from authenticating")
	})

	t.Run("not trusted when local plugin auth is disabled", func(t *testing.T) {
		cfg := cfgWith("")
		cfg.Raw.Section("plugins").Key("enable_local_plugin_auth").SetValue("false")
		client := localExtendedJWT(t, cfg)
		require.False(t, client.IsEnabled(context.Background()))
	})

	t.Run("not trusted without audiences", func(t *testing.T) {
		cfg := cfgWith("")
		cfg.ExtJWTAuth.Audiences = nil
		client := localExtendedJWT(t, cfg)
		require.False(t, client.IsEnabled(context.Background()))
	})

	t.Run("not trusted with a real signer", func(t *testing.T) {
		client := localExtendedJWT(t, cfgWith("https://auth.example.com/jwks"))
		require.False(t, client.IsEnabled(context.Background()))
	})
}

func TestExtendedJWT_localPluginOrganizations(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagApppluginsLoadAppManifest)
	cfg := &setting.Cfg{
		Raw:        ini.Empty(),
		ExtJWTAuth: setting.ExtJWTSettings{Audiences: []string{"grafana"}},
	}
	exchanger, err := v3.LocalTokenExchanger()
	require.NoError(t, err)
	policy := v3.LocalAccessPolicy{
		PluginID: "example-app", Audiences: []string{"grafana"},
		Permissions:          []string{"dashboard.grafana.app/dashboards:get"},
		DelegatedPermissions: []string{"dashboard.grafana.app/dashboards:get"},
	}
	for _, tc := range []struct {
		name       string
		stackID    string
		namespace  string
		requestOrg int64
		wantOrg    int64
		obo        bool
		denied     bool
	}{
		{name: "plugin in default org", namespace: "*", wantOrg: 1},
		{name: "plugin in another org", namespace: "*", requestOrg: 2, wantOrg: 2},
		{name: "plugin scoped to another org", namespace: "org-2", requestOrg: 2, wantOrg: 2},
		{name: "caller in another org", namespace: "org-2", requestOrg: 2, wantOrg: 2, obo: true},
		{name: "caller without org override", namespace: "org-2", wantOrg: 2, obo: true},
		{name: "cannot switch caller org", namespace: "org-2", requestOrg: 3, obo: true, denied: true},
		{name: "cannot switch plugin org", namespace: "default", requestOrg: 2, denied: true},
		{name: "cannot use cloud namespace locally", namespace: "stacks-123", denied: true},
		{name: "unknown namespace", namespace: "other", denied: true},
		{name: "invalid organization", namespace: "org-0", denied: true},
		{name: "configured stack", stackID: "123", namespace: "stacks-123", wantOrg: 1, obo: true},
		{name: "other stack", stackID: "123", namespace: "stacks-456", denied: true},
		{name: "local namespace in stack", stackID: "123", namespace: "default", denied: true},
		{name: "wildcard token in stack", stackID: "123", namespace: "*", wantOrg: 1},
		{name: "cannot switch stack organization", stackID: "123", namespace: "*", requestOrg: 2, denied: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			testCfg := *cfg
			testCfg.StackID = tc.stackID
			client := localExtendedJWT(t, &testCfg)
			req := authlib.TokenExchangeRequest{Namespace: tc.namespace, Audiences: []string{"grafana"}}
			if tc.obo {
				id := generateIDToken(t, idTokenClaims{Claims: jwt.Claims{Subject: "user:42", Expiry: jwt.NewNumericDate(time.Now().Add(time.Hour))}, Rest: authlib.IDTokenClaims{Identifier: "u42", Type: claims.TypeUser, Namespace: tc.namespace}}, pk, jose.ES256)
				inbound, err := exchanger.Exchange(context.Background(), authlib.TokenExchangeRequest{Namespace: tc.namespace, Audiences: []string{"example-app"}, SubjectToken: id})
				require.NoError(t, err)
				req.SubjectToken = inbound.Token
			}
			token, err := v3.SignLocalAccessToken(context.Background(), policy, req)
			require.NoError(t, err)
			r := &authn.Request{OrgID: tc.requestOrg, HTTPRequest: &http.Request{Header: http.Header{"X-Access-Token": {token}}}}
			identity, err := client.Authenticate(context.Background(), r)
			if tc.denied {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.wantOrg, identity.OrgID)
			require.Equal(t, tc.wantOrg, r.OrgID, "user sync must resolve permissions in the token's organization")
			if tc.obo {
				require.Equal(t, "42", identity.ID)
				require.Equal(t, "u42", identity.UID)
				require.Equal(t, policy.DelegatedPermissions, identity.ClientParams.FetchPermissionsParams.K8sRestrictedActions)
			}
		})
	}
}

// localExtendedJWT builds the client with the local plugin auth decision for
// cfg, as Wire does.
func localExtendedJWT(t *testing.T, cfg *setting.Cfg) *ExtendedJWT {
	t.Helper()
	pluginAuth, err := pluginauth.ProvideConfig(cfg)
	require.NoError(t, err)
	return ProvideExtendedJWTWithPluginAuth(cfg, tracing.InitializeTracerForTest(), pluginAuth)
}

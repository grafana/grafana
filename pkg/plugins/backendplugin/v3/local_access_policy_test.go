package v3

import (
	"context"
	"strings"
	"testing"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/plugin"
)

func TestLocalAccessPolicyToken(t *testing.T) {
	first, err := IssueLocalAccessPolicyToken("first-app", nil)
	require.NoError(t, err)
	require.False(t, strings.HasPrefix(first, "glsa_"), "the API key client must not look it up")
	pluginID, _, ok := LookupLocalAccessPolicyToken(first)
	require.True(t, ok)
	require.Equal(t, "first-app", pluginID)

	// Each process of a plugin gets its own token.
	second, err := IssueLocalAccessPolicyToken("first-app", nil)
	require.NoError(t, err)
	require.NotEqual(t, first, second)

	// Revoking one process's token leaves the others working.
	RevokeLocalAccessPolicyToken(first)
	_, _, ok = LookupLocalAccessPolicyToken(first)
	require.False(t, ok)
	_, _, ok = LookupLocalAccessPolicyToken(second)
	require.True(t, ok)
	RevokeLocalAccessPolicyToken("")

	require.Equal(t, second, LocalAccessPolicyTokenFromEnv([]string{"GF_VERSION=1", plugin.EnvVarAPIAccessCAPToken + "=" + second}))
	require.Empty(t, LocalAccessPolicyTokenFromEnv([]string{"GF_VERSION=1"}))

	manifest := &app.ManifestData{Group: "first.ext.grafana.app"}
	withManifest, err := IssueLocalAccessPolicyToken("first-app", manifest)
	require.NoError(t, err)
	pluginID, got, ok := LookupLocalAccessPolicyToken(withManifest)
	require.True(t, ok)
	require.Equal(t, "first-app", pluginID)
	require.Same(t, manifest, got, "the token carries its process's manifest")
	RevokeLocalAccessPolicyToken(withManifest)
	_, got, ok = LookupLocalAccessPolicyToken(withManifest)
	require.False(t, ok)
	require.Nil(t, got)

	_, _, ok = LookupLocalAccessPolicyToken(second + "x")
	require.False(t, ok)
	_, _, ok = LookupLocalAccessPolicyToken("")
	require.False(t, ok)
	_, err = IssueLocalAccessPolicyToken("", nil)
	require.Error(t, err)
}

func TestSignLocalAccessToken(t *testing.T) {
	exchanger, err := newLocalExchanger()
	require.NoError(t, err)
	policy := LocalAccessPolicy{
		PluginID:             "example-app",
		Audiences:            []string{"example.ext.grafana.app", "grafana"},
		Permissions:          []string{"example.ext.grafana.app:*", "dashboard.grafana.app/dashboards:get"},
		DelegatedPermissions: []string{"plugins.app:access", "example.ext.grafana.app:*", "dashboard.grafana.app/dashboards:get"},
	}
	// Grafana's API verifies these tokens with the local key and its own audience.
	grafana := authnlib.NewAccessTokenVerifier(authnlib.VerifierConfig{AllowedAudiences: []string{"grafana"}}, exchanger.keys)
	sign := func(req authnlib.TokenExchangeRequest) (*authnlib.Claims[authnlib.AccessTokenClaims], error) {
		token, err := exchanger.signForPolicy(context.Background(), policy, req)
		if err != nil {
			return nil, err
		}
		return grafana.Verify(context.Background(), token)
	}
	// What Grafana sends the plugin with a request from user u1.
	inbound := func(audience, namespace string) string {
		idToken := signTestToken(t, authnlib.TokenTypeID, "user:u1", authnlib.IDTokenClaims{Identifier: "u1", Type: types.TypeUser, Namespace: namespace})
		rsp, err := exchanger.Exchange(context.Background(), authnlib.TokenExchangeRequest{Namespace: namespace, Audiences: []string{audience}, SubjectToken: idToken})
		require.NoError(t, err)
		return rsp.Token
	}

	t.Run("as the plugin", func(t *testing.T) {
		claims, err := sign(authnlib.TokenExchangeRequest{Namespace: "*", Audiences: []string{"example.ext.grafana.app", "grafana"}})
		require.NoError(t, err)
		require.Equal(t, "access-policy:example-app", claims.Subject)
		require.Equal(t, "*", claims.Rest.Namespace)
		require.Equal(t, policy.Permissions, claims.Rest.Permissions)
		require.Empty(t, claims.Rest.DelegatedPermissions)
		require.Nil(t, claims.Rest.Actor)
		require.False(t, claims.Rest.IsOnBehalfOfUser())
	})

	t.Run("on behalf of the caller", func(t *testing.T) {
		claims, err := sign(authnlib.TokenExchangeRequest{Namespace: "default", Audiences: []string{"grafana"}, SubjectToken: inbound("example-app", "default")})
		require.NoError(t, err)
		require.Equal(t, "access-policy:example-app", claims.Subject)
		require.Equal(t, policy.DelegatedPermissions, claims.Rest.DelegatedPermissions)
		require.Empty(t, claims.Rest.Permissions)
		require.True(t, claims.Rest.IsOnBehalfOfUser())
		require.Equal(t, "access-policy:grafana", claims.Rest.Actor.Subject, "the delegation chain is kept")
		require.Equal(t, "user:u1", authnlib.NewAccessTokenAuthInfo(*claims).GetSubject())
	})

	t.Run("restricted delegated permissions", func(t *testing.T) {
		claims, err := sign(authnlib.TokenExchangeRequest{
			Namespace: "default", Audiences: []string{"grafana"}, SubjectToken: inbound("example-app", "default"),
			RestrictedDelegatedPermissions: []string{"dashboard.grafana.app/dashboards:get", "folder.grafana.app/folders:get"},
		})
		require.NoError(t, err)
		require.Equal(t, []string{"dashboard.grafana.app/dashboards:get"}, claims.Rest.DelegatedPermissions)
	})

	t.Run("refuses to delegate nothing", func(t *testing.T) {
		// The caller's org role would survive empty delegated permissions.
		empty := LocalAccessPolicy{PluginID: "example-app", Audiences: []string{"grafana"}}
		_, err := exchanger.signForPolicy(context.Background(), empty, authnlib.TokenExchangeRequest{
			Namespace: "default", Audiences: []string{"grafana"}, SubjectToken: inbound("example-app", "default"),
		})
		require.ErrorIs(t, err, ErrLocalAccessDenied)

		_, err = sign(authnlib.TokenExchangeRequest{
			Namespace: "default", Audiences: []string{"grafana"}, SubjectToken: inbound("example-app", "default"),
			RestrictedDelegatedPermissions: []string{"folder.grafana.app/folders:get"},
		})
		require.ErrorIs(t, err, ErrLocalAccessDenied, "a restriction that leaves nothing is refused too")

		// The plugin's own token with no permissions has no caller to carry a role.
		_, err = exchanger.signForPolicy(context.Background(), empty, authnlib.TokenExchangeRequest{Namespace: "*", Audiences: []string{"grafana"}})
		require.NoError(t, err)
	})

	t.Run("restricted delegated permissions leave the plugin's own token alone", func(t *testing.T) {
		claims, err := sign(authnlib.TokenExchangeRequest{
			Namespace: "*", Audiences: []string{"grafana"},
			RestrictedDelegatedPermissions: []string{"folder.grafana.app/folders:get"},
		})
		require.NoError(t, err)
		require.Equal(t, policy.Permissions, claims.Rest.Permissions)
	})

	for _, tc := range []struct {
		name string
		req  authnlib.TokenExchangeRequest
	}{
		{name: "an audience outside the policy", req: authnlib.TokenExchangeRequest{Namespace: "*", Audiences: []string{"grafana", "other-app"}}},
		{name: "a subject token issued to another plugin", req: authnlib.TokenExchangeRequest{Namespace: "default", Audiences: []string{"grafana"}, SubjectToken: inbound("other-app", "default")}},
		{name: "another namespace than the subject's", req: authnlib.TokenExchangeRequest{Namespace: "org-2", Audiences: []string{"grafana"}, SubjectToken: inbound("example-app", "default")}},
		{name: "all namespaces for a subject in one", req: authnlib.TokenExchangeRequest{Namespace: "*", Audiences: []string{"grafana"}, SubjectToken: inbound("example-app", "default")}},
		{name: "a subject token signed by another key", req: authnlib.TokenExchangeRequest{Namespace: "default", Audiences: []string{"grafana"},
			SubjectToken: signTestToken(t, authnlib.TokenTypeAccess, "access-policy:grafana", authnlib.AccessTokenClaims{Namespace: "default"})}},
		{name: "an asserted subject", req: authnlib.TokenExchangeRequest{Namespace: "default", Audiences: []string{"grafana"}, Subject: &authnlib.TokenExchangeSubject{Sub: "user:u1"}}},
	} {
		t.Run("denies "+tc.name, func(t *testing.T) {
			_, err := sign(tc.req)
			require.ErrorIs(t, err, ErrLocalAccessDenied)
		})
	}

	_, err = sign(authnlib.TokenExchangeRequest{Audiences: []string{"grafana"}})
	require.ErrorContains(t, err, "namespace and audiences are required")

	t.Run("tokens for plugins are not valid for Grafana", func(t *testing.T) {
		_, err := grafana.Verify(context.Background(), inbound("example-app", "default"))
		require.Error(t, err)
	})
}

package authn

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/setting"
)

func TestNewGrafanaTokenAuthenticatorInvalidConfig(t *testing.T) {
	for _, tc := range []struct {
		name      string
		jwksURL   string
		audiences []string
		wantError string
	}{
		{name: "missing JWKS URL", audiences: []string{"grafana"}, wantError: "missing cfg.ExtJWTAuth.JWKSUrl"},
		{name: "nil audiences", jwksURL: "https://jwks.invalid/keys", wantError: "missing cfg.ExtJWTAuth.Audiences"},
		{name: "empty audiences", jwksURL: "https://jwks.invalid/keys", audiences: []string{}, wantError: "missing cfg.ExtJWTAuth.Audiences"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.ExtJWTAuth.JWKSUrl = tc.jwksURL
			cfg.ExtJWTAuth.Audiences = tc.audiences
			authenticator, err := NewGrafanaTokenAuthenticator(cfg)
			require.ErrorContains(t, err, tc.wantError)
			require.Nil(t, authenticator)
		})
	}
}

func TestGrafanaTokenAuthenticator(t *testing.T) {
	t.Run("unconfigured verifier", func(t *testing.T) {
		authenticator := &GrafanaTokenAuthenticator{}
		requester, err := authenticator.AuthenticateToken(t.Context(), "token")
		require.True(t, apierrors.IsUnauthorized(err), "%v", err)
		require.ErrorContains(t, err, "token verifier is not configured")
		require.Nil(t, requester)
	})
	t.Run("verifier returns no claims", func(t *testing.T) {
		authenticator := &GrafanaTokenAuthenticator{verifier: authnlib.NewNoopVerifier[authnlib.AccessTokenClaims]()}
		requester, err := authenticator.AuthenticateToken(t.Context(), "token")
		require.True(t, apierrors.IsUnauthorized(err), "%v", err)
		require.ErrorContains(t, err, "invalid access token")
		require.Nil(t, requester)
	})

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, json.NewEncoder(w).Encode(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{Key: &key.PublicKey, KeyID: "test-key", Algorithm: string(jose.ES256), Use: "sig"}}}))
	}))
	defer server.Close()
	cfg := setting.NewCfg()
	cfg.ExtJWTAuth.JWKSUrl = server.URL
	cfg.ExtJWTAuth.Audiences = []string{"grafana"}
	authenticator, err := NewGrafanaTokenAuthenticator(cfg)
	require.NoError(t, err)
	sign := func(claims authnlib.Claims[authnlib.AccessTokenClaims], signingKey *ecdsa.PrivateKey, tokenType string) string {
		t.Helper()
		signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: signingKey}, (&jose.SignerOptions{}).WithType(jose.ContentType(tokenType)).WithHeader("kid", "test-key"))
		require.NoError(t, err)
		token, err := jwt.Signed(signer).Claims(claims).Serialize()
		require.NoError(t, err)
		return token
	}
	validClaims := func() authnlib.Claims[authnlib.AccessTokenClaims] {
		return authnlib.Claims[authnlib.AccessTokenClaims]{
			Claims: jwt.Claims{Subject: "access-policy:policy-1", Audience: jwt.Audience{"grafana"}, Expiry: jwt.NewNumericDate(time.Now().Add(time.Hour))},
			Rest:   authnlib.AccessTokenClaims{Namespace: "stacks-5457", Permissions: []string{"plugins.grafana.app:*"}, DelegatedPermissions: []string{"plugins.grafana.app/plugins:get"}, ServiceIdentity: "edge"},
		}
	}
	for _, prefix := range []string{"", "Bearer "} {
		t.Run("access policy/"+prefix, func(t *testing.T) {
			token := sign(validClaims(), key, authnlib.TokenTypeAccess)
			requester, err := authenticator.AuthenticateToken(t.Context(), prefix+token)
			require.NoError(t, err)
			require.Equal(t, "access-policy:policy-1", requester.GetUID())
			require.Equal(t, "stacks-5457", requester.GetNamespace())
			require.Equal(t, int64(1), requester.GetOrgID())
			require.Equal(t, []string{"grafana"}, requester.GetAudience())
			require.Equal(t, validClaims().Rest.Permissions, requester.GetTokenPermissions())
			require.Equal(t, token, requester.GetAccessToken())
			require.False(t, requester.GetIsGrafanaAdmin())
			require.Equal(t, map[string][]string{
				authnlib.ServiceIdentityKey:          {"edge"},
				authnlib.InnermostServiceIdentityKey: {"edge"},
			}, requester.GetExtra())
		})
	}
	for namespace, orgID := range map[string]int64{"default": 1, "org-12": 12, "*": 0} {
		t.Run(namespace, func(t *testing.T) {
			claims := validClaims()
			claims.Rest.Namespace = namespace
			requester, err := authenticator.AuthenticateToken(t.Context(), sign(claims, key, authnlib.TokenTypeAccess))
			require.NoError(t, err)
			require.Equal(t, namespace, requester.GetNamespace())
			require.Equal(t, orgID, requester.GetOrgID())
		})
	}

	for _, typ := range []types.IdentityType{types.TypeUser, types.TypeServiceAccount} {
		t.Run(string(typ), func(t *testing.T) {
			claims := validClaims()
			claims.Rest.Actor = &authnlib.ActorClaims{Subject: "access-policy:intermediate", Actor: &authnlib.ActorClaims{
				Subject:         types.NewTypeID(typ, "42"),
				ServiceIdentity: "origin",
				IDTokenClaims:   authnlib.IDTokenClaims{Type: typ, Identifier: "user-uid", Username: "alice", Email: "alice@example.com", EmailVerified: true, Groups: []string{"team-1"}},
			}}
			requester, err := authenticator.AuthenticateToken(t.Context(), sign(claims, key, authnlib.TokenTypeAccess))
			require.NoError(t, err)
			require.Equal(t, types.NewTypeID(typ, "user-uid"), requester.GetUID())
			require.Equal(t, types.NewTypeID(typ, "42"), requester.GetSubject())
			require.Equal(t, "alice", requester.GetLogin())
			require.Equal(t, "alice@example.com", requester.GetEmail())
			require.True(t, requester.GetEmailVerified())
			require.Equal(t, []string{"team-1"}, requester.GetGroups())
			require.Empty(t, requester.GetTokenPermissions())
			require.Equal(t, claims.Rest.DelegatedPermissions, requester.GetTokenDelegatedPermissions())
			require.Equal(t, map[string][]string{
				authnlib.ServiceIdentityKey:          {"edge"},
				authnlib.InnermostServiceIdentityKey: {"origin"},
			}, requester.GetExtra())
		})
	}
	for _, tc := range []struct {
		name   string
		mutate func(*authnlib.Claims[authnlib.AccessTokenClaims])
	}{
		{"expired", func(c *authnlib.Claims[authnlib.AccessTokenClaims]) {
			c.Expiry = jwt.NewNumericDate(time.Now().Add(-time.Hour))
		}},
		{"not yet valid", func(c *authnlib.Claims[authnlib.AccessTokenClaims]) {
			c.NotBefore = jwt.NewNumericDate(time.Now().Add(time.Hour))
		}},
		{"wrong audience", func(c *authnlib.Claims[authnlib.AccessTokenClaims]) { c.Audience = jwt.Audience{"other"} }},
		{"invalid subject", func(c *authnlib.Claims[authnlib.AccessTokenClaims]) { c.Subject = "user:42" }},

		{"malformed subject", func(c *authnlib.Claims[authnlib.AccessTokenClaims]) { c.Subject = "invalid" }},
		{"malformed namespace", func(c *authnlib.Claims[authnlib.AccessTokenClaims]) { c.Rest.Namespace = "stacks-invalid" }},
		{"actor type mismatch", func(c *authnlib.Claims[authnlib.AccessTokenClaims]) {
			c.Rest.Actor = &authnlib.ActorClaims{Subject: "service-account:42", IDTokenClaims: authnlib.IDTokenClaims{Type: types.TypeUser, Identifier: "user-uid"}}
		}},
		{"missing actor identifier", func(c *authnlib.Claims[authnlib.AccessTokenClaims]) {
			c.Rest.Actor = &authnlib.ActorClaims{Subject: "user:42", IDTokenClaims: authnlib.IDTokenClaims{Type: types.TypeUser}}
		}},
		{"invalid namespace", func(c *authnlib.Claims[authnlib.AccessTokenClaims]) { c.Rest.Namespace = "" }},
		{"invalid actor", func(c *authnlib.Claims[authnlib.AccessTokenClaims]) {
			c.Rest.Actor = &authnlib.ActorClaims{Subject: "invalid", IDTokenClaims: authnlib.IDTokenClaims{Type: types.TypeUser}}
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			claims := validClaims()
			tc.mutate(&claims)
			requester, err := authenticator.AuthenticateToken(t.Context(), sign(claims, key, authnlib.TokenTypeAccess))
			require.True(t, apierrors.IsUnauthorized(err), "%v", err)
			require.Nil(t, requester)
		})
	}
	otherKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	for name, token := range map[string]string{
		"empty": "", "malformed": "not-a-token",
		"empty bearer":             "Bearer ",
		"malformed bearer":         "Bearer not-a-token",
		"bearer invalid signature": "Bearer " + sign(validClaims(), otherKey, authnlib.TokenTypeAccess),
		"invalid signature":        sign(validClaims(), otherKey, authnlib.TokenTypeAccess),
		"ID token":                 sign(validClaims(), key, authnlib.TokenTypeID),
	} {
		t.Run(name, func(t *testing.T) {
			requester, err := authenticator.AuthenticateToken(t.Context(), token)
			require.True(t, apierrors.IsUnauthorized(err), "%v", err)
			require.Nil(t, requester)
		})
	}
}

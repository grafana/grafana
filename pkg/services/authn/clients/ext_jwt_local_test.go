package clients

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"net/http"
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
	"github.com/grafana/grafana/pkg/setting"
)

func TestExtendedJWT_localPluginTokens(t *testing.T) {
	cfgWith := func(jwksURL string) *setting.Cfg {
		return &setting.Cfg{
			Raw:        ini.Empty(),
			ExtJWTAuth: setting.ExtJWTSettings{JWKSUrl: jwksURL, Audiences: []string{"grafana"}},
		}
	}
	policy := v3.LocalAccessPolicy{
		PluginID:    "example-app",
		Audiences:   []string{"grafana"},
		Permissions: []string{"dashboard.grafana.app/dashboards:get"},
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
		client := ProvideExtendedJWT(cfgWith(""), tracing.InitializeTracerForTest())
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
		idToken := signIDToken(t, "user:u1", authlib.IDTokenClaims{Identifier: "u1", Type: claims.TypeUser, Namespace: "default"})
		inbound, err := exchanger.Exchange(context.Background(), authlib.TokenExchangeRequest{Namespace: "default", Audiences: []string{"example-app"}, SubjectToken: idToken})
		require.NoError(t, err)

		client := ProvideExtendedJWT(cfgWith(""), tracing.InitializeTracerForTest())
		_, err = client.Authenticate(context.Background(), request(inbound.Token))
		require.Error(t, err, "tokens for plugins are not valid for Grafana")

		token := sign(t, authlib.TokenExchangeRequest{Namespace: "default", Audiences: []string{"grafana"}, SubjectToken: inbound.Token})
		identity, err := client.Authenticate(context.Background(), request(token))
		require.NoError(t, err)
		require.Equal(t, claims.TypeUser, identity.Type)
		require.Equal(t, "u1", identity.UID)
		require.Equal(t, "default", identity.Namespace)
		require.Equal(t, "access-policy:example-app", identity.AuthID)
		require.Equal(t, policy.Permissions, identity.ClientParams.FetchPermissionsParams.K8sRestrictedActions,
			"the caller's permissions are limited to what the plugin may do")
	})

	t.Run("not trusted with a real signer", func(t *testing.T) {
		client := ProvideExtendedJWT(cfgWith("https://auth.example.com/jwks"), tracing.InitializeTracerForTest())
		require.False(t, client.IsEnabled(context.Background()))
	})
}

func signIDToken(t *testing.T, subject string, idClaims authlib.IDTokenClaims) string {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: key},
		(&jose.SignerOptions{}).WithType(jose.ContentType(authlib.TokenTypeID)).WithHeader("kid", "test"))
	require.NoError(t, err)
	token, err := jwt.Signed(signer).Claims(jwt.Claims{Subject: subject, Expiry: jwt.NewNumericDate(time.Now().Add(time.Hour))}).Claims(idClaims).Serialize()
	require.NoError(t, err)
	return token
}

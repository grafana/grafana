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
	"github.com/stretchr/testify/require"
)

func TestIsDatasourceGroup(t *testing.T) {
	for group, want := range map[string]bool{
		"loki.datasource.grafana.app":                          true,
		"grafana-postgresql-datasource.datasource.grafana.app": true,
		"datasource.grafana.app":                               false,
		".datasource.grafana.app":                              false,
		"foo.bar.datasource.grafana.app":                       false,
		"folder.grafana.app":                                   false,
		"example-aisdk-app":                                    false,
		"":                                                     false,
	} {
		require.Equal(t, want, isDatasourceGroup(group), group)
	}
}

func TestVerifyAccessTokenForRequest(t *testing.T) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		require.NoError(t, json.NewEncoder(w).Encode(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{Key: &key.PublicKey, KeyID: "test-key", Algorithm: string(jose.ES256), Use: "sig"}}}))
	}))
	defer server.Close()
	keys := authnlib.NewKeyRetriever(authnlib.KeyRetrieverConfig{SigningKeysURL: server.URL})
	verifier := authnlib.NewAccessTokenVerifier(authnlib.VerifierConfig{AllowedAudiences: []string{"grafana"}}, keys)

	sign := func(exp time.Time, audiences ...string) string {
		t.Helper()
		signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: key}, (&jose.SignerOptions{}).WithType(jose.ContentType(authnlib.TokenTypeAccess)).WithHeader("kid", "test-key"))
		require.NoError(t, err)
		token, err := jwt.Signed(signer).Claims(jwt.Claims{
			Subject: "access-policy:example", Audience: audiences, Expiry: jwt.NewNumericDate(exp),
		}).Claims(authnlib.AccessTokenClaims{Namespace: "stacks-1"}).Serialize()
		require.NoError(t, err)
		return token
	}
	valid := time.Now().Add(time.Minute)
	const lokiPath = "/apis/loki.datasource.grafana.app/v0alpha1/namespaces/stacks-1/datasources"

	for _, tc := range []struct {
		name  string
		token string
		path  string
		keys  authnlib.KeyRetriever
		err   error
	}{
		{name: "configured audience, any path", token: sign(valid, "grafana"), path: "/api/user", keys: keys},
		{name: "configured audience, api group path", token: sign(valid, "grafana"), path: "/apis/folder.grafana.app/v1/folders", keys: keys},
		{name: "app plugin audience, its group", token: sign(valid, "example-aisdk-app"), path: "/apis/example-aisdk-app/v1", keys: keys},
		{name: "datasource plugin audience, its group", token: sign(valid, "github-datasource"), path: "/apis/github-datasource/v1", keys: keys},
		{name: "plugin audience, other plugin", token: sign(valid, "example-aisdk-app"), path: "/apis/github-datasource/v1", keys: keys, err: authnlib.ErrInvalidAudience},
		{name: "plugin audience, non-canonical path", token: sign(valid, "example-aisdk-app"), path: "/apis/example-aisdk-app/../github-datasource/v1", keys: keys, err: authnlib.ErrInvalidAudience},
		{name: "group audience, its group", token: sign(valid, "folder.grafana.app"), path: "/apis/folder.grafana.app/v1/folders", keys: keys},
		{name: "group audience among others", token: sign(valid, "iam.grafana.app", "folder.grafana.app"), path: "/apis/folder.grafana.app/v1/folders", keys: keys},
		{name: "group audience, other group", token: sign(valid, "iam.grafana.app"), path: "/apis/folder.grafana.app/v1/folders", keys: keys, err: authnlib.ErrInvalidAudience},
		{name: "group audience, not an api path", token: sign(valid, "folder.grafana.app"), path: "/api/folders", keys: keys, err: authnlib.ErrInvalidAudience},
		{name: "group audience, discovery", token: sign(valid, "folder.grafana.app"), path: "/apis", keys: keys, err: authnlib.ErrInvalidAudience},
		{name: "group audience, non-canonical path", token: sign(valid, "folder.grafana.app"), path: "/apis/folder.grafana.app/../iam.grafana.app/v0alpha1/whoami", keys: keys, err: authnlib.ErrInvalidAudience},
		{name: "group audience without keys", token: sign(valid, "folder.grafana.app"), path: "/apis/folder.grafana.app/v1/folders", err: authnlib.ErrInvalidAudience},
		{name: "expired group audience", token: sign(time.Now().Add(-2*time.Minute), "folder.grafana.app"), path: "/apis/folder.grafana.app/v1/folders", keys: keys, err: authnlib.ErrExpiredToken},
		{name: "datasource audience, a datasource group", token: sign(valid, datasourceAudience), path: lokiPath, keys: keys},
		{name: "datasource group audience, its group", token: sign(valid, "loki.datasource.grafana.app"), path: lokiPath, keys: keys},
		{name: "datasource audience, another group", token: sign(valid, datasourceAudience), path: "/apis/folder.grafana.app/v1/folders", keys: keys, err: authnlib.ErrInvalidAudience},
		{name: "datasource audience, the shared datasource group", token: sign(valid, datasourceAudience), path: "/apis/datasource.grafana.app/v0alpha1/namespaces/stacks-1/datasources", keys: keys, err: authnlib.ErrInvalidAudience},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tc.path, nil)
			claims, err := VerifyAccessTokenForRequest(t.Context(), tc.token, req, verifier, tc.keys)
			if tc.err != nil {
				require.ErrorIs(t, err, tc.err)
				require.Nil(t, claims)
				return
			}
			require.NoError(t, err)
			require.Equal(t, "access-policy:example", claims.Subject)
		})
	}
}

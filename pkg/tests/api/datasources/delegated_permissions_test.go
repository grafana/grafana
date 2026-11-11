package datasources

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationDataSourceDelegatedPermissions(t *testing.T) {
	testinfra.RunWithFeatureToggle(t, featuremgmt.FlagAuthzUseLegacyCheck, testIntegrationDataSourceDelegatedPermissions)
}

func testIntegrationDataSourceDelegatedPermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	const keyID = "delegated-permissions-test"
	jwks, err := json.Marshal(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{
		Key: &key.PublicKey, KeyID: keyID, Algorithm: string(jose.ES256), Use: "sig",
	}}})
	require.NoError(t, err)
	keyServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(jwks)
	}))
	t.Cleanup(keyServer.Close)

	t.Setenv("GF_AUTH_EXTENDED_JWT_ENABLED", "true")
	t.Setenv("GF_AUTH_EXTENDED_JWT_JWKS_URL", keyServer.URL)
	t.Setenv("GF_AUTH_EXTENDED_JWT_AUDIENCES", "grafana")

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{DisableAnonymous: true})
	env := helper.GetEnv()
	target := createResolverDataSource(t, &env, "delegated-target", "Delegated target", helper.Org1.OrgID)
	other := createResolverDataSource(t, &env, "delegated-other", "Delegated other", helper.Org1.OrgID)
	grants := datasourceReadGrant(target.UID)
	grants[0].Actions = []string{datasources.ActionRead, datasources.ActionQuery}
	caller := helper.CreateUser("delegated-user", apis.Org1, org.RoleNone, grants)

	sign := func(tokenType authnlib.TokenType, claims any) string {
		t.Helper()
		signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: key},
			(&jose.SignerOptions{}).WithType(jose.ContentType(tokenType)).WithHeader("kid", keyID))
		require.NoError(t, err)
		token, err := jwt.Signed(signer).Claims(claims).Serialize()
		require.NoError(t, err)
		return token
	}
	identityClaims := authnlib.Claims[authnlib.IDTokenClaims]{
		Claims: jwt.Claims{
			Subject: caller.Identity.GetID(),
			Expiry:  jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
		Rest: authnlib.IDTokenClaims{
			Type: types.TypeUser, Identifier: caller.Identity.GetIdentifier(),
			Namespace: caller.Identity.GetNamespace(), Username: caller.Identity.GetLogin(),
		},
	}
	idToken := sign(authnlib.TokenTypeID, identityClaims)

	// Warm the user's permission cache before authenticating restricted tokens.
	requireDataSourceRead(t, helper, caller, "/api/datasources/uid/"+target.UID, http.StatusOK, target.UID)

	for _, mode := range []string{"on behalf of user", "access token and ID token"} {
		t.Run(mode, func(t *testing.T) {
			for _, tc := range []struct {
				name       string
				actions    []string
				wantStatus int
			}{
				{
					name: "delegated read preserves resource scope", actions: []string{datasources.ActionRead},
					wantStatus: http.StatusOK,
				},
				{
					name: "unrelated delegation cannot restore read", actions: []string{datasources.ActionQuery},
					wantStatus: http.StatusForbidden,
				},
				{
					name: "empty delegation denies read", actions: []string{},
					wantStatus: http.StatusForbidden,
				},
			} {
				t.Run(tc.name, func(t *testing.T) {
					claims := authnlib.Claims[authnlib.AccessTokenClaims]{
						Claims: jwt.Claims{
							Subject: "access-policy:delegated-permissions-test", Audience: jwt.Audience{"grafana"},
							IssuedAt: jwt.NewNumericDate(time.Now()), Expiry: jwt.NewNumericDate(time.Now().Add(time.Hour)),
						},
						Rest: authnlib.AccessTokenClaims{
							Namespace: caller.Identity.GetNamespace(), DelegatedPermissions: tc.actions,
						},
					}
					headers := map[string]string{}
					if mode == "on behalf of user" {
						claims.Rest.Actor = &authnlib.ActorClaims{
							Subject: identityClaims.Subject, IDTokenClaims: identityClaims.Rest,
						}
					} else {
						headers["X-Grafana-Id"] = idToken
					}
					headers["X-Access-Token"] = sign(authnlib.TokenTypeAccess, claims)

					// Even an empty delegation must authenticate as the user before authorization denies access.
					profile := apis.DoRequest(helper, apis.RequestParams{
						Path: "/api/user", Headers: headers,
					}, &user.UserProfileDTO{})
					require.Equal(t, http.StatusOK, profile.Response.StatusCode, string(profile.Body))
					require.Equal(t, caller.Identity.GetIdentifier(), profile.Result.UID)

					for _, ds := range []*datasources.DataSource{target, other} {
						wantStatus := http.StatusForbidden
						if ds == target {
							wantStatus = tc.wantStatus
						}
						for _, path := range []string{
							"/api/datasources/uid/" + ds.UID,
							"/api/datasources/name/" + url.PathEscape(ds.Name),
						} {
							t.Run(fmt.Sprintf("GET %s", path), func(t *testing.T) {
								response := apis.DoRequest(helper, apis.RequestParams{Path: path, Headers: headers}, &dtos.DataSource{})
								require.Equal(t, wantStatus, response.Response.StatusCode, string(response.Body))
								if wantStatus == http.StatusOK {
									require.Equal(t, target.UID, response.Result.UID)
								}
							})
						}
					}
				})
			}
		})
	}

	// Request-specific restrictions must not change the cached grants for other credentials.
	requireDataSourceRead(t, helper, caller, "/api/datasources/uid/"+target.UID, http.StatusOK, target.UID)
}

package tokenexchange

import (
	"context"
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
	"google.golang.org/grpc/metadata"
	"gopkg.in/ini.v1"
	"k8s.io/client-go/rest"

	appplugin "github.com/grafana/grafana-app-sdk/plugin"
	"github.com/grafana/grafana/pkg/infra/tracing"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/clients"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginauth"
	"github.com/grafana/grafana/pkg/setting"
)

// Exercise the SDK's actual HTTP transport: its audiences, caller context and
// authentication headers must all agree with the local exchange and Grafana.
func TestSDKLocalTokenRoundTrip(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagApppluginsLoadAppManifest)
	for _, name := range []string{
		appplugin.EnvVarGrafanaJWKS, appplugin.EnvVarGrafanaJWKSURL,
		appplugin.EnvVarAPIAccessBearerToken, appplugin.EnvVarAPIAccessCAFile, appplugin.EnvVarAPIAccessInsecureTLS, //nolint:gosec,staticcheck // SA1019: includes a deprecated variable name; names, not credentials
	} {
		t.Setenv(name, "")
	}
	cfg := &setting.Cfg{Raw: ini.Empty(), ExtJWTAuth: setting.ExtJWTSettings{Audiences: []string{"grafana"}}}
	localAuth, err := pluginauth.ProvideConfig(cfg)
	require.NoError(t, err)
	grafana := clients.ProvideExtendedJWTWithPluginAuth(cfg, tracing.InitializeTracerForTest(), localAuth)
	signer := newTestServer(t)
	capToken, err := v3.IssueLocalAccessPolicyToken("example-app", testManifest)
	require.NoError(t, err)
	t.Cleanup(func() { v3.RevokeLocalAccessPolicyToken(capToken) })

	keys, err := v3.LocalKeyRetriever()
	require.NoError(t, err)
	pluginAuth := authnlib.NewAccessTokenAuthenticator(authnlib.NewAccessTokenVerifier(
		authnlib.VerifierConfig{AllowedAudiences: []string{"example-app"}}, keys))
	exchanger, err := v3.LocalTokenExchanger()
	require.NoError(t, err)

	for _, tc := range []struct {
		name      string
		namespace string
		orgID     int64
		obo       bool
	}{
		{name: "background request", namespace: "default", orgID: 1},
		{name: "background request in org 2", namespace: "org-2", orgID: 2},
		{name: "on behalf of caller", namespace: "default", orgID: 1, obo: true},
		{name: "on behalf of caller in org 2", namespace: "org-2", orgID: 2, obo: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				id, err := grafana.Authenticate(r.Context(), &authn.Request{HTTPRequest: r, OrgID: tc.orgID})
				if err != nil {
					http.Error(w, err.Error(), http.StatusUnauthorized)
					return
				}
				_ = json.NewEncoder(w).Encode(sdkTestIdentity{
					OrgID: id.OrgID, Type: id.Type, ID: id.ID, UID: id.UID, Namespace: id.Namespace,
					K8s:                  id.ClientParams.FetchPermissionsParams.K8s,
					K8sRestrictedActions: id.ClientParams.FetchPermissionsParams.K8sRestrictedActions,
					Permissions:          id.AccessTokenClaims.Rest.Permissions,
				})
			}))
			defer api.Close()
			t.Setenv(appplugin.EnvVarAPIAccessRouterURL, api.URL)
			t.Setenv(appplugin.EnvVarAPIAccessTokenExchangeURL, signer.URL)
			t.Setenv(appplugin.EnvVarAPIAccessCAPToken, capToken)
			kubeConfig, err := appplugin.BuildKubeConfig(*testManifest)
			require.NoError(t, err)
			client, err := rest.HTTPClientFor(kubeConfig)
			require.NoError(t, err)

			ctx := context.Background()
			if tc.obo {
				inbound, err := exchanger.Exchange(ctx, authnlib.TokenExchangeRequest{
					Namespace: tc.namespace, Audiences: []string{"example-app"},
					SubjectToken: sdkTestIDToken(t, tc.namespace),
				})
				require.NoError(t, err)
				caller, err := pluginAuth.Authenticate(ctx, authnlib.NewGRPCTokenProvider(metadata.Pairs("x-access-token", inbound.Token)))
				require.NoError(t, err)
				ctx = types.WithAuthInfo(ctx, caller)
			}
			req, err := http.NewRequestWithContext(ctx, http.MethodGet, api.URL+"/apis/dashboard.grafana.app/v1/namespaces/"+tc.namespace+"/dashboards", nil)
			require.NoError(t, err)
			rsp, err := client.Do(req)
			require.NoError(t, err)
			defer func() { _ = rsp.Body.Close() }()
			require.Equal(t, http.StatusOK, rsp.StatusCode)
			var id sdkTestIdentity
			require.NoError(t, json.NewDecoder(rsp.Body).Decode(&id))
			require.Equal(t, tc.orgID, id.OrgID)
			if tc.obo {
				require.Equal(t, types.TypeUser, id.Type)
				require.Equal(t, "42", id.ID)
				require.Equal(t, "u42", id.UID)
				require.Equal(t, tc.namespace, id.Namespace)
				require.Contains(t, id.K8sRestrictedActions, "dashboard.grafana.app/dashboards:list")
				require.Empty(t, id.Permissions)
			} else {
				require.Equal(t, types.TypeAccessPolicy, id.Type)
				require.Equal(t, "example-app", id.ID)
				require.Contains(t, id.K8s, "dashboard.grafana.app/dashboards:list")
			}
		})
	}
}

// sdkTestIdentity is what the test API returns about the authenticated identity:
// only the fields the test checks, and never the access token itself.
type sdkTestIdentity struct {
	OrgID                int64
	Type                 types.IdentityType
	ID                   string
	UID                  string
	Namespace            string
	K8s                  []string
	K8sRestrictedActions []string
	Permissions          []string
}

func sdkTestIDToken(t *testing.T, namespace string) string {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: key},
		(&jose.SignerOptions{}).WithType(jose.ContentType(authnlib.TokenTypeID)))
	require.NoError(t, err)
	token, err := jwt.Signed(signer).Claims(jwt.Claims{
		Subject: "user:42", Expiry: jwt.NewNumericDate(time.Now().Add(time.Minute)),
	}).Claims(authnlib.IDTokenClaims{Identifier: "u42", Type: types.TypeUser, Namespace: namespace}).Serialize()
	require.NoError(t, err)
	return token
}

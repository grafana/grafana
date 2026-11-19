package clients_test

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

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	permreg "github.com/grafana/grafana/pkg/services/accesscontrol/permreg/test"
	"github.com/grafana/grafana/pkg/services/authn"
	authnsync "github.com/grafana/grafana/pkg/services/authn/authnimpl/sync"
	"github.com/grafana/grafana/pkg/services/authn/clients"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginauth"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	pluginID       = "example-app"
	pluginGroup    = "example.ext.grafana.app"
	pluginResource = pluginGroup + "/things"
	audience       = "grafana"
	namespace      = "default"
	userID         = "u1"
)

func TestExtendedJWTPluginDelegationSync_GroupWildcard(t *testing.T) {
	create := pluginResource + ":create"
	get := pluginResource + ":get"
	ident := syncPluginCallerPermissions(t,
		[]string{pluginGroup + ":*"},
		[]accesscontrol.Permission{
			{Action: create},
			{Action: get},
			{Action: "other.ext.grafana.app/things:create"},
		},
	)

	require.Equal(t, map[string][]string{create: {""}, get: {""}}, ident.Permissions[ident.OrgID])
}

func TestExtendedJWTPluginDelegationSync_K8sVerbAliases(t *testing.T) {
	get := pluginResource + ":get"
	update := pluginResource + ":update"
	ident := syncPluginCallerPermissions(t,
		[]string{pluginResource + ":list", pluginResource + ":patch"},
		[]accesscontrol.Permission{
			{Action: get},
			{Action: update},
			{Action: pluginResource + ":delete"},
		},
	)

	require.Equal(t, map[string][]string{get: {""}, update: {""}}, ident.Permissions[ident.OrgID])
}

// syncPluginCallerPermissions carries the delegated claims through a real
// locally signed token, ExtendedJWT, and RBACSync. The access-control mock
// supplies the caller's stored permissions at the database boundary.
func syncPluginCallerPermissions(t *testing.T, delegated []string, held []accesscontrol.Permission) *authn.Identity {
	t.Helper()
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagApppluginsLoadAppManifest)
	cfg := &setting.Cfg{
		Raw:        ini.Empty(),
		ExtJWTAuth: setting.ExtJWTSettings{Audiences: []string{audience}},
	}
	token := createPluginDelegationToken(t, delegated)

	pluginAuth, err := pluginauth.ProvideConfig(cfg)
	require.NoError(t, err)

	client := clients.ProvideExtendedJWTWithPluginAuth(cfg, tracing.InitializeTracerForTest(), pluginAuth)
	request := &authn.Request{HTTPRequest: &http.Request{Header: http.Header{"X-Access-Token": {token}}}}

	ident, err := client.Authenticate(context.Background(), request)
	require.NoError(t, err)
	require.Equal(t, delegated, ident.ClientParams.FetchPermissionsParams.K8sRestrictedActions)

	ac := &acmock.Mock{
		GetUserPermissionsFunc: func(context.Context, identity.Requester, accesscontrol.Options) ([]accesscontrol.Permission, error) {
			return held, nil
		},
	}

	sync := authnsync.ProvideRBACSync(cfg, ac, tracing.InitializeTracerForTest(), permreg.ProvidePermissionRegistry(t))
	require.NoError(t, sync.SyncPermissionsHook(context.Background(), ident, request))

	return ident
}

func createPluginDelegationToken(t *testing.T, delegated []string) string {
	t.Helper()
	policy := v3.LocalAccessPolicy{
		PluginID:             pluginID,
		Audiences:            []string{audience, pluginGroup},
		Permissions:          delegated,
		DelegatedPermissions: delegated,
	}

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: key},
		(&jose.SignerOptions{}).WithType(jose.ContentType(authlib.TokenTypeID)))
	require.NoError(t, err)
	idToken, err := jwt.Signed(signer).Claims(jwt.Claims{
		Subject: "user:" + userID, Expiry: jwt.NewNumericDate(time.Now().Add(time.Hour)),
	}).Claims(authlib.IDTokenClaims{
		Identifier: userID, Type: claims.TypeUser, Namespace: namespace,
	}).Serialize()
	require.NoError(t, err)

	exchanger, err := v3.LocalTokenExchanger()
	require.NoError(t, err)
	inbound, err := exchanger.Exchange(context.Background(), authlib.TokenExchangeRequest{
		Namespace: namespace, Audiences: []string{pluginID}, SubjectToken: idToken,
	})
	require.NoError(t, err)
	token, err := v3.SignLocalAccessToken(context.Background(), policy, authlib.TokenExchangeRequest{
		Namespace: namespace, Audiences: []string{audience}, SubjectToken: inbound.Token,
	})
	require.NoError(t, err)
	return token
}

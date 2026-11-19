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

func TestExtendedJWTPluginDelegationSync_GroupWildcard(t *testing.T) {
	const group = "example.ext.grafana.app"
	create := group + "/things:create"
	get := group + "/things:get"
	ident := syncPluginCallerPermissions(t,
		[]string{group + ":*"},
		[]accesscontrol.Permission{
			{Action: create},
			{Action: get},
			{Action: "other.ext.grafana.app/things:create"},
		},
	)

	require.Equal(t, map[string][]string{create: {""}, get: {""}}, ident.Permissions[ident.OrgID])
}

func TestExtendedJWTPluginDelegationSync_K8sVerbAliases(t *testing.T) {
	const resource = "example.ext.grafana.app/things"
	get := resource + ":get"
	update := resource + ":update"
	ident := syncPluginCallerPermissions(t,
		[]string{resource + ":list", resource + ":patch"},
		[]accesscontrol.Permission{
			{Action: get},
			{Action: update},
			{Action: resource + ":delete"},
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
	const group = "example.ext.grafana.app"
	cfg := &setting.Cfg{
		Raw:        ini.Empty(),
		ExtJWTAuth: setting.ExtJWTSettings{Audiences: []string{"grafana"}},
	}
	policy := v3.LocalAccessPolicy{
		PluginID:             "example-app",
		Audiences:            []string{"grafana", group},
		Permissions:          delegated,
		DelegatedPermissions: delegated,
	}

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: key},
		(&jose.SignerOptions{}).WithType(jose.ContentType(authlib.TokenTypeID)))
	require.NoError(t, err)
	idToken, err := jwt.Signed(signer).Claims(jwt.Claims{
		Subject: "user:u1", Expiry: jwt.NewNumericDate(time.Now().Add(time.Hour)),
	}).Claims(authlib.IDTokenClaims{
		Identifier: "u1", Type: claims.TypeUser, Namespace: "default",
	}).Serialize()
	require.NoError(t, err)

	exchanger, err := v3.LocalTokenExchanger()
	require.NoError(t, err)
	inbound, err := exchanger.Exchange(context.Background(), authlib.TokenExchangeRequest{
		Namespace: "default", Audiences: []string{"example-app"}, SubjectToken: idToken,
	})
	require.NoError(t, err)
	token, err := v3.SignLocalAccessToken(context.Background(), policy, authlib.TokenExchangeRequest{
		Namespace: "default", Audiences: []string{"grafana"}, SubjectToken: inbound.Token,
	})
	require.NoError(t, err)

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

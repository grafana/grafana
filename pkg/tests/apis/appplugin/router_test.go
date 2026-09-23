package appplugin

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
	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	k8srest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/router"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationPluginsOverRouter(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	const (
		group     = "router-test.ext.grafana.app"
		namespace = "stacks-1234"
		audience  = "router-integration"
	)
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: key},
		(&jose.SignerOptions{}).WithType(jose.ContentType(authnlib.TokenTypeAccess)).WithHeader("kid", "router-test-key"))
	require.NoError(t, err)
	claims := authnlib.Claims[authnlib.AccessTokenClaims]{
		Claims: jwt.Claims{
			Subject: "access-policy:router-test", Audience: jwt.Audience{audience},
			IssuedAt: jwt.NewNumericDate(time.Now()), Expiry: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
		Rest: authnlib.AccessTokenClaims{
			Namespace: namespace,
			Actor: &authnlib.ActorClaims{
				Subject:       "user:42",
				IDTokenClaims: authnlib.IDTokenClaims{Type: types.TypeUser, Identifier: "router-test-user", Username: "router-test-user"},
			},
		},
	}
	sign := func(claims authnlib.Claims[authnlib.AccessTokenClaims]) string {
		t.Helper()
		token, err := jwt.Signed(signer).Claims(claims).Serialize()
		require.NoError(t, err)
		return token
	}
	token := sign(claims)
	mux := http.NewServeMux()
	mux.HandleFunc("GET /plugins", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"plugins":[{"definition":{
   "jsonData":{"id":"router-test-app","type":"app"},
   "manifest":{
    "appName":"router-test-app","group":"router-test.ext.grafana.app","preferredVersion":"v1",
    "versions":[{"name":"v1","served":true,"kinds":[
     {"kind":"Thing","plural":"things","scope":"Namespaced","folderScoped":false,
      "schemas":{"Thing":{"type":"object","properties":{"spec":{"type":"object","properties":{"value":{"type":"string"}}}}}}},
     {"kind":"Widget","plural":"widgets","scope":"Namespaced","folderScoped":false,
      "schemas":{"Widget":{"type":"object","properties":{"spec":{"type":"object","properties":{"value":{"type":"string"}}}}}}}
    ]}]
   }
  }}]}`))
	})
	mux.HandleFunc("GET /jwks", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{
			Key: &key.PublicKey, KeyID: "router-test-key", Algorithm: string(jose.ES256), Use: "sig",
		}}})
	})
	manifests := httptest.NewServer(mux)
	t.Cleanup(manifests.Close)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{DisableAnonymous: true})
	t.Cleanup(helper.Shutdown)
	cfg := setting.NewCfg()
	cfg.ExtJWTAuth.JWKSUrl = manifests.URL + "/jwks"
	cfg.ExtJWTAuth.Audiences = []string{audience}
	cfg.SectionWithEnvOverrides("cloud_router").Key("plugins_url").SetValue(manifests.URL + "/plugins")
	loader, err := router.ProvideRoutesLoader(cfg, router.PluginLoaderDependencies{
		PluginDependencies: router.PluginDependencies{Cfg: cfg, Unified: helper.GetEnv().ResourceClient},
	})
	require.NoError(t, err)
	lifecycle, ok := loader.(services.Service)
	require.True(t, ok)
	ctx, cancel := context.WithCancel(t.Context())
	t.Cleanup(cancel)
	require.NoError(t, services.StartAndAwaitRunning(ctx, lifecycle))
	t.Cleanup(func() { require.NoError(t, services.StopAndAwaitTerminated(context.Background(), lifecycle)) })
	apiRouter := router.NewGrafanaRouter(loader)
	require.NoError(t, apiRouter.Run(ctx))
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		apiRouter.HandleFunc(w, r, http.NotFoundHandler())
	}))
	t.Cleanup(server.Close)
	newClient := func(token string) dynamic.Interface {
		t.Helper()
		clientCfg := &k8srest.Config{Host: server.URL}
		clientCfg.Wrap(func(next http.RoundTripper) http.RoundTripper {
			return pluginRouterTokenTransport{next: next, token: token}
		})
		client, err := dynamic.NewForConfig(clientCfg)
		require.NoError(t, err)
		return client
	}
	client := newClient(token)

	for _, kind := range []struct{ name, plural string }{{"Thing", "things"}, {"Widget", "widgets"}} {
		t.Run(kind.name, func(t *testing.T) {
			resource := client.Resource(schema.GroupVersionResource{Group: group, Version: "v1", Resource: kind.plural}).Namespace(namespace)
			ctx := t.Context()
			require.EventuallyWithT(t, func(c *assert.CollectT) {
				_, err := resource.List(ctx, metav1.ListOptions{})
				assert.NoError(c, err, "%#v", err)
			}, 30*time.Second, 100*time.Millisecond, "router should load the polled manifest")

			created, err := resource.Create(ctx, &unstructured.Unstructured{Object: map[string]any{
				"apiVersion": group + "/v1", "kind": kind.name,
				"metadata": map[string]any{"name": "example"},
				"spec":     map[string]any{"value": "initial"},
			}}, metav1.CreateOptions{})
			require.NoError(t, err)
			require.NotEmpty(t, created.GetUID())
			require.NotEmpty(t, created.GetResourceVersion())

			got, err := resource.Get(ctx, created.GetName(), metav1.GetOptions{})
			require.NoError(t, err)
			require.Equal(t, created.GetUID(), got.GetUID())
			require.Equal(t, "initial", got.Object["spec"].(map[string]any)["value"])

			require.NoError(t, unstructured.SetNestedField(got.Object, "updated", "spec", "value"))
			updated, err := resource.Update(ctx, got, metav1.UpdateOptions{})
			require.NoError(t, err)
			require.NotEqual(t, created.GetResourceVersion(), updated.GetResourceVersion())
			got, err = resource.Get(ctx, created.GetName(), metav1.GetOptions{})
			require.NoError(t, err)
			require.Equal(t, "updated", got.Object["spec"].(map[string]any)["value"])

			list, err := resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.Len(t, list.Items, 1)
			require.Equal(t, created.GetUID(), list.Items[0].GetUID())

			require.NoError(t, resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{}))
			_, err = resource.Get(ctx, created.GetName(), metav1.GetOptions{})
			require.True(t, apierrors.IsNotFound(err), "expected NotFound after deletion, got %v", err)
			list, err = resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.Empty(t, list.Items)
		})
	}

	t.Run("rejects invalid access tokens", func(t *testing.T) {
		expired := claims
		expired.Expiry = jwt.NewNumericDate(time.Now().Add(-time.Hour))
		wrongAudience := claims
		wrongAudience.Audience = jwt.Audience{"another-service"}
		otherKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		require.NoError(t, err)
		otherSigner, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: otherKey},
			(&jose.SignerOptions{}).WithType(jose.ContentType(authnlib.TokenTypeAccess)).WithHeader("kid", "router-test-key"))
		require.NoError(t, err)
		invalidSignature, err := jwt.Signed(otherSigner).Claims(claims).Serialize()
		require.NoError(t, err)
		for name, token := range map[string]string{
			"missing": "", "malformed": "test-token", "expired": sign(expired),
			"wrong audience": sign(wrongAudience), "invalid signature": invalidSignature,
		} {
			t.Run(name, func(t *testing.T) {
				_, err := newClient(token).Resource(schema.GroupVersionResource{Group: group, Version: "v1", Resource: "things"}).Namespace(namespace).List(t.Context(), metav1.ListOptions{})
				require.True(t, apierrors.IsUnauthorized(err), "expected Unauthorized, got %v", err)
			})
		}
	})
	t.Run("rejects another namespace", func(t *testing.T) {
		_, err := client.Resource(schema.GroupVersionResource{Group: group, Version: "v1", Resource: "things"}).Namespace("stacks-5678").List(t.Context(), metav1.ListOptions{})
		require.True(t, apierrors.IsForbidden(err), "expected Forbidden, got %v", err)
	})
}

type pluginRouterTokenTransport struct {
	next  http.RoundTripper
	token string
}

func (t pluginRouterTokenTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	req = req.Clone(req.Context())
	if t.token != "" {
		req.Header.Set("X-Access-Token", t.token)
	}
	return t.next.RoundTrip(req)
}

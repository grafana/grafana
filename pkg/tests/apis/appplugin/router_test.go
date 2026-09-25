package appplugin

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	k8srest "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	"github.com/grafana/grafana-app-sdk/plugin/httpadapter"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/secret"
	"github.com/grafana/grafana/pkg/registry/apis/secret/clock"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/router"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/secret/database"
	"github.com/grafana/grafana/pkg/storage/secret/metadata"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationPluginsOverRouter(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	const (
		group     = "router-test.ext.grafana.app"
		namespace = apis.DefaultNamespace
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
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	pluginServer := grpc.NewServer()
	var routeCalls atomic.Int32
	var receivedSecureValues atomic.Value
	pluginv3.RegisterRouteServiceServer(pluginServer, httpadapter.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		parent := httpadapter.ParentFromContext(r.Context())
		receivedSecureValues.Store(parent.GetDecryptedSecureValues())
		routeCalls.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(parent.GetRaw())
	})))
	go func() { _ = pluginServer.Serve(listener) }()
	t.Cleanup(pluginServer.Stop)
	var decryptCalls atomic.Int32
	decrypter := routerTestDecrypter(func(ctx context.Context, serviceName, ns string, names ...string) (map[string]decrypt.DecryptResult, error) {
		decryptCalls.Add(1)
		assert.Equal(t, group, serviceName)
		assert.Equal(t, namespace, ns)
		assert.Equal(t, []string{"router-api-key"}, names)
		value := secretv1beta1.ExposedSecureValue("decrypted-api-key")
		return map[string]decrypt.DecryptResult{"router-api-key": decrypt.NewDecryptResultValue(&value)}, nil
	})
	mux := http.NewServeMux()
	mux.HandleFunc("GET /plugins", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(strings.ReplaceAll(`{"plugins":[{"host":"PLUGIN_HOST","definition":{
   "jsonData":{"id":"router-test-app","type":"app"},
   "manifest":{
    "appName":"router-test-app","group":"router-test.ext.grafana.app","preferredVersion":"v1",
    "versions":[{"name":"v1","served":true,"kinds":[
     {"kind":"Thing","plural":"things","scope":"Namespaced","folderScoped":false,
      "routes":{"reload":{"get":{"responses":{"200":{"description":"OK"}}}}},
      "schemas":{"Thing":{"type":"object","properties":{"secure":{"type":"object","additionalProperties":{"type":"object","properties":{"name":{"type":"string"}}}},"spec":{"type":"object","properties":{"value":{"type":"string"}}}}}}},
     {"kind":"Widget","plural":"widgets","scope":"Namespaced","folderScoped":true,
      "schemas":{"Widget":{"type":"object","properties":{"spec":{"type":"object","properties":{"value":{"type":"string"}}}}}}}
    ]}]
   }
  }}]}`, "PLUGIN_HOST", listener.Addr().String())))
	})
	mux.HandleFunc("GET /jwks", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{
			Key: &key.PublicKey, KeyID: "router-test-key", Algorithm: string(jose.ES256), Use: "sig",
		}}})
	})
	manifests := httptest.NewServer(mux)
	t.Cleanup(manifests.Close)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{DisableAnonymous: true, SecretsManagerEnableDBMigrations: true})
	t.Cleanup(helper.Shutdown)
	// Unified storage validates ownership of secure references before saving the parent.
	tracer := noop.NewTracerProvider().Tracer("router-test")
	secretStore, err := metadata.ProvideSecureValueMetadataStorage(clock.ProvideClock(), database.ProvideDatabase(helper.GetEnv().SQLStore, tracer), tracer, nil)
	require.NoError(t, err)
	secureValue, err := secretStore.Create(t.Context(), "system", &secretv1beta1.SecureValue{
		ObjectMeta: metav1.ObjectMeta{
			Name: "router-api-key", Namespace: namespace,
			OwnerReferences: []metav1.OwnerReference{{APIVersion: group + "/v1", Kind: "Thing", Name: "route-with-secure"}},
		},
		Spec: secretv1beta1.SecureValueSpec{Description: "Router integration test"},
	}, "router-test-user")
	require.NoError(t, err)
	require.NoError(t, secretStore.SetVersionToActive(t.Context(), xkube.Namespace(namespace), secureValue.Name, secureValue.Status.Version))

	const folderUID = "router-widgets"
	createFolder(t, t.Context(), helper, folderUID, "Router widgets")
	// The backing test server uses basic auth; the router-facing endpoint uses
	// the same access token as the plugin API.
	folderConfig := helper.Org1.Admin.NewRestConfig()
	folderURL, err := url.Parse(folderConfig.Host)
	require.NoError(t, err)
	var folderReads atomic.Int32
	folderProxy := &httputil.ReverseProxy{Rewrite: func(pr *httputil.ProxyRequest) {
		pr.SetURL(folderURL)
		pr.Out.Header.Del("X-Access-Token")
		pr.Out.SetBasicAuth(folderConfig.Username, folderConfig.Password)
	}}
	folderServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Access-Token") != "Bearer "+token {
			http.Error(w, "missing caller credentials", http.StatusUnauthorized)
			return
		}
		folderReads.Add(1)
		folderProxy.ServeHTTP(w, r)
	}))
	t.Cleanup(folderServer.Close)
	folderBackend, err := router.NewForwardBackend(metav1.APIGroup{Name: "folder.grafana.app"}, v1alpha2.RouteBackendSpec{
		Mode:    v1alpha2.RouteBackendSpecModeForward,
		Forward: &v1alpha2.RouteBackendCommonBackendConfig{Url: folderServer.URL},
	}, "folder", folderServer.Client().Transport.(*http.Transport))
	require.NoError(t, err)
	routerHandler := http.NewServeMux()
	cfg := setting.NewCfg()
	cfg.ExtJWTAuth.JWKSUrl = manifests.URL + "/jwks"
	cfg.ExtJWTAuth.Audiences = []string{audience}
	cfg.SectionWithEnvOverrides("cloud_router").Key("plugins_url").SetValue(manifests.URL + "/plugins")
	loader, err := router.ProvideRoutesLoader(cfg, router.PluginLoaderDependencies{
		PluginDependencies: router.PluginDependencies{Cfg: cfg, Unified: helper.GetEnv().ResourceClient,
			RESTConfigProvider: router.NewLoopbackRestConfigProvider(routerHandler),
			SecureValues:       secret.NewMockInlineSecureValueSupport(t), Decrypter: decrypter},
	})
	require.NoError(t, err)
	lifecycle, ok := loader.(services.Service)
	require.True(t, ok)
	ctx, cancel := context.WithCancel(t.Context())
	t.Cleanup(cancel)
	require.NoError(t, services.StartAndAwaitRunning(ctx, lifecycle))
	t.Cleanup(func() { require.NoError(t, services.StopAndAwaitTerminated(context.Background(), lifecycle)) })
	apiRouter := router.NewGrafanaRouter(folderRoutesLoader{RoutesLoader: loader, folder: folderBackend})
	require.NoError(t, apiRouter.Run(ctx))
	routerHandler.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		apiRouter.HandleFunc(w, r, http.NotFoundHandler())
	}))
	server := httptest.NewServer(routerHandler)
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

			ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
			defer cancel()

			object := &unstructured.Unstructured{Object: map[string]any{
				"apiVersion": group + "/v1", "kind": kind.name,
				"metadata": map[string]any{"name": "example"},
				"spec":     map[string]any{"value": "initial"},
			}}
			if kind.name == "Widget" {
				_, err := resource.Create(ctx, object.DeepCopy(), metav1.CreateOptions{})
				require.True(t, apierrors.IsInvalid(err), "%v", err)
				object.SetAnnotations(map[string]string{utils.AnnoKeyFolder: "missing-folder"})
				_, err = resource.Create(ctx, object.DeepCopy(), metav1.CreateOptions{})
				require.ErrorContains(t, err, "failed to read folder missing-folder")
				object.SetName("")
				object.SetGenerateName("widget-")
				object.SetAnnotations(map[string]string{utils.AnnoKeyFolder: folderUID})
			}
			readsBefore := folderReads.Load()
			created, err := resource.Create(ctx, object, metav1.CreateOptions{})
			require.NoError(t, err)
			if kind.name == "Widget" {
				require.Greater(t, folderReads.Load(), readsBefore)
				require.Equal(t, folderUID, created.GetAnnotations()[utils.AnnoKeyFolder])
				require.NotEmpty(t, created.GetName())
			}
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
			if kind.name == "Widget" {
				require.Equal(t, folderUID, got.GetAnnotations()[utils.AnnoKeyFolder])
			}

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

	t.Run("kind route decrypts parent secure values", func(t *testing.T) {
		resource := client.Resource(schema.GroupVersionResource{Group: group, Version: "v1", Resource: "things"}).Namespace(namespace)
		for _, withSecure := range []bool{false, true} {
			name := "route-without-secure"
			if withSecure {
				name = "route-with-secure"
			}
			t.Run(name, func(t *testing.T) {
				object := &unstructured.Unstructured{Object: map[string]any{
					"apiVersion": group + "/v1", "kind": "Thing",
					"metadata": map[string]any{"name": name},
					"spec":     map[string]any{"value": "route-parent"},
				}}
				if withSecure {
					object.Object["secure"] = map[string]any{"apiKey": map[string]any{"name": "router-api-key"}}
				}
				created, err := resource.Create(t.Context(), object, metav1.CreateOptions{})
				require.NoError(t, err)
				before := decryptCalls.Load()
				callsBefore := routeCalls.Load()
				got, err := resource.Get(t.Context(), name, metav1.GetOptions{}, "reload")
				require.NoError(t, err)
				require.Equal(t, created.GetUID(), got.GetUID())
				require.Equal(t, "route-parent", got.Object["spec"].(map[string]any)["value"])
				require.Equal(t, callsBefore+1, routeCalls.Load())
				if withSecure {
					require.Equal(t, before+1, decryptCalls.Load())
					require.Equal(t, map[string]string{"apiKey": "decrypted-api-key"}, receivedSecureValues.Load())
					require.Equal(t, object.Object["secure"], got.Object["secure"])
				} else {
					require.Equal(t, before, decryptCalls.Load())
					require.Empty(t, receivedSecureValues.Load())
				}
			})
		}
	})

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

// folderRoutesLoader combines the polled plugin with a real folder API backend.
type folderRoutesLoader struct {
	router.RoutesLoader
	folder router.Backend
}

func (l folderRoutesLoader) Load(ctx context.Context) ([]router.Backend, error) {
	backends, err := l.RoutesLoader.Load(ctx)
	if err != nil {
		return nil, err
	}
	return append(backends, l.folder), nil
}

type routerTestDecrypter func(context.Context, string, string, ...string) (map[string]decrypt.DecryptResult, error)

func (f routerTestDecrypter) Decrypt(ctx context.Context, serviceName, namespace string, names ...string) (map[string]decrypt.DecryptResult, error) {
	return f(ctx, serviceName, namespace, names...)
}

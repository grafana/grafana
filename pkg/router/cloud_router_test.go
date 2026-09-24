package router

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"math/big"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"testing/synctest"
	"time"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
	"github.com/grafana/grafana/pkg/setting"
)

func TestAPIGroupFromManifestData(t *testing.T) {
	manifest := app.ManifestData{
		Group:            "example.grafana.app",
		PreferredVersion: "v2",
		Versions: []app.ManifestVersion{
			{Name: "v1", Served: true},
			{Name: "v2", Served: true},
			{Name: "v3", Served: false},
		},
	}

	want := metav1.APIGroup{
		Name: "example.grafana.app",
		Versions: []metav1.GroupVersionForDiscovery{
			{GroupVersion: "example.grafana.app/v1", Version: "v1"},
			{GroupVersion: "example.grafana.app/v2", Version: "v2"},
		},
		PreferredVersion: metav1.GroupVersionForDiscovery{GroupVersion: "example.grafana.app/v2", Version: "v2"},
	}

	if got := apiGroupFromManifestData(manifest); !reflect.DeepEqual(got, want) {
		t.Fatalf("apiGroupFromManifestData() = %#v, want %#v", got, want)
	}
}

func TestAPIGroupFromManifestSpecUsesDefaults(t *testing.T) {
	served, unserved := true, false
	spec := v1alpha2.AppManifestSpec{
		Group: "example.grafana.app",
		Versions: []v1alpha2.AppManifestManifestVersion{
			{Name: "v1"},
			{Name: "v2", Served: &unserved},
			{Name: "v3", Served: &served},
		},
	}

	want := metav1.APIGroup{
		Name: "example.grafana.app",
		Versions: []metav1.GroupVersionForDiscovery{
			{GroupVersion: "example.grafana.app/v1", Version: "v1"},
			{GroupVersion: "example.grafana.app/v3", Version: "v3"},
		},
		PreferredVersion: metav1.GroupVersionForDiscovery{GroupVersion: "example.grafana.app/v3", Version: "v3"},
	}

	if got := apiGroupFromManifestSpec(spec); !reflect.DeepEqual(got, want) {
		t.Fatalf("apiGroupFromManifestSpec() = %#v, want %#v", got, want)
	}
}

func TestProvideCloudRoutesLoaderFactoryNotConfigured(t *testing.T) {
	cfg := setting.NewCfg()

	loader, err := ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{})
	require.NoError(t, err)
	require.Nil(t, loader)
}

func TestProvideCloudRoutesLoaderFactoryRequiresCapTokenAndExchangeURL(t *testing.T) {
	cfg := setting.NewCfg()
	section, err := cfg.Raw.NewSection(cloudRouterSection)
	require.NoError(t, err)
	_, err = section.NewKey("appmanifest_apiserver_url", "https://apiserver.example.com")
	require.NoError(t, err)

	_, err = ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{})
	require.ErrorContains(t, err, "cap_token and token_exchange_url are required")
}

func TestProvideCloudRoutesLoaderFactoryBuildsLoader(t *testing.T) {
	cfg := setting.NewCfg()
	section, err := cfg.Raw.NewSection(cloudRouterSection)
	require.NoError(t, err)
	_, err = section.NewKey("appmanifest_apiserver_url", "https://apiserver.example.com")
	require.NoError(t, err)
	_, err = section.NewKey("cap_token", "token")
	require.NoError(t, err)
	_, err = section.NewKey("token_exchange_url", "https://token-exchange.example.com")
	require.NoError(t, err)

	loader, err := ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{})
	require.NoError(t, err)
	require.NotNil(t, loader)
	require.IsType(t, &cloudLoader{}, loader)
}

// cfgWithCloudRouterSection is a test helper that builds a *setting.Cfg with a cloud_router section
// populated with the provided key-value pairs.
func cfgWithCloudRouterSection(t *testing.T, kv map[string]string) *setting.Cfg {
	cfg := setting.NewCfg()
	section, err := cfg.Raw.NewSection(cloudRouterSection)
	require.NoError(t, err)
	for key, value := range kv {
		_, err := section.NewKey(key, value)
		require.NoError(t, err)
	}
	return cfg
}

func TestProvideCloudRoutesLoaderFactory_RenamedKey(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"appmanifest_apiserver_url": "https://example.invalid",
		"cap_token":                 "tok",
		"token_exchange_url":        "https://exchange.invalid",
	})

	loader, err := ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{})
	require.NoError(t, err)
	require.NotNil(t, loader)
}

// TestProvideCloudRoutesLoaderFactory_LegacyKeyFailsLoudly covers the
// rename's worst failure mode: a deployment still on apiserver_url would
// otherwise look like "nothing configured" and silently degrade to the dummy
// loader, with the router reporting itself ready while serving no real routes.
func TestProvideCloudRoutesLoaderFactory_LegacyKeyFailsLoudly(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"apiserver_url":      "https://example.invalid",
		"cap_token":          "tok",
		"token_exchange_url": "https://exchange.invalid",
	})

	_, err := ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{})
	require.ErrorContains(t, err, "apiserver_url was renamed to appmanifest_apiserver_url")
}

// The legacy key must be ignored, not fatal, once the new key is also present
// -- an operator mid-migration who set both is correctly configured.
func TestProvideCloudRoutesLoaderFactory_LegacyKeyIgnoredWhenNewKeySet(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"apiserver_url":             "https://old.invalid",
		"appmanifest_apiserver_url": "https://example.invalid",
		"cap_token":                 "tok",
		"token_exchange_url":        "https://exchange.invalid",
	})

	loader, err := ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{})
	require.NoError(t, err)
	require.NotNil(t, loader)
}

func TestProvideCloudRoutesLoaderFactory_NoTargetsConfigured(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{})

	loader, err := ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{})
	require.NoError(t, err)
	require.Nil(t, loader) // falls back to dummyRoutesLoader upstream
}

func TestProvideCloudRoutesLoaderFactory_AggregateOnlyRequiresCapToken(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"baas_apiserver.url":      "https://baas.invalid",
		"baas_apiserver.audience": "baas",
	})

	_, err := ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{})
	require.ErrorContains(t, err, "cap_token and token_exchange_url are required")
}

func TestProvideCloudRoutesLoaderFactory_AggregateTargetRequiresAudience(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"cap_token":          "tok",
		"token_exchange_url": "https://exchange.invalid",
		"baas_apiserver.url": "https://baas.invalid",
	})

	_, err := ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{})
	require.ErrorContains(t, err, "baas_apiserver.audience is required")
}

// TestNewAggregateBaseTransport_IsPerCallClone pins the property that keeps
// aggregate targets off the process-global http.DefaultTransport: each call
// yields its own transport, so no two targets share a connection pool and
// none of them shares the default's (MaxIdleConnsPerHost=2) pool with the
// rest of the process.
func TestNewAggregateBaseTransport_IsPerCallClone(t *testing.T) {
	first := newAggregateBaseTransport(nil)
	second := newAggregateBaseTransport(nil)

	require.NotSame(t, http.DefaultTransport.(*http.Transport), first)
	require.NotSame(t, first, second)
	require.Equal(t, aggregateMaxIdleConnsPerHost, first.MaxIdleConnsPerHost)
	// 0 means net/http's DefaultMaxIdleConnsPerHost (2) -- the global default
	// transport must be left exactly as it was.
	require.Zero(t, http.DefaultTransport.(*http.Transport).MaxIdleConnsPerHost, "the global default must be left untouched")
}

func TestBuildAggregateTLSConfig(t *testing.T) {
	t.Run("neither set yields a plain config", func(t *testing.T) {
		tlsCfg, err := buildAggregateTLSConfig("", false)
		require.NoError(t, err)
		require.False(t, tlsCfg.InsecureSkipVerify)
		require.Nil(t, tlsCfg.RootCAs)
	})

	t.Run("insecure wins over ca_file", func(t *testing.T) {
		tlsCfg, err := buildAggregateTLSConfig("/does/not/exist.crt", true)
		require.NoError(t, err)
		require.True(t, tlsCfg.InsecureSkipVerify)
		require.Nil(t, tlsCfg.RootCAs)
	})

	t.Run("missing ca_file errors", func(t *testing.T) {
		_, err := buildAggregateTLSConfig("/does/not/exist.crt", false)
		require.ErrorContains(t, err, "reading ca_file")
	})

	t.Run("ca_file with invalid PEM errors", func(t *testing.T) {
		caFile := filepath.Join(t.TempDir(), "ca.crt")
		require.NoError(t, os.WriteFile(caFile, []byte("not a cert"), 0o600))

		_, err := buildAggregateTLSConfig(caFile, false)
		require.ErrorContains(t, err, "invalid CA PEM data")
	})

	t.Run("ca_file with valid PEM populates RootCAs", func(t *testing.T) {
		caFile := filepath.Join(t.TempDir(), "ca.crt")
		require.NoError(t, os.WriteFile(caFile, generateSelfSignedCAPEM(t), 0o600))

		tlsCfg, err := buildAggregateTLSConfig(caFile, false)
		require.NoError(t, err)
		require.False(t, tlsCfg.InsecureSkipVerify)
		require.NotNil(t, tlsCfg.RootCAs)
	})
}

// generateSelfSignedCAPEM builds a throwaway self-signed CA cert in PEM form,
// just to exercise AppendCertsFromPEM's success path in
// TestBuildAggregateTLSConfig -- no relation to any real CA.
func generateSelfSignedCAPEM(t *testing.T) []byte {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	template := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "test-ca"},
		NotBefore:    time.Now(),
		NotAfter:     time.Now().Add(time.Hour),
		IsCA:         true,
	}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	require.NoError(t, err)

	return pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
}

// capturingRoundTripper records the last request it saw instead of sending it.
type capturingRoundTripper struct {
	req *http.Request
}

func (c *capturingRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	c.req = req
	return &http.Response{StatusCode: http.StatusOK, Body: http.NoBody}, nil
}

// TestAggregateTokenWrapper_HeaderPerTarget pins the fix for the bug where
// cloud_app_platform_apiserver -- an app-platform apiserver that
// authenticates a standard bearer token from Authorization, same family as
// manifestAuthWrapper's target -- was getting the CAP token on X-Access-Token
// like baas_apiserver, so discovery/proxied requests to it never authenticated.
func TestAggregateTokenWrapper_HeaderPerTarget(t *testing.T) {
	t.Run("cloud_app_platform_apiserver uses Authorization", func(t *testing.T) {
		captured := &capturingRoundTripper{}
		wrapped := aggregateTokenWrapper("cloud_app_platform_apiserver", authnlib.NewStaticTokenExchanger("exchanged-token"), "aud")(captured)

		resp, err := wrapped.RoundTrip(httptest.NewRequest(http.MethodGet, "https://cap.invalid/apis", nil))
		require.NoError(t, err)
		defer func() { _ = resp.Body.Close() }()

		require.Equal(t, "Bearer exchanged-token", captured.req.Header.Get("Authorization"))
		require.Empty(t, captured.req.Header.Get("X-Access-Token"))
	})

	t.Run("baas_apiserver uses X-Access-Token", func(t *testing.T) {
		captured := &capturingRoundTripper{}
		wrapped := aggregateTokenWrapper("baas_apiserver", authnlib.NewStaticTokenExchanger("exchanged-token"), "aud")(captured)

		resp, err := wrapped.RoundTrip(httptest.NewRequest(http.MethodGet, "https://baas.invalid/apis", nil))
		require.NoError(t, err)
		defer func() { _ = resp.Body.Close() }()

		require.Equal(t, "Bearer exchanged-token", captured.req.Header.Get("X-Access-Token"))
		require.Empty(t, captured.req.Header.Get("Authorization"))
	})
}

// TestProvideCloudRoutesLoaderFactory_TargetsGetOwnHTTPClients checks the
// wiring side of the same concern: the transport is built inside the
// per-target loop, so two configured targets end up with two distinct
// clients rather than one shared one.
func TestProvideCloudRoutesLoaderFactory_TargetsGetOwnHTTPClients(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"cap_token":                             "tok",
		"token_exchange_url":                    "https://exchange.invalid",
		"baas_apiserver.url":                    "https://baas.invalid",
		"baas_apiserver.audience":               "baas",
		"cloud_app_platform_apiserver.url":      "https://cap.invalid",
		"cloud_app_platform_apiserver.audience": "cap",
	})

	loaderIface, err := ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{})
	require.NoError(t, err)
	loader, ok := loaderIface.(*cloudLoader)
	require.True(t, ok)
	require.Len(t, loader.aggregateTargets, 2)

	first, second := loader.aggregateTargets[0], loader.aggregateTargets[1]
	require.NotNil(t, first.client)
	require.NotNil(t, second.client)
	require.NotSame(t, first.client, second.client)
	require.NotSame(t, http.DefaultClient, first.client)
	// rest.HTTPClientFor only builds a dedicated client when the transport
	// isn't http.DefaultTransport (or a timeout is set), so a non-nil
	// per-client Transport is the observable trace of the per-target clone.
	require.NotNil(t, first.client.Transport)
	require.NotSame(t, http.DefaultTransport, first.client.Transport)
}

// TestProvideCloudRoutesLoaderFactory_PluginsURLAloneActivatesWithoutCapToken
// pins plugins_url's independence from the appmanifest/aggregate auth gate:
// its operator is an unauthenticated in-cluster endpoint, so it must not
// require cap_token/token_exchange_url the way the other two sources do.
func TestProvideCloudRoutesLoaderFactory_PluginsURLAloneActivatesWithoutCapToken(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"plugins_url": "https://plugins.invalid/plugins",
	})
	cfg.ExtJWTAuth.JWKSUrl = "https://jwks.invalid/keys"
	cfg.ExtJWTAuth.Audiences = []string{"grafana"}

	loaderIface, err := ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{})
	require.NoError(t, err)
	require.NotNil(t, loaderIface)

	loader, ok := loaderIface.(*cloudLoader)
	require.True(t, ok)
	require.NotNil(t, loader.pluginsTarget)
	require.Nil(t, loader.routeBackendClient)
	require.Empty(t, loader.aggregateTargets)
}

func TestProvideCloudRoutesLoaderFactory_PluginsURLRejectsNonAbsoluteURL(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"plugins_url": "/just/a/path",
	})
	cfg.ExtJWTAuth.JWKSUrl = "https://jwks.invalid/keys"
	cfg.ExtJWTAuth.Audiences = []string{"grafana"}

	_, err := ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{})
	require.ErrorContains(t, err, "must be absolute")
}

// TestCloudLoader_AllThreeSourcesCombineInLoad exercises plugins_url as a
// third source alongside an aggregate target, confirming Load() combines
// backends from both rather than treating them as mutually exclusive (the
// dummy plugins_url loader this replaces returned early instead of
// combining).
func TestCloudLoader_AllThreeSourcesCombineInLoad(t *testing.T) {
	aggregateUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		list := metav1.APIGroupList{Groups: []metav1.APIGroup{{Name: "dashboard.grafana.app"}}}
		_ = json.NewEncoder(w).Encode(list)
	}))
	defer aggregateUpstream.Close()

	pluginsUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(pluginManifestsFixture))
	}))
	defer pluginsUpstream.Close()

	tokenExchange := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok","data":{"token":"fake-token"}}`))
	}))
	defer tokenExchange.Close()

	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"cap_token":               "tok",
		"token_exchange_url":      tokenExchange.URL,
		"baas_apiserver.url":      aggregateUpstream.URL,
		"baas_apiserver.audience": "baas",
		"plugins_url":             pluginsUpstream.URL,
	})
	cfg.ExtJWTAuth.JWKSUrl = "https://jwks.invalid/keys"
	cfg.ExtJWTAuth.Audiences = []string{"grafana"}

	loaderIface, err := ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{})
	require.NoError(t, err)
	loader, ok := loaderIface.(*cloudLoader)
	require.True(t, ok)

	svc, ok := loaderIface.(services.Service)
	require.True(t, ok)
	require.NoError(t, services.StartAndAwaitRunning(t.Context(), svc))
	t.Cleanup(func() {
		require.NoError(t, services.StopAndAwaitTerminated(context.Background(), svc))
	})

	require.Eventually(t, func() bool {
		backends, err := loader.Load(t.Context())
		if err != nil {
			return false
		}
		var sawAggregate, sawPlugin bool
		for _, b := range backends {
			switch b.Group().Name {
			case "dashboard.grafana.app":
				sawAggregate = true
			case "appsdktest.ext.grafana.app":
				sawPlugin = true
			}
		}
		return sawAggregate && sawPlugin
	}, 5*time.Second, 10*time.Millisecond)
}

func TestCloudLoader_AggregateOnlyNoAppManifest(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		list := metav1.APIGroupList{Groups: []metav1.APIGroup{{Name: "dashboard.grafana.app"}}}
		_ = json.NewEncoder(w).Encode(list)
	}))
	defer upstream.Close()

	// Fake token exchange endpoint: the real exchange client (authnlib)
	// performs a real HTTP POST on every RoundTrip, so it needs somewhere
	// to actually succeed against for the poll loop to reach upstream.
	tokenExchange := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok","data":{"token":"fake-token"}}`))
	}))
	defer tokenExchange.Close()

	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"cap_token":               "tok",
		"token_exchange_url":      tokenExchange.URL,
		"baas_apiserver.url":      upstream.URL,
		"baas_apiserver.audience": "baas",
	})

	loaderIface, err := ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{})
	require.NoError(t, err)
	require.NotNil(t, loaderIface) // must activate without appmanifest_apiserver_url set

	loader, ok := loaderIface.(*cloudLoader)
	require.True(t, ok)
	require.Nil(t, loader.routeBackendClient) // CRD side must stay unconfigured

	svc, ok := loaderIface.(services.Service)
	require.True(t, ok)
	require.NoError(t, services.StartAndAwaitRunning(t.Context(), svc))
	t.Cleanup(func() {
		require.NoError(t, services.StopAndAwaitTerminated(context.Background(), svc))
	})

	require.Eventually(t, func() bool {
		backends, err := loader.Load(t.Context())
		if err != nil {
			return false
		}
		for _, b := range backends {
			if b.Group().Name == "dashboard.grafana.app" {
				return true
			}
		}
		return false
	}, 5*time.Second, 10*time.Millisecond)
}

func TestCloudLoaderSingleTenantFallback(t *testing.T) {
	t.Run("disabled returns a nil interface", func(t *testing.T) {
		loader := &cloudLoader{}
		require.True(t, loader.SingleTenantFallback() == nil)
	})
	t.Run("discovery alone enables fallback", func(t *testing.T) {
		gcom := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.Equal(t, http.MethodGet, r.Method)
			require.Equal(t, "Bearer test-gcom-token", r.Header.Get("Authorization"))
			switch r.URL.Path {
			case "/api/instances/35611":
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"slug":"play"}`))
			case "/api/instances/123":
				w.WriteHeader(http.StatusNotFound)
			default:
				t.Errorf("unexpected gcom request: %s", r.URL.Path)
				w.WriteHeader(http.StatusBadRequest)
			}
		}))
		t.Cleanup(gcom.Close)
		cfg := cfgWithCloudRouterSection(t, map[string]string{"st_discovery_url": "https://play.grafana.org/"})
		cfg.GrafanaComAPIURL = gcom.URL + "/api"
		cfg.GrafanaComSSOAPIToken = "test-gcom-token"
		loader, err := ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{})
		require.NoError(t, err)
		cloud, ok := loader.(*cloudLoader)
		require.True(t, ok)
		require.Same(t, cloud.singleTenantFallback, cloud.SingleTenantFallback())
		host, err := cloud.singleTenantFallback.hostForNamespace(t.Context(), "stacks-35611")
		require.NoError(t, err)
		require.Equal(t, "http://play-grafana-http.hosted-grafana.svc.cluster.local.:80", host.url.String())
		host, err = cloud.singleTenantFallback.hostForNamespace(t.Context(), "stacks-123")
		require.NoError(t, err)
		require.Nil(t, host)
	})
	for _, raw := range []string{"/relative", "http:///missing-host", "ftp://example.com", "http://%"} {
		t.Run(raw, func(t *testing.T) {
			cfg := cfgWithCloudRouterSection(t, map[string]string{"st_discovery_url": raw})
			_, err := ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{})
			require.Error(t, err)
		})
	}
}

func TestCloudLoaderFallbackOnlyLifecycle(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		cfg := cfgWithCloudRouterSection(t, map[string]string{"st_discovery_url": "https://play.grafana.org/"})
		loader, err := ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{})
		require.NoError(t, err)
		cloud := loader.(*cloudLoader)
		require.NoError(t, services.StartAndAwaitRunning(t.Context(), cloud))
		synctest.Wait()
		require.Equal(t, services.Running, cloud.State())
		require.NoError(t, services.StopAndAwaitTerminated(t.Context(), cloud))
	})
}

func TestProvideCloudRoutesLoaderFactory_PluginsRequireTokenVerificationConfig(t *testing.T) {
	for _, tc := range []struct {
		name      string
		jwksURL   string
		wantError string
	}{
		{name: "missing JWKS URL", wantError: "missing cfg.ExtJWTAuth.JWKSUrl"},
		{name: "missing audiences", jwksURL: "https://jwks.invalid/keys", wantError: "missing cfg.ExtJWTAuth.Audiences"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := cfgWithCloudRouterSection(t, map[string]string{"plugins_url": "https://plugins.invalid/plugins"})
			cfg.ExtJWTAuth.JWKSUrl = tc.jwksURL
			cfg.ExtJWTAuth.Audiences = nil
			loader, err := ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{})
			require.ErrorContains(t, err, cloudRouterSection+": "+tc.wantError)
			require.Nil(t, loader)
		})
	}
}

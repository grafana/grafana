package router

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"math/big"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"testing/synctest"
	"time"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"golang.org/x/time/rate"
	"gopkg.in/ini.v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/setting"
)

func TestNewCloudRoutesLoaderNotConfigured(t *testing.T) {
	cfg := setting.NewCfg()

	loader, err := NewCloudRoutesLoader(cfg, PluginDependencies{})
	require.NoError(t, err)
	require.Nil(t, loader)
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

func TestNewCloudRoutesLoader_NoTargetsConfigured(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{})

	loader, err := NewCloudRoutesLoader(cfg, PluginDependencies{})
	require.NoError(t, err)
	require.Nil(t, loader) // falls back to dummyRoutesLoader upstream
}

func TestNewCloudRoutesLoader_PluginsGroupPatternsWinOverRegex(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"plugins_url":            "http://plugins.invalid/plugins",
		"plugins_group_patterns": "*.a",
		"plugins_group_regex":    "*.b",
	})

	loader, err := NewCloudRoutesLoader(cfg, PluginDependencies{MetricsRegister: prometheus.NewRegistry()})
	require.NoError(t, err)
	target := pluginManifestsTargetOf(loader.(*cloudLoader), sourcePluginsURL)
	require.NotNil(t, target)
	require.Len(t, target.patterns, 1)
}

// A deployment still configured only for the removed appmanifest apiserver
// must not silently degrade to the dummy loader, reporting itself ready while
// serving no real routes.
func TestNewCloudRoutesLoader_RemovedAppManifestKeyFailsLoudly(t *testing.T) {
	for _, key := range []string{"appmanifest_apiserver_url", "apiserver_url"} {
		t.Run(key, func(t *testing.T) {
			cfg := cfgWithCloudRouterSection(t, map[string]string{
				key:                  "https://example.invalid",
				"cap_token":          "tok",
				"token_exchange_url": "https://exchange.invalid",
			})
			_, err := NewCloudRoutesLoader(cfg, PluginDependencies{})
			require.ErrorContains(t, err, key+" is no longer supported")
		})
	}
}

func TestNewCloudRoutesLoader_AggregateOnlyRequiresCapToken(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{})
	addAggregateSection(t, cfg, "baas_apiserver", map[string]string{
		"url":      "https://baas.invalid",
		"audience": "baas",
	})

	_, err := NewCloudRoutesLoader(cfg, PluginDependencies{})
	require.ErrorContains(t, err, "cap_token and token_exchange_url are required")
}

func TestNewCloudRoutesLoader_AggregateTargetRequiresAudience(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"cap_token":          "tok",
		"token_exchange_url": "https://exchange.invalid",
	})
	addAggregateSection(t, cfg, "baas_apiserver", map[string]string{
		"url": "https://baas.invalid",
	})

	_, err := NewCloudRoutesLoader(cfg, PluginDependencies{})
	require.ErrorContains(t, err, "router.aggregate.baas_apiserver: audience is required")
}

func TestNewCloudRoutesLoader_AnonymousDiscoveryAggregateNeedsNoCapToken(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{})
	addAggregateSection(t, cfg, "open", map[string]string{
		"url":            "https://open.invalid",
		"discovery_auth": "none",
	})

	loader, err := NewCloudRoutesLoader(cfg, PluginDependencies{})
	require.NoError(t, err)
	require.NotNil(t, loader)
}

func TestNewCloudRoutesLoader_AnonymousDiscoveryAggregateDoesNotExemptSignedTarget(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{})
	addAggregateSection(t, cfg, "open", map[string]string{"url": "https://open.invalid", "discovery_auth": "none"})
	addAggregateSection(t, cfg, "signed", map[string]string{"url": "https://signed.invalid", "audience": "signed"})

	_, err := NewCloudRoutesLoader(cfg, PluginDependencies{})
	require.ErrorContains(t, err, "cap_token and token_exchange_url are required")
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

// TestAggregateTokenWrapper_HeaderPerTarget pins which header carries the CAP
// token on a target's discovery polls. cloud_app_platform_apiserver
// authenticates a bearer token from Authorization and never reads
// X-Access-Token, so it keeps that default by name until its deployment sets
// discovery_auth = bearer.
func TestAggregateTokenWrapper_HeaderPerTarget(t *testing.T) {
	for _, tc := range []struct {
		name, target, discoveryAuth string
		wantHeader, otherHeader     string
	}{
		{name: "bearer uses Authorization", target: "custom", discoveryAuth: discoveryAuthBearer, wantHeader: "Authorization", otherHeader: "X-Access-Token"},
		{name: "cap_token uses X-Access-Token", target: "custom", discoveryAuth: discoveryAuthCAPToken, wantHeader: "X-Access-Token", otherHeader: "Authorization"},
		{name: "unset uses X-Access-Token", target: "baas_apiserver", wantHeader: "X-Access-Token", otherHeader: "Authorization"},
		{name: "unset on cloud_app_platform_apiserver uses Authorization", target: legacyBearerTargetName, wantHeader: "Authorization", otherHeader: "X-Access-Token"},
		{name: "cap_token on cloud_app_platform_apiserver uses X-Access-Token", target: legacyBearerTargetName, discoveryAuth: discoveryAuthCAPToken, wantHeader: "X-Access-Token", otherHeader: "Authorization"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			captured := &capturingRoundTripper{}
			targetCfg := aggregateTargetConfig{Name: tc.target, Audience: "aud", DiscoveryAuth: tc.discoveryAuth}
			wrapped := aggregateTokenWrapper(targetCfg, authnlib.NewStaticTokenExchanger("exchanged-token"))(captured)

			resp, err := wrapped.RoundTrip(httptest.NewRequest(http.MethodGet, "https://target.invalid/apis", nil))
			require.NoError(t, err)
			defer func() { _ = resp.Body.Close() }()

			require.Equal(t, "Bearer exchanged-token", captured.req.Header.Get(tc.wantHeader))
			require.Empty(t, captured.req.Header.Get(tc.otherHeader))
		})
	}
}

// TestNewCloudRoutesLoader_TargetsGetOwnHTTPClients checks the
// wiring side of the same concern: the transport is built inside the
// per-target loop, so two configured targets end up with two distinct
// clients rather than one shared one.
func TestNewCloudRoutesLoader_TargetsGetOwnHTTPClients(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"cap_token":          "tok",
		"token_exchange_url": "https://exchange.invalid",
	})
	addAggregateSection(t, cfg, "baas_apiserver", map[string]string{
		"url":      "https://baas.invalid",
		"audience": "baas",
	})
	addAggregateSection(t, cfg, "cloud_app_platform_apiserver", map[string]string{
		"url":      "https://cap.invalid",
		"audience": "cap",
	})

	loaderIface, err := NewCloudRoutesLoader(cfg, PluginDependencies{})
	require.NoError(t, err)
	loader, ok := loaderIface.(*cloudLoader)
	require.True(t, ok)
	require.Len(t, aggregateTargetsOf(loader), 2)

	first, second := aggregateTargetsOf(loader)[0], aggregateTargetsOf(loader)[1]
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

// TestNewCloudRoutesLoader_PluginsURLAloneActivatesWithoutCapToken
// pins plugins_url's independence from the aggregate auth gate: its operator
// is an unauthenticated in-cluster endpoint, so it must not require
// cap_token/token_exchange_url the way signed aggregate targets do.
func TestNewCloudRoutesLoader_PluginsURLAloneActivatesWithoutCapToken(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"plugins_url": "https://plugins.invalid/plugins",
	})
	cfg.ExtJWTAuth.JWKSUrl = "https://jwks.invalid/keys"
	cfg.ExtJWTAuth.Audiences = []string{"grafana"}

	loaderIface, err := NewCloudRoutesLoader(cfg, PluginDependencies{})
	require.NoError(t, err)
	require.NotNil(t, loaderIface)

	loader, ok := loaderIface.(*cloudLoader)
	require.True(t, ok)
	require.NotNil(t, pluginManifestsTargetOf(loader, sourcePluginsURL))
	require.Empty(t, aggregateTargetsOf(loader))
}

func TestNewCloudRoutesLoader_CoreURLAloneActivatesWithoutCapToken(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"core_url": "https://core.invalid/plugins",
	})
	cfg.ExtJWTAuth.JWKSUrl = "https://jwks.invalid/keys"
	cfg.ExtJWTAuth.Audiences = []string{"grafana"}

	loaderIface, err := NewCloudRoutesLoader(cfg, PluginDependencies{})
	require.NoError(t, err)
	loader, ok := loaderIface.(*cloudLoader)
	require.True(t, ok)
	require.NotNil(t, pluginManifestsTargetOf(loader, sourceCoreURL))
	require.Nil(t, pluginManifestsTargetOf(loader, sourcePluginsURL))
	require.Equal(t, sourceCoreURL, pluginManifestsTargetOf(loader, sourceCoreURL).source)
	require.Equal(t, coreKeyPrefix, pluginManifestsTargetOf(loader, sourceCoreURL).keyPrefix)
}

func TestNewCloudRoutesLoader_CoreAndPluginsURLShareRegisterer(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"plugins_url": "https://plugins.invalid/plugins",
		"core_url":    "https://core.invalid/plugins",
	})
	cfg.ExtJWTAuth.JWKSUrl = "https://jwks.invalid/keys"
	cfg.ExtJWTAuth.Audiences = []string{"grafana"}

	loaderIface, err := NewCloudRoutesLoader(cfg, PluginDependencies{MetricsRegister: prometheus.NewRegistry()})
	require.NoError(t, err)
	loader, ok := loaderIface.(*cloudLoader)
	require.True(t, ok)
	require.NotNil(t, pluginManifestsTargetOf(loader, sourceCoreURL))
	require.NotNil(t, pluginManifestsTargetOf(loader, sourcePluginsURL))
}

func TestNewCloudRoutesLoader_PluginsURLRejectsNonAbsoluteURL(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"plugins_url": "/just/a/path",
	})
	cfg.ExtJWTAuth.JWKSUrl = "https://jwks.invalid/keys"
	cfg.ExtJWTAuth.Audiences = []string{"grafana"}

	_, err := NewCloudRoutesLoader(cfg, PluginDependencies{})
	require.ErrorContains(t, err, "must be absolute")
}

// TestNewCloudRoutesLoader_PluginManifestsTLS checks that each
// plugin manifests source polls an HTTPS endpoint with its own TLS settings.
func TestNewCloudRoutesLoader_PluginManifestsTLS(t *testing.T) {
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"plugins":[]}`))
	}))
	t.Cleanup(srv.Close)
	caFile := filepath.Join(t.TempDir(), "ca.crt")
	require.NoError(t, os.WriteFile(caFile, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: srv.Certificate().Raw}), 0o600))

	targets := func(t *testing.T, kv map[string]string) (pluginsTarget, coreTarget *pluginManifestsTarget) {
		t.Helper()
		kv["plugins_url"] = srv.URL + "/plugins"
		kv["core_url"] = srv.URL + "/core"
		loaderIface, err := NewCloudRoutesLoader(cfgWithCloudRouterSection(t, kv), PluginDependencies{})
		require.NoError(t, err)
		loader, ok := loaderIface.(*cloudLoader)
		require.True(t, ok)
		return pluginManifestsTargetOf(loader, sourcePluginsURL), pluginManifestsTargetOf(loader, sourceCoreURL)
	}
	poll := func(target *pluginManifestsTarget) error {
		_, err := fetchPluginManifests(context.Background(), target.client, target.url)
		return err
	}

	t.Run("an unknown CA is rejected", func(t *testing.T) {
		pluginsTarget, coreTarget := targets(t, map[string]string{})
		require.ErrorContains(t, poll(pluginsTarget), "certificate")
		require.ErrorContains(t, poll(coreTarget), "certificate")
	})

	t.Run("ca_file trusts the CA for its own source only", func(t *testing.T) {
		pluginsTarget, coreTarget := targets(t, map[string]string{"plugins_ca_file": caFile})
		require.NoError(t, poll(pluginsTarget))
		require.ErrorContains(t, poll(coreTarget), "certificate")

		pluginsTarget, coreTarget = targets(t, map[string]string{"core_ca_file": caFile})
		require.ErrorContains(t, poll(pluginsTarget), "certificate")
		require.NoError(t, poll(coreTarget))
	})

	t.Run("insecure skips verification", func(t *testing.T) {
		pluginsTarget, coreTarget := targets(t, map[string]string{"plugins_insecure": "true", "core_insecure": "true"})
		require.NoError(t, poll(pluginsTarget))
		require.NoError(t, poll(coreTarget))
	})

	t.Run("a missing ca_file is a startup error", func(t *testing.T) {
		for _, prefix := range []string{"plugins", "core"} {
			cfg := cfgWithCloudRouterSection(t, map[string]string{
				prefix + "_url":     srv.URL,
				prefix + "_ca_file": "/does/not/exist.crt",
			})
			_, err := NewCloudRoutesLoader(cfg, PluginDependencies{})
			require.ErrorContains(t, err, prefix+"_url: reading ca_file")
		}
	})
}

// TestCloudLoader_PluginsAndAggregateCombineInLoad exercises plugins_url
// alongside an aggregate target, confirming Load() combines
// backends from both rather than treating them as mutually exclusive (the
// dummy plugins_url loader this replaces returned early instead of
// combining).
func TestCloudLoader_PluginsAndAggregateCombineInLoad(t *testing.T) {
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
		"cap_token":          "tok",
		"token_exchange_url": tokenExchange.URL,
		"plugins_url":        pluginsUpstream.URL,
	})
	addAggregateSection(t, cfg, "baas_apiserver", map[string]string{
		"url":      aggregateUpstream.URL,
		"audience": "baas",
	})
	cfg.ExtJWTAuth.JWKSUrl = "https://jwks.invalid/keys"
	cfg.ExtJWTAuth.Audiences = []string{"grafana"}

	loaderIface, err := NewCloudRoutesLoader(cfg, PluginDependencies{})
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

func TestCloudLoader_AggregateOnly(t *testing.T) {
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
		"cap_token":          "tok",
		"token_exchange_url": tokenExchange.URL,
	})
	addAggregateSection(t, cfg, "baas_apiserver", map[string]string{
		"url":      upstream.URL,
		"audience": "baas",
	})

	loaderIface, err := NewCloudRoutesLoader(cfg, PluginDependencies{})
	require.NoError(t, err)
	require.NotNil(t, loaderIface)

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
		require.True(t, loader.UnregisteredGroupHandler() == nil)
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
		loader, err := NewCloudRoutesLoader(cfg, PluginDependencies{})
		require.NoError(t, err)
		cloud, ok := loader.(*cloudLoader)
		require.True(t, ok)
		require.Same(t, cloud.singleTenantFallback, cloud.UnregisteredGroupHandler())
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
			_, err := NewCloudRoutesLoader(cfg, PluginDependencies{})
			require.Error(t, err)
		})
	}
}

func TestCloudLoaderSingleTenantLookupLimits(t *testing.T) {
	stLimiter := func(t *testing.T, keys map[string]string) (*rate.Limiter, error) {
		keys["st_discovery_url"] = "https://play.grafana.org/"
		loader, err := NewCloudRoutesLoader(cfgWithCloudRouterSection(t, keys), PluginDependencies{})
		if err != nil {
			return nil, err
		}
		return loader.(*cloudLoader).singleTenantFallback.lookupLimiter, nil
	}

	t.Run("defaults", func(t *testing.T) {
		limiter, err := stLimiter(t, map[string]string{})
		require.NoError(t, err)
		require.Equal(t, rate.Limit(defaultSingleTenantLookupRate), limiter.Limit())
		require.Equal(t, defaultSingleTenantLookupBurst, limiter.Burst())
	})
	t.Run("configured", func(t *testing.T) {
		limiter, err := stLimiter(t, map[string]string{"st_lookup_rate": "5", "st_lookup_burst": "7"})
		require.NoError(t, err)
		require.Equal(t, rate.Limit(5), limiter.Limit())
		require.Equal(t, 7, limiter.Burst())
	})
	t.Run("zero rate disables the limit", func(t *testing.T) {
		limiter, err := stLimiter(t, map[string]string{"st_lookup_rate": "0"})
		require.NoError(t, err)
		require.Nil(t, limiter)
	})
	for key, value := range map[string]string{
		"st_cache_size":         "0",
		"st_breaker_cache_size": "-1",
		"st_lookup_rate":        "-1",
		"st_lookup_burst":       "0",
	} {
		t.Run("invalid "+key, func(t *testing.T) {
			_, err := stLimiter(t, map[string]string{key: value})
			require.Error(t, err)
		})
	}
}

func TestCloudLoaderFallbackOnlyLifecycle(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		// A host name would be resolved inside the bubble, which crashes when
		// the lookup is shared with a goroutine outside it. Nothing listens on
		// this port, so the poll fails at once.
		cfg := cfgWithCloudRouterSection(t, map[string]string{"st_discovery_url": "http://127.0.0.1:1/"})
		loader, err := NewCloudRoutesLoader(cfg, PluginDependencies{})
		require.NoError(t, err)
		cloud := loader.(*cloudLoader)
		require.NoError(t, services.StartAndAwaitRunning(t.Context(), cloud))
		synctest.Wait()
		require.Equal(t, services.Running, cloud.State())
		require.NoError(t, services.StopAndAwaitTerminated(t.Context(), cloud))
	})
}

func TestNewCloudRoutesLoader_PluginsWithoutTokenVerificationConfig(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{"plugins_url": "https://plugins.invalid/plugins"})
	loader, err := NewCloudRoutesLoader(cfg, PluginDependencies{})
	require.NoError(t, err)
	require.NotNil(t, loader)
}

func TestCloudLoaderAggregateSectionPriority(t *testing.T) {
	newUpstream := func(version string) *httptest.Server {
		upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.Equal(t, "/apis", r.URL.Path)
			require.Equal(t, "Bearer fake-token", r.Header.Get("X-Access-Token"))
			_ = json.NewEncoder(w).Encode(metav1.APIGroupList{Groups: []metav1.APIGroup{{
				Name:     "shared.ext.grafana.app",
				Versions: []metav1.GroupVersionForDiscovery{{GroupVersion: "shared.ext.grafana.app/" + version, Version: version}},
			}}})
		}))
		t.Cleanup(upstream.Close)
		return upstream
	}
	first, second := newUpstream("v1"), newUpstream("v2")
	exchange := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok","data":{"token":"fake-token"}}`))
	}))
	t.Cleanup(exchange.Close)
	cfg := setting.NewCfg()
	var err error
	cfg.Raw, err = ini.Load([]byte(fmt.Sprintf(`
[cloud_router]
cap_token = token
token_exchange_url = %s
[router.aggregate.z_first]
url = %s
audience = first
[router.aggregate.a_second]
url = %s
audience = second
`, exchange.URL, first.URL, second.URL)))
	require.NoError(t, err)
	result, err := NewCloudRoutesLoader(cfg, PluginDependencies{})
	require.NoError(t, err)
	loader := result.(*cloudLoader)
	require.Len(t, aggregateTargetsOf(loader), 2)
	dirty := make(chan struct{}, 1)
	assertWinner := func(name, version string) {
		t.Helper()
		backends, err := loader.Load(t.Context())
		require.NoError(t, err)
		require.Len(t, backends, 1)
		require.Equal(t, "aggregate:"+name, backends[0].Source())
		require.Equal(t, []metav1.GroupVersionForDiscovery{{GroupVersion: "shared.ext.grafana.app/" + version, Version: version}}, backends[0].Group().Versions)
	}
	// Poll completion order must not determine priority or merge group
	// versions. The loader serves nothing until every target has polled once.
	aggregateTargetsOf(loader)[1].poll(t.Context(), dirty)
	_, err = loader.Load(t.Context())
	require.ErrorIs(t, err, errFirstPollPending)
	aggregateTargetsOf(loader)[0].poll(t.Context(), dirty)
	assertWinner("z_first", "v1")
	require.Equal(t, []shadowedGroup{{Group: "shared.ext.grafana.app", Source: "aggregate:a_second", By: "aggregate:z_first"}}, loader.shadowedGroups())
	first.Close()
	aggregateTargetsOf(loader)[0].poll(t.Context(), dirty)
	assertWinner("z_first", "v1")
}

func TestPluginManifestsPollInterval(t *testing.T) {
	section := func(t *testing.T, kv map[string]string) *setting.DynamicSection {
		return cfgWithCloudRouterSection(t, kv).SectionWithEnvOverrides(cloudRouterSection)
	}
	targets, err := readManifestsTargets(setting.NewCfg(), section(t, map[string]string{
		"plugins_url":           "https://plugins.invalid/plugins",
		"core_url":              "https://core.invalid/plugins",
		"plugins_poll_interval": "5m",
	}), PluginDependencies{MetricsRegister: prometheus.NewRegistry()})
	require.NoError(t, err)
	require.Len(t, targets, 2)
	require.Equal(t, 5*time.Minute, targets[0].cooldown.steady)
	require.Equal(t, defaultAggregatePollInterval, targets[1].cooldown.steady)

	targets, err = readManifestsTargets(setting.NewCfg(), section(t, map[string]string{
		"bridge_url":           "https://bridge.invalid/plugins",
		"bridge_poll_interval": "2m",
	}), PluginDependencies{MetricsRegister: prometheus.NewRegistry()})
	require.NoError(t, err)
	require.Len(t, targets, 1)
	require.Equal(t, sourceBridgeURL, targets[0].source)
	require.Equal(t, 2*time.Minute, targets[0].cooldown.steady)

	_, err = readManifestsTargets(setting.NewCfg(), section(t, map[string]string{
		"core_url":           "https://core.invalid/plugins",
		"core_poll_interval": "0s",
	}), PluginDependencies{MetricsRegister: prometheus.NewRegistry()})
	require.ErrorContains(t, err, "core_poll_interval must be a positive duration")
}

// The loader tears its sources down once it stops, which closes the managed
// plugin connections.
func TestCloudLoaderStopClosesPluginConnections(t *testing.T) {
	target, err := newPluginManifestsTarget(pluginsKeyPrefix, sourcePluginsURL, "http://127.0.0.1:1/plugins", nil, http.DefaultClient,
		defaultPluginGRPCConfig(), PluginDependencies{MetricsRegister: prometheus.NewRegistry()})
	require.NoError(t, err)
	release, err := target.acquireConnection("localhost:50051", "grafana-appsdktest-app")
	require.NoError(t, err)
	defer release()
	loader, err := newCloudLoader(nil, []*pluginManifestsTarget{target}, nil)
	require.NoError(t, err)

	require.NoError(t, services.StartAndAwaitRunning(t.Context(), loader))
	target.connectionsMu.Lock()
	require.Len(t, target.connections, 1, "running keeps the connections")
	target.connectionsMu.Unlock()
	require.NoError(t, services.StopAndAwaitTerminated(t.Context(), loader))
	target.connectionsMu.Lock()
	defer target.connectionsMu.Unlock()
	require.True(t, target.closed)
	require.Empty(t, target.connections)
}

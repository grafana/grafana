package router

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

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

	loader, err := ProvideCloudRoutesLoaderFactory(cfg)
	require.NoError(t, err)
	require.Nil(t, loader)
}

func TestProvideCloudRoutesLoaderFactoryRequiresCapTokenAndExchangeURL(t *testing.T) {
	cfg := setting.NewCfg()
	section, err := cfg.Raw.NewSection(cloudRouterSection)
	require.NoError(t, err)
	_, err = section.NewKey("appmanifest_apiserver_url", "https://apiserver.example.com")
	require.NoError(t, err)

	_, err = ProvideCloudRoutesLoaderFactory(cfg)
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

	loader, err := ProvideCloudRoutesLoaderFactory(cfg)
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

	loader, err := ProvideCloudRoutesLoaderFactory(cfg)
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

	_, err := ProvideCloudRoutesLoaderFactory(cfg)
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

	loader, err := ProvideCloudRoutesLoaderFactory(cfg)
	require.NoError(t, err)
	require.NotNil(t, loader)
}

func TestProvideCloudRoutesLoaderFactory_NoTargetsConfigured(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{})

	loader, err := ProvideCloudRoutesLoaderFactory(cfg)
	require.NoError(t, err)
	require.Nil(t, loader) // falls back to dummyRoutesLoader upstream
}

func TestProvideCloudRoutesLoaderFactory_AggregateOnlyRequiresCapToken(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"baas_apiserver.url":      "https://baas.invalid",
		"baas_apiserver.audience": "baas",
	})

	_, err := ProvideCloudRoutesLoaderFactory(cfg)
	require.ErrorContains(t, err, "cap_token and token_exchange_url are required")
}

func TestProvideCloudRoutesLoaderFactory_AggregateTargetRequiresAudience(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"cap_token":          "tok",
		"token_exchange_url": "https://exchange.invalid",
		"baas_apiserver.url": "https://baas.invalid",
	})

	_, err := ProvideCloudRoutesLoaderFactory(cfg)
	require.ErrorContains(t, err, "baas_apiserver.audience is required")
}

// TestNewAggregateBaseTransport_IsPerCallClone pins the property that keeps
// aggregate targets off the process-global http.DefaultTransport: each call
// yields its own transport, so no two targets share a connection pool and
// none of them shares the default's (MaxIdleConnsPerHost=2) pool with the
// rest of the process.
func TestNewAggregateBaseTransport_IsPerCallClone(t *testing.T) {
	first := newAggregateBaseTransport()
	second := newAggregateBaseTransport()

	require.NotSame(t, http.DefaultTransport.(*http.Transport), first)
	require.NotSame(t, first, second)
	require.Equal(t, aggregateMaxIdleConnsPerHost, first.MaxIdleConnsPerHost)
	// 0 means net/http's DefaultMaxIdleConnsPerHost (2) -- the global default
	// transport must be left exactly as it was.
	require.Zero(t, http.DefaultTransport.(*http.Transport).MaxIdleConnsPerHost, "the global default must be left untouched")
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

	loaderIface, err := ProvideCloudRoutesLoaderFactory(cfg)
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

	loaderIface, err := ProvideCloudRoutesLoaderFactory(cfg)
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

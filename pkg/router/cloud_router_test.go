package router

import (
	"reflect"
	"testing"

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

func TestProvideCloudRoutesLoaderFactory_NoTargetsConfigured(t *testing.T) {
	t.Skip("enabled in Task 6")
	cfg := cfgWithCloudRouterSection(t, map[string]string{})

	loader, err := ProvideCloudRoutesLoaderFactory(cfg)
	require.NoError(t, err)
	require.Nil(t, loader) // falls back to dummyRoutesLoader upstream
}

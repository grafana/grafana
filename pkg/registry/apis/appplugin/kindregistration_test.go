package appplugin

import (
	"context"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	genericapiserver "k8s.io/apiserver/pkg/server"

	"github.com/grafana/grafana-app-sdk/app"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

// testBuilder is a builder over the manifest, with the group rewritten to the
// plugin id the way NewAppPluginAPIBuilder does.
func testBuilder(t *testing.T, manifest *app.ManifestData) *AppPluginAPIBuilder {
	t.Helper()

	if manifest != nil {
		copied := *manifest
		copied.Group = "example-app"
		manifest = &copied
	}
	return &AppPluginAPIBuilder{
		manifest:   manifest,
		pluginJSON: plugins.JSONData{ID: "example-app"},
		clientV3:   &fakeRouteClient{},
	}
}

// testAPIGroupOptions builds what server startup hands UpdateAPIGroupInfo. The
// storage it registers is never read: only the shape of the resource map matters.
func testAPIGroupOptions(t *testing.T, b *AppPluginAPIBuilder) (*genericapiserver.APIGroupInfo, builder.APIGroupOptions) {
	t.Helper()

	scheme := runtime.NewScheme()
	require.NoError(t, b.InstallSchema(scheme))

	codecs := builder.ProvideCodecFactory(scheme)
	info := genericapiserver.NewDefaultAPIGroupInfo(b.pluginJSON.ID, scheme, metav1.ParameterCodec, codecs)
	return &info, builder.APIGroupOptions{
		Scheme:              scheme,
		OptsGetter:          appinstaller.NewNoopRESTOptionsGetter(),
		MetricsRegister:     prometheus.NewRegistry(),
		StorageOptsRegister: func(schema.GroupResource, apistore.StorageOptions) {},
	}
}

// InstallSchema has to leave every served version usable by the scheme: the
// settings kind in all of them, and each manifest kind (plus its list, plus the
// internal version server-side apply tracks managed fields against).
func TestInstallSchema(t *testing.T) {
	b := testBuilder(t, testManifest(t))
	scheme := runtime.NewScheme()
	require.NoError(t, b.InstallSchema(scheme))

	for _, version := range []string{"v0alpha1", "v1alpha1", "v2alpha1"} {
		gv := schema.GroupVersion{Group: "example-app", Version: version}
		_, err := scheme.New(gv.WithKind("Settings"))
		require.NoError(t, err, "settings are served in every version")
	}

	// v2alpha1 declares no kinds, so only the two versions that do are registered.
	for _, version := range []string{"v0alpha1", "v1alpha1", runtime.APIVersionInternal} {
		gv := schema.GroupVersion{Group: "example-app", Version: version}
		obj, err := scheme.New(gv.WithKind("TestKind"))
		require.NoError(t, err, "version %s", version)
		require.IsType(t, &unstructured.Unstructured{}, obj)

		list, err := scheme.New(gv.WithKind("TestKindList"))
		require.NoError(t, err, "version %s", version)
		require.IsType(t, &unstructured.UnstructuredList{}, list)
	}

	// The preferred version has to come first, or discovery points clients at
	// the wrong one.
	require.Equal(t, "v1alpha1", scheme.PrioritizedVersionsForGroup("example-app")[0].Version)
}

func TestUpdateAPIGroupInfo(t *testing.T) {
	t.Run("every served version gets storage", func(t *testing.T) {
		b := testBuilder(t, testManifest(t))
		info, opts := testAPIGroupOptions(t, b)
		require.NoError(t, b.UpdateAPIGroupInfo(info, opts))

		// The settings resource and its subresources are in every version,
		// whether or not the manifest mentions the version.
		for _, version := range []string{"v0alpha1", "v1alpha1", "v2alpha1"} {
			storage := info.VersionedResourcesStorageMap[version]
			require.Contains(t, storage, apppluginV0.APP_RESOURCE_NAME, "version %s", version)
			require.Contains(t, storage, apppluginV0.APP_RESOURCE_NAME+"/health", "version %s", version)
			require.Contains(t, storage, apppluginV0.APP_RESOURCE_NAME+"/resources", "version %s", version)
			require.NotContains(t, storage, apppluginV0.APP_RESOURCE_NAME+"/proxy",
				"the proxy is only registered when the plugin declares routes and the toggle is on")
		}

		// The plural names the path, lower-cased.
		require.Contains(t, info.VersionedResourcesStorageMap["v0alpha1"], "testkinds")
		require.Contains(t, info.VersionedResourcesStorageMap["v1alpha1"], "testkinds")
		require.NotContains(t, info.VersionedResourcesStorageMap["v2alpha1"], "testkinds",
			"v2alpha1 declares no kinds")

		// Only the version whose schema declares status gets the subresource.
		require.Contains(t, info.VersionedResourcesStorageMap["v1alpha1"], "testkinds/status")
		require.NotContains(t, info.VersionedResourcesStorageMap["v0alpha1"], "testkinds/status")

		// Admission dispatch resolves the kind through this map, so a missing
		// entry silently skips every hook the kind declared.
		require.Contains(t, b.kinds, schema.GroupVersionResource{
			Group: "example-app", Version: "v1alpha1", Resource: "testkinds",
		})
		require.NotContains(t, b.kinds, schema.GroupVersionResource{
			Group: "example-app", Version: "v2alpha1", Resource: "testkinds",
		})
	})

	t.Run("a plugin without a manifest serves only settings", func(t *testing.T) {
		b := testBuilder(t, nil)
		info, opts := testAPIGroupOptions(t, b)
		require.NoError(t, b.UpdateAPIGroupInfo(info, opts))

		require.Len(t, info.VersionedResourcesStorageMap, 1)
		require.Empty(t, b.kinds)
	})

	// A kind whose plural collides would silently replace the resource already in
	// the map, so the API would serve one kind under another kind's path.
	t.Run("a kind claiming a taken resource is an error", func(t *testing.T) {
		for _, plural := range []string{apppluginV0.APP_RESOURCE_NAME, "things"} {
			b := testBuilder(t, &app.ManifestData{
				Versions: []app.ManifestVersion{{
					Name:   "v1",
					Served: true,
					Kinds: []app.ManifestVersionKind{
						{Kind: "Thing", Plural: "things", Scope: "Namespaced"},
						{Kind: "Other", Plural: plural, Scope: "Namespaced"},
					},
				}},
			})
			info, opts := testAPIGroupOptions(t, b)
			err := b.UpdateAPIGroupInfo(info, opts)
			require.ErrorContains(t, err, "claims the already registered resource")
			require.ErrorContains(t, err, plural)
		}
	})

	t.Run("storage opts are required", func(t *testing.T) {
		b := testBuilder(t, testManifest(t))
		info, opts := testAPIGroupOptions(t, b)
		opts.StorageOptsRegister = nil
		require.ErrorContains(t, b.UpdateAPIGroupInfo(info, opts), "apps require storage opts")
	})

	// Custom routes read their parent object through the getter, which is only
	// wired here -- an unwired one turns every kind route into a 500.
	t.Run("the getter reaches the registered kinds", func(t *testing.T) {
		b := testBuilder(t, testManifest(t))
		info, opts := testAPIGroupOptions(t, b)
		require.NoError(t, b.UpdateAPIGroupInfo(info, opts))
		require.NotNil(t, b.getter)

		_, err := b.getter(context.Background(), schema.GroupVersionResource{
			Group: "example-app", Version: "v1alpha1", Resource: "nope",
		}, "x")
		require.ErrorContains(t, err, "no storage registered for")
	})
}

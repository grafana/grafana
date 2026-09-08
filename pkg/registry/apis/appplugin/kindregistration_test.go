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
	"k8s.io/apiserver/pkg/storage/storagebackend"

	"github.com/grafana/grafana-app-sdk/app"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

// testBuilder is a builder over the manifest, served under the group
// NewAppPluginAPIBuilder would pick for it.
func testBuilder(t *testing.T, manifest *app.ManifestData) *AppPluginAPIBuilder {
	t.Helper()

	plugin := definition.PluginDefinition{
		JSONData: plugins.JSONData{ID: "example-app"},
		Manifest: manifest,
	}
	return &AppPluginAPIBuilder{
		group:      apiGroupForPlugin(plugin),
		manifest:   manifest,
		pluginJSON: plugin.JSONData,
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
	info := genericapiserver.NewDefaultAPIGroupInfo(b.group, scheme, metav1.ParameterCodec, codecs)
	return &info, builder.APIGroupOptions{
		Scheme:              scheme,
		OptsGetter:          apistore.NewRESTOptionsGetterForClient(nil, nil, storagebackend.Config{}, nil, nil),
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
		gv := schema.GroupVersion{Group: "example.ext.grafana.app", Version: version}
		_, err := scheme.New(gv.WithKind("Settings"))
		require.NoError(t, err, "settings are served in every version")
	}

	// v2alpha1 declares no kinds, so only the two versions that do are registered.
	for _, version := range []string{"v0alpha1", "v1alpha1", runtime.APIVersionInternal} {
		gv := schema.GroupVersion{Group: "example.ext.grafana.app", Version: version}
		obj, err := scheme.New(gv.WithKind("TestKind"))
		require.NoError(t, err, "version %s", version)
		require.IsType(t, &unstructured.Unstructured{}, obj)

		list, err := scheme.New(gv.WithKind("TestKindList"))
		require.NoError(t, err, "version %s", version)
		require.IsType(t, &unstructured.UnstructuredList{}, list)
	}

	// The preferred version has to come first, or discovery points clients at
	// the wrong one.
	require.Equal(t, "v1alpha1", scheme.PrioritizedVersionsForGroup("example.ext.grafana.app")[0].Version)
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
			Group: "example.ext.grafana.app", Version: "v1alpha1", Resource: "testkinds",
		})
		require.NotContains(t, b.kinds, schema.GroupVersionResource{
			Group: "example.ext.grafana.app", Version: "v2alpha1", Resource: "testkinds",
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
				Group: "example.ext.grafana.app",
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
			Group: "example.ext.grafana.app", Version: "v1alpha1", Resource: "nope",
		}, "x")
		require.ErrorContains(t, err, "no storage registered for")
	})
}

// The settings kind and the metav1 types are registered in every served
// version, and the scheme panics on a double registration -- so a kind that
// collides with one of them must be reported, not crash the whole server.
func TestInstallSchemaRejectsReservedKindNames(t *testing.T) {
	for _, kind := range []string{"Settings", "Status", "WatchEvent", "ListOptions", "HealthCheckResult"} {
		t.Run(kind, func(t *testing.T) {
			manifest := &app.ManifestData{
				AppName:          "example",
				Group:            "example.ext.grafana.app",
				PreferredVersion: "v1alpha1",
				Versions: []app.ManifestVersion{{
					Name:   "v1alpha1",
					Served: true,
					Kinds: []app.ManifestVersionKind{{
						Kind: kind, Plural: kind + "s", Scope: "Namespaced",
					}},
				}},
			}
			b := testBuilder(t, manifest)

			require.NotPanics(t, func() {
				err := b.InstallSchema(runtime.NewScheme())
				require.ErrorContains(t, err, "reserved kind name")
			})
		})
	}
}

// The list types are registered too, so a kind named after one is refused on
// the same grounds.
func TestInstallSchemaRejectsReservedListName(t *testing.T) {
	manifest := &app.ManifestData{
		AppName:          "example",
		Group:            "example.ext.grafana.app",
		PreferredVersion: "v1alpha1",
		Versions: []app.ManifestVersion{{
			Name:   "v1alpha1",
			Served: true,
			Kinds:  []app.ManifestVersionKind{{Kind: "SettingsList", Plural: "SettingsLists", Scope: "Namespaced"}},
		}},
	}
	b := testBuilder(t, manifest)

	require.NotPanics(t, func() {
		err := b.InstallSchema(runtime.NewScheme())
		require.ErrorContains(t, err, "reserved kind name")
	})
}

// Storage options are keyed by GroupResource, which carries no version, so both
// served versions of a kind register against the same key and whichever runs
// last would otherwise decide the folder scope for both. A kind that requires a
// folder in any served version requires one in all of them.
func TestUpdateAPIGroupInfoFolderScopeIsConsistentAcrossVersions(t *testing.T) {
	falseValue := false

	manifest := &app.ManifestData{
		AppName:          "example",
		Group:            "example.ext.grafana.app",
		PreferredVersion: "v1alpha1",
		Versions: []app.ManifestVersion{
			{Name: "v1alpha1", Served: true, Kinds: []app.ManifestVersionKind{
				{Kind: "Thing", Plural: "Things", Scope: "Namespaced"}, // folder scoped by default
			}},
			{Name: "v2alpha1", Served: true, Kinds: []app.ManifestVersionKind{
				{Kind: "Thing", Plural: "Things", Scope: "Namespaced", FolderScoped: &falseValue},
			}},
		},
	}

	b := testBuilder(t, manifest)
	info, opts := testAPIGroupOptions(t, b)

	registered := map[schema.GroupResource][]apistore.StorageOptions{}
	opts.StorageOptsRegister = func(gr schema.GroupResource, so apistore.StorageOptions) {
		registered[gr] = append(registered[gr], so)
	}
	require.NoError(t, b.UpdateAPIGroupInfo(info, opts))

	gr := schema.GroupResource{Group: "example.ext.grafana.app", Resource: "things"}
	require.Len(t, registered[gr], 2, "both versions register against the shared resource")
	for i, so := range registered[gr] {
		require.True(t, so.EnableFolderSupport, "registration %d dropped folder support", i)
		require.True(t, so.RequireFolder, "registration %d dropped the folder requirement", i)
	}
}

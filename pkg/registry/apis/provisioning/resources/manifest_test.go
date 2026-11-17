package resources

import (
	"slices"
	"testing"

	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"

	appmanifestv1alpha2 "github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestManifestKinds(t *testing.T) {
	widget := SupportedResource{GroupKind: schema.GroupKind{Group: testManifestGroup, Kind: "Widget"}, Capabilities: sets.New(CapabilityFolder)}
	gadget := SupportedResource{GroupKind: schema.GroupKind{Group: testManifestGroup, Kind: "Gadget"}, Capabilities: sets.New[string]()}

	// watch starts a watcher for the manifests that the router of this process publishes.
	watch := func(t *testing.T, manifests *appmanifestv1alpha2.AppManifestList) SupportedResourceProvider {
		t.Helper()
		router := NewMockManifestDiscovery(t)
		router.EXPECT().ListManifests(mock.Anything).Return(manifests, nil)
		set := NewSupportedResourceProvider(nil)
		watcher := resource.NewLocalManifestWatcher(router, nil, ManifestKinds(set), nil)
		require.NoError(t, services.StartAndAwaitRunning(t.Context(), watcher))
		t.Cleanup(watcher.StopAsync)
		return set
	}

	t.Run("adds the kinds that opt in to provisioning", func(t *testing.T) {
		clusterScoped := testManifestKind("Global", true, false)
		clusterScoped.Scope = appmanifestv1alpha2.AppManifestManifestVersionKindScopeCluster

		set := watch(t, testManifestList(true,
			testManifestKind("Widget", true, true),
			testManifestKind("Gadget", true, false),
			testManifestKind("Other", false, true),
			clusterScoped,
		))

		require.Equal(t, slices.Concat(SupportedProvisioningResources, []SupportedResource{widget, gadget}), set.Get())
	})

	t.Run("skips the kinds of a version that is not served", func(t *testing.T) {
		set := watch(t, testManifestList(false, testManifestKind("Widget", true, true)))

		require.Empty(t, set.Get())
	})
}

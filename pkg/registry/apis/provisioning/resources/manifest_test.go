package resources

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestManifestSupportedResources(t *testing.T) {
	folder := SupportedResource{GroupKind: schema.GroupKind{Group: "folder.grafana.app", Kind: "Folder"}, Capabilities: sets.New(CapabilityFolder)}

	t.Run("returns the configured set before the manifests are read", func(t *testing.T) {
		supported, _ := ManifestSupportedResources([]SupportedResource{folder})

		require.Equal(t, []SupportedResource{folder}, supported(context.Background()))
	})

	t.Run("adds the kinds that opt in to provisioning", func(t *testing.T) {
		clusterScoped := testManifestKind("Global", true, false)
		clusterScoped.Scope = "Cluster"
		supported, onManifests := ManifestSupportedResources([]SupportedResource{folder})

		onManifests(testManifests(
			testManifestKind("Widget", true, true),
			testManifestKind("Gadget", true, false),
			testManifestKind("Other", false, true),
			clusterScoped,
		))

		require.Equal(t, []SupportedResource{
			folder,
			{GroupKind: schema.GroupKind{Group: testManifestGroup, Kind: "Widget"}, Capabilities: sets.New(CapabilityFolder)},
			{GroupKind: schema.GroupKind{Group: testManifestGroup, Kind: "Gadget"}, Capabilities: sets.New[string]()},
		}, supported(context.Background()))
	})

	t.Run("skips the kinds of a version that is not served", func(t *testing.T) {
		manifests := testManifests(testManifestKind("Widget", true, true))
		manifests[0].Versions[0].Served = false
		supported, onManifests := ManifestSupportedResources([]SupportedResource{folder})

		onManifests(manifests)

		require.Equal(t, []SupportedResource{folder}, supported(context.Background()))
	})

	t.Run("keeps the configured capabilities of a kind that a manifest declares", func(t *testing.T) {
		configured := SupportedResource{GroupKind: schema.GroupKind{Group: testManifestGroup, Kind: "Widget"}, Capabilities: sets.New(CapabilityDisabled)}
		supported, onManifests := ManifestSupportedResources([]SupportedResource{configured})

		onManifests(testManifests(testManifestKind("Widget", true, true)))

		require.Equal(t, []SupportedResource{configured}, supported(context.Background()))
	})

	t.Run("keeps the capabilities of a configured collection that covers the kind", func(t *testing.T) {
		collection := SupportedResource{GroupKind: schema.GroupKind{Group: "*.ext.grafana.app", Kind: "Widget"}, Capabilities: sets.New(CapabilityDisabled)}
		supported, onManifests := ManifestSupportedResources([]SupportedResource{collection})

		onManifests(testManifests(testManifestKind("Widget", true, true)))

		require.Equal(t, []SupportedResource{collection}, supported(context.Background()))
	})

	t.Run("keeps the default set when none is configured", func(t *testing.T) {
		supported, onManifests := ManifestSupportedResources(nil)

		onManifests(testManifests(testManifestKind("Widget", true, true)))

		got := supported(context.Background())
		require.Len(t, got, len(SupportedProvisioningResources)+1)
		require.Subset(t, got, SupportedProvisioningResources)
	})

	t.Run("follows the manifests as they change", func(t *testing.T) {
		supported, onManifests := ManifestSupportedResources([]SupportedResource{folder})

		onManifests(testManifests(testManifestKind("Widget", true, true), testManifestKind("Gadget", true, true)))
		require.Len(t, supported(context.Background()), 3)

		onManifests(testManifests(testManifestKind("Widget", true, true)))
		require.Len(t, supported(context.Background()), 2)
	})
}

func TestRemoteManifestSupportedResources(t *testing.T) {
	folder := SupportedResource{GroupKind: schema.GroupKind{Group: "folder.grafana.app", Kind: "Folder"}, Capabilities: sets.New(CapabilityFolder)}

	t.Run("returns the configured set without a discovery URL", func(t *testing.T) {
		supported, watcher, err := RemoteManifestSupportedResources([]SupportedResource{folder}, resource.ManifestWatcherConfig{})

		require.NoError(t, err)
		require.NotNil(t, watcher)
		require.Equal(t, []SupportedResource{folder}, supported(context.Background()))
	})
}

package resources

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestManifestKinds(t *testing.T) {
	t.Run("returns the kinds that opt in to provisioning", func(t *testing.T) {
		clusterScoped := testManifestKind("Global", true, false)
		clusterScoped.Scope = "Cluster"

		got := manifestKinds(testManifests(
			testManifestKind("Widget", true, true),
			testManifestKind("Gadget", true, false),
			testManifestKind("Other", false, true),
			clusterScoped,
		))

		require.Equal(t, []SupportedResource{
			{GroupKind: schema.GroupKind{Group: testManifestGroup, Kind: "Widget"}, Capabilities: sets.New(CapabilityFolder)},
			{GroupKind: schema.GroupKind{Group: testManifestGroup, Kind: "Gadget"}, Capabilities: sets.New[string]()},
		}, got)
	})

	t.Run("skips the kinds of a version that is not served", func(t *testing.T) {
		manifests := testManifests(testManifestKind("Widget", true, true))
		manifests[0].Versions[0].Served = false

		require.Empty(t, manifestKinds(manifests))
	})
}

func TestWatchManifests(t *testing.T) {
	t.Run("does nothing without a router", func(t *testing.T) {
		watcher, err := WatchManifests(NewSupportedResourceSet(nil), nil, resource.ManifestWatcherConfig{})

		require.NoError(t, err)
		require.NotNil(t, watcher)
	})
}

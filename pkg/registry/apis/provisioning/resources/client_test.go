package resources

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"
)

// playlistKind is an arbitrary identifier used only to exercise the supported-set plumbing
// in these tests; it need not be a real provisionable kind.
var (
	playlistKind     = schema.GroupKind{Group: "playlist.grafana.app", Kind: "Playlist"}
	playlistGVK      = schema.GroupVersionKind{Group: "playlist.grafana.app", Version: "v0alpha1", Kind: "Playlist"}
	dashboardTestGVK = schema.GroupVersionKind{Group: DashboardResource.Group, Version: "v1", Kind: DashboardKind.Kind}
)

func TestResourceClients_SupportedResources(t *testing.T) {
	t.Run("falls back to the static base set when none is configured", func(t *testing.T) {
		clients, err := NewClientFactory(nil).Clients(context.Background(), "default")
		require.NoError(t, err)

		assert.Equal(t, SupportedProvisioningResources, clients.SupportedResources())
	})

	t.Run("returns only the active configured resources", func(t *testing.T) {
		active := SupportedResource{GroupKind: DashboardKind.GroupKind(), Capabilities: sets.New(CapabilityFolder)}
		disabled := SupportedResource{GroupKind: playlistKind, Capabilities: sets.New(CapabilityDisabled)}

		clients, err := NewClientFactory(nil, active, disabled).Clients(context.Background(), "default")
		require.NoError(t, err)

		// Disabled resources are not acted on, so they are excluded from the active set.
		assert.Equal(t, []SupportedResource{active}, clients.SupportedResources())
	})
}

func TestSupportedResourceCapabilities(t *testing.T) {
	folder := SupportedResource{GroupKind: dashboardTestGVK.GroupKind(), Capabilities: sets.New(CapabilityFolder)}
	skip := SupportedResource{GroupKind: playlistKind, Capabilities: sets.New(CapabilitySkipValidation)}
	disabled := SupportedResource{GroupKind: playlistKind, Capabilities: sets.New(CapabilityDisabled)}

	assert.True(t, folder.IsActive())
	assert.True(t, folder.IsValidated())
	assert.True(t, folder.IsFolderScoped())

	assert.False(t, skip.IsValidated())
	assert.True(t, skip.IsActive())

	assert.False(t, disabled.IsActive())
}

func TestSupportsFolderAnnotation(t *testing.T) {
	supported := []SupportedResource{
		{GroupKind: dashboardTestGVK.GroupKind(), Capabilities: sets.New(CapabilityFolder)},
		{GroupKind: playlistKind, Capabilities: sets.New[string]()},
	}

	assert.True(t, supportsFolderAnnotation(supported, dashboardTestGVK), "folder-scoped kind")
	assert.False(t, supportsFolderAnnotation(supported, playlistGVK), "org-scoped kind in the set")
	assert.False(t, supportsFolderAnnotation(supported, schema.GroupVersionKind{Group: "other.grafana.app", Version: "v1", Kind: "Other"}), "kind not in the set")

	// Matches on group+kind regardless of version.
	other := schema.GroupVersionKind{Group: dashboardTestGVK.Group, Version: "v2", Kind: dashboardTestGVK.Kind}
	assert.True(t, supportsFolderAnnotation(supported, other))
}

func TestParseSupportedResources(t *testing.T) {
	t.Run("parses ids and capabilities", func(t *testing.T) {
		got, err := ParseSupportedResources([]string{
			"folder.grafana.app/Folder:folder",
			" dashboard.grafana.app/Dashboard:folder ",
			"dashboard.grafana.app/LibraryPanel:folder:disabled",
			"playlist.grafana.app/Playlist:disabled",
			"", // skipped
		})
		require.NoError(t, err)
		require.Len(t, got, 4)

		assert.Equal(t, schema.GroupKind{Group: "folder.grafana.app", Kind: "Folder"}, got[0].GroupKind)
		assert.True(t, got[0].IsFolderScoped())
		assert.True(t, got[0].IsActive())

		assert.Equal(t, schema.GroupKind{Group: "dashboard.grafana.app", Kind: "LibraryPanel"}, got[2].GroupKind)
		assert.True(t, got[2].IsFolderScoped())
		assert.False(t, got[2].IsActive())

		assert.Equal(t, schema.GroupKind{Group: "playlist.grafana.app", Kind: "Playlist"}, got[3].GroupKind)
		assert.False(t, got[3].IsFolderScoped())
		assert.False(t, got[3].IsActive())
	})

	t.Run("splits group and kind on the last slash", func(t *testing.T) {
		got, err := ParseSupportedResources([]string{"alerting.notifications.grafana.app/ContactPoint"})
		require.NoError(t, err)
		require.Len(t, got, 1)
		assert.Equal(t, schema.GroupKind{Group: "alerting.notifications.grafana.app", Kind: "ContactPoint"}, got[0].GroupKind)
	})

	for _, tc := range []struct {
		name  string
		entry string
	}{
		{"missing kind", "dashboard.grafana.app/"},
		{"missing group", "/Dashboard"},
		{"no slash", "Dashboard"},
		{"group without a dot", "dashboard/Dashboard"},
		{"unknown capability", "dashboard.grafana.app/Dashboard:bogus"},
	} {
		t.Run("rejects "+tc.name, func(t *testing.T) {
			_, err := ParseSupportedResources([]string{tc.entry})
			require.Error(t, err)
		})
	}

	t.Run("rejects duplicate capability", func(t *testing.T) {
		_, err := ParseSupportedResources([]string{"dashboard.grafana.app/Dashboard:folder:folder"})
		require.Error(t, err)
	})

	t.Run("rejects duplicate resource id", func(t *testing.T) {
		_, err := ParseSupportedResources([]string{"dashboard.grafana.app/Dashboard:folder", "dashboard.grafana.app/Dashboard"})
		require.Error(t, err)
	})
}

package resources

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// playlistResource/playlistKind are arbitrary identifiers used only to exercise the
// supported-set plumbing in these tests; they need not be real provisionable kinds.
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

	t.Run("returns exactly the configured set", func(t *testing.T) {
		configured := []SupportedResource{
			{GroupKind: DashboardKind.GroupKind(), SupportsFolderAnnotation: true},
			{GroupKind: playlistKind, SupportsFolderAnnotation: false},
		}
		clients, err := NewClientFactory(nil, configured...).Clients(context.Background(), "default")
		require.NoError(t, err)

		assert.Equal(t, configured, clients.SupportedResources())
	})
}

func TestSupportsFolderAnnotation(t *testing.T) {
	supported := []SupportedResource{
		{GroupKind: dashboardTestGVK.GroupKind(), SupportsFolderAnnotation: true},
		{GroupKind: playlistKind, SupportsFolderAnnotation: false},
	}

	t.Run("true for a folder-contained kind", func(t *testing.T) {
		assert.True(t, supportsFolderAnnotation(supported, dashboardTestGVK))
	})

	t.Run("false for an org-scoped kind in the set", func(t *testing.T) {
		assert.False(t, supportsFolderAnnotation(supported, playlistGVK))
	})

	t.Run("false for a kind not in the set", func(t *testing.T) {
		assert.False(t, supportsFolderAnnotation(supported, schema.GroupVersionKind{Group: "other.grafana.app", Version: "v1", Kind: "Other"}))
	})

	t.Run("matches on group+kind regardless of version", func(t *testing.T) {
		// A different version of the same group+kind still matches.
		other := schema.GroupVersionKind{Group: dashboardTestGVK.Group, Version: "v2", Kind: dashboardTestGVK.Kind}
		assert.True(t, supportsFolderAnnotation(supported, other))
	})
}

package resources

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// playlistResource is an arbitrary GVR used only to exercise the supported-set plumbing
// in these tests; it does not need to be a real provisionable kind.
var playlistResource = schema.GroupVersionResource{Group: "playlist.grafana.app", Version: "v0alpha1", Resource: "playlists"}

func TestResourceClients_SupportedResources(t *testing.T) {
	t.Run("falls back to the static base set when none is configured", func(t *testing.T) {
		clients, err := NewClientFactory(nil).Clients(context.Background(), "default")
		require.NoError(t, err)

		assert.Equal(t, SupportedProvisioningResources, clients.SupportedResources())
	})

	t.Run("returns exactly the configured set", func(t *testing.T) {
		configured := []SupportedResource{
			{GVR: DashboardResource, SupportsFolderAnnotation: true},
			{GVR: playlistResource, SupportsFolderAnnotation: false},
		}
		clients, err := NewClientFactory(nil, configured...).Clients(context.Background(), "default")
		require.NoError(t, err)

		assert.Equal(t, configured, clients.SupportedResources())
	})

	t.Run("supportsFolderAnnotation reflects the per-resource flag", func(t *testing.T) {
		assert.True(t, supportsFolderAnnotation([]SupportedResource{{GVR: playlistResource, SupportsFolderAnnotation: true}}, playlistResource))
		assert.False(t, supportsFolderAnnotation([]SupportedResource{{GVR: playlistResource, SupportsFolderAnnotation: false}}, playlistResource))

		// Folder and dashboard from the static set both support folder annotations.
		assert.True(t, supportsFolderAnnotation(SupportedProvisioningResources, DashboardResource))
		assert.True(t, supportsFolderAnnotation(SupportedProvisioningResources, FolderResource))
	})
}

func TestBuildSupportedResources(t *testing.T) {
	t.Run("builds the default set from the default config names", func(t *testing.T) {
		got, err := BuildSupportedResources([]string{"dashboards", "folders"}, []string{"dashboards", "folders"})
		require.NoError(t, err)
		// Same resources as the static fallback set (order follows the config list).
		assert.ElementsMatch(t, SupportedProvisioningResources, got)
	})

	t.Run("marks folder annotation only for the folder_resources subset", func(t *testing.T) {
		got, err := BuildSupportedResources([]string{"dashboards", "folders"}, []string{"folders"})
		require.NoError(t, err)
		assert.Equal(t, []SupportedResource{
			{GVR: DashboardResource, SupportsFolderAnnotation: false},
			{GVR: FolderResource, SupportsFolderAnnotation: true},
		}, got)
	})

	t.Run("preserves the order of the resources list", func(t *testing.T) {
		got, err := BuildSupportedResources([]string{"folders", "dashboards"}, nil)
		require.NoError(t, err)
		assert.Equal(t, []schema.GroupVersionResource{FolderResource, DashboardResource}, []schema.GroupVersionResource{got[0].GVR, got[1].GVR})
	})

	t.Run("rejects an unknown resource name", func(t *testing.T) {
		_, err := BuildSupportedResources([]string{"dashboards", "widgets"}, nil)
		require.Error(t, err)
		assert.Contains(t, err.Error(), `unknown provisioning resource "widgets"`)
	})

	t.Run("rejects an unknown folder resource name", func(t *testing.T) {
		_, err := BuildSupportedResources([]string{"dashboards"}, []string{"widgets"})
		require.Error(t, err)
		assert.Contains(t, err.Error(), `unknown provisioning folder resource "widgets"`)
	})
}

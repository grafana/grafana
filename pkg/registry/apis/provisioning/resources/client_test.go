package resources

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// playlistResource is an arbitrary GVR used only to exercise extra-resource
// registration in these tests; it does not need to be a real provisionable kind.
var playlistResource = schema.GroupVersionResource{Group: "playlist.grafana.app", Version: "v0alpha1", Resource: "playlists"}

func TestResourceClients_SupportedResources(t *testing.T) {
	t.Run("with no extra resources returns the static base set", func(t *testing.T) {
		clients, err := NewClientFactory(nil).Clients(context.Background(), "default")
		require.NoError(t, err)

		assert.Equal(t, SupportedProvisioningResources, clients.SupportedResources())
	})

	t.Run("appends registered extra resources in order", func(t *testing.T) {
		extra := SupportedResource{GVR: playlistResource, SupportsFolderAnnotation: true}
		clients, err := NewClientFactory(nil, extra).Clients(context.Background(), "default")
		require.NoError(t, err)

		want := append(append([]SupportedResource{}, SupportedProvisioningResources...), extra)
		assert.Equal(t, want, clients.SupportedResources())
	})

	t.Run("supportsFolderAnnotation reflects the registered flag", func(t *testing.T) {
		withAnnotation := SupportedResource{GVR: playlistResource, SupportsFolderAnnotation: true}
		assert.True(t, supportsFolderAnnotation([]SupportedResource{withAnnotation}, playlistResource))

		withoutAnnotation := SupportedResource{GVR: playlistResource, SupportsFolderAnnotation: false}
		assert.False(t, supportsFolderAnnotation([]SupportedResource{withoutAnnotation}, playlistResource))

		// Folder and dashboard from the static set both support folder annotations.
		assert.True(t, supportsFolderAnnotation(SupportedProvisioningResources, DashboardResource))
		assert.True(t, supportsFolderAnnotation(SupportedProvisioningResources, FolderResource))
	})
}

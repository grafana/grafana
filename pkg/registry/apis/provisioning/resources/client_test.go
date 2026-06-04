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
	t.Run("with no extra resources returns the static base sets", func(t *testing.T) {
		clients, err := NewClientFactory(nil).Clients(context.Background(), "default")
		require.NoError(t, err)

		assert.Equal(t, SupportedProvisioningResources, clients.SupportedResources())
		assert.Equal(t, SupportsFolderAnnotation, clients.SupportsFolderAnnotationResources())
	})

	t.Run("appends registered extra resources in order", func(t *testing.T) {
		extra := SupportedResource{GVR: playlistResource, SupportsFolderAnnotation: true}
		clients, err := NewClientFactory(nil, extra).Clients(context.Background(), "default")
		require.NoError(t, err)

		wantSupported := append(append([]schema.GroupVersionResource{}, SupportedProvisioningResources...), playlistResource)
		wantFolder := append(append([]schema.GroupResource{}, SupportsFolderAnnotation...), playlistResource.GroupResource())
		assert.Equal(t, wantSupported, clients.SupportedResources())
		assert.Equal(t, wantFolder, clients.SupportsFolderAnnotationResources())
	})

	t.Run("extra resource without folder annotation is only added to the supported set", func(t *testing.T) {
		extra := SupportedResource{GVR: playlistResource, SupportsFolderAnnotation: false}
		clients, err := NewClientFactory(nil, extra).Clients(context.Background(), "default")
		require.NoError(t, err)

		wantSupported := append(append([]schema.GroupVersionResource{}, SupportedProvisioningResources...), playlistResource)
		assert.Equal(t, wantSupported, clients.SupportedResources())
		assert.Equal(t, SupportsFolderAnnotation, clients.SupportsFolderAnnotationResources())
	})
}

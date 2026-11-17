package resources

import (
	"context"
	"slices"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"
)

func TestSupportedResourceSet(t *testing.T) {
	folder := SupportedResource{GroupKind: schema.GroupKind{Group: "folder.grafana.app", Kind: "Folder"}, Capabilities: sets.New(CapabilityFolder)}
	widget := SupportedResource{GroupKind: schema.GroupKind{Group: "example.ext.grafana.app", Kind: "Widget"}, Capabilities: sets.New(CapabilityFolder)}
	gadget := SupportedResource{GroupKind: schema.GroupKind{Group: "example.ext.grafana.app", Kind: "Gadget"}, Capabilities: sets.New[string]()}

	t.Run("returns the configured set before an update", func(t *testing.T) {
		require.Equal(t, []SupportedResource{folder}, NewSupportedResourceSet([]SupportedResource{folder}).Latest())
	})

	t.Run("adds the kinds of an update, one time each", func(t *testing.T) {
		set := NewSupportedResourceSet([]SupportedResource{folder})

		set.Update([]SupportedResource{widget, gadget, widget})

		require.Equal(t, []SupportedResource{folder, widget, gadget}, set.Latest())
	})

	t.Run("follows the updates", func(t *testing.T) {
		set := NewSupportedResourceSet([]SupportedResource{folder})

		set.Update([]SupportedResource{widget, gadget})
		set.Update([]SupportedResource{widget})

		require.Equal(t, []SupportedResource{folder, widget}, set.Latest())
	})

	t.Run("keeps a configured resource over the same kind of an update", func(t *testing.T) {
		configured := SupportedResource{GroupKind: widget.GroupKind, Capabilities: sets.New(CapabilityDisabled)}
		set := NewSupportedResourceSet([]SupportedResource{configured})

		set.Update([]SupportedResource{widget})

		require.Equal(t, []SupportedResource{configured}, set.Latest())
	})

	t.Run("keeps a configured collection over a kind that it covers", func(t *testing.T) {
		collection := SupportedResource{GroupKind: schema.GroupKind{Group: "*.ext.grafana.app", Kind: "Widget"}, Capabilities: sets.New(CapabilityDisabled)}
		set := NewSupportedResourceSet([]SupportedResource{collection})

		set.Update([]SupportedResource{widget})

		require.Equal(t, []SupportedResource{collection}, set.Latest())
	})

	t.Run("keeps the default set when none is configured", func(t *testing.T) {
		set := NewSupportedResourceSet(nil)

		set.Update([]SupportedResource{widget})

		require.Equal(t, slices.Concat(SupportedProvisioningResources, []SupportedResource{widget}), set.Latest())
	})

	t.Run("adds the kinds to the clients of a factory", func(t *testing.T) {
		set := NewSupportedResourceSet([]SupportedResource{folder})
		factory := set.Clients(NewClientFactory(nil, folder))

		set.Update([]SupportedResource{widget})

		clients, err := factory.Clients(context.Background(), "default")
		require.NoError(t, err)
		require.Equal(t, []SupportedResource{folder, widget}, clients.SupportedResources())
	})
}

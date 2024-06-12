package resource_test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/store/resource"
)

func TestResourceModels(t *testing.T) {
	t.Run("key namespaced path", func(t *testing.T) {
		key := &resource.Key{}
		require.Equal(t, "__cluster__", key.NamespacedPath())

		key.Namespace = "ns"
		require.Equal(t, "ns", key.NamespacedPath())

		key.Group = "ggg"
		require.Equal(t, "ns/ggg", key.NamespacedPath())

		key.Resource = "rrr"
		require.Equal(t, "ns/ggg/rrr", key.NamespacedPath())

		key.Name = "nnnn"
		require.Equal(t, "ns/ggg/rrr/nnnn", key.NamespacedPath())

		key.ResourceVersion = 1234
		require.Equal(t, "ns/ggg/rrr/nnnn/00000000000000001234", key.NamespacedPath())
	})
}

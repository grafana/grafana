package pluginroute

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestHardcodedNamespaceReadable(t *testing.T) {
	require.True(t, hardcodedNamespaceReadable("banners.grafana.app", "announcement-banners"))

	// The group and the resource must both match, so a plugin group serving a
	// resource of the same name is not readable without RBAC.
	require.False(t, hardcodedNamespaceReadable("banners.ext.grafana.app", "announcement-banners"))
	require.False(t, hardcodedNamespaceReadable("banners.grafana.app", "other"))
}

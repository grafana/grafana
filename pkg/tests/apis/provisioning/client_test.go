package provisioning

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// FIXME: do this tests make sense in their current form?
func TestIntegrationProvisioning_Client(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	helper := runGrafana(t)

	ctx := context.Background()
	clientFactory := resources.NewClientFactory(&helper.Org1.Admin)
	clients, err := clientFactory.Clients(ctx, "default")
	require.NoError(t, err)

	t.Run("dashboard client support", func(t *testing.T) {
		_, _, err := clients.ForResource(schema.GroupVersionResource{
			Group:    "dashboard.grafana.app",
			Resource: "dashboards",
			Version:  "v1alpha1",
		})
		require.NoError(t, err)

		// With empty version, we should get the preferred version (v1alpha1)
		_, _, err = clients.ForResource(schema.GroupVersionResource{
			Group:    "dashboard.grafana.app",
			Resource: "dashboards",
		})
		require.NoError(t, err)

		_, _, err = clients.ForKind(schema.GroupVersionKind{
			Group:   "dashboard.grafana.app",
			Version: "v1alpha1",
			Kind:    "Dashboard",
		})
		require.NoError(t, err)
	})
}

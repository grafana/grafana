package provisioning

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboardV2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// FIXME: do this tests make sense in their current form?
func TestIntegrationProvisioning_Client(t *testing.T) {
	helper := sharedHelper(t)

	ctx := context.Background()
	clientFactory := resources.NewClientFactory(&helper.Org1.Admin)
	clients, err := clientFactory.Clients(ctx, "default")
	require.NoError(t, err)

	t.Run("dashboard client support", func(t *testing.T) {
		_, _, err := clients.ForResource(ctx, schema.GroupVersionResource{
			Group:    dashboardV2.GROUP,
			Version:  dashboardV2.VERSION,
			Resource: "dashboards",
		})
		require.NoError(t, err)

		// With empty version, we should get the preferred version (v2)
		_, gvk, err := clients.ForResource(ctx, schema.GroupVersionResource{
			Group:    dashboardV2.GROUP,
			Resource: "dashboards",
		})
		require.NoError(t, err)
		require.Equal(t, dashboardV2.VERSION, gvk.Version)
		require.Equal(t, "Dashboard", gvk.Kind)

		_, _, err = clients.ForKind(ctx, schema.GroupVersionKind{
			Group:   dashboardV2.GROUP,
			Version: dashboardV2.VERSION,
			Kind:    "Dashboard",
		})
		require.NoError(t, err)
	})
}

package provisioning

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
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
		_, _, err := clients.ForResource(ctx, schema.GroupVersionResource{
			Group:    dashboardV1.GROUP,
			Version:  dashboardV1.VERSION,
			Resource: "dashboards",
		})
		require.NoError(t, err)

		// With empty version, we should get the preferred version (v1beta1)
		_, gvk, err := clients.ForResource(ctx, schema.GroupVersionResource{
			Group:    dashboardV1.GROUP,
			Resource: "dashboards",
		})
		require.NoError(t, err)
		require.Equal(t, dashboardV1.VERSION, gvk.Version)
		require.Equal(t, "Dashboard", gvk.Kind)

		_, _, err = clients.ForKind(ctx, schema.GroupVersionKind{
			Group:   dashboardV1.GROUP,
			Version: dashboardV1.VERSION,
			Kind:    "Dashboard",
		})
		require.NoError(t, err)
	})
}

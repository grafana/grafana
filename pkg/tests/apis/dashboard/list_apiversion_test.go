package dashboards

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashboardV1beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationListItemAPIVersion covers #124569. v1beta1 is a Go type
// alias of v1, so the conversion is a no-op and a dashboard stored through
// v1beta1 used to keep its stored apiVersion when listed through v1.
func TestIntegrationListItemAPIVersion(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous:     true,
		AppModeProduction:    true,
		APIServerStorageType: "unified",
	})
	t.Cleanup(helper.Shutdown)

	ctx := context.Background()
	v1GVR := schema.GroupVersionResource{Group: dashboardV1.GROUP, Version: dashboardV1.VERSION, Resource: "dashboards"}
	betaGVR := schema.GroupVersionResource{Group: dashboardV1beta1.GROUP, Version: dashboardV1beta1.VERSION, Resource: "dashboards"}

	betaClient := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Admin, GVR: betaGVR})
	v1Client := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Admin, GVR: v1GVR})

	created, err := betaClient.Resource.Create(ctx, &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": betaGVR.GroupVersion().String(),
		"kind":       "Dashboard",
		"metadata":   map[string]any{"name": "api-version-test"},
		"spec":       map[string]any{"title": "api version test", "schemaVersion": 42},
	}}, metav1.CreateOptions{})
	require.NoError(t, err)
	require.Equal(t, "dashboard.grafana.app/v1beta1", created.GetAPIVersion())

	list, err := v1Client.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err)
	require.Equal(t, "dashboard.grafana.app/v1", list.GetAPIVersion())

	found := false
	for _, item := range list.Items {
		require.Equal(t, "dashboard.grafana.app/v1", item.GetAPIVersion(), "item %s has the wrong apiVersion", item.GetName())
		if item.GetName() == created.GetName() {
			found = true
		}
	}
	require.True(t, found, "the dashboard created through v1beta1 is missing from the v1 list")
}

package dashboards

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashboardV2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// An update through another API version must report the version it was saved in, not the
// version the dashboard was stored in before. Clients pick the API version to write through
// from storedVersion, and writing through the wrong one drops fields that version cannot hold.
func TestIntegrationStoredVersionAfterCrossVersionUpdate(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous:     true,
		AppModeProduction:    true,
		APIServerStorageType: "unified",
	})
	t.Cleanup(helper.Shutdown)

	ctx := context.Background()
	v1GVR := schema.GroupVersionResource{Group: dashboardV1.GROUP, Version: dashboardV1.VERSION, Resource: "dashboards"}
	v2GVR := schema.GroupVersionResource{Group: dashboardV2.GROUP, Version: dashboardV2.VERSION, Resource: "dashboards"}
	v1Client := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Admin, GVR: v1GVR})
	v2Client := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Admin, GVR: v2GVR})

	storedVersion := func(t *testing.T, obj *unstructured.Unstructured) string {
		t.Helper()
		v, _, err := unstructured.NestedString(obj.Object, "status", "conversion", "storedVersion")
		require.NoError(t, err)
		return v
	}

	t.Run("created through v1, updated through v2", func(t *testing.T) {
		_, err := v1Client.Resource.Create(ctx, &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": v1GVR.GroupVersion().String(),
			"kind":       "Dashboard",
			"metadata":   map[string]any{"name": "stored-version-v1-to-v2"},
			"spec":       map[string]any{"title": "v1 to v2", "schemaVersion": 42},
		}}, metav1.CreateOptions{})
		require.NoError(t, err)

		asV2, err := v2Client.Resource.Get(ctx, "stored-version-v1-to-v2", metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "v1", storedVersion(t, asV2))

		// Clients send the spec without the status, as the dashboard save does
		delete(asV2.Object, "status")
		require.NoError(t, unstructured.SetNestedField(asV2.Object, "saved through v2", "spec", "title"))
		_, err = v2Client.Resource.Update(ctx, asV2, metav1.UpdateOptions{})
		require.NoError(t, err)

		asV1, err := v1Client.Resource.Get(ctx, "stored-version-v1-to-v2", metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "v2", storedVersion(t, asV1))
	})

	t.Run("created through v2, updated through v1", func(t *testing.T) {
		_, err := v2Client.Resource.Create(ctx, &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": v2GVR.GroupVersion().String(),
			"kind":       "Dashboard",
			"metadata":   map[string]any{"name": "stored-version-v2-to-v1"},
			"spec": map[string]any{
				"title":    "v2 to v1",
				"elements": map[string]any{},
				"layout":   map[string]any{"kind": "GridLayout", "spec": map[string]any{"items": []any{}}},
			},
		}}, metav1.CreateOptions{})
		require.NoError(t, err)

		asV1, err := v1Client.Resource.Get(ctx, "stored-version-v2-to-v1", metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "v2", storedVersion(t, asV1))

		delete(asV1.Object, "status")
		require.NoError(t, unstructured.SetNestedField(asV1.Object, "saved through v1", "spec", "title"))
		_, err = v1Client.Resource.Update(ctx, asV1, metav1.UpdateOptions{})
		require.NoError(t, err)

		asV2, err := v2Client.Resource.Get(ctx, "stored-version-v2-to-v1", metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "v1", storedVersion(t, asV2))
	})
}

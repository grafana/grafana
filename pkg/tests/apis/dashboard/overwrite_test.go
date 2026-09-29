package dashboards

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboardV2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationDashboardOverwriteOnCreate(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	gvr := schema.GroupVersionResource{
		Group:    dashboardV2beta1.GROUP,
		Version:  dashboardV2beta1.VERSION,
		Resource: "dashboards",
	}

	newDashboard := func(name, title string) *unstructured.Unstructured {
		obj := &unstructured.Unstructured{Object: map[string]interface{}{
			"spec": map[string]any{
				"title":         title,
				"schemaVersion": 42,
			},
		}}
		obj.SetName(name)
		obj.SetAPIVersion(gvr.GroupVersion().String())
		obj.SetKind("Dashboard")
		return obj
	}

	t.Run("toggle on, second create with annotation overwrites instead of 409", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous:     true,
			EnableFeatureToggles: []string{featuremgmt.FlagDashboardOverwriteOnCreate},
		})
		t.Cleanup(helper.Shutdown)

		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})

		first := newDashboard("overwrite-test-uid", "first title")
		_, err := client.Resource.Create(ctx, first, metav1.CreateOptions{})
		require.NoError(t, err)

		second := newDashboard("overwrite-test-uid", "second title")
		meta, err := utils.MetaAccessor(second)
		require.NoError(t, err)
		meta.SetAnnotation(utils.AnnoKeyOverwriteExisting, "true")

		updated, err := client.Resource.Create(ctx, second, metav1.CreateOptions{})
		require.NoError(t, err)
		require.Equal(t, "second title", updated.Object["spec"].(map[string]any)["title"])

		updatedMeta, err := utils.MetaAccessor(updated)
		require.NoError(t, err)
		require.Equal(t, "", updatedMeta.GetAnnotation(utils.AnnoKeyOverwriteExisting), "annotation must never be persisted")

		fetched, err := client.Resource.Get(ctx, "overwrite-test-uid", metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "second title", fetched.Object["spec"].(map[string]any)["title"])
	})

	t.Run("toggle on, second create without annotation still 409s", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous:     true,
			EnableFeatureToggles: []string{featuremgmt.FlagDashboardOverwriteOnCreate},
		})
		t.Cleanup(helper.Shutdown)

		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})

		first := newDashboard("no-overwrite-uid", "first title")
		_, err := client.Resource.Create(ctx, first, metav1.CreateOptions{})
		require.NoError(t, err)

		second := newDashboard("no-overwrite-uid", "second title")
		_, err = client.Resource.Create(ctx, second, metav1.CreateOptions{})
		require.True(t, errors.IsAlreadyExists(err), "expected AlreadyExists, got: %v", err)
	})
}

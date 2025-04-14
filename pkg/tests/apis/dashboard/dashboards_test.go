package dashboards

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
	dashboardV2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func runDashboardTest(t *testing.T, helper *apis.K8sTestHelper, gvr schema.GroupVersionResource) {
	t.Run("simple crud+list", func(t *testing.T) {
		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})
		rsp, err := client.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Empty(t, rsp.Items)

		obj := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"spec": map[string]any{
					"title":         "Test empty dashboard",
					"schemaVersion": 41,
				},
			},
		}
		obj.SetGenerateName("aa")
		obj.SetAPIVersion(gvr.GroupVersion().String())
		obj.SetKind("Dashboard")
		obj, err = client.Resource.Create(ctx, obj, metav1.CreateOptions{})
		require.NoError(t, err)
		created := obj.GetName()
		require.True(t, strings.HasPrefix(created, "aa"), "expecting prefix %s (%s)", "aa", created) // the generate name prefix

		// The new value exists in a list
		rsp, err = client.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, rsp.Items, 1)
		require.Equal(t, created, rsp.Items[0].GetName())

		// Same value returned from get
		obj, err = client.Resource.Get(ctx, created, metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, created, obj.GetName())
		require.Equal(t, int64(1), obj.GetGeneration())
		require.Equal(t, "Test empty dashboard", obj.Object["spec"].(map[string]any)["title"])

		wrap, err := utils.MetaAccessor(obj)
		require.NoError(t, err)

		m, _ := wrap.GetManagerProperties()
		require.Empty(t, m.Identity) // no SQL repo stub
		require.Equal(t, helper.Org1.Admin.Identity.GetUID(), wrap.GetCreatedBy())

		// Commented out because the dynamic client does not like lists as sub-resource
		// // Check that it now appears in the history
		// sub, err := client.Resource.Get(ctx, created, metav1.GetOptions{}, "history")
		// require.NoError(t, err)
		// history, err := sub.ToList()
		// require.NoError(t, err)
		// require.Len(t, history.Items, 1)
		// require.Equal(t, created, history.Items[0].GetName())

		obj.Object["spec"].(map[string]any)["title"] = "Changed title"

		updated, err := client.Resource.Update(context.Background(),
			obj,
			metav1.UpdateOptions{},
		)
		require.NoError(t, err)
		require.Equal(t, obj.GetName(), updated.GetName())
		require.Equal(t, obj.GetUID(), updated.GetUID())
		require.Less(t, obj.GetResourceVersion(), updated.GetResourceVersion())
		require.Equal(t, "Changed title", updated.Object["spec"].(map[string]any)["title"])

		// Delete the object, skipping the provisioned dashboard check
		zeroInt64 := int64(0)
		err = client.Resource.Delete(ctx, created, metav1.DeleteOptions{
			GracePeriodSeconds: &zeroInt64,
		})
		require.NoError(t, err)

		// Now it is not in the list
		rsp, err = client.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Empty(t, rsp.Items)
	})
}

func TestIntegrationDashboardsAppV0Alpha1(t *testing.T) {
	gvr := schema.GroupVersionResource{
		Group:    "dashboard.grafana.app",
		Version:  "v0alpha1",
		Resource: "dashboards",
	}
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	t.Run("v0alpha1 with dual writer mode 0", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 0,
				},
			},
		})
		runDashboardTest(t, helper, gvr)
	})

	t.Run("v0alpha1 with dual writer mode 1", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 1,
				},
			},
		})
		runDashboardTest(t, helper, gvr)
	})

	t.Run("v0alpha1 with dual writer mode 2", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 2,
				},
			},
		})
		runDashboardTest(t, helper, gvr)
	})

	t.Run("v0alpha1 with dual writer mode 3", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 3,
				},
			},
		})
		runDashboardTest(t, helper, gvr)
	})

	t.Run("v0alpha1 with dual writer mode 4", func(t *testing.T) {
		t.Skip("skipping test because of authorizer issue")
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 4,
				},
			},
		})
		runDashboardTest(t, helper, gvr)
	})
}

func TestIntegrationDashboardsAppV1Alpha1(t *testing.T) {
	gvr := schema.GroupVersionResource{
		Group:    "dashboard.grafana.app",
		Version:  "v1alpha1",
		Resource: "dashboards",
	}
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	t.Run("v1alpha1 with dual writer mode 0", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 0,
				},
			},
		})
		runDashboardTest(t, helper, gvr)
	})

	t.Run("v1alpha1 with dual writer mode 1", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 1,
				},
			},
		})
		runDashboardTest(t, helper, gvr)
	})

	t.Run("v1alpha1 with dual writer mode 2", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 2,
				},
			},
		})
		runDashboardTest(t, helper, gvr)
	})

	t.Run("v1alpha1 with dual writer mode 3", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 3,
				},
			},
		})
		runDashboardTest(t, helper, gvr)
	})

	t.Run("v1alpha1 with dual writer mode 4", func(t *testing.T) {
		t.Skip("skipping test because of authorizer issue")
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 4,
				},
			},
		})
		runDashboardTest(t, helper, gvr)
	})
}

func TestIntegrationLegacySupport(t *testing.T) {
	ctx := context.Background()
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{
			// NOTE: when using this feature toggle, the read is always v0!
			// featuremgmt.FlagKubernetesClientDashboardsFolders
		},
	})

	clientV0 := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  dashboardV0.DashboardResourceInfo.GroupVersionResource(),
	})
	obj, err := clientV0.Resource.Create(ctx,
		helper.LoadYAMLOrJSONFile("testdata/dashboard-test-v0.yaml"),
		metav1.CreateOptions{},
	)
	require.NoError(t, err)
	require.Equal(t, "test-v0", obj.GetName())

	clientV1 := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  dashboardV1.DashboardResourceInfo.GroupVersionResource(),
	})
	obj, err = clientV1.Resource.Create(ctx,
		helper.LoadYAMLOrJSONFile("testdata/dashboard-test-v1.yaml"),
		metav1.CreateOptions{},
	)
	require.NoError(t, err)
	require.Equal(t, "test-v1", obj.GetName())

	clientV2 := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  dashboardV2.DashboardResourceInfo.GroupVersionResource(),
	})
	obj, err = clientV2.Resource.Create(ctx,
		helper.LoadYAMLOrJSONFile("testdata/dashboard-test-v2.yaml"),
		metav1.CreateOptions{},
	)
	require.NoError(t, err)
	require.Equal(t, "test-v2", obj.GetName())

	//---------------------------------------------------------
	// Now check that we can get each dashboard with any API
	//---------------------------------------------------------
	names := []string{"test-v0", "test-v1", "test-v2"}
	clients := []dynamic.ResourceInterface{
		clientV0.Resource,
		clientV1.Resource,
		clientV2.Resource,
	}
	for _, name := range names {
		for _, client := range clients {
			obj, err := client.Get(ctx, name, metav1.GetOptions{})
			require.NoError(t, err)
			require.Equal(t, name, obj.GetName())

			// Can get the same thing with the /dto endpoint
			obj, err = client.Get(ctx, name, metav1.GetOptions{}, "dto")
			require.NoError(t, err)
			require.Equal(t, name, obj.GetName())

			if obj.Object["spec"] == nil {
				continue // missing conversions
			}

			// This should have been moved to metadata
			spec, _, err := unstructured.NestedMap(obj.Object, "spec")
			require.NoError(t, err)

			require.Nil(t, spec["id"])
			require.Nil(t, spec["uid"])
			require.Nil(t, spec["version"])

			access, _, err := unstructured.NestedMap(obj.Object, "access")
			require.NoError(t, err)
			require.Equal(t, slugify.Slugify(spec["title"].(string)), access["slug"])
		}
	}

	//---------------------------------------------------------
	// Check that the legacy APIs return the correct apiVersion
	//---------------------------------------------------------

	rsp := apis.DoRequest(helper, apis.RequestParams{
		User: helper.Org1.Admin,
		Path: "/api/dashboards/uid/test-v0",
	}, &dtos.DashboardFullWithMeta{})
	require.Equal(t, 200, rsp.Response.StatusCode)
	require.Equal(t, "v0alpha1", rsp.Result.Meta.APIVersion)

	rsp = apis.DoRequest(helper, apis.RequestParams{
		User: helper.Org1.Admin,
		Path: "/api/dashboards/uid/test-v1",
	}, &dtos.DashboardFullWithMeta{})
	require.Equal(t, 200, rsp.Response.StatusCode)
	require.Equal(t, "v1alpha1", rsp.Result.Meta.APIVersion)

	// V2 should send a not acceptable
	rsp = apis.DoRequest(helper, apis.RequestParams{
		User: helper.Org1.Admin,
		Path: "/api/dashboards/uid/test-v2",
	}, &dtos.DashboardFullWithMeta{})
	require.Equal(t, 406, rsp.Response.StatusCode) // not acceptable
}

package dashboards

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"

	dashboardV0 "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	dashboardV1 "github.com/grafana/grafana/pkg/apis/dashboard/v1alpha1"
	dashboardV2 "github.com/grafana/grafana/pkg/apis/dashboard/v2alpha1"
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
					"title": "Test empty dashboard",
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

	// V2 should send a redirect
	rsp = apis.DoRequest(helper, apis.RequestParams{
		User: helper.Org1.Admin,
		Path: "/api/dashboards/uid/test-v2",
	}, &dtos.DashboardFullWithMeta{})
	require.Equal(t, 302, rsp.Response.StatusCode) // redirect
}

func runDashboardFieldSelectorTest(t *testing.T, helper *apis.K8sTestHelper, gvr schema.GroupVersionResource) {
	ctx := context.Background()

	// Use a single namespace for all test objects
	testNamespace := "default"

	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  gvr,
	})

	// Create test dashboards with different fields for testing selectors
	testDashboards := []struct {
		name      string
		title     string
		folderUID string
	}{
		{
			name:      "dashboard-1",
			title:     "Production Dashboard",
			folderUID: "",
		},
		{
			name:      "dashboard-2",
			title:     "Development Dashboard",
			folderUID: "folder-1",
		},
		{
			name:      "dashboard-3",
			title:     "Test Dashboard",
			folderUID: "folder-2",
		},
	}

	// Create the test dashboards
	for _, d := range testDashboards {
		obj := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"metadata": map[string]interface{}{
					"name":      d.name,
					"namespace": testNamespace,
				},
				"spec": map[string]interface{}{
					"title":     d.title,
					"folderUID": d.folderUID,
				},
			},
		}
		obj.SetAPIVersion(gvr.GroupVersion().String())
		obj.SetKind("Dashboard")

		_, err := client.Resource.Create(ctx, obj, metav1.CreateOptions{})
		require.NoError(t, err)
	}

	// Update some dashboards to modify their content
	// Dashboard-1: Update once
	dashboard1, err := client.Resource.Get(ctx, "dashboard-1", metav1.GetOptions{})
	require.NoError(t, err)

	// Store the original generation before update
	gen1Before := dashboard1.GetGeneration()

	dashboard1.Object["spec"].(map[string]interface{})["title"] = "Updated Production Dashboard"
	updatedDashboard1, err := client.Resource.Update(ctx, dashboard1, metav1.UpdateOptions{})
	require.NoError(t, err)

	// Store the actual generation after update (don't assert a specific value)
	gen1After := updatedDashboard1.GetGeneration()
	t.Logf("Dashboard-1 generation: before=%d, after=%d", gen1Before, gen1After)

	// Dashboard-3: Update twice
	dashboard3, err := client.Resource.Get(ctx, "dashboard-3", metav1.GetOptions{})
	require.NoError(t, err)

	// Store the original generation before updates
	gen3Before := dashboard3.GetGeneration()

	// First update - we don't need to store this result since we're going to get it again
	dashboard3.Object["spec"].(map[string]interface{})["title"] = "Updated Test Dashboard"
	_, err = client.Resource.Update(ctx, dashboard3, metav1.UpdateOptions{})
	require.NoError(t, err)

	// Get the latest version again before the second update
	updatedDashboard3, err := client.Resource.Get(ctx, "dashboard-3", metav1.GetOptions{})
	require.NoError(t, err)

	gen3Middle := updatedDashboard3.GetGeneration()

	updatedDashboard3.Object["spec"].(map[string]interface{})["description"] = "Added description"
	finalDashboard3, err := client.Resource.Update(ctx, updatedDashboard3, metav1.UpdateOptions{})
	require.NoError(t, err)

	gen3After := finalDashboard3.GetGeneration()
	t.Logf("Dashboard-3 generation: before=%d, middle=%d, after=%d", gen3Before, gen3Middle, gen3After)

	// Query all objects to get their actual generation values for test cases
	objList, err := client.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err)

	// Map of name -> generation
	generationByName := make(map[string]int64)
	for _, obj := range objList.Items {
		generationByName[obj.GetName()] = obj.GetGeneration()
	}

	// Define test cases for field selectors based on actual generation values
	testCases := []struct {
		name          string
		fieldSelector string
		expectedCount int
		expectedNames []string
	}{
		// Only include metadata.name and metadata.generation field selectors
		{
			name:          "select by metadata.name equals",
			fieldSelector: "metadata.name=dashboard-1",
			expectedCount: 1,
			expectedNames: []string{"dashboard-1"},
		},
	}

	// Add generation-based test cases dynamically based on actual values
	for name, generation := range generationByName {
		testCases = append(testCases, struct {
			name          string
			fieldSelector string
			expectedCount int
			expectedNames []string
		}{
			name:          fmt.Sprintf("select %s with generation %d", name, generation),
			fieldSelector: fmt.Sprintf("metadata.generation=%d", generation),
			expectedCount: 1,
			expectedNames: []string{name},
		})
	}

	// Run the field selector test cases
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// List resources with field selector
			listOpts := metav1.ListOptions{
				FieldSelector: tc.fieldSelector,
			}
			list, err := client.Resource.List(ctx, listOpts)
			require.NoError(t, err)

			// Verify count
			require.Len(t, list.Items, tc.expectedCount, "Expected %d items, got %d", tc.expectedCount, len(list.Items))

			// Extract names for verification
			var names []string
			for _, item := range list.Items {
				names = append(names, item.GetName())
			}

			// Verify names match expected results
			if tc.expectedCount > 0 {
				require.Len(t, names, tc.expectedCount)
				for _, expectedName := range tc.expectedNames {
					require.Contains(t, names, expectedName, "Expected to find '%s' in results", expectedName)
				}
			}
		})
	}

	// Test field selector on historical dashboard versions
	t.Run("field selectors on historical versions", func(t *testing.T) {
		// Get the dashboard we'll update
		obj, err := client.Resource.Get(ctx, "dashboard-1", metav1.GetOptions{})
		require.NoError(t, err)

		// Save the original version
		originalVersion := obj.GetResourceVersion()
		originalGen := obj.GetGeneration()

		// Update the dashboard
		spec := obj.Object["spec"].(map[string]interface{})
		spec["title"] = "Updated Again Production Dashboard"
		obj.Object["spec"] = spec

		updatedObj, err := client.Resource.Update(ctx, obj, metav1.UpdateOptions{})
		require.NoError(t, err)
		require.Equal(t, "Updated Again Production Dashboard", updatedObj.Object["spec"].(map[string]interface{})["title"])

		newGen := updatedObj.GetGeneration()
		t.Logf("Historical test - dashboard generation: before=%d, after=%d", originalGen, newGen)

		// Verify we can get the historical version
		historyObj, err := client.Resource.Get(ctx, "dashboard-1", metav1.GetOptions{
			ResourceVersion: originalVersion,
		})
		require.NoError(t, err)
		require.Equal(t, "Updated Production Dashboard", historyObj.Object["spec"].(map[string]interface{})["title"])

		// Don't check for a specific generation value, just that it's preserved
		histGen := historyObj.GetGeneration()
		require.Equal(t, originalGen, histGen, "Historical generation should match original generation")
	})

	// Clean up
	for _, d := range testDashboards {
		zeroInt64 := int64(0)
		err := client.Resource.Delete(ctx, d.name, metav1.DeleteOptions{
			GracePeriodSeconds: &zeroInt64,
		})
		require.NoError(t, err)
	}
}

func TestIntegrationDashboardFieldSelectorsV0Alpha1(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	gvr := schema.GroupVersionResource{
		Group:    "dashboard.grafana.app",
		Version:  "v0alpha1",
		Resource: "dashboards",
	}

	t.Run("v0alpha1 with dual writer mode 0", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			EnableFeatureToggles: []string{
				"unifiedStorage",
			},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 0,
				},
			},
		})
		runDashboardFieldSelectorTest(t, helper, gvr)
	})

	t.Run("v0alpha1 with dual writer mode 1", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			EnableFeatureToggles: []string{
				"unifiedStorage",
			},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 1,
				},
			},
		})
		runDashboardFieldSelectorTest(t, helper, gvr)
	})

	t.Run("v0alpha1 with dual writer mode 2", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			EnableFeatureToggles: []string{
				"unifiedStorage",
			},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 2,
				},
			},
		})
		runDashboardFieldSelectorTest(t, helper, gvr)
	})

	t.Run("v0alpha1 with dual writer mode 3", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			EnableFeatureToggles: []string{
				"unifiedStorage",
			},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 3,
				},
			},
		})
		runDashboardFieldSelectorTest(t, helper, gvr)
	})

	t.Run("v0alpha1 with dual writer mode 4", func(t *testing.T) {
		t.Skip("skipping test because of authorizer issue")
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			EnableFeatureToggles: []string{
				"unifiedStorage",
			},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 4,
				},
			},
		})
		runDashboardFieldSelectorTest(t, helper, gvr)
	})
}

func TestIntegrationDashboardFieldSelectorsV1Alpha1(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	gvr := schema.GroupVersionResource{
		Group:    "dashboard.grafana.app",
		Version:  "v1alpha1",
		Resource: "dashboards",
	}

	t.Run("v1alpha1 with dual writer mode 0", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			EnableFeatureToggles: []string{
				"unifiedStorage",
			},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 0,
				},
			},
		})
		runDashboardFieldSelectorTest(t, helper, gvr)
	})

	t.Run("v1alpha1 with dual writer mode 1", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			EnableFeatureToggles: []string{
				"unifiedStorage",
			},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 1,
				},
			},
		})
		runDashboardFieldSelectorTest(t, helper, gvr)
	})

	t.Run("v1alpha1 with dual writer mode 2", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			EnableFeatureToggles: []string{
				"unifiedStorage",
			},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 2,
				},
			},
		})
		runDashboardFieldSelectorTest(t, helper, gvr)
	})

	t.Run("v1alpha1 with dual writer mode 3", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			EnableFeatureToggles: []string{
				"unifiedStorage",
			},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 3,
				},
			},
		})
		runDashboardFieldSelectorTest(t, helper, gvr)
	})

	t.Run("v1alpha1 with dual writer mode 4", func(t *testing.T) {
		t.Skip("skipping test because of authorizer issue")
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			EnableFeatureToggles: []string{
				"unifiedStorage",
			},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 4,
				},
			},
		})
		runDashboardFieldSelectorTest(t, helper, gvr)
	})
}

func TestIntegrationDashboardFieldSelectorsV2Alpha1(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	gvr := schema.GroupVersionResource{
		Group:    "dashboard.grafana.app",
		Version:  "v2alpha1",
		Resource: "dashboards",
	}

	t.Run("v2alpha1 with dual writer mode 0", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			EnableFeatureToggles: []string{
				"unifiedStorage",
			},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 0,
				},
			},
		})
		runDashboardFieldSelectorTest(t, helper, gvr)
	})

	t.Run("v2alpha1 with dual writer mode 1", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			EnableFeatureToggles: []string{
				"unifiedStorage",
			},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 1,
				},
			},
		})
		runDashboardFieldSelectorTest(t, helper, gvr)
	})

	t.Run("v2alpha1 with dual writer mode 2", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			EnableFeatureToggles: []string{
				"unifiedStorage",
			},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 2,
				},
			},
		})
		runDashboardFieldSelectorTest(t, helper, gvr)
	})

	t.Run("v2alpha1 with dual writer mode 3", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			EnableFeatureToggles: []string{
				"unifiedStorage",
			},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 3,
				},
			},
		})
		runDashboardFieldSelectorTest(t, helper, gvr)
	})

	t.Run("v2alpha1 with dual writer mode 4", func(t *testing.T) {
		t.Skip("skipping test because of authorizer issue")
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableAnonymous: true,
			EnableFeatureToggles: []string{
				"unifiedStorage",
			},
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				"dashboards.dashboard.grafana.app": {
					DualWriterMode: 4,
				},
			},
		})
		runDashboardFieldSelectorTest(t, helper, gvr)
	})
}

package provisioning

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestIntegrationProvisioning_Stats(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()

	const repo = "stats-test-repo1"

	testRepo := TestRepo{
		Name: repo,
		Copies: map[string]string{
			"testdata/all-panels.json":   "dashboard1.json",
			"testdata/text-options.json": "folder/dashboard2.json",
		},
		ExpectedDashboards: 2,
		ExpectedFolders:    1,
	}
	helper.CreateRepo(t, testRepo)

	// Create some unmanaged dashboards directly in Grafana
	unmanagedDash1 := helper.LoadYAMLOrJSONFile("exportunifiedtorepository/dashboard-test-v1.yaml")
	dashboard1Obj, err := helper.DashboardsV1.Resource.Create(ctx, unmanagedDash1, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create unmanaged dashboard")
	dashboard1Name := dashboard1Obj.GetName()

	// Verify that the unmanaged dashboard is indeed unmanaged
	dashboard1, err := helper.DashboardsV1.Resource.Get(ctx, dashboard1Name, metav1.GetOptions{})
	require.NoError(t, err)
	manager1, found1 := dashboard1.GetAnnotations()[utils.AnnoKeyManagerIdentity]
	require.True(t, !found1 || manager1 == "", "dashboard1 should be unmanaged")

	// Get global stats
	result := helper.AdminREST.Get().
		Namespace("default").
		Resource("stats").
		Do(ctx)
	require.NoError(t, result.Error(), "should be able to get global stats")

	statsObj, err := result.Get()
	require.NoError(t, err, "should be able to get global stats object")
	unstructuredStats := statsObj.(*unstructured.Unstructured)

	// Parse instance stats
	instanceStats, _, err := unstructured.NestedSlice(unstructuredStats.Object, "instance")
	require.NoError(t, err, "should be able to get instance stats")

	var dashboardInstanceCount int64
	for _, instanceStat := range instanceStats {
		stat := instanceStat.(map[string]interface{})
		group, _, _ := unstructured.NestedString(stat, "group")
		resource, _, _ := unstructured.NestedString(stat, "resource")
		if group == "dashboard.grafana.app" && resource == "dashboards" {
			count, _, _ := unstructured.NestedInt64(stat, "count")
			dashboardInstanceCount = count
			break
		}
	}
	require.GreaterOrEqual(t, dashboardInstanceCount, int64(3), "should have at least 3 dashboards total (2 managed + 1 unmanaged)")

	// Parse managed stats
	managedStats, _, err := unstructured.NestedSlice(unstructuredStats.Object, "managed")
	require.NoError(t, err, "should be able to get managed stats")

	var totalManagedDashboards int64
	foundRepo := false
	for _, manager := range managedStats {
		managerObj := manager.(map[string]interface{})
		identity, _, _ := unstructured.NestedString(managerObj, "id")

		if identity == repo {
			foundRepo = true
			stats, _, _ := unstructured.NestedSlice(managerObj, "stats")
			for _, statObj := range stats {
				stat := statObj.(map[string]interface{})
				group, _, _ := unstructured.NestedString(stat, "group")
				resource, _, _ := unstructured.NestedString(stat, "resource")
				if group == "dashboard.grafana.app" && resource == "dashboards" {
					count, _, _ := unstructured.NestedInt64(stat, "count")
					totalManagedDashboards += count
					require.Equal(t, int64(2), count, "repo should manage 2 dashboards")
				} else if group == "folder.grafana.app" && resource == "folders" {
					count, _, _ := unstructured.NestedInt64(stat, "count")
					require.Equal(t, int64(1), count, "repo should manage 1 folder")
				}
			}
		}
	}
	require.True(t, foundRepo, "should find stats for repo1")

	// Parse unmanaged stats
	unmanagedStats, _, err := unstructured.NestedSlice(unstructuredStats.Object, "unmanaged")
	require.NoError(t, err, "should be able to get unmanaged stats")

	var unmanagedDashboardCount int64
	for _, unmanagedStat := range unmanagedStats {
		stat := unmanagedStat.(map[string]interface{})
		group, _, _ := unstructured.NestedString(stat, "group")
		resource, _, _ := unstructured.NestedString(stat, "resource")
		if group == "dashboard.grafana.app" && resource == "dashboards" {
			count, _, _ := unstructured.NestedInt64(stat, "count")
			unmanagedDashboardCount = count
			break
		}
	}
	require.GreaterOrEqual(t, unmanagedDashboardCount, int64(1), "should have at least 1 unmanaged dashboard")

	// Verify the math: instance = managed + unmanaged
	require.Equal(t, dashboardInstanceCount, totalManagedDashboards+unmanagedDashboardCount,
		"instance count should equal managed + unmanaged counts")
}

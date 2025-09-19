package provisioning

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestProvisioning_ExportUnifiedToRepository(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()

	// Write dashboards at
	dashboard := helper.LoadYAMLOrJSONFile("exportunifiedtorepository/dashboard-test-v0.yaml")
	_, err := helper.DashboardsV0.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v0 dashboard")

	// FIXME: add helper and template for dashboards in different versions
	dashboard = helper.LoadYAMLOrJSONFile("exportunifiedtorepository/dashboard-test-v1.yaml")
	_, err = helper.DashboardsV1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v1 dashboard")

	dashboard = helper.LoadYAMLOrJSONFile("exportunifiedtorepository/dashboard-test-v2alpha1.yaml")
	_, err = helper.DashboardsV2alpha1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v2alpha1 dashboard")

	dashboard = helper.LoadYAMLOrJSONFile("exportunifiedtorepository/dashboard-test-v2beta1.yaml")
	_, err = helper.DashboardsV2beta1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v2beta1 dashboard")

	// Now for the repository.
	const repo = "local-repository"
	testRepo := TestRepo{
		Name:               repo,
		Copies:             map[string]string{}, // No initial files needed for export test
		ExpectedDashboards: 4,                   // 4 dashboards created above (v0, v1, v2alpha1, v2beta1)
		ExpectedFolders:    0,                   // No folders expected after sync
	}
	helper.CreateRepo(t, testRepo)

	// Now export
	helper.DebugState(t, repo, "BEFORE EXPORT TO REPOSITORY")

	spec := provisioning.JobSpec{
		Action: provisioning.JobActionPush,
		Push: &provisioning.ExportJobOptions{
			Folder: "", // export entire instance
			Path:   "", // no prefix necessary for testing
		},
	}
	helper.TriggerJobAndWaitForSuccess(t, repo, spec)

	helper.DebugState(t, repo, "AFTER EXPORT TO REPOSITORY")

	type props struct {
		title      string
		apiVersion string
		name       string
		fileName   string
	}

	printFileTree(t, helper.ProvisioningPath)

	// Check that each file was exported with its stored version
	for _, test := range []props{
		{title: "Test dashboard. Created at v0", apiVersion: "dashboard.grafana.app/v0alpha1", name: "test-v0", fileName: "test-dashboard-created-at-v0.json"},
		{title: "Test dashboard. Created at v1", apiVersion: "dashboard.grafana.app/v1beta1", name: "test-v1", fileName: "test-dashboard-created-at-v1.json"},
		{title: "Test dashboard. Created at v2alpha1", apiVersion: "dashboard.grafana.app/v2alpha1", name: "test-v2alpha1", fileName: "test-dashboard-created-at-v2alpha1.json"},
		{title: "Test dashboard. Created at v2beta1", apiVersion: "dashboard.grafana.app/v2beta1", name: "test-v2beta1", fileName: "test-dashboard-created-at-v2beta1.json"},
	} {
		fpath := filepath.Join(helper.ProvisioningPath, test.fileName)
		//nolint:gosec // we are ok with reading files in testdata
		body, err := os.ReadFile(fpath)
		require.NoError(t, err, "exported file was not created at path %s", fpath)
		obj := map[string]any{}
		err = json.Unmarshal(body, &obj)
		require.NoError(t, err, "exported file not json %s", fpath)

		val, _, err := unstructured.NestedString(obj, "apiVersion")
		require.NoError(t, err)
		require.Equal(t, test.apiVersion, val)

		val, _, err = unstructured.NestedString(obj, "spec", "title")
		require.NoError(t, err)
		require.Equal(t, test.title, val)

		val, _, err = unstructured.NestedString(obj, "metadata", "name")
		require.NoError(t, err)
		require.Equal(t, test.name, val)

		require.Nil(t, obj["status"], "should not have a status element")
	}
}

func TestIntegrationProvisioning_SecondRepositoryOnlyExportsNewDashboards(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()

	// FIXME: helper to create dashboards.
	// Create some unmanaged dashboards directly in Grafana first
	dashboard1 := helper.LoadYAMLOrJSONFile("exportunifiedtorepository/dashboard-test-v1.yaml")
	dashboard1Obj, err := helper.DashboardsV1.Resource.Create(ctx, dashboard1, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create first dashboard")
	dashboard1Name := dashboard1Obj.GetName()

	dashboard2 := helper.LoadYAMLOrJSONFile("exportunifiedtorepository/dashboard-test-v2beta1.yaml")
	dashboard2Obj, err := helper.DashboardsV2beta1.Resource.Create(ctx, dashboard2, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create second dashboard")
	dashboard2Name := dashboard2Obj.GetName()

	// Create the first repository with sync enabled and separate filesystem path
	const repo1 = "first-repository"
	repo1Path := filepath.Join(helper.ProvisioningPath, repo1)
	testRepo1 := TestRepo{
		Name:               repo1,
		Target:             "folder",
		Path:               repo1Path,
		Copies:             map[string]string{}, // No initial files needed for export test
		ExpectedDashboards: 2,                   // 2 dashboards created above (v1, v2beta1)
		ExpectedFolders:    1,                   // One folder expected after sync
	}
	helper.CreateRepo(t, testRepo1)

	// Print file tree before export
	printFileTree(t, helper.ProvisioningPath)

	// Initial export
	helper.DebugState(t, repo1, "BEFORE INITIAL EXPORT")

	spec := provisioning.JobSpec{
		Action: provisioning.JobActionPush,
		Push: &provisioning.ExportJobOptions{
			Folder: "", // export entire instance
			Path:   "", // no prefix necessary for testing
		},
	}

	helper.TriggerJobAndWaitForSuccess(t, repo1, spec)

	helper.DebugState(t, repo1, "AFTER INITIAL EXPORT")
	helper.SyncAndWait(t, repo1, nil)

	printFileTree(t, helper.ProvisioningPath)
	// Verify that the first repository has claimed ownership of the dashboards
	managedDash1, err := helper.DashboardsV1.Resource.Get(ctx, dashboard1Name, metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, repo1, managedDash1.GetAnnotations()[utils.AnnoKeyManagerIdentity], "dashboard1 should be managed by first repo")

	managedDash2, err := helper.DashboardsV2beta1.Resource.Get(ctx, dashboard2Name, metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, repo1, managedDash2.GetAnnotations()[utils.AnnoKeyManagerIdentity], "dashboard2 should be managed by first repo")

	// Create second repository - enable sync and set different target with separate filesystem path
	const repo2 = "second-repository"
	repo2Path := filepath.Join(helper.ProvisioningPath, repo2)
	testRepo2 := TestRepo{
		Name:               repo2,
		Target:             "folder",
		Path:               repo2Path,
		Copies:             map[string]string{}, // No initial files needed for export test
		ExpectedDashboards: 2,                   // 2 dashboards exist when second repo syncs
		ExpectedFolders:    2,                   // Two folders expected after sync (repo1 + repo2)
	}
	helper.CreateRepo(t, testRepo2)

	// Wait for second repository to sync
	helper.SyncAndWait(t, repo2, nil)

	printFileTree(t, helper.ProvisioningPath)

	// FIXME: use helpers to check status
	// Validate that folders for both repositories exist
	folders, err := helper.Folders.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err, "should be able to list folders")

	var repo1FolderFound, repo2FolderFound bool
	for _, folder := range folders.Items {
		if folder.GetName() == repo1 {
			repo1FolderFound = true
		}
		if folder.GetName() == repo2 {
			repo2FolderFound = true
		}
	}
	require.True(t, repo1FolderFound, "folder for first repository %s should exist after sync", repo1)
	require.True(t, repo2FolderFound, "folder for second repository %s should exist after sync", repo2)

	// Create a third dashboard that won't be claimed by the first repo
	dashboard3 := helper.LoadYAMLOrJSONFile("exportunifiedtorepository/dashboard-test-v0.yaml")
	dashboard3Obj, err := helper.DashboardsV0.Resource.Create(ctx, dashboard3, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create third dashboard")
	dashboard3Name := dashboard3Obj.GetName()

	// Verify dashboard3 is not managed by anyone initially
	unmanagedDash3, err := helper.DashboardsV0.Resource.Get(ctx, dashboard3Name, metav1.GetOptions{})
	require.NoError(t, err)
	manager, found := unmanagedDash3.GetAnnotations()[utils.AnnoKeyManagerIdentity]
	require.True(t, !found || manager == "", "dashboard3 should not be managed initially")

	printFileTree(t, helper.ProvisioningPath)
	// Count files in first repo before second export
	files1Before, err := countFilesInDir(repo1Path)
	require.NoError(t, err)

	// Export from second repository - this should only export the unmanaged dashboard3
	helper.DebugState(t, repo2, "BEFORE SECOND EXPORT")

	spec = provisioning.JobSpec{
		Action: provisioning.JobActionPush,
		Push: &provisioning.ExportJobOptions{
			Folder: "", // export entire instance
			Path:   "", // no prefix necessary for testing
		},
	}
	helper.TriggerJobAndWaitForSuccess(t, repo2, spec)

	helper.DebugState(t, repo2, "AFTER SECOND EXPORT")

	// Wait for both repositories to sync
	helper.SyncAndWait(t, repo1, nil)
	helper.SyncAndWait(t, repo2, nil)

	printFileTree(t, helper.ProvisioningPath)
	files1After, err := countFilesInDir(repo1Path)
	require.NoError(t, err)

	actualNewFiles := files1After - files1Before
	require.Equal(t, 0, actualNewFiles,
		"second repository should skip managed dashboards and had folder issues with unmanaged dashboard (expected %d new files, got %d)",
		0, actualNewFiles)

	// Verify files in the second repository
	files2After, err := countFilesInDir(repo2Path)
	require.NoError(t, err)
	require.Equal(t, 1, files2After,
		"second repository should only export the unmanaged dashboard (expected %d new files, got %d)",
		1, files2After)

	// Verify dashboard1 and dashboard2 are still managed by repo1 (unchanged)
	stillManagedDash1, err := helper.DashboardsV1.Resource.Get(ctx, dashboard1Name, metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, repo1, stillManagedDash1.GetAnnotations()[utils.AnnoKeyManagerIdentity],
		"dashboard1 should still be managed by first repo")

	stillManagedDash2, err := helper.DashboardsV2beta1.Resource.Get(ctx, dashboard2Name, metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, repo1, stillManagedDash2.GetAnnotations()[utils.AnnoKeyManagerIdentity],
		"dashboard2 should still be managed by first repo")

	// Verify dashboard3 is now managed by repo2
	stillManagedDash3, err := helper.DashboardsV0.Resource.Get(ctx, dashboard3Name, metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, repo2, stillManagedDash3.GetAnnotations()[utils.AnnoKeyManagerIdentity],
		"dashboard3 should now be managed by second repo")
}

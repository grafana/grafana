package provisioning

import (
	"os"
	"path/filepath"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
)

// TestIntegrationProvisionedFolders_BlockDashboardCreation verifies that users cannot
// create dashboards inside repository-managed (provisioned) folders.
func TestIntegrationProvisionedFolders_BlockDashboardCreation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	helper.CreateRepo(t, TestRepo{
		Name:            "dashboard-guard-repo",
		Target:          "folder",
		ExpectedFolders: 1,
	})

	t.Run("should fail to create a dashboard in a provisioned folder", func(t *testing.T) {
		ctx := t.Context()

		folders, err := helper.Folders.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.NotEmpty(t, folders.Items, "should have at least one folder")

		var managedFolder *unstructured.Unstructured
		for i := range folders.Items {
			annotations := folders.Items[i].GetAnnotations()
			if _, ok := annotations[utils.AnnoKeyManagerKind]; ok {
				managedFolder = &folders.Items[i]
				break
			}
		}
		require.NotNil(t, managedFolder, "should find a managed folder")

		dashboard := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": "dashboard.grafana.app/v1beta1",
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"generateName": "test-dash-",
					"annotations": map[string]interface{}{
						utils.AnnoKeyFolder: managedFolder.GetName(),
					},
				},
				"spec": map[string]interface{}{
					"title":         "Unmanaged Dashboard",
					"schemaVersion": 41,
				},
			},
		}

		_, err = helper.DashboardsV1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
		require.Error(t, err, "should not be able to create a dashboard in a provisioned folder")
		require.Contains(t, err.Error(), "managed by a repository")
	})

	t.Run("should succeed creating a dashboard in an unmanaged folder", func(t *testing.T) {
		ctx := t.Context()

		unmanagedFolder := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": foldersV1.FolderResourceInfo.GroupVersion().String(),
				"kind":       foldersV1.FolderResourceInfo.GroupVersionKind().Kind,
				"metadata": map[string]interface{}{
					"generateName": "unmanaged-folder-",
				},
				"spec": map[string]interface{}{
					"title": "Unmanaged Folder",
				},
			},
		}
		createdFolder, err := helper.Folders.Resource.Create(ctx, unmanagedFolder, metav1.CreateOptions{})
		require.NoError(t, err, "should create unmanaged folder")

		dashboard := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": "dashboard.grafana.app/v1beta1",
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"generateName": "test-dash-ok-",
					"annotations": map[string]interface{}{
						utils.AnnoKeyFolder: createdFolder.GetName(),
					},
				},
				"spec": map[string]interface{}{
					"title":         "Dashboard in Unmanaged Folder",
					"schemaVersion": 41,
				},
			},
		}

		_, err = helper.DashboardsV1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
		require.NoError(t, err, "should be able to create a dashboard in an unmanaged folder")
	})
}

// TestIntegrationProvisionedFolders_BlockFolderCreation verifies that users cannot
// create subfolders inside repository-managed (provisioned) folders.
func TestIntegrationProvisionedFolders_BlockFolderCreation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	helper.CreateRepo(t, TestRepo{
		Name:            "folder-guard-repo",
		Target:          "folder",
		ExpectedFolders: 1,
	})

	t.Run("should fail to create a subfolder in a provisioned folder", func(t *testing.T) {
		ctx := t.Context()

		folders, err := helper.Folders.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.NotEmpty(t, folders.Items, "should have at least one folder")

		var managedFolder *unstructured.Unstructured
		for i := range folders.Items {
			annotations := folders.Items[i].GetAnnotations()
			if _, ok := annotations[utils.AnnoKeyManagerKind]; ok {
				managedFolder = &folders.Items[i]
				break
			}
		}
		require.NotNil(t, managedFolder, "should find a managed folder")

		childFolder := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": foldersV1.FolderResourceInfo.GroupVersion().String(),
				"kind":       foldersV1.FolderResourceInfo.GroupVersionKind().Kind,
				"metadata": map[string]interface{}{
					"generateName": "child-folder-",
					"annotations": map[string]interface{}{
						utils.AnnoKeyFolder: managedFolder.GetName(),
					},
				},
				"spec": map[string]interface{}{
					"title": "Unmanaged Child Folder",
				},
			},
		}

		_, err = helper.Folders.Resource.Create(ctx, childFolder, metav1.CreateOptions{})
		require.Error(t, err, "should not be able to create a subfolder in a provisioned folder")
		require.Contains(t, err.Error(), "managed by a repository")
	})

	t.Run("should succeed creating a subfolder in an unmanaged folder", func(t *testing.T) {
		ctx := t.Context()

		parentFolder := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": foldersV1.FolderResourceInfo.GroupVersion().String(),
				"kind":       foldersV1.FolderResourceInfo.GroupVersionKind().Kind,
				"metadata": map[string]interface{}{
					"generateName": "parent-folder-",
				},
				"spec": map[string]interface{}{
					"title": "Unmanaged Parent Folder",
				},
			},
		}
		createdParent, err := helper.Folders.Resource.Create(ctx, parentFolder, metav1.CreateOptions{})
		require.NoError(t, err, "should create unmanaged parent folder")

		childFolder := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": foldersV1.FolderResourceInfo.GroupVersion().String(),
				"kind":       foldersV1.FolderResourceInfo.GroupVersionKind().Kind,
				"metadata": map[string]interface{}{
					"generateName": "child-folder-ok-",
					"annotations": map[string]interface{}{
						utils.AnnoKeyFolder: createdParent.GetName(),
					},
				},
				"spec": map[string]interface{}{
					"title": "Child Folder in Unmanaged Parent",
				},
			},
		}

		_, err = helper.Folders.Resource.Create(ctx, childFolder, metav1.CreateOptions{})
		require.NoError(t, err, "should be able to create a subfolder in an unmanaged folder")
	})

	t.Run("should fail to move an unmanaged folder into a provisioned folder", func(t *testing.T) {
		ctx := t.Context()

		foldersList, err := helper.Folders.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)

		var managedFolder *unstructured.Unstructured
		for i := range foldersList.Items {
			if _, ok := foldersList.Items[i].GetAnnotations()[utils.AnnoKeyManagerKind]; ok {
				managedFolder = &foldersList.Items[i]
				break
			}
		}
		require.NotNil(t, managedFolder, "should find a managed folder")

		unmanagedFolder := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": foldersV1.FolderResourceInfo.GroupVersion().String(),
				"kind":       foldersV1.FolderResourceInfo.GroupVersionKind().Kind,
				"metadata": map[string]interface{}{
					"generateName": "movable-folder-",
				},
				"spec": map[string]interface{}{
					"title": "Folder To Move",
				},
			},
		}
		created, err := helper.Folders.Resource.Create(ctx, unmanagedFolder, metav1.CreateOptions{})
		require.NoError(t, err, "should create unmanaged folder at root")

		annotations := created.GetAnnotations()
		if annotations == nil {
			annotations = map[string]string{}
		}
		annotations[utils.AnnoKeyFolder] = managedFolder.GetName()
		created.SetAnnotations(annotations)

		_, err = helper.Folders.Resource.Update(ctx, created, metav1.UpdateOptions{})
		require.Error(t, err, "should not be able to move a folder into a provisioned folder")
		require.Contains(t, err.Error(), "managed by a repository")
	})
}

// TestIntegrationProvisionedFolders_SyncCanCreateResources verifies that the provisioning
// system itself can create dashboards and nested folders inside provisioned folders.
func TestIntegrationProvisionedFolders_SyncCanCreateResources(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	helper.CreateRepo(t, TestRepo{
		Name:   "sync-guard-repo",
		Target: "folder",
		Copies: map[string]string{
			"testdata/all-panels.json": "folder/subfolder/dashboard.json",
		},
		SkipResourceAssertions: true,
	})

	t.Run("sync should create nested folders and dashboards in provisioned folders", func(t *testing.T) {
		ctx := t.Context()

		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			folderList, err := helper.Folders.Resource.List(ctx, metav1.ListOptions{})
			if !assert.NoError(collect, err) {
				return
			}
			assert.GreaterOrEqual(collect, len(folderList.Items), 2, "should have root folder and subfolder")

			var managedCount int
			for _, f := range folderList.Items {
				if _, ok := f.GetAnnotations()[utils.AnnoKeyManagerKind]; ok {
					managedCount++
				}
			}
			assert.GreaterOrEqual(collect, managedCount, 2, "both folders should be managed by the repo")
		}, waitTimeoutDefault, waitIntervalDefault)

		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
			if !assert.NoError(collect, err) {
				return
			}
			assert.GreaterOrEqual(collect, len(dashboards.Items), 1, "should have at least one dashboard")

			var managedDash int
			for _, d := range dashboards.Items {
				if _, ok := d.GetAnnotations()[utils.AnnoKeyManagerKind]; ok {
					managedDash++
				}
			}
			assert.GreaterOrEqual(collect, managedDash, 1, "dashboard should be managed by the repo")
		}, waitTimeoutDefault, waitIntervalDefault)
	})
}

// TestIntegrationProvisionedFolders_SyncDeletionOfNestedContent reproduces the production
// issue where deleting provisioned folders fails with "folder is not empty" because
// the search index hasn't caught up with child resource deletions.
//
// Scenario:
//  1. Sync a repo with nested folders and dashboards
//  2. Remove all content from the repo filesystem
//  3. Re-sync — the sync job deletes dashboards first, then folders
//  4. Verify the sync completes successfully (no "folder is not empty" errors)
func TestIntegrationProvisionedFolders_SyncDeletionOfNestedContent(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)

	const repo = "sync-delete-nested-repo"
	repoPath := filepath.Join(helper.ProvisioningPath, repo)

	helper.CreateRepo(t, TestRepo{
		Name:   repo,
		Path:   repoPath,
		Target: "folder",
		Copies: map[string]string{
			"testdata/all-panels.json":   "folder/dashboard1.json",
			"testdata/text-options.json": "folder/nested/dashboard2.json",
		},
		SkipSync:               true,
		SkipResourceAssertions: true,
	})
	helper.SyncAndWait(t, repo, nil)

	// Step 1: Verify resources were created
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		dashboards, err := helper.DashboardsV1.Resource.List(t.Context(), metav1.ListOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		var managedDashCount int
		for _, d := range dashboards.Items {
			if id, _, _ := unstructured.NestedString(d.Object, "metadata", "annotations", "grafana.app/managerId"); id == repo {
				managedDashCount++
			}
		}
		assert.Equal(collect, 2, managedDashCount, "should have 2 managed dashboards")

		folders, err := helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		var managedFolderCount int
		for _, f := range folders.Items {
			if id, _, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/managerId"); id == repo {
				managedFolderCount++
			}
		}
		assert.Equal(collect, 3, managedFolderCount, "should have 3 managed folders (root + folder + folder/nested)")
	}, waitTimeoutDefault, waitIntervalDefault)

	// Step 2: Remove all content from the repo filesystem (simulating repo content deletion)
	err := os.RemoveAll(filepath.Join(repoPath, "folder"))
	require.NoError(t, err, "should be able to remove folder directory")

	// Step 3: Re-sync — this triggers deletion of dashboards then folders
	job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})

	jobObj := &provisioning.Job{}
	err = runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj)
	require.NoError(t, err)

	t.Logf("Job state: %s", jobObj.Status.State)
	t.Logf("Job message: %s", jobObj.Status.Message)
	t.Logf("Job errors: %v", jobObj.Status.Errors)
	for _, s := range jobObj.Status.Summary {
		t.Logf("Summary: group=%s kind=%s delete=%d error=%d warnings=%v",
			s.Group, s.Kind, s.Delete, s.Error, s.Warnings)
	}

	// Step 4: Verify the sync succeeded — no "folder is not empty" errors
	require.Equal(t, provisioning.JobStateSuccess, jobObj.Status.State,
		"sync job should succeed when deleting nested provisioned content")
	require.Empty(t, jobObj.Status.Errors,
		"sync job should have no errors (no 'folder is not empty' failures)")

	// Step 5: Verify all managed resources were cleaned up
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		dashboards, err := helper.DashboardsV1.Resource.List(t.Context(), metav1.ListOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		var remaining int
		for _, d := range dashboards.Items {
			if id, _, _ := unstructured.NestedString(d.Object, "metadata", "annotations", "grafana.app/managerId"); id == repo {
				remaining++
			}
		}
		assert.Equal(collect, 0, remaining, "all managed dashboards should be deleted")

		folders, err := helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		var remainingFolders int
		for _, f := range folders.Items {
			if id, _, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/managerId"); id == repo {
				remainingFolders++
			}
		}
		// Root folder may persist (it's the repo target), but nested folders should be gone
		assert.LessOrEqual(collect, remainingFolders, 1, "nested managed folders should be deleted")
	}, waitTimeoutDefault, waitIntervalDefault)
}

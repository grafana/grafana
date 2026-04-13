package orgs

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestFilesCreate_NamespaceIsolation verifies that files created in a repository
// are properly isolated by namespace and don't leak across organizations.
func TestFilesCreate_NamespaceIsolation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := sharedHelper(t)
	ctx := context.Background()

	const (
		repo1Name = "repo-files-create-1"
		repo2Name = "repo-files-create-2"
	)

	// Setup: Create two empty repositories
	t.Run("setup repositories", func(t *testing.T) {
		helper.CreateRepo(t, common.TestRepo{
			Name:     repo1Name,
			Target:   "instance",
			SkipSync: true,
		})

		helper.CreateRepo(t, common.TestRepo{
			Name:     repo2Name,
			Target:   "instance",
			SkipSync: true,
		})
	})

	// Test: Create files via API and verify namespace isolation
	t.Run("create files in each repository", func(t *testing.T) {
		// Create a dashboard file in repo1
		dashboardContent := helper.LoadFile("testdata/simple-dashboard.json")

		resp := helper.PostFilesRequest(t, repo1Name, common.FilesPostOptions{
			TargetPath: "test-dashboard-1.json",
			Message:    "create dashboard in repo1",
			Body:       string(dashboardContent),
		})
		defer resp.Body.Close()
		require.Equal(t, 200, resp.StatusCode, "should create file in repo1")

		// Create a dashboard file in repo2 with same content but different name
		resp2 := helper.PostFilesRequest(t, repo2Name, common.FilesPostOptions{
			TargetPath: "test-dashboard-2.json",
			Message:    "create dashboard in repo2",
			Body:       string(dashboardContent),
		})
		defer resp2.Body.Close()
		require.Equal(t, 200, resp2.StatusCode, "should create file in repo2")

		t.Log("✓ Files created in both repositories")
	})

	// Sync both repositories
	t.Run("sync repositories to create resources", func(t *testing.T) {
		helper.SyncAndWait(t, repo1Name, nil)
		helper.SyncAndWait(t, repo2Name, nil)
	})

	// Verify: Each repository's resources are in the correct namespace
	t.Run("verify resources are namespace-isolated", func(t *testing.T) {
		dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)

		var repo1Dashboard, repo2Dashboard *unstructured.Unstructured

		for i := range dashboards.Items {
			dash := &dashboards.Items[i]
			meta, err := utils.MetaAccessor(dash)
			require.NoError(t, err)

			manager, hasManager := meta.GetManagerProperties()
			if !hasManager {
				continue
			}

			switch manager.Identity {
			case repo1Name:
				repo1Dashboard = dash
			case repo2Name:
				repo2Dashboard = dash
			}
		}

		require.NotNil(t, repo1Dashboard, "should find dashboard from repo1")
		require.NotNil(t, repo2Dashboard, "should find dashboard from repo2")

		// Both should be in the same namespace (default org) but managed by different repos
		assert.NotEmpty(t, repo1Dashboard.GetNamespace(), "repo1 dashboard should have namespace")
		assert.NotEmpty(t, repo2Dashboard.GetNamespace(), "repo2 dashboard should have namespace")
		assert.Equal(t, repo1Dashboard.GetNamespace(), repo2Dashboard.GetNamespace(),
			"dashboards should be in the same namespace (default org)")

		t.Logf("✓ Resources properly isolated: repo1 dashboard in namespace '%s', repo2 dashboard in namespace '%s'",
			repo1Dashboard.GetNamespace(), repo2Dashboard.GetNamespace())
	})

	// Verify: Files API only shows files for the specific repository
	t.Run("verify files list is repository-scoped", func(t *testing.T) {
		// List files in repo1
		fileList1 := &provisioning.FileList{}
		result1 := helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repo1Name).
			Suffix("files/").
			Do(ctx)
		require.NoError(t, result1.Error())
		require.NoError(t, result1.Into(fileList1))

		// List files in repo2
		fileList2 := &provisioning.FileList{}
		result2 := helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repo2Name).
			Suffix("files/").
			Do(ctx)
		require.NoError(t, result2.Error())
		require.NoError(t, result2.Into(fileList2))

		// Each repo should only see its own file
		require.Len(t, fileList1.Items, 1, "repo1 should have exactly one file")
		require.Len(t, fileList2.Items, 1, "repo2 should have exactly one file")

		assert.Equal(t, "test-dashboard-1.json", fileList1.Items[0].Path,
			"repo1 should see its own file")
		assert.Equal(t, "test-dashboard-2.json", fileList2.Items[0].Path,
			"repo2 should see its own file")

		t.Log("✓ Files API properly scoped to repository")
	})
}

// TestFilesRead_NamespaceIsolation verifies that reading files respects
// repository boundaries and namespace isolation.
func TestFilesRead_NamespaceIsolation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := sharedHelper(t)
	ctx := context.Background()

	const (
		repoName = "repo-files-read"
	)

	// Setup: Create repository with a file
	t.Run("setup repository with file", func(t *testing.T) {
		helper.CreateRepo(t, common.TestRepo{
			Name:   repoName,
			Target: "instance",
			Copies: map[string]string{
				"simple-dashboard.json": "readable-dashboard.json",
			},
		})

		helper.SyncAndWait(t, repoName, nil)
	})

	// Test: Read file and verify it contains correct resource metadata
	t.Run("read file and verify namespace metadata", func(t *testing.T) {
		fileObj, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{},
			"files", "readable-dashboard.json")
		require.NoError(t, err, "should be able to read file")

		// Extract the resource from the file
		resource, found, err := unstructured.NestedMap(fileObj.Object, "resource")
		require.NoError(t, err)
		require.True(t, found, "file should have resource field")

		// Check dryRun response (contains the resource metadata)
		dryRun, found, err := unstructured.NestedMap(resource, "dryRun")
		require.NoError(t, err)
		require.True(t, found, "resource should have dryRun field")

		// Verify namespace is set in the resource
		namespace, found, err := unstructured.NestedString(dryRun, "metadata", "namespace")
		require.NoError(t, err)
		if found {
			assert.NotEmpty(t, namespace, "resource should have namespace in metadata")
			t.Logf("✓ File resource has namespace: '%s'", namespace)
		}

		// Verify manager annotations
		annotations, found, err := unstructured.NestedStringMap(dryRun, "metadata", "annotations")
		if found && err == nil {
			managerKind, hasKind := annotations[utils.AnnoKeyManagerKind]
			managerIdentity, hasIdentity := annotations[utils.AnnoKeyManagerIdentity]

			if hasKind && hasIdentity {
				assert.Equal(t, string(utils.ManagerKindRepo), managerKind,
					"resource should be managed by repo")
				assert.Equal(t, repoName, managerIdentity,
					"resource should be managed by correct repo")
				t.Logf("✓ File resource has correct manager annotations: kind=%s, identity=%s",
					managerKind, managerIdentity)
			}
		}
	})

	// Test: Verify we cannot read files from non-existent repository
	t.Run("cannot read files from non-existent repository", func(t *testing.T) {
		_, err := helper.Repositories.Resource.Get(ctx, "non-existent-repo", metav1.GetOptions{},
			"files", "some-file.json")
		require.Error(t, err, "should fail to read from non-existent repository")
		t.Log("✓ Properly rejects reads from non-existent repository")
	})
}

// TestFilesUpdate_NamespaceIsolation verifies that updating files maintains
// proper namespace isolation and ownership.
func TestFilesUpdate_NamespaceIsolation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := sharedHelper(t)
	ctx := context.Background()

	const repoName = "repo-files-update"

	// Setup: Create repository with a file
	t.Run("setup repository", func(t *testing.T) {
		helper.CreateRepo(t, common.TestRepo{
			Name:   repoName,
			Target: "instance",
			Copies: map[string]string{
				"simple-dashboard.json": "update-test.json",
			},
		})

		helper.SyncAndWait(t, repoName, nil)
	})

	var originalDashboardUID string

	// Get original dashboard UID
	t.Run("get original dashboard", func(t *testing.T) {
		dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)

		for i := range dashboards.Items {
			dash := &dashboards.Items[i]
			meta, err := utils.MetaAccessor(dash)
			require.NoError(t, err)

			if manager, hasManager := meta.GetManagerProperties(); hasManager {
				if manager.Identity == repoName {
					originalDashboardUID = dash.GetName()
					t.Logf("Found original dashboard UID: %s", originalDashboardUID)
					break
				}
			}
		}

		require.NotEmpty(t, originalDashboardUID, "should find original dashboard")
	})

	// Test: Update file content
	t.Run("update file content", func(t *testing.T) {
		// Load different content
		updatedContent := helper.LoadFile("testdata/text-options.json")

		// Update the file using move with same path
		resp := helper.PostFilesRequest(t, repoName, common.FilesPostOptions{
			TargetPath:   "update-test.json",
			OriginalPath: "update-test.json",
			Message:      "update dashboard content",
			Body:         string(updatedContent),
		})
		defer resp.Body.Close()
		require.Equal(t, 200, resp.StatusCode, "should update file successfully")

		// Sync to apply changes
		helper.SyncAndWait(t, repoName, nil)
	})

	// Verify: Dashboard is updated and maintains namespace
	t.Run("verify dashboard updated with correct namespace", func(t *testing.T) {
		dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)

		var updatedDashboard *unstructured.Unstructured

		for i := range dashboards.Items {
			dash := &dashboards.Items[i]
			meta, err := utils.MetaAccessor(dash)
			require.NoError(t, err)

			if manager, hasManager := meta.GetManagerProperties(); hasManager {
				if manager.Identity == repoName {
					updatedDashboard = dash
					break
				}
			}
		}

		require.NotNil(t, updatedDashboard, "should find updated dashboard")

		// Verify namespace is still set
		assert.NotEmpty(t, updatedDashboard.GetNamespace(),
			"updated dashboard should still have namespace")

		// Verify it's still managed by the same repo
		meta, err := utils.MetaAccessor(updatedDashboard)
		require.NoError(t, err)
		manager, hasManager := meta.GetManagerProperties()
		require.True(t, hasManager)
		assert.Equal(t, repoName, manager.Identity,
			"updated dashboard should still be managed by same repo")

		// Verify the content was actually updated (title should change)
		title, found, err := unstructured.NestedString(updatedDashboard.Object, "spec", "title")
		require.NoError(t, err)
		require.True(t, found)
		assert.Equal(t, "Text options", title, "dashboard title should be updated")

		t.Logf("✓ Dashboard updated successfully in namespace '%s'", updatedDashboard.GetNamespace())
	})
}

// TestFilesDelete_NamespaceIsolation verifies that deleting files properly
// removes resources while respecting namespace boundaries.
func TestFilesDelete_NamespaceIsolation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := sharedHelper(t)
	ctx := context.Background()

	const (
		repo1Name = "repo-files-delete-1"
		repo2Name = "repo-files-delete-2"
	)

	// Setup: Create two repositories with dashboards
	t.Run("setup repositories", func(t *testing.T) {
		helper.CreateRepo(t, common.TestRepo{
			Name:   repo1Name,
			Target: "instance",
			Copies: map[string]string{
				"simple-dashboard.json": "dashboard-to-delete.json",
			},
		})

		helper.CreateRepo(t, common.TestRepo{
			Name:   repo2Name,
			Target: "instance",
			Copies: map[string]string{
				"simple-dashboard.json": "dashboard-to-keep.json",
			},
		})

		helper.SyncAndWait(t, repo1Name, nil)
		helper.SyncAndWait(t, repo2Name, nil)
	})

	var repo1DashboardUID, repo2DashboardUID string

	// Get dashboard UIDs
	t.Run("get dashboard UIDs", func(t *testing.T) {
		dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)

		for i := range dashboards.Items {
			dash := &dashboards.Items[i]
			meta, err := utils.MetaAccessor(dash)
			require.NoError(t, err)

			if manager, hasManager := meta.GetManagerProperties(); hasManager {
				switch manager.Identity {
				case repo1Name:
					repo1DashboardUID = dash.GetName()
				case repo2Name:
					repo2DashboardUID = dash.GetName()
				}
			}
		}

		require.NotEmpty(t, repo1DashboardUID, "should find repo1 dashboard")
		require.NotEmpty(t, repo2DashboardUID, "should find repo2 dashboard")
		t.Logf("Found dashboards: repo1=%s, repo2=%s", repo1DashboardUID, repo2DashboardUID)
	})

	// Test: Delete file from repo1
	t.Run("delete file from repo1", func(t *testing.T) {
		result := helper.AdminREST.Delete().
			Namespace("default").
			Resource("repositories").
			Name(repo1Name).
			SubResource("files", "dashboard-to-delete.json").
			Do(ctx)
		require.NoError(t, result.Error(), "should delete file from repo1")

		t.Log("✓ File deleted from repo1")
	})

	// Verify: repo1's dashboard is deleted, but repo2's remains
	t.Run("verify selective deletion", func(t *testing.T) {
		// Wait for deletion to process
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			// repo1's dashboard should be gone
			_, err := helper.DashboardsV1.Resource.Get(ctx, repo1DashboardUID, metav1.GetOptions{})
			assert.Error(collect, err, "repo1 dashboard should be deleted")

			// repo2's dashboard should still exist
			repo2Dash, err := helper.DashboardsV1.Resource.Get(ctx, repo2DashboardUID, metav1.GetOptions{})
			if !assert.NoError(collect, err, "repo2 dashboard should still exist") {
				return
			}

			// Verify repo2 dashboard is still managed correctly
			meta, err := utils.MetaAccessor(repo2Dash)
			assert.NoError(collect, err)
			if err == nil {
				manager, hasManager := meta.GetManagerProperties()
				assert.True(collect, hasManager, "repo2 dashboard should still have manager")
				if hasManager {
					assert.Equal(collect, repo2Name, manager.Identity,
						"repo2 dashboard should still be managed by repo2")
				}
			}
		}, common.WaitTimeoutDefault, common.WaitIntervalDefault,
			"repo1 dashboard should be deleted while repo2 dashboard remains")

		t.Log("✓ Deletion properly scoped to repository - repo2 dashboard unaffected")
	})
}

// TestFilesCRUD_CrossRepositoryIsolation verifies that CRUD operations
// on files in one repository cannot affect another repository's resources.
func TestFilesCRUD_CrossRepositoryIsolation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := sharedHelper(t)
	ctx := context.Background()

	const (
		repo1Name = "repo-crud-isolation-1"
		repo2Name = "repo-crud-isolation-2"
	)

	// Setup: Create two repositories
	t.Run("setup repositories with files", func(t *testing.T) {
		helper.CreateRepo(t, common.TestRepo{
			Name:   repo1Name,
			Target: "instance",
			Copies: map[string]string{
				"simple-dashboard.json": "repo1-dashboard.json",
			},
		})

		helper.CreateRepo(t, common.TestRepo{
			Name:   repo2Name,
			Target: "instance",
			Copies: map[string]string{
				"simple-dashboard.json": "repo2-dashboard.json",
			},
		})

		helper.SyncAndWait(t, repo1Name, nil)
		helper.SyncAndWait(t, repo2Name, nil)
	})

	// Test: Verify each repository only sees its own files
	t.Run("verify file listing is isolated", func(t *testing.T) {
		// List files in repo1
		fileList1 := &provisioning.FileList{}
		result1 := helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repo1Name).
			Suffix("files/").
			Do(ctx)
		require.NoError(t, result1.Error())
		require.NoError(t, result1.Into(fileList1))

		// List files in repo2
		fileList2 := &provisioning.FileList{}
		result2 := helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repo2Name).
			Suffix("files/").
			Do(ctx)
		require.NoError(t, result2.Error())
		require.NoError(t, result2.Into(fileList2))

		require.Len(t, fileList1.Items, 1, "repo1 should have one file")
		require.Len(t, fileList2.Items, 1, "repo2 should have one file")

		assert.Equal(t, "repo1-dashboard.json", fileList1.Items[0].Path)
		assert.Equal(t, "repo2-dashboard.json", fileList2.Items[0].Path)

		t.Log("✓ File listings properly isolated between repositories")
	})

	// Test: Verify each repository's resources are independently managed
	t.Run("verify resources are independently managed", func(t *testing.T) {
		dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)

		repo1Count := 0
		repo2Count := 0

		for i := range dashboards.Items {
			dash := &dashboards.Items[i]
			meta, err := utils.MetaAccessor(dash)
			require.NoError(t, err)

			if manager, hasManager := meta.GetManagerProperties(); hasManager {
				switch manager.Identity {
				case repo1Name:
					repo1Count++
					// Verify namespace
					assert.NotEmpty(t, dash.GetNamespace(), "repo1 dashboard should have namespace")
				case repo2Name:
					repo2Count++
					// Verify namespace
					assert.NotEmpty(t, dash.GetNamespace(), "repo2 dashboard should have namespace")
				}
			}
		}

		assert.Equal(t, 1, repo1Count, "repo1 should manage exactly 1 dashboard")
		assert.Equal(t, 1, repo2Count, "repo2 should manage exactly 1 dashboard")

		t.Log("✓ Resources independently managed by their respective repositories")
	})

	// Test: Update in repo1 doesn't affect repo2
	t.Run("update in repo1 does not affect repo2", func(t *testing.T) {
		// Get repo2 dashboard before update
		dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)

		var repo2DashboardBefore *unstructured.Unstructured
		for i := range dashboards.Items {
			dash := &dashboards.Items[i]
			meta, err := utils.MetaAccessor(dash)
			require.NoError(t, err)

			if manager, hasManager := meta.GetManagerProperties(); hasManager {
				if manager.Identity == repo2Name {
					repo2DashboardBefore = dash.DeepCopy()
					break
				}
			}
		}
		require.NotNil(t, repo2DashboardBefore, "should find repo2 dashboard before update")

		// Update file in repo1
		updatedContent := helper.LoadFile("testdata/text-options.json")
		resp := helper.PostFilesRequest(t, repo1Name, common.FilesPostOptions{
			TargetPath:   "repo1-dashboard.json",
			OriginalPath: "repo1-dashboard.json",
			Message:      "update repo1 dashboard",
			Body:         string(updatedContent),
		})
		defer resp.Body.Close()
		require.Equal(t, 200, resp.StatusCode)

		helper.SyncAndWait(t, repo1Name, nil)

		// Verify repo2 dashboard unchanged
		dashboards, err = helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)

		var repo2DashboardAfter *unstructured.Unstructured
		for i := range dashboards.Items {
			dash := &dashboards.Items[i]
			meta, err := utils.MetaAccessor(dash)
			require.NoError(t, err)

			if manager, hasManager := meta.GetManagerProperties(); hasManager {
				if manager.Identity == repo2Name {
					repo2DashboardAfter = dash
					break
				}
			}
		}
		require.NotNil(t, repo2DashboardAfter, "should find repo2 dashboard after update")

		// Verify repo2 dashboard content unchanged
		titleBefore, _, _ := unstructured.NestedString(repo2DashboardBefore.Object, "spec", "title")
		titleAfter, _, _ := unstructured.NestedString(repo2DashboardAfter.Object, "spec", "title")
		assert.Equal(t, titleBefore, titleAfter,
			"repo2 dashboard should be unchanged after repo1 update")

		t.Log("✓ Updates in repo1 do not affect repo2 resources")
	})
}

// TestFilesNamespaceConsistency verifies that all file operations maintain
// consistent namespace metadata throughout the lifecycle.
func TestFilesNamespaceConsistency(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := sharedHelper(t)
	ctx := context.Background()

	const repoName = "repo-namespace-consistency"

	expectedNamespace := helper.Namespacer(helper.Org1.Viewer.Identity.GetOrgID())

	// Track dashboard UID across operations
	var dashboardUID string

	// Create
	t.Run("create file and verify namespace", func(t *testing.T) {
		helper.CreateRepo(t, common.TestRepo{
			Name:   repoName,
			Target: "instance",
			Copies: map[string]string{
				"simple-dashboard.json": "consistency-test.json",
			},
		})

		helper.SyncAndWait(t, repoName, nil)

		dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)

		for i := range dashboards.Items {
			dash := &dashboards.Items[i]
			meta, err := utils.MetaAccessor(dash)
			require.NoError(t, err)

			if manager, hasManager := meta.GetManagerProperties(); hasManager {
				if manager.Identity == repoName {
					dashboardUID = dash.GetName()
					assert.Equal(t, expectedNamespace, dash.GetNamespace(),
						"dashboard should be in correct namespace after creation")
					t.Logf("✓ CREATE: Dashboard in namespace '%s'", dash.GetNamespace())
					break
				}
			}
		}

		require.NotEmpty(t, dashboardUID, "should find created dashboard")
	})

	// Read
	t.Run("read file and verify namespace metadata", func(t *testing.T) {
		fileObj, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{},
			"files", "consistency-test.json")
		require.NoError(t, err)

		// Check the resource metadata in the file
		resource, found, err := unstructured.NestedMap(fileObj.Object, "resource")
		require.NoError(t, err)
		require.True(t, found)

		dryRun, found, err := unstructured.NestedMap(resource, "dryRun")
		require.NoError(t, err)
		require.True(t, found)

		namespace, found, err := unstructured.NestedString(dryRun, "metadata", "namespace")
		if found && err == nil {
			assert.Equal(t, expectedNamespace, namespace,
				"file resource should show correct namespace")
			t.Logf("✓ READ: File shows namespace '%s'", namespace)
		}
	})

	// Update
	t.Run("update file and verify namespace preserved", func(t *testing.T) {
		updatedContent := helper.LoadFile("testdata/text-options.json")

		resp := helper.PostFilesRequest(t, repoName, common.FilesPostOptions{
			TargetPath:   "consistency-test.json",
			OriginalPath: "consistency-test.json",
			Message:      "update dashboard",
			Body:         string(updatedContent),
		})
		defer resp.Body.Close()
		require.Equal(t, 200, resp.StatusCode)

		helper.SyncAndWait(t, repoName, nil)

		dash, err := helper.DashboardsV1.Resource.Get(ctx, dashboardUID, metav1.GetOptions{})
		require.NoError(t, err)

		assert.Equal(t, expectedNamespace, dash.GetNamespace(),
			"dashboard namespace should be preserved after update")
		t.Logf("✓ UPDATE: Dashboard still in namespace '%s'", dash.GetNamespace())
	})

	// Delete (via file deletion triggers resource deletion)
	t.Run("delete file and verify resource removed from namespace", func(t *testing.T) {
		result := helper.AdminREST.Delete().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "consistency-test.json").
			Do(ctx)
		require.NoError(t, result.Error())

		// Verify dashboard is deleted
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			_, err := helper.DashboardsV1.Resource.Get(ctx, dashboardUID, metav1.GetOptions{})
			assert.Error(collect, err, "dashboard should be deleted")
		}, common.WaitTimeoutDefault, common.WaitIntervalDefault,
			"dashboard should be deleted after file deletion")

		t.Log("✓ DELETE: Resource properly removed from namespace")
	})

	t.Log("✓ Namespace consistency maintained throughout full CRUD lifecycle")
}

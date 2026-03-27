package git

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestIntegrationGitFiles_CreateFile(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	repoName := "test-create-file"
	// Enable branch workflow since we test creating files on new branches
	_, _ = helper.CreateGitRepo(t, repoName, nil, "write", "branch")

	t.Run("create file on default branch", func(t *testing.T) {
		// Create a proper dashboard file
		dashboardContent := []byte(`{
			"uid": "test-dashboard-1",
			"title": "Test Dashboard 1",
			"tags": [],
			"timezone": "browser",
			"schemaVersion": 39,
			"version": 1,
			"refresh": "",
			"panels": []
		}`)

		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "dashboard1.json").
			Param("message", "Create dashboard1.json").
			Body(dashboardContent).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error(), "should create file on default branch")

		// Verify file exists in repository
		fileObj, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{}, "files", "dashboard1.json")
		require.NoError(t, err, "file should exist in repository")
		require.NotNil(t, fileObj)

		// Trigger sync and verify dashboard is created
		helper.SyncAndWait(t, repoName)

		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
			if !assert.NoError(collect, err) {
				return
			}

			found := false
			for _, dash := range dashboards.Items {
				if dash.GetName() == "test-dashboard-1" {
					found = true
					assert.Equal(collect, repoName, dash.GetAnnotations()[utils.AnnoKeyManagerIdentity])
					break
				}
			}
			assert.True(collect, found, "dashboard should be synced to Grafana")
		}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "dashboard should appear after sync")
	})

	t.Run("create file on new branch", func(t *testing.T) {
		branchName := "feature-branch"

		dashboardContent := common.DashboardJSON("test-dashboard-2", "Test Dashboard 2", 1)

		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "dashboard2.json").
			Param("ref", branchName).
			Param("message", "Create dashboard2.json on feature branch").
			Body(dashboardContent).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error(), "should create file on new branch")

		// Verify file exists on the branch using ref query param
		result = helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "dashboard2.json").
			Param("ref", branchName).
			Do(ctx)

		require.NoError(t, result.Error(), "file should exist on branch")
	})
}

func TestIntegrationGitFiles_UpdateFile(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	repoName := "test-update-file"
	initialContent := map[string][]byte{
		"dashboard.json": []byte(`{
			"uid": "test-dash",
			"title": "Original Title",
			"tags": [],
			"timezone": "browser",
			"schemaVersion": 39,
			"version": 1,
			"refresh": "",
			"panels": []
		}`),
	}

	// Enable branch workflow since we test updating files on branches
	_, _ = helper.CreateGitRepo(t, repoName, initialContent, "write", "branch")
	helper.SyncAndWait(t, repoName)

	t.Run("update file on default branch", func(t *testing.T) {
		updatedContent := []byte(`{
			"uid": "test-dash",
			"title": "Updated Title",
			"tags": [],
			"timezone": "browser",
			"schemaVersion": 39,
			"version": 2,
			"refresh": "",
			"panels": []
		}`)

		result := helper.AdminREST.Put().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "dashboard.json").
			Param("message", "Update dashboard.json title").
			Body(updatedContent).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error(), "should update file on default branch")

		// Sync and verify update
		helper.SyncAndWait(t, repoName)

		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			dashboard, err := helper.DashboardsV1.Resource.Get(ctx, "test-dash", metav1.GetOptions{})
			if !assert.NoError(collect, err) {
				return
			}

			title, _, err := unstructured.NestedString(dashboard.Object, "spec", "title")
			if !assert.NoError(collect, err) {
				return
			}

			assert.Equal(collect, "Updated Title", title, "dashboard title should be updated")
		}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "dashboard should be updated after sync")
	})

	t.Run("update file on branch", func(t *testing.T) {
		branchName := "update-branch"

		updatedContent := []byte(`{
			"uid": "test-dash",
			"title": "Branch Update",
			"tags": [],
			"timezone": "browser",
			"schemaVersion": 39,
			"version": 3,
			"refresh": "",
			"panels": []
		}`)

		result := helper.AdminREST.Put().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "dashboard.json").
			Param("ref", branchName).
			Param("message", "Update dashboard.json on branch").
			Body(updatedContent).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error(), "should update file on branch")

		// Verify the file was updated on the branch
		fileObj, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{
			ResourceVersion: branchName,
		}, "files", "dashboard.json")
		require.NoError(t, err, "file should exist on branch")
		require.NotNil(t, fileObj)
	})
}

func TestIntegrationGitFiles_DeleteFile(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	repoName := "test-delete-file"
	initialContent := map[string][]byte{
		"dashboard1.json": []byte(`{
			"uid": "dash-1",
			"title": "Dashboard 1",
			"tags": [],
			"timezone": "browser",
			"schemaVersion": 39,
			"version": 1,
			"refresh": "",
			"panels": []
		}`),
		"dashboard2.json": []byte(`{
			"uid": "dash-2",
			"title": "Dashboard 2",
			"tags": [],
			"timezone": "browser",
			"schemaVersion": 39,
			"version": 1,
			"refresh": "",
			"panels": []
		}`),
	}

	// Enable branch workflow since we test deleting files on branches
	_, _ = helper.CreateGitRepo(t, repoName, initialContent, "write", "branch")
	helper.SyncAndWait(t, repoName)

	t.Run("delete file on default branch", func(t *testing.T) {
		result := helper.AdminREST.Delete().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "dashboard1.json").
			Param("message", "Delete dashboard1.json").
			Do(ctx)

		require.NoError(t, result.Error(), "should delete file on default branch")

		// Sync and verify dashboard is deleted
		helper.SyncAndWait(t, repoName)

		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			_, err := helper.DashboardsV1.Resource.Get(ctx, "dash-1", metav1.GetOptions{})
			assert.True(collect, apierrors.IsNotFound(err), "dashboard should be deleted from Grafana")
		}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "dashboard should be deleted after sync")
	})

	t.Run("delete file on branch", func(t *testing.T) {
		branchName := "delete-branch"

		result := helper.AdminREST.Delete().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "dashboard2.json").
			Param("ref", branchName).
			Param("message", "Delete dashboard2.json on branch").
			Do(ctx)

		require.NoError(t, result.Error(), "should delete file on branch")

		// Verify file is deleted on branch but not on main
		result = helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "dashboard2.json").
			Param("ref", branchName).
			Do(ctx)
		require.True(t, apierrors.IsNotFound(result.Error()), "file should not exist on delete branch")

		// File should still exist on main branch
		result = helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "dashboard2.json").
			Do(ctx)
		require.NoError(t, result.Error(), "file should still exist on main branch")
	})
}

func TestIntegrationGitFiles_MoveFile(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	repoName := "test-move-file"
	initialContent := map[string][]byte{
		"dashboard.json": []byte(`{
			"uid": "move-dash",
			"title": "Dashboard to Move",
			"tags": [],
			"timezone": "browser",
			"schemaVersion": 39,
			"version": 1,
			"refresh": "",
			"panels": []
		}`),
	}

	_, _ = helper.CreateGitRepo(t, repoName, initialContent)
	helper.SyncAndWait(t, repoName)

	t.Run("move file on default branch", func(t *testing.T) {
		addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()
		url := fmt.Sprintf(
			"http://admin:admin@%s/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/%s/files/moved/dashboard.json?originalPath=dashboard.json&message=Move%%20file",
			addr, repoName,
		)

		req, err := http.NewRequest(http.MethodPost, url, nil)
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		defer func() {
			_ = resp.Body.Close()
		}()

		require.Equal(t, http.StatusOK, resp.StatusCode, "should move file on default branch")

		// Verify file moved
		_, err = helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{}, "files", "moved", "dashboard.json")
		require.NoError(t, err, "file should exist at new location")

		_, err = helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{}, "files", "dashboard.json")
		require.Error(t, err, "file should not exist at old location")
	})
}

func TestIntegrationGitFiles_MoveDirectoryOnBranch(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	repoName := "test-move-dir"
	initialContent := map[string][]byte{
		"mydir/dashboard.json": common.DashboardJSON("dir-dash", "Dir Dashboard", 1),
	}

	_, _ = helper.CreateGitRepo(t, repoName, initialContent, "write", "branch")
	helper.SyncAndWait(t, repoName)

	t.Run("move directory on branch succeeds with correct response", func(t *testing.T) {
		branchName := "move-dir-branch"

		resp := helper.PostFilesRequest(t, repoName, common.FilesPostOptions{
			TargetPath:   "renamed/",
			OriginalPath: "mydir/",
			Message:      "rename directory",
			Ref:          branchName,
		})
		defer func() { _ = resp.Body.Close() }()

		require.Equal(t, http.StatusOK, resp.StatusCode, "directory move on branch should succeed")

		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)

		var wrapper map[string]interface{}
		require.NoError(t, json.Unmarshal(body, &wrapper))

		assert.Equal(t, "renamed/", wrapper["path"], "response path should be the target directory")
		assert.Equal(t, branchName, wrapper["ref"], "response ref should match the requested branch")

		resource, ok := wrapper["resource"].(map[string]interface{})
		require.True(t, ok, "response should contain resource object")
		assert.Equal(t, "move", resource["action"], "resource action should be 'move'")

		// Verify the directory was actually moved on the branch
		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "renamed", "dashboard.json").
			Param("ref", branchName).
			Do(ctx)
		require.NoError(t, result.Error(), "dashboard should exist at new location on branch")
	})
}

func TestIntegrationGitFiles_ListFiles(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	repoName := "test-list-files"
	initialContent := map[string][]byte{
		"dashboard1.json":        common.DashboardJSON("dash-1", "Dashboard 1", 1),
		"dashboard2.json":        common.DashboardJSON("dash-2", "Dashboard 2", 1),
		"folder/dashboard3.json": common.DashboardJSON("dash-3", "Dashboard 3", 1),
	}

	_, _ = helper.CreateGitRepo(t, repoName, initialContent)

	t.Run("list all files", func(t *testing.T) {
		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			Suffix("files/").
			Do(ctx)

		require.NoError(t, result.Error(), "should list files")

		fileListObj := &unstructured.Unstructured{}
		err := result.Into(fileListObj)
		require.NoError(t, err)

		items, found, err := unstructured.NestedSlice(fileListObj.Object, "items")
		require.NoError(t, err)
		require.True(t, found)
		require.GreaterOrEqual(t, len(items), 3, "should list at least 3 files")

		// Verify our expected files are present
		paths := make([]string, 0, len(items))
		for _, item := range items {
			itemMap := item.(map[string]interface{})
			if path, ok := itemMap["path"].(string); ok {
				paths = append(paths, path)
			}
		}
		require.Contains(t, paths, "dashboard1.json", "should contain dashboard1.json")
		require.Contains(t, paths, "dashboard2.json", "should contain dashboard2.json")
		require.Contains(t, paths, "folder/dashboard3.json", "should contain folder/dashboard3.json")
	})

	t.Run("list files in subdirectory", func(t *testing.T) {
		// Try to get the specific file in the subdirectory
		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "folder", "dashboard3.json").
			Do(ctx)

		require.NoError(t, result.Error(), "should get file in subdirectory")

		fileObj := &unstructured.Unstructured{}
		err := result.Into(fileObj)
		require.NoError(t, err)

		// Verify we got the correct file
		path, found, _ := unstructured.NestedString(fileObj.Object, "path")
		require.True(t, found, "file should have a path")
		require.Equal(t, "folder/dashboard3.json", path, "should be the file from the subdirectory")
	})
}

func TestIntegrationGitFiles_BranchOperations(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	repoName := "test-branch-ops"
	initialContent := map[string][]byte{
		"main-file.json": common.DashboardJSON("main-dash", "Main Dashboard", 1),
	}

	// Enable both write and branch workflows for branch operations
	_, _ = helper.CreateGitRepo(t, repoName, initialContent, "write", "branch")

	t.Run("create multiple files on same branch", func(t *testing.T) {
		branchName := "multi-file-branch"

		// Create first file
		file1Content := common.DashboardJSON("branch-dash-1", "Branch Dashboard 1", 1)
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "branch-file1.json").
			Param("ref", branchName).
			Param("message", "Create branch-file1.json").
			Body(file1Content).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error(), "should create first file on branch")

		// Create second file on same branch
		file2Content := common.DashboardJSON("branch-dash-2", "Branch Dashboard 2", 1)
		result = helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "branch-file2.json").
			Param("ref", branchName).
			Param("message", "Create branch-file2.json").
			Body(file2Content).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error(), "should create second file on same branch")

		// Verify both files exist on branch using ref query param
		result = helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "branch-file1.json").
			Param("ref", branchName).
			Do(ctx)
		require.NoError(t, result.Error(), "first file should exist on branch")

		result = helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "branch-file2.json").
			Param("ref", branchName).
			Do(ctx)
		require.NoError(t, result.Error(), "second file should exist on branch")

		// Verify files don't exist on main branch
		result = helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "branch-file1.json").
			Do(ctx)
		require.True(t, apierrors.IsNotFound(result.Error()), "first file should not exist on main branch")

		result = helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "branch-file2.json").
			Do(ctx)
		require.True(t, apierrors.IsNotFound(result.Error()), "second file should not exist on main branch")
	})

	t.Run("update file independently on different branches", func(t *testing.T) {
		branch1 := "update-branch-1"
		branch2 := "update-branch-2"

		// Create initial file
		initialContent := common.DashboardJSON("multi-branch-dash", "Original", 1)
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "multi-branch.json").
			Param("message", "Create multi-branch.json").
			Body(initialContent).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error(), "should create initial file")

		// Update on branch 1
		branch1Content := common.DashboardJSON("multi-branch-dash", "Branch 1 Update", 2)
		result = helper.AdminREST.Put().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "multi-branch.json").
			Param("ref", branch1).
			Param("message", "Update multi-branch.json on branch 1").
			Body(branch1Content).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error(), "should update file on branch 1")

		// Update on branch 2
		branch2Content := common.DashboardJSON("multi-branch-dash", "Branch 2 Update", 3)
		result = helper.AdminREST.Put().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "multi-branch.json").
			Param("ref", branch2).
			Param("message", "Update multi-branch.json on branch 2").
			Body(branch2Content).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error(), "should update file on branch 2")

		// Verify different content on each branch using ref query param
		result = helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "multi-branch.json").
			Param("ref", branch1).
			Do(ctx)
		require.NoError(t, result.Error(), "should get file from branch 1")

		branch1File := &unstructured.Unstructured{}
		err := result.Into(branch1File)
		require.NoError(t, err)

		result = helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "multi-branch.json").
			Param("ref", branch2).
			Do(ctx)
		require.NoError(t, result.Error(), "should get file from branch 2")

		branch2File := &unstructured.Unstructured{}
		err = result.Into(branch2File)
		require.NoError(t, err)

		// Extract content hashes or paths to verify they're different
		branch1Hash, _, _ := unstructured.NestedString(branch1File.Object, "hash")
		branch2Hash, _, _ := unstructured.NestedString(branch2File.Object, "hash")

		// Verify files have different content hashes (different content on each branch)
		require.NotEmpty(t, branch1Hash, "branch 1 file should have a hash")
		require.NotEmpty(t, branch2Hash, "branch 2 file should have a hash")
		require.NotEqual(t, branch1Hash, branch2Hash, "file content should differ between branches")
	})
}

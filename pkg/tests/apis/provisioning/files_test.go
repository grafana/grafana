package provisioning

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestIntegrationProvisioning_DeleteResources(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()

	const repo = "delete-test-repo"
	helper.CreateRepo(t, TestRepo{
		Name:   repo,
		Path:   helper.ProvisioningPath,
		Target: "instance",
		Copies: map[string]string{
			"testdata/all-panels.json":    "dashboard1.json",
			"testdata/text-options.json":  "folder/dashboard2.json",
			"testdata/timeline-demo.json": "folder/nested/dashboard3.json",
			"testdata/.keep":              "folder/nested/.keep",
		},
		ExpectedDashboards: 3,
		ExpectedFolders:    2,
	})

	dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err)
	require.Equal(t, 3, len(dashboards.Items))

	helper.validateManagedDashboardsFolderMetadata(t, ctx, repo, dashboards.Items)

	folders, err := helper.Folders.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err)
	require.Equal(t, 2, len(folders.Items))

	t.Run("delete individual dashboard file, should delete from repo and grafana", func(t *testing.T) {
		result := helper.AdminREST.Delete().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "dashboard1.json").
			Do(ctx)
		require.NoError(t, result.Error())
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "dashboard1.json")
		require.Error(t, err)
		dashboards, err = helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Equal(t, 2, len(dashboards.Items))
	})

	t.Run("delete folder, should delete from repo and grafana all nested resources too", func(t *testing.T) {
		// need to delete directly through the url, because the k8s client doesn't support `/` in a subresource
		// but that is needed by gitsync to know that it is a folder
		addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()
		url := fmt.Sprintf("http://admin:admin@%s/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/%s/files/folder/", addr, repo)
		req, err := http.NewRequest(http.MethodDelete, url, nil)
		require.NoError(t, err)
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		// nolint:errcheck
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		// should be deleted from the repo
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "folder")
		require.Error(t, err)
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "folder", "dashboard2.json")
		require.Error(t, err)
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "folder", "nested")
		require.Error(t, err)
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "folder", "nested", "dashboard3.json")
		require.Error(t, err)

		// all should be deleted from grafana
		for _, d := range dashboards.Items {
			_, err = helper.DashboardsV1.Resource.Get(ctx, d.GetName(), metav1.GetOptions{})
			require.Error(t, err)
		}
		for _, f := range folders.Items {
			_, err = helper.Folders.Resource.Get(ctx, f.GetName(), metav1.GetOptions{})
			require.Error(t, err)
		}
	})

	t.Run("deleting a non-existent file should fail", func(t *testing.T) {
		result := helper.AdminREST.Delete().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "non-existent.json").
			Do(ctx)
		require.Error(t, result.Error())
	})
}

func TestIntegrationProvisioning_MoveResources(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()
	repo := "move-test-repo"
	helper.CreateRepo(t, TestRepo{
		Name:   repo,
		Path:   helper.ProvisioningPath,
		Target: "instance",
		Copies: map[string]string{
			"testdata/all-panels.json": "all-panels.json",
		},
		ExpectedDashboards: 1,
		ExpectedFolders:    0,
	})

	// Validate the dashboard metadata
	dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err)
	require.Equal(t, 1, len(dashboards.Items))

	helper.validateManagedDashboardsFolderMetadata(t, ctx, repo, dashboards.Items)

	// Verify the original dashboard exists in Grafana (using the UID from all-panels.json)
	const allPanelsUID = "n1jR8vnnz" // This is the UID from the all-panels.json file
	obj, err := helper.DashboardsV1.Resource.Get(ctx, allPanelsUID, metav1.GetOptions{})
	require.NoError(t, err, "original dashboard should exist in Grafana")
	require.Equal(t, repo, obj.GetAnnotations()[utils.AnnoKeyManagerIdentity])

	t.Run("move file without content change", func(t *testing.T) {
		const targetPath = "moved/simple-move.json"

		// Perform the move operation using helper function
		resp := helper.postFilesRequest(t, repo, filesPostOptions{
			targetPath:   targetPath,
			originalPath: "all-panels.json",
			message:      "move file without content change",
		})
		// nolint:errcheck
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode, "move operation should succeed")

		// Verify the file moved in the repository
		movedObj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "moved", "simple-move.json")
		require.NoError(t, err, "moved file should exist in repository")

		// Check the content is preserved (verify it's still the all-panels dashboard)
		resource, _, err := unstructured.NestedMap(movedObj.Object, "resource")
		require.NoError(t, err)
		dryRun, _, err := unstructured.NestedMap(resource, "dryRun")
		require.NoError(t, err)
		title, _, err := unstructured.NestedString(dryRun, "spec", "title")
		require.NoError(t, err)
		require.Equal(t, "Panel tests - All panels", title, "content should be preserved")

		// Verify original file no longer exists
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "all-panels.json")
		require.Error(t, err, "original file should no longer exist")

		// Verify dashboard still exists in Grafana with same content but may have updated path references
		helper.SyncAndWait(t, repo, nil)
		_, err = helper.DashboardsV1.Resource.Get(ctx, allPanelsUID, metav1.GetOptions{})
		require.NoError(t, err, "dashboard should still exist in Grafana after move")
	})

	t.Run("move file to nested path without ref", func(t *testing.T) {
		// Test a different scenario: Move a file that was never synced to Grafana
		// This might reveal the issue if dashboard creation fails during move
		const sourceFile = "never-synced.json"
		helper.CopyToProvisioningPath(t, "testdata/timeline-demo.json", sourceFile)

		// DO NOT sync - move the file immediately without it ever being in Grafana
		const targetPath = "deep/nested/timeline.json"

		// Perform the move operation without the file ever being synced to Grafana
		resp := helper.postFilesRequest(t, repo, filesPostOptions{
			targetPath:   targetPath,
			originalPath: sourceFile,
			message:      "move never-synced file to nested path",
		})
		// nolint:errcheck
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode, "move operation should succeed")

		// Check folders were created and validate hierarchy
		folderList, err := helper.Folders.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err, "should be able to list folders")

		// Build a map of folder names to their objects for easier lookup
		folders := make(map[string]*unstructured.Unstructured)
		for _, folder := range folderList.Items {
			title, _, _ := unstructured.NestedString(folder.Object, "spec", "title")
			folders[title] = &folder
			parent, _, _ := unstructured.NestedString(folder.Object, "metadata", "annotations", "grafana.app/folder")
			t.Logf("  - %s: %s (parent: %s)", folder.GetName(), title, parent)
		}

		// Validate expected folders exist with proper hierarchy
		// Expected structure: deep -> deep/nested
		deepFolderTitle := "deep"
		nestedFolderTitle := "nested"

		// Validate "deep" folder exists and has no parent (is top-level)
		require.Contains(t, folders, deepFolderTitle, "deep folder should exist")
		f := folders[deepFolderTitle]
		deepFolderName := f.GetName()
		title, _, _ := unstructured.NestedString(f.Object, "spec", "title")
		require.Equal(t, deepFolderTitle, title, "deep folder should have correct title")
		parent, found, _ := unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/folder")
		require.True(t, !found || parent == "", "deep folder should be top-level (no parent)")

		// Validate "deep/nested" folder exists and has "deep" as parent
		require.Contains(t, folders, nestedFolderTitle, "nested folder should exist")
		f = folders[nestedFolderTitle]
		nestedFolderName := f.GetName()
		title, _, _ = unstructured.NestedString(f.Object, "spec", "title")
		require.Equal(t, nestedFolderTitle, title, "nested folder should have correct title")
		parent, _, _ = unstructured.NestedString(f.Object, "metadata", "annotations", "grafana.app/folder")
		require.Equal(t, deepFolderName, parent, "nested folder should have deep folder as parent")

		// The key test: Check if dashboard was created in Grafana during move
		const timelineUID = "mIJjFy8Kz"
		dashboard, err := helper.DashboardsV1.Resource.Get(ctx, timelineUID, metav1.GetOptions{})
		require.NoError(t, err, "dashboard should exist in Grafana after moving never-synced file")
		dashboardFolder, _, _ := unstructured.NestedString(dashboard.Object, "metadata", "annotations", "grafana.app/folder")

		// Validate dashboard is in the correct nested folder
		require.Equal(t, nestedFolderName, dashboardFolder, "dashboard should be in the nested folder")

		// Verify the file moved in the repository
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "deep", "nested", "timeline.json")
		require.NoError(t, err, "moved file should exist in nested repository path")

		// Verify the original file no longer exists in the repository
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", sourceFile)
		require.Error(t, err, "original file should no longer exist in repository")
	})

	t.Run("move file with content update", func(t *testing.T) {
		const sourcePath = "moved/simple-move.json" // Use the file from previous test
		const targetPath = "updated/content-updated.json"

		// Use text-options.json content for the update
		updatedContent := helper.LoadFile("testdata/text-options.json")

		// Perform move with content update using helper function
		resp := helper.postFilesRequest(t, repo, filesPostOptions{
			targetPath:   targetPath,
			originalPath: sourcePath,
			message:      "move file with content update",
			body:         string(updatedContent),
		})
		// nolint:errcheck
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode, "move with content update should succeed")

		// Verify the moved file has updated content (should now be text-options dashboard)
		movedObj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "updated", "content-updated.json")
		require.NoError(t, err, "moved file should exist in repository")

		resource, _, err := unstructured.NestedMap(movedObj.Object, "resource")
		require.NoError(t, err)
		dryRun, _, err := unstructured.NestedMap(resource, "dryRun")
		require.NoError(t, err)
		title, _, err := unstructured.NestedString(dryRun, "spec", "title")
		require.NoError(t, err)
		require.Equal(t, "Text options", title, "content should be updated to text-options dashboard")

		// Check it has the expected UID from text-options.json
		name, _, err := unstructured.NestedString(dryRun, "metadata", "name")
		require.NoError(t, err)
		require.Equal(t, "WZ7AhQiVz", name, "should have the UID from text-options.json")

		// Verify source file no longer exists
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "moved", "simple-move.json")
		require.Error(t, err, "source file should no longer exist")

		// Sync and verify the updated dashboard exists in Grafana
		helper.SyncAndWait(t, repo, nil)
		const textOptionsUID = "WZ7AhQiVz" // UID from text-options.json
		updatedDashboard, err := helper.DashboardsV1.Resource.Get(ctx, textOptionsUID, metav1.GetOptions{})
		require.NoError(t, err, "updated dashboard should exist in Grafana")

		// Verify the original dashboard was deleted from Grafana
		_, err = helper.DashboardsV1.Resource.Get(ctx, allPanelsUID, metav1.GetOptions{})
		require.Error(t, err, "original dashboard should be deleted from Grafana")
		require.True(t, apierrors.IsNotFound(err))

		// Verify the new dashboard has the updated content
		updatedTitle, _, err := unstructured.NestedString(updatedDashboard.Object, "spec", "title")
		require.NoError(t, err)
		require.Equal(t, "Text options", updatedTitle)
	})

	t.Run("move directory", func(t *testing.T) {
		// Create some files in a directory first using existing testdata files
		helper.CopyToProvisioningPath(t, "testdata/timeline-demo.json", "source-dir/timeline-demo.json")
		helper.CopyToProvisioningPath(t, "testdata/text-options.json", "source-dir/text-options.json")

		// Sync to ensure files are recognized
		helper.SyncAndWait(t, repo, nil)

		const sourceDir = "source-dir/"
		const targetDir = "moved-dir/"

		// Move directory using helper function
		resp := helper.postFilesRequest(t, repo, filesPostOptions{
			targetPath:   targetDir,
			originalPath: sourceDir,
			message:      "move directory",
		})
		// nolint:errcheck
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode, "directory move should succeed")

		// Verify source directory no longer exists
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "source-dir")
		require.Error(t, err, "source directory should no longer exist")

		// Verify target directory and files exist
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "moved-dir", "timeline-demo.json")
		require.NoError(t, err, "moved timeline-demo.json should exist")
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "moved-dir", "text-options.json")
		require.NoError(t, err, "moved text-options.json should exist")
	})

	t.Run("error cases", func(t *testing.T) {
		t.Run("missing originalPath parameter", func(t *testing.T) {
			result := helper.AdminREST.Post().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("files", "target.json").
				Body([]byte(`{"test": "content"}`)).
				SetHeader("Content-Type", "application/json").
				Do(ctx)
			require.Error(t, result.Error(), "should fail without originalPath")
		})

		t.Run("file to directory type mismatch", func(t *testing.T) {
			// First create a simple test file without slashes in the path
			result := helper.AdminREST.Post().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("files", "simple-test.json").
				Body(helper.LoadFile("testdata/all-panels.json")).
				SetHeader("Content-Type", "application/json").
				Do(ctx)
			require.NoError(t, result.Error(), "should create test file")

			// Now try to move this file to a directory path using helper function
			resp := helper.postFilesRequest(t, repo, filesPostOptions{
				targetPath:   "target-dir/",
				originalPath: "simple-test.json",
				message:      "test move",
			})
			// nolint:errcheck
			defer resp.Body.Close()
			// Read response body to check error message
			body, err := io.ReadAll(resp.Body)
			require.NoError(t, err)

			require.NotEqual(t, http.StatusOK, resp.StatusCode, "should fail when moving file to directory")
			require.Contains(t, string(body), "cannot move between file and directory types")
		})

		t.Run("non-existent source file", func(t *testing.T) {
			result := helper.AdminREST.Post().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("files", "target.json").
				Param("originalPath", "non-existent.json").
				Body([]byte("")).
				SetHeader("Content-Type", "application/json").
				Do(ctx)
			require.Error(t, result.Error(), "should fail when source file doesn't exist")
		})
	})
}

func TestIntegrationProvisioning_FilesOwnershipProtection(t *testing.T) {
	t.Skip("skipping integration test, flaky")
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()

	// Create first repository targeting "folder-1" with its own subdirectory
	const repo1 = "ownership-repo-1"
	helper.CreateRepo(t, TestRepo{
		Name:   repo1,
		Path:   path.Join(helper.ProvisioningPath, "repo1"),
		Target: "folder",
		Copies: map[string]string{
			"testdata/all-panels.json": "dashboard1.json",
		},
		ExpectedDashboards: 1,
		ExpectedFolders:    1,
	})

	// Create second repository targeting "folder-2" with its own subdirectory
	const repo2 = "ownership-repo-2"
	path2 := path.Join(helper.ProvisioningPath, "repo2")
	helper.CreateRepo(t, TestRepo{
		Name:   repo2,
		Path:   path2,
		Target: "folder",
		Copies: map[string]string{
			"testdata/timeline-demo.json": "dashboard2.json",
		},
		ExpectedDashboards: 2, // Total across both repos
		ExpectedFolders:    2, // Total across both repos
	})

	allDashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err)
	for _, dashboard := range allDashboards.Items {
		annotations := dashboard.GetAnnotations()
		// Expect to be managed by repo1 or repo2
		managerID := annotations["grafana.app/managerId"]
		if managerID != repo1 && managerID != repo2 {
			t.Fatalf("dashboard %s is not managed by repo1 or repo2", dashboard.GetName())
		}
	}

	t.Run("CREATE file with UID already owned by different repository - should fail", func(t *testing.T) {
		// Try to create a dashboard in repo2 that has the same UID as the one in repo1
		// The all-panels.json has UID "n1jR8vnnz" which is already owned by repo1
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo2). // Using repo2 to try to create resource with same UID as repo1
			SubResource("files", "conflicting-dashboard.json").
			Body(helper.LoadFile("testdata/all-panels.json")). // Same file = same UID
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		// This should fail with ownership conflict
		require.Error(t, result.Error(), "creating resource with UID already owned by different repository should fail")

		// Get detailed error information
		err := result.Error()
		t.Logf("CREATE operation error: %T - %v", err, err)
		if statusErr := apierrors.APIStatus(nil); errors.As(err, &statusErr) {
			t.Logf("Status error details: code=%d, reason=%s, message=%s",
				statusErr.Status().Code, statusErr.Status().Reason, statusErr.Status().Message)
		}

		// Verify it returns BadRequest (400) for ownership conflicts
		if !apierrors.IsBadRequest(err) {
			t.Errorf("Expected BadRequest error but got: %T - %v", err, err)
			return
		}

		// Check error message contains ownership conflict information
		errorMsg := err.Error()
		t.Logf("Error message: %s", errorMsg)
		require.Contains(t, errorMsg, fmt.Sprintf("managed by repo '%s'", repo1))
		require.Contains(t, errorMsg, fmt.Sprintf("cannot be modified by repo '%s'", repo2))
	})

	t.Run("UPDATE with UID already owned by different repository - should fail", func(t *testing.T) {
		// Try to update the dashboard owned by repo1 using repo2
		result := helper.AdminREST.Put().
			Namespace("default").
			Resource("repositories").
			Name(repo2). // Using repo2 to try to update repo1's resource
			SubResource("files", "conflicting-update.json").
			Body(helper.LoadFile("testdata/all-panels.json")). // Same UID as repo1's dashboard
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		// This should fail with ownership conflict
		require.Error(t, result.Error(), "updating resource owned by different repository should fail")

		// Get detailed error information
		err := result.Error()
		t.Logf("UPDATE operation error: %T - %v", err, err)
		if statusErr := apierrors.APIStatus(nil); errors.As(err, &statusErr) {
			t.Logf("Status error details: code=%d, reason=%s, message=%s",
				statusErr.Status().Code, statusErr.Status().Reason, statusErr.Status().Message)
		}

		// Verify it returns BadRequest (400) for ownership conflicts
		if !apierrors.IsBadRequest(err) {
			t.Errorf("Expected BadRequest error but got: %T - %v", err, err)
			return
		}

		// Check error message contains ownership conflict information
		errorMsg := err.Error()
		t.Logf("Error message: %s", errorMsg)
		require.Contains(t, errorMsg, fmt.Sprintf("managed by repo '%s'", repo1))
		require.Contains(t, errorMsg, fmt.Sprintf("cannot be modified by repo '%s'", repo2))
	})

	t.Run("DELETE resource owned by different repository - should fail", func(t *testing.T) {
		// Create a file manually in the second repo which is already in first one
		helper.CopyToProvisioningPath(t, "testdata/all-panels.json", "repo2/conflicting-delete.json")
		printFileTree(t, helper.ProvisioningPath)

		result := helper.AdminREST.Delete().
			Namespace("default").
			Resource("repositories").
			Name(repo2).
			SubResource("files", "conflicting-delete.json").
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		// This should fail with ownership conflict
		require.Error(t, result.Error(), "deleting resource owned by different repository should fail")

		// Get detailed error information
		err := result.Error()
		t.Logf("DELETE operation error: %T - %v", err, err)
		if statusErr := apierrors.APIStatus(nil); errors.As(err, &statusErr) {
			t.Logf("Status error details: code=%d, reason=%s, message=%s",
				statusErr.Status().Code, statusErr.Status().Reason, statusErr.Status().Message)
		}

		// Verify it returns BadRequest (400) for ownership conflicts
		if !apierrors.IsBadRequest(err) {
			t.Errorf("Expected BadRequest error but got: %T - %v", err, err)
			return
		}

		// Check error message contains ownership conflict information
		errorMsg := err.Error()
		t.Logf("Error message: %s", errorMsg)
		require.Contains(t, errorMsg, fmt.Sprintf("managed by repo '%s'", repo1))
		require.Contains(t, errorMsg, fmt.Sprintf("cannot be modified by repo '%s'", repo2))
	})

	t.Run("MOVE and UPDATE file with UID already owned by different repository - should fail", func(t *testing.T) {
		resp := helper.postFilesRequest(t, repo2, filesPostOptions{
			targetPath:   "moved-dashboard.json",
			originalPath: path.Join("dashboard2.json"),
			message:      "attempt to move file from different repository",
			body:         string(helper.LoadFile("testdata/all-panels.json")), // Content to move with the conflicting UID
		})
		// nolint:errcheck
		defer resp.Body.Close()

		// This should fail with ownership conflict
		require.NotEqual(t, http.StatusOK, resp.StatusCode, "moving resource owned by different repository should fail")
		// Read response body to check error message
		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		errorMsg := string(body)

		// Log detailed error information
		t.Logf("MOVE operation HTTP status: %d", resp.StatusCode)
		t.Logf("MOVE operation error response: %s", errorMsg)

		require.Equal(t, http.StatusBadRequest, resp.StatusCode, "should return BadRequest (400) for ownership conflict")
		// Check error message contains ownership conflict information
		require.Contains(t, errorMsg, fmt.Sprintf("managed by repo '%s'", repo1))
		require.Contains(t, errorMsg, fmt.Sprintf("cannot be modified by repo '%s'", repo2))
	})

	t.Run("verify original resources remain intact", func(t *testing.T) {
		const allPanelsUID = "n1jR8vnnz" // UID from all-panels.json (repo1)
		const timelineUID = "mIJjFy8Kz"  // UID from timeline-demo.json (repo2)

		// Verify repo1's dashboard is still owned by repo1
		dashboard1, err := helper.DashboardsV1.Resource.Get(ctx, allPanelsUID, metav1.GetOptions{})
		require.NoError(t, err, "repo1's dashboard should still exist")
		require.Equal(t, repo1, dashboard1.GetAnnotations()[utils.AnnoKeyManagerIdentity], "repo1's dashboard should still be owned by repo1")

		// Verify repo2's dashboard is still owned by repo2
		dashboard2, err := helper.DashboardsV1.Resource.Get(ctx, timelineUID, metav1.GetOptions{})
		require.NoError(t, err, "repo2's dashboard should still exist")
		require.Equal(t, repo2, dashboard2.GetAnnotations()[utils.AnnoKeyManagerIdentity], "repo2's dashboard should still be owned by repo2")
	})
}

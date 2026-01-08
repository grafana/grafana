package provisioning

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path"
	"sync"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestIntegrationProvisioning_DeleteResources(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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
		SkipResourceAssertions: true, // tested below
	})

	var dashboards *unstructured.UnstructuredList
	var folders *unstructured.UnstructuredList
	var err error
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		dashboards, err = helper.DashboardsV1.Resource.List(t.Context(), metav1.ListOptions{})
		if err != nil {
			collect.Errorf("could not list dashboards error: %s", err.Error())
			return
		}
		if len(dashboards.Items) != 3 {
			collect.Errorf("should have the expected dashboards after sync. got: %d. expected: %d", len(dashboards.Items), 2)
			return
		}
		folders, err = helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
		if err != nil {
			collect.Errorf("could not list folders: error: %s", err.Error())
			return
		}
		if len(folders.Items) != 2 {
			collect.Errorf("should have the expected folders after sync. got: %d. expected: %d", len(folders.Items), 2)
			return
		}

		assert.Len(collect, dashboards.Items, 3)
		assert.Len(collect, folders.Items, 2)
	}, waitTimeoutDefault, waitIntervalDefault, "should have the expected dashboards and folders after sync")

	helper.validateManagedDashboardsFolderMetadata(t, ctx, repo, dashboards.Items)

	t.Run("delete individual dashboard file on configured branch should succeed", func(t *testing.T) {
		result := helper.AdminREST.Delete().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "dashboard1.json").
			Do(ctx)
		require.NoError(t, result.Error(), "delete file on configured branch should succeed")

		// Verify the dashboard is removed from Grafana
		const allPanelsUID = "n1jR8vnnz" // UID from all-panels.json
		_, err := helper.DashboardsV1.Resource.Get(ctx, allPanelsUID, metav1.GetOptions{})
		require.Error(t, err, "dashboard should be deleted from Grafana")
		require.True(t, apierrors.IsNotFound(err), "should return NotFound for deleted dashboard")
	})

	t.Run("delete individual dashboard file on branch should succeed", func(t *testing.T) {
		// Create a branch first by creating a file on a branch
		branchRef := "test-branch-delete"
		helper.CopyToProvisioningPath(t, "testdata/text-options.json", "branch-test-delete.json")

		// Delete on branch should work
		result := helper.AdminREST.Delete().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "branch-test-delete.json").
			Param("ref", branchRef).
			Do(ctx)
		// Note: This might fail if branch doesn't exist, but the important thing is it doesn't return MethodNotAllowed
		if result.Error() != nil {
			var statusErr *apierrors.StatusError
			if errors.As(result.Error(), &statusErr) {
				require.NotEqual(t, int32(http.StatusMethodNotAllowed), statusErr.ErrStatus.Code, "should not return MethodNotAllowed for branch delete")
			}
		}
	})

	t.Run("delete folder on configured branch should return MethodNotAllowed", func(t *testing.T) {
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
		require.Equal(t, http.StatusMethodNotAllowed, resp.StatusCode, "should return MethodNotAllowed for configured branch folder delete")

		// Verify a file inside the folder still exists (operation was rejected)
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "folder", "dashboard2.json")
		require.NoError(t, err, "file inside folder should still exist after rejected delete")
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
	testutil.SkipIntegrationTestInShortMode(t)

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

	t.Run("move file without content change on configured branch should succeed", func(t *testing.T) {
		const targetPath = "moved/simple-move.json"

		// Perform the move operation using helper function (no ref = configured branch)
		resp := helper.postFilesRequest(t, repo, filesPostOptions{
			targetPath:   targetPath,
			originalPath: "all-panels.json",
			message:      "move file without content change",
		})
		// nolint:errcheck
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode, "move operation on configured branch should succeed")

		// Verify file was moved - read from new location
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "moved", "simple-move.json")
		require.NoError(t, err, "file should exist at new location")

		// Verify file no longer exists at old location
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "all-panels.json")
		require.Error(t, err, "file should not exist at old location")
	})

	t.Run("move file without content change on branch should succeed", func(t *testing.T) {
		const targetPath = "moved/simple-move-branch.json"
		branchRef := "test-branch-move"

		// Perform the move operation using helper function with ref parameter
		resp := helper.postFilesRequest(t, repo, filesPostOptions{
			targetPath:   targetPath,
			originalPath: "all-panels.json",
			message:      "move file without content change",
			ref:          branchRef,
		})
		// nolint:errcheck
		defer resp.Body.Close()
		// Note: This might fail if branch doesn't exist, but the important thing is it doesn't return MethodNotAllowed
		if resp.StatusCode == http.StatusMethodNotAllowed {
			t.Fatal("should not return MethodNotAllowed for branch move")
		}

		// If move succeeded (not MethodNotAllowed), verify the file moved in the repository
		if resp.StatusCode == http.StatusOK {
			movedObj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "moved", "simple-move-branch.json")
			require.NoError(t, err, "moved file should exist in repository")

			// Check the content is preserved (verify it's still the all-panels dashboard)
			resource, _, err := unstructured.NestedMap(movedObj.Object, "resource")
			require.NoError(t, err)
			dryRun, _, err := unstructured.NestedMap(resource, "dryRun")
			require.NoError(t, err)
			title, _, err := unstructured.NestedString(dryRun, "spec", "title")
			require.NoError(t, err)
			require.Equal(t, "Panel tests - All panels", title, "content should be preserved")
		}
	})

	t.Run("move file to nested path on configured branch should succeed", func(t *testing.T) {
		// Test a different scenario: Move a file that was never synced to Grafana
		// This might reveal the issue if dashboard creation fails during move
		const sourceFile = "never-synced.json"
		helper.CopyToProvisioningPath(t, "testdata/timeline-demo.json", sourceFile)

		// DO NOT sync - move the file immediately without it ever being in Grafana
		const targetPath = "deep/nested/timeline.json"

		// Perform the move operation without the file ever being synced to Grafana (no ref = configured branch)
		resp := helper.postFilesRequest(t, repo, filesPostOptions{
			targetPath:   targetPath,
			originalPath: sourceFile,
			message:      "move never-synced file to nested path",
		})
		// nolint:errcheck
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode, "move operation on configured branch should succeed")

		// File should exist at new location
		_, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "deep", "nested", "timeline.json")
		require.NoError(t, err, "file should exist at new nested location")

		// File should not exist at original location
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", sourceFile)
		require.Error(t, err, "file should not exist at original location after move")
	})

	t.Run("move file with content update on configured branch should succeed", func(t *testing.T) {
		const sourcePath = "moved/simple-move.json" // Use the file we moved earlier
		const targetPath = "updated/content-updated.json"

		// Use text-options.json content for the update
		updatedContent := helper.LoadFile("testdata/text-options.json")

		// Perform move with content update using helper function (no ref = configured branch)
		resp := helper.postFilesRequest(t, repo, filesPostOptions{
			targetPath:   targetPath,
			originalPath: sourcePath,
			message:      "move file with content update",
			body:         string(updatedContent),
		})
		// nolint:errcheck
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode, "move with content update on configured branch should succeed")

		// File should exist at new location with updated content
		movedObj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "updated", "content-updated.json")
		require.NoError(t, err, "file should exist at new location")

		// Verify content was updated (should be text-options dashboard now)
		resource, _, err := unstructured.NestedMap(movedObj.Object, "resource")
		require.NoError(t, err)
		dryRun, _, err := unstructured.NestedMap(resource, "dryRun")
		require.NoError(t, err)
		title, _, err := unstructured.NestedString(dryRun, "spec", "title")
		require.NoError(t, err)
		require.Equal(t, "Text options", title, "content should be updated")

		// Source file should not exist anymore
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", sourcePath)
		require.Error(t, err, "source file should not exist after move")
	})

	t.Run("move directory on configured branch should return MethodNotAllowed", func(t *testing.T) {
		// Create some files in a directory first using existing testdata files
		helper.CopyToProvisioningPath(t, "testdata/timeline-demo.json", "source-dir/timeline-demo.json")
		helper.CopyToProvisioningPath(t, "testdata/text-options.json", "source-dir/text-options.json")

		// Sync to ensure files are recognized
		helper.SyncAndWait(t, repo, nil)

		const sourceDir = "source-dir/"
		const targetDir = "moved-dir/"

		// Move directory using helper function (no ref = configured branch)
		resp := helper.postFilesRequest(t, repo, filesPostOptions{
			targetPath:   targetDir,
			originalPath: sourceDir,
			message:      "move directory",
		})
		// nolint:errcheck
		defer resp.Body.Close()
		require.Equal(t, http.StatusMethodNotAllowed, resp.StatusCode, "directory move on configured branch should return MethodNotAllowed")

		// Verify files in source directory still exist (operation was rejected)
		_, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "source-dir", "timeline-demo.json")
		require.NoError(t, err, "file in source directory should still exist after rejected move")
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
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()

	// create both repos concurrently to reduce duration of this test
	// Create first repository targeting "folder-1" with its own subdirectory
	const repo1 = "ownership-repo-1"
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		helper.CreateRepo(t, TestRepo{
			Name:   repo1,
			Path:   path.Join(helper.ProvisioningPath, "repo1"),
			Target: "folder",
			Copies: map[string]string{
				"testdata/all-panels.json": "dashboard1.json",
			},
			SkipResourceAssertions: true, // will check both at the same time below to reduce duration of this test
		})
	}()

	// Create second repository targeting "folder-2" with its own subdirectory
	const repo2 = "ownership-repo-2"
	path2 := path.Join(helper.ProvisioningPath, "repo2")
	go func() {
		defer wg.Done()
		helper.CreateRepo(t, TestRepo{
			Name:   repo2,
			Path:   path2,
			Target: "folder",
			Copies: map[string]string{
				"testdata/timeline-demo.json": "dashboard2.json",
			},
			SkipResourceAssertions: true, // will check both at the same time below to reduce duration of this test
		})
	}()
	wg.Wait()

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		dashboards, err := helper.DashboardsV1.Resource.List(t.Context(), metav1.ListOptions{})
		if err != nil {
			collect.Errorf("could not list dashboards error: %s", err.Error())
			return
		}
		if len(dashboards.Items) != 2 {
			collect.Errorf("should have the expected dashboards after sync. got: %d. expected: %d", len(dashboards.Items), 2)
			return
		}
		folders, err := helper.Folders.Resource.List(t.Context(), metav1.ListOptions{})
		if err != nil {
			collect.Errorf("could not list folders: error: %s", err.Error())
			return
		}
		if len(folders.Items) != 2 {
			collect.Errorf("should have the expected folders after sync. got: %d. expected: %d", len(folders.Items), 2)
			return
		}

		assert.Len(collect, dashboards.Items, 2)
		assert.Len(collect, folders.Items, 2)
	}, waitTimeoutDefault, waitIntervalDefault, "should have the expected dashboards and folders after sync")

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
		// Create a file manually in the second repo which has UID from first repo
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
		require.True(t, apierrors.IsBadRequest(err), "Expected BadRequest error but got: %T - %v", err, err)

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
			body:         string(helper.LoadFile("testdata/all-panels.json")), // Content with the conflicting UID
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

func TestIntegrationProvisioning_FilesAuthorization(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()

	const repo = "auth-test-repo"
	helper.CreateRepo(t, TestRepo{
		Name:   repo,
		Path:   helper.ProvisioningPath,
		Target: "instance",
		Copies: map[string]string{
			"testdata/all-panels.json": "dashboard1.json",
		},
		ExpectedDashboards: 1,
		ExpectedFolders:    0,
	})

	// Wait for initial sync to complete
	var dashboardUID string
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		dashboards, err := helper.DashboardsV1.Resource.List(t.Context(), metav1.ListOptions{})
		if err != nil {
			collect.Errorf("could not list dashboards error: %s", err.Error())
			return
		}
		if len(dashboards.Items) != 1 {
			collect.Errorf("should have the expected dashboards after sync. got: %d. expected: %d", len(dashboards.Items), 1)
			return
		}
		assert.Len(collect, dashboards.Items, 1)
		dashboardUID = dashboards.Items[0].GetName()
	}, waitTimeoutDefault, waitIntervalDefault, "should have the expected dashboards after sync")

	// Grant permissions to Editor user for all dashboards using wildcard
	// The access checker checks resource-level permissions, so we need to grant them
	// Using wildcard "*" to grant permissions to all dashboards (including ones created during tests)
	// Note: Viewer role gets permissions via HTTP API below, Editor gets them here via SetPermissions
	helper.SetPermissions(helper.Org1.Editor, []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions:           []string{"dashboards:read", "dashboards:write", "dashboards:delete"},
			Resource:          "dashboards",
			ResourceAttribute: "uid",
			ResourceID:        "*",
		},
	})

	// Grant view permission to Viewer role via HTTP API (for the initial dashboard)
	// Note: This only grants permissions to the initial dashboard, but viewers should be able to read all
	addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()
	setDashboardPermissions := func(permissions []map[string]interface{}) {
		payload := map[string]interface{}{
			"items": permissions,
		}
		payloadBytes, err := json.Marshal(payload)
		require.NoError(t, err)
		url := fmt.Sprintf("http://admin:admin@%s/api/dashboards/uid/%s/permissions", addr, dashboardUID)
		req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(payloadBytes))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		require.NoError(t, resp.Body.Close())
	}

	// Grant view permission to Viewer role for the initial dashboard
	setDashboardPermissions([]map[string]interface{}{
		{"role": "Viewer", "permission": 1}, // View permission
	})

	t.Run("GET operations", func(t *testing.T) {
		t.Run("viewer can GET files", func(t *testing.T) {
			var statusCode int
			result := helper.ViewerREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("files", "dashboard1.json").
				Do(ctx).StatusCode(&statusCode)

			require.NoError(t, result.Error(), "viewer should be able to GET files")
			require.Equal(t, http.StatusOK, statusCode, "should return 200 OK")
		})

		t.Run("editor can GET files", func(t *testing.T) {
			var statusCode int
			result := helper.EditorREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("files", "dashboard1.json").
				Do(ctx).StatusCode(&statusCode)

			require.NoError(t, result.Error(), "editor should be able to GET files")
			require.Equal(t, http.StatusOK, statusCode, "should return 200 OK")
		})

		t.Run("admin can GET files", func(t *testing.T) {
			var statusCode int
			result := helper.AdminREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("files", "dashboard1.json").
				Do(ctx).StatusCode(&statusCode)

			require.NoError(t, result.Error(), "admin should be able to GET files")
			require.Equal(t, http.StatusOK, statusCode, "should return 200 OK")
		})
	})

	t.Run("POST operations", func(t *testing.T) {
		t.Run("viewer cannot POST files", func(t *testing.T) {
			var statusCode int
			result := helper.ViewerREST.Post().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("files", "viewer-test.json").
				Body(helper.LoadFile("testdata/text-options.json")).
				SetHeader("Content-Type", "application/json").
				Do(ctx).StatusCode(&statusCode)

			require.Error(t, result.Error(), "viewer should not be able to POST files")
			require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
			require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
		})

		t.Run("editor can POST files", func(t *testing.T) {
			var statusCode int
			result := helper.EditorREST.Post().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("files", "editor-test.json").
				Body(helper.LoadFile("testdata/text-options.json")).
				SetHeader("Content-Type", "application/json").
				Do(ctx).StatusCode(&statusCode)

			require.NoError(t, result.Error(), "editor should be able to POST files")
			require.Equal(t, http.StatusOK, statusCode, "should return 200 OK")

			// Clean up
			helper.AdminREST.Delete().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("files", "editor-test.json").
				Do(ctx)
		})

		t.Run("admin can POST files", func(t *testing.T) {
			var statusCode int
			result := helper.AdminREST.Post().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("files", "admin-test.json").
				Body(helper.LoadFile("testdata/text-options.json")).
				SetHeader("Content-Type", "application/json").
				Do(ctx).StatusCode(&statusCode)

			require.NoError(t, result.Error(), "admin should be able to POST files")
			require.Equal(t, http.StatusOK, statusCode, "should return 200 OK")

			// Clean up
			helper.AdminREST.Delete().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("files", "admin-test.json").
				Do(ctx)
		})
	})

	t.Run("PUT operations", func(t *testing.T) {
		// Create a test file first using admin
		helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "update-test.json").
			Body(helper.LoadFile("testdata/text-options.json")).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		t.Run("viewer cannot PUT files", func(t *testing.T) {
			var statusCode int
			result := helper.ViewerREST.Put().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("files", "update-test.json").
				Body(helper.LoadFile("testdata/timeline-demo.json")).
				SetHeader("Content-Type", "application/json").
				Do(ctx).StatusCode(&statusCode)

			require.Error(t, result.Error(), "viewer should not be able to PUT files")
			require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
			require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
		})

		t.Run("editor can PUT files", func(t *testing.T) {
			var statusCode int
			result := helper.EditorREST.Put().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("files", "update-test.json").
				Body(helper.LoadFile("testdata/timeline-demo.json")).
				SetHeader("Content-Type", "application/json").
				Do(ctx).StatusCode(&statusCode)

			require.NoError(t, result.Error(), "editor should be able to PUT files")
			require.Equal(t, http.StatusOK, statusCode, "should return 200 OK")
		})

		t.Run("admin can PUT files", func(t *testing.T) {
			var statusCode int
			result := helper.AdminREST.Put().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("files", "update-test.json").
				Body(helper.LoadFile("testdata/text-options.json")).
				SetHeader("Content-Type", "application/json").
				Do(ctx).StatusCode(&statusCode)

			require.NoError(t, result.Error(), "admin should be able to PUT files")
			require.Equal(t, http.StatusOK, statusCode, "should return 200 OK")
		})

		// Clean up
		helper.AdminREST.Delete().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "update-test.json").
			Do(ctx)
	})

	t.Run("DELETE operations", func(t *testing.T) {
		// Create test files for deletion tests
		helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "delete-viewer-test.json").
			Body(helper.LoadFile("testdata/text-options.json")).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "delete-editor-test.json").
			Body(helper.LoadFile("testdata/text-options.json")).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", "delete-admin-test.json").
			Body(helper.LoadFile("testdata/text-options.json")).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		t.Run("viewer cannot DELETE files", func(t *testing.T) {
			var statusCode int
			result := helper.ViewerREST.Delete().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("files", "delete-viewer-test.json").
				Do(ctx).StatusCode(&statusCode)

			require.Error(t, result.Error(), "viewer should not be able to DELETE files")
			require.Equal(t, http.StatusForbidden, statusCode, "should return 403 Forbidden")
			require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")

			// Verify file still exists
			_, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "delete-viewer-test.json")
			require.NoError(t, err, "file should still exist after failed delete")
		})

		t.Run("editor can DELETE files", func(t *testing.T) {
			var statusCode int
			result := helper.EditorREST.Delete().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("files", "delete-editor-test.json").
				Do(ctx).StatusCode(&statusCode)

			require.NoError(t, result.Error(), "editor should be able to DELETE files")
			require.Equal(t, http.StatusOK, statusCode, "should return 200 OK")

			// Verify file was deleted
			_, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "delete-editor-test.json")
			require.Error(t, err, "file should be deleted")
			require.True(t, apierrors.IsNotFound(err), "should return NotFound for deleted file")
		})

		t.Run("admin can DELETE files", func(t *testing.T) {
			var statusCode int
			result := helper.AdminREST.Delete().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("files", "delete-admin-test.json").
				Do(ctx).StatusCode(&statusCode)

			require.NoError(t, result.Error(), "admin should be able to DELETE files")
			require.Equal(t, http.StatusOK, statusCode, "should return 200 OK")

			// Verify file was deleted
			_, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "delete-admin-test.json")
			require.Error(t, err, "file should be deleted")
			require.True(t, apierrors.IsNotFound(err), "should return NotFound for deleted file")
		})
	})

	t.Run("folder operations", func(t *testing.T) {
		t.Run("viewer cannot create folders", func(t *testing.T) {
			// Create a folder by POSTing to a directory path
			addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()
			url := fmt.Sprintf("http://viewer:viewer@%s/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/%s/files/test-folder/", addr, repo)
			req, err := http.NewRequest(http.MethodPost, url, nil)
			require.NoError(t, err)
			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			// nolint:errcheck
			defer resp.Body.Close()

			require.Equal(t, http.StatusForbidden, resp.StatusCode, "viewer should not be able to create folders")
		})

		t.Run("editor can create folders", func(t *testing.T) {
			addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()
			url := fmt.Sprintf("http://editor:editor@%s/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/%s/files/editor-folder/", addr, repo)
			req, err := http.NewRequest(http.MethodPost, url, nil)
			require.NoError(t, err)
			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			// nolint:errcheck
			defer resp.Body.Close()

			require.Equal(t, http.StatusOK, resp.StatusCode, "editor should be able to create folders")

			// Clean up - delete folder
			deleteURL := fmt.Sprintf("http://admin:admin@%s/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/%s/files/editor-folder/", addr, repo)
			deleteReq, err := http.NewRequest(http.MethodDelete, deleteURL, nil)
			require.NoError(t, err)
			deleteResp, err := http.DefaultClient.Do(deleteReq)
			require.NoError(t, err)
			// nolint:errcheck
			defer deleteResp.Body.Close()
		})

		t.Run("admin can create folders", func(t *testing.T) {
			addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()
			url := fmt.Sprintf("http://admin:admin@%s/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/%s/files/admin-folder/", addr, repo)
			req, err := http.NewRequest(http.MethodPost, url, nil)
			require.NoError(t, err)
			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			// nolint:errcheck
			defer resp.Body.Close()

			require.Equal(t, http.StatusOK, resp.StatusCode, "admin should be able to create folders")

			// Clean up - delete folder
			deleteURL := fmt.Sprintf("http://admin:admin@%s/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/%s/files/admin-folder/", addr, repo)
			deleteReq, err := http.NewRequest(http.MethodDelete, deleteURL, nil)
			require.NoError(t, err)
			deleteResp, err := http.DefaultClient.Do(deleteReq)
			require.NoError(t, err)
			// nolint:errcheck
			defer deleteResp.Body.Close()
		})
	})
}

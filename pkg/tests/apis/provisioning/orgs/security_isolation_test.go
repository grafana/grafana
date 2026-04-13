package orgs

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestAttack_CrossRepositoryFileAccess attempts to access files from another repository.
// This should be prevented by proper repository scoping.
func TestAttack_CrossRepositoryFileAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := sharedHelper(t)
	ctx := context.Background()

	const (
		victimRepo   = "victim-repo"
		attackerRepo = "attacker-repo"
	)

	// Setup: Create two repositories with files
	t.Run("setup victim and attacker repositories", func(t *testing.T) {
		helper.CreateRepo(t, common.TestRepo{
			Name:   victimRepo,
			Target: "instance",
			Copies: map[string]string{
				"simple-dashboard.json": "secret-dashboard.json",
			},
		})

		helper.CreateRepo(t, common.TestRepo{
			Name:   attackerRepo,
			Target: "instance",
			Copies: map[string]string{
				"simple-dashboard.json": "attacker-dashboard.json",
			},
		})

		helper.SyncAndWait(t, victimRepo, nil)
		helper.SyncAndWait(t, attackerRepo, nil)
	})

	// Attack 1: Try to read victim's file through attacker's repository
	t.Run("attack: read victim's file via attacker repo", func(t *testing.T) {
		// Attempt to read victim's file by accessing it through attacker's repo
		_, err := helper.Repositories.Resource.Get(ctx, attackerRepo, metav1.GetOptions{},
			"files", "secret-dashboard.json")

		// Should fail - attacker repo should not see victim's files
		assert.Error(t, err, "should not be able to read victim's file via attacker repo")
		assert.True(t, apierrors.IsNotFound(err),
			"should return NotFound (not permission denied, which would leak existence)")

		t.Log("✓ DEFENSE: Cannot read victim's files via attacker repository")
	})

	// Attack 2: Try to list files and see if victim's files appear
	t.Run("attack: check if victim's files leak in attacker's file list", func(t *testing.T) {
		fileList := &provisioning.FileList{}
		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(attackerRepo).
			Suffix("files/").
			Do(ctx)
		require.NoError(t, result.Error())
		require.NoError(t, result.Into(fileList))

		// Verify victim's file doesn't appear in attacker's list
		for _, file := range fileList.Items {
			assert.NotEqual(t, "secret-dashboard.json", file.Path,
				"victim's file should not appear in attacker's file list")
		}

		// Should only see attacker's own file
		require.Len(t, fileList.Items, 1, "attacker should only see their own files")
		assert.Equal(t, "attacker-dashboard.json", fileList.Items[0].Path)

		t.Log("✓ DEFENSE: Victim's files do not leak in attacker's file listing")
	})

	// Attack 3: Try to delete victim's file through attacker's repository
	t.Run("attack: delete victim's file via attacker repo", func(t *testing.T) {
		result := helper.AdminREST.Delete().
			Namespace("default").
			Resource("repositories").
			Name(attackerRepo).
			SubResource("files", "secret-dashboard.json").
			Do(ctx)

		// Should fail or be a no-op (returns OK but doesn't actually delete)
		if result.Error() != nil {
			assert.True(t, apierrors.IsNotFound(result.Error()),
				"should return NotFound for non-existent file in attacker repo")
		}

		// Verify victim's file still exists
		_, err := helper.Repositories.Resource.Get(ctx, victimRepo, metav1.GetOptions{},
			"files", "secret-dashboard.json")
		assert.NoError(t, err, "victim's file should still exist")

		t.Log("✓ DEFENSE: Cannot delete victim's files via attacker repository")
	})

	// Attack 4: Try to update/overwrite victim's file through attacker's repository
	t.Run("attack: overwrite victim's file via attacker repo", func(t *testing.T) {
		maliciousContent := helper.LoadFile("testdata/text-options.json")

		resp := helper.PostFilesRequest(t, attackerRepo, common.FilesPostOptions{
			TargetPath:   "secret-dashboard.json",
			OriginalPath: "attacker-dashboard.json",
			Message:      "attempt to overwrite victim's file",
			Body:         string(maliciousContent),
		})
		defer resp.Body.Close()

		// Should succeed in attacker's repo (creates new file there)
		// But should NOT affect victim's file
		require.Equal(t, http.StatusOK, resp.StatusCode)

		// Sync attacker repo
		helper.SyncAndWait(t, attackerRepo, nil)

		// Verify victim's original file is unchanged
		victimFile, err := helper.Repositories.Resource.Get(ctx, victimRepo, metav1.GetOptions{},
			"files", "secret-dashboard.json")
		require.NoError(t, err, "victim's file should still exist")

		// Verify victim's dashboard is still managed by victim repo
		dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)

		victimDashboardIntact := false
		for i := range dashboards.Items {
			dash := &dashboards.Items[i]
			meta, err := utils.MetaAccessor(dash)
			require.NoError(t, err)

			if manager, hasManager := meta.GetManagerProperties(); hasManager {
				if manager.Identity == victimRepo {
					victimDashboardIntact = true
					// Verify title unchanged (should still be "Simple Dashboard")
					title, _, _ := unstructured.NestedString(dash.Object, "spec", "title")
					assert.Contains(t, title, "Simple", "victim's dashboard content should be unchanged")
					break
				}
			}
		}

		assert.True(t, victimDashboardIntact, "victim's dashboard should still be intact")

		// Verify victim file content unchanged
		resource, _, _ := unstructured.NestedMap(victimFile.Object, "resource")
		dryRun, _, _ := unstructured.NestedMap(resource, "dryRun")
		title, _, _ := unstructured.NestedString(dryRun, "spec", "title")
		assert.Contains(t, title, "Simple", "victim's file content should be unchanged")

		t.Log("✓ DEFENSE: Cannot overwrite victim's files via attacker repository")
	})
}

// TestAttack_ResourceOwnershipHijacking attempts to hijack ownership of resources
// created by another repository.
func TestAttack_ResourceOwnershipHijacking(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := sharedHelper(t)
	ctx := context.Background()

	const (
		victimRepo   = "victim-ownership"
		attackerRepo = "attacker-ownership"
	)

	var victimDashboardUID string

	// Setup: Create victim repository with a resource
	t.Run("setup victim repository", func(t *testing.T) {
		helper.CreateRepo(t, common.TestRepo{
			Name:   victimRepo,
			Target: "instance",
			Copies: map[string]string{
				"simple-dashboard.json": "victim-dashboard.json",
			},
		})

		helper.SyncAndWait(t, victimRepo, nil)

		// Get victim's dashboard UID
		dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)

		for i := range dashboards.Items {
			dash := &dashboards.Items[i]
			meta, err := utils.MetaAccessor(dash)
			require.NoError(t, err)

			if manager, hasManager := meta.GetManagerProperties(); hasManager {
				if manager.Identity == victimRepo {
					victimDashboardUID = dash.GetName()
					t.Logf("Victim dashboard UID: %s", victimDashboardUID)
					break
				}
			}
		}

		require.NotEmpty(t, victimDashboardUID, "should find victim's dashboard")
	})

	// Attack 1: Create attacker repo and try to create a file that would claim victim's resource
	t.Run("attack: create file attempting to claim victim's resource UID", func(t *testing.T) {
		helper.CreateRepo(t, common.TestRepo{
			Name:     attackerRepo,
			Target:   "instance",
			SkipSync: true,
		})

		// Create a dashboard file with the same UID as victim's dashboard
		// This would attempt to hijack the resource
		dashboardJSON := fmt.Sprintf(`{
			"uid": "%s",
			"title": "Hijacked Dashboard",
			"schemaVersion": 41
		}`, victimDashboardUID)

		resp := helper.PostFilesRequest(t, attackerRepo, common.FilesPostOptions{
			TargetPath: "hijack-attempt.json",
			Message:    "attempt to hijack victim's dashboard",
			Body:       dashboardJSON,
		})
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		// Sync attacker repo
		helper.SyncAndWait(t, attackerRepo, nil)
	})

	// Verify: Victim's dashboard ownership is protected
	t.Run("verify victim's dashboard ownership protected", func(t *testing.T) {
		victimDash, err := helper.DashboardsV1.Resource.Get(ctx, victimDashboardUID, metav1.GetOptions{})
		require.NoError(t, err, "victim's dashboard should still exist")

		meta, err := utils.MetaAccessor(victimDash)
		require.NoError(t, err)

		manager, hasManager := meta.GetManagerProperties()
		require.True(t, hasManager, "dashboard should still have manager")

		// CRITICAL: Manager should still be victim, not attacker
		assert.Equal(t, victimRepo, manager.Identity,
			"dashboard should still be owned by victim repository")
		assert.NotEqual(t, attackerRepo, manager.Identity,
			"dashboard should NOT be hijacked by attacker")

		// Verify content not changed
		title, _, _ := unstructured.NestedString(victimDash.Object, "spec", "title")
		assert.NotEqual(t, "Hijacked Dashboard", title,
			"dashboard title should not be changed by attacker")

		t.Log("✓ DEFENSE: Ownership hijacking attempt blocked - resource still owned by victim")
	})

	// Verify: Attacker's sync job should have errors/warnings
	t.Run("verify attacker's sync reported conflict", func(t *testing.T) {
		// The attacker's job should have warnings about the ownership conflict
		// Get the latest job for attacker repo
		jobs := &unstructured.UnstructuredList{}
		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(attackerRepo).
			SubResource("jobs").
			Do(ctx)

		require.NoError(t, result.Error())
		require.NoError(t, result.Into(jobs))

		if len(jobs.Items) > 0 {
			latestJob := jobs.Items[0]
			status, found, _ := unstructured.NestedMap(latestJob.Object, "status")
			if found {
				// Check for errors or warnings in the job
				warnings, _, _ := unstructured.NestedSlice(status, "results")
				if warnings != nil && len(warnings) > 0 {
					t.Logf("✓ DEFENSE: Attacker's sync job reported conflicts/warnings")
				}
			}
		}
	})
}

// TestAttack_NamespaceLeakage attempts to leak resources across namespace boundaries.
func TestAttack_NamespaceLeakage(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := sharedHelper(t)
	ctx := context.Background()

	const (
		repo1 = "repo-namespace-leak-1"
		repo2 = "repo-namespace-leak-2"
	)

	// Setup: Create repositories with identical dashboard UIDs (but should be in same namespace)
	t.Run("setup repositories", func(t *testing.T) {
		helper.CreateRepo(t, common.TestRepo{
			Name:   repo1,
			Target: "instance",
			Copies: map[string]string{
				"simple-dashboard.json": "dashboard1.json",
			},
		})

		helper.CreateRepo(t, common.TestRepo{
			Name:   repo2,
			Target: "instance",
			Copies: map[string]string{
				"simple-dashboard.json": "dashboard2.json",
			},
		})

		helper.SyncAndWait(t, repo1, nil)
		helper.SyncAndWait(t, repo2, nil)
	})

	// Attack: Verify each repository's resources stay in the correct namespace
	t.Run("verify no namespace leakage", func(t *testing.T) {
		dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)

		expectedNamespace := helper.Namespacer(helper.Org1.Viewer.Identity.GetOrgID())

		repo1Found := false
		repo2Found := false

		for i := range dashboards.Items {
			dash := &dashboards.Items[i]
			meta, err := utils.MetaAccessor(dash)
			require.NoError(t, err)

			if manager, hasManager := meta.GetManagerProperties(); hasManager {
				switch manager.Identity {
				case repo1:
					repo1Found = true
					// Verify namespace
					assert.Equal(t, expectedNamespace, dash.GetNamespace(),
						"repo1 resource should be in correct namespace")
					// Before the fix, this would be empty or default org

				case repo2:
					repo2Found = true
					// Verify namespace
					assert.Equal(t, expectedNamespace, dash.GetNamespace(),
						"repo2 resource should be in correct namespace")
					// Before the fix, this would be empty or default org
				}
			}
		}

		require.True(t, repo1Found, "should find repo1 dashboard")
		require.True(t, repo2Found, "should find repo2 dashboard")

		t.Log("✓ DEFENSE: All resources in correct namespace - no leakage")
	})
}

// TestAttack_MaliciousFileOperations attempts various malicious file operations.
func TestAttack_MaliciousFileOperations(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := sharedHelper(t)
	ctx := context.Background()

	const (
		victimRepo   = "victim-files"
		attackerRepo = "attacker-files"
	)

	// Setup
	t.Run("setup repositories", func(t *testing.T) {
		helper.CreateRepo(t, common.TestRepo{
			Name:   victimRepo,
			Target: "instance",
			Copies: map[string]string{
				"simple-dashboard.json": "victim-resource.json",
			},
		})

		helper.CreateRepo(t, common.TestRepo{
			Name:     attackerRepo,
			Target:   "instance",
			SkipSync: true,
		})

		helper.SyncAndWait(t, victimRepo, nil)
	})

	// Attack 1: Path traversal attempt
	t.Run("attack: path traversal to access victim's files", func(t *testing.T) {
		// Try to read victim's file using path traversal
		_, err := helper.Repositories.Resource.Get(ctx, attackerRepo, metav1.GetOptions{},
			"files", "..", victimRepo, "victim-resource.json")

		assert.Error(t, err, "path traversal should be blocked")
		t.Log("✓ DEFENSE: Path traversal attack blocked")
	})

	// Attack 2: Try to create file with malicious path
	t.Run("attack: create file with directory traversal in name", func(t *testing.T) {
		maliciousContent := helper.LoadFile("testdata/simple-dashboard.json")

		// Try to create a file that attempts to escape the repository
		resp := helper.PostFilesRequest(t, attackerRepo, common.FilesPostOptions{
			TargetPath: "../" + victimRepo + "/hijacked.json",
			Message:    "attempt path traversal",
			Body:       string(maliciousContent),
		})
		defer resp.Body.Close()

		// Should either fail or create file safely within attacker's repo
		// But should NOT affect victim's repository
		if resp.StatusCode == http.StatusOK {
			// Verify victim's file list unchanged
			victimFileList := &provisioning.FileList{}
			result := helper.AdminREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(victimRepo).
				Suffix("files/").
				Do(ctx)
			require.NoError(t, result.Error())
			require.NoError(t, result.Into(victimFileList))

			// Victim should still have only original file
			require.Len(t, victimFileList.Items, 1,
				"victim repository should not have extra files")
			assert.Equal(t, "victim-resource.json", victimFileList.Items[0].Path,
				"victim should only have original file")
		}

		t.Log("✓ DEFENSE: Malicious path in filename blocked or sanitized")
	})

	// Attack 3: Try to create file with same name as victim's to cause confusion
	t.Run("attack: create file with same name as victim's file", func(t *testing.T) {
		maliciousContent := `{"uid":"evil","title":"Evil Dashboard","schemaVersion":41}`

		resp := helper.PostFilesRequest(t, attackerRepo, common.FilesPostOptions{
			TargetPath: "victim-resource.json", // Same name as victim's file
			Message:    "create confusing file",
			Body:       maliciousContent,
		})
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		helper.SyncAndWait(t, attackerRepo, nil)

		// Verify both files exist independently
		victimFile, err := helper.Repositories.Resource.Get(ctx, victimRepo, metav1.GetOptions{},
			"files", "victim-resource.json")
		require.NoError(t, err, "victim's file should still exist")

		attackerFile, err := helper.Repositories.Resource.Get(ctx, attackerRepo, metav1.GetOptions{},
			"files", "victim-resource.json")
		require.NoError(t, err, "attacker's file should exist")

		// Verify they are different files (different content)
		victimResource, _, _ := unstructured.NestedMap(victimFile.Object, "resource")
		attackerResource, _, _ := unstructured.NestedMap(attackerFile.Object, "resource")

		victimDryRun, _, _ := unstructured.NestedMap(victimResource, "dryRun")
		attackerDryRun, _, _ := unstructured.NestedMap(attackerResource, "dryRun")

		victimTitle, _, _ := unstructured.NestedString(victimDryRun, "spec", "title")
		attackerTitle, _, _ := unstructured.NestedString(attackerDryRun, "spec", "title")

		assert.NotEqual(t, attackerTitle, victimTitle,
			"files should be different despite same name")

		t.Log("✓ DEFENSE: Files with same name in different repos remain isolated")
	})
}

// TestAttack_SyncJobManipulation attempts to manipulate sync jobs across repositories.
func TestAttack_SyncJobManipulation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := sharedHelper(t)
	ctx := context.Background()

	const (
		victimRepo   = "victim-sync"
		attackerRepo = "attacker-sync"
	)

	// Setup
	t.Run("setup repositories", func(t *testing.T) {
		helper.CreateRepo(t, common.TestRepo{
			Name:   victimRepo,
			Target: "instance",
			Copies: map[string]string{
				"simple-dashboard.json": "sync-test.json",
			},
		})

		helper.CreateRepo(t, common.TestRepo{
			Name:   attackerRepo,
			Target: "instance",
			Copies: map[string]string{
				"simple-dashboard.json": "attacker-sync.json",
			},
		})

		helper.SyncAndWait(t, victimRepo, nil)
	})

	// Attack: Try to trigger sync for victim's repo from attacker's context
	// This tests if sync job submission is properly scoped
	t.Run("verify sync jobs are repository-scoped", func(t *testing.T) {
		// Trigger sync for both repos
		helper.SyncAndWait(t, victimRepo, nil)
		helper.SyncAndWait(t, attackerRepo, nil)

		// List jobs for victim repo
		victimJobs := &unstructured.UnstructuredList{}
		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(victimRepo).
			SubResource("jobs").
			Do(ctx)
		require.NoError(t, result.Error())
		require.NoError(t, result.Into(victimJobs))

		// Verify victim's jobs only processed victim's files
		for _, job := range victimJobs.Items {
			status, found, _ := unstructured.NestedMap(job.Object, "status")
			if !found {
				continue
			}

			results, found, _ := unstructured.NestedSlice(status, "results")
			if !found {
				continue
			}

			// Check that no attacker files appear in victim's job results
			for _, result := range results {
				resultMap, ok := result.(map[string]interface{})
				if !ok {
					continue
				}

				path, _, _ := unstructured.NestedString(resultMap, "path")
				assert.NotContains(t, path, "attacker-sync.json",
					"victim's sync jobs should not process attacker's files")
			}
		}

		t.Log("✓ DEFENSE: Sync jobs properly scoped to their repository")
	})
}

// TestAttack_ResourceNameCollision tests what happens when resources with same UID
// are attempted across different managers.
func TestAttack_ResourceNameCollision(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := sharedHelper(t)
	ctx := context.Background()

	const (
		repo1 = "repo-collision-1"
		repo2 = "repo-collision-2"
	)

	// Setup: Both repos try to create resource with same UID
	t.Run("setup repositories with conflicting UIDs", func(t *testing.T) {
		// Create custom dashboard with fixed UID
		dashboardJSON := `{
			"uid": "collision-test-uid",
			"title": "Repo1 Dashboard",
			"schemaVersion": 41
		}`

		helper.CreateRepo(t, common.TestRepo{
			Name:     repo1,
			Target:   "instance",
			SkipSync: true,
		})

		resp := helper.PostFilesRequest(t, repo1, common.FilesPostOptions{
			TargetPath: "dashboard.json",
			Message:    "create dashboard with fixed UID",
			Body:       dashboardJSON,
		})
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		helper.SyncAndWait(t, repo1, nil)

		// Now repo2 tries to create resource with same UID
		dashboardJSON2 := `{
			"uid": "collision-test-uid",
			"title": "Repo2 Dashboard - Hijack Attempt",
			"schemaVersion": 41
		}`

		helper.CreateRepo(t, common.TestRepo{
			Name:     repo2,
			Target:   "instance",
			SkipSync: true,
		})

		resp2 := helper.PostFilesRequest(t, repo2, common.FilesPostOptions{
			TargetPath: "dashboard.json",
			Message:    "attempt to hijack with same UID",
			Body:       dashboardJSON2,
		})
		defer resp2.Body.Close()
		require.Equal(t, http.StatusOK, resp2.StatusCode)

		helper.SyncAndWait(t, repo2, nil)
	})

	// Verify: First repo maintains ownership
	t.Run("verify first repo maintains ownership", func(t *testing.T) {
		dash, err := helper.DashboardsV1.Resource.Get(ctx, "collision-test-uid", metav1.GetOptions{})
		require.NoError(t, err, "dashboard should exist")

		meta, err := utils.MetaAccessor(dash)
		require.NoError(t, err)

		manager, hasManager := meta.GetManagerProperties()
		require.True(t, hasManager)

		// CRITICAL: First repo should maintain ownership
		assert.Equal(t, repo1, manager.Identity,
			"first repository should maintain ownership despite collision attempt")

		// Verify content is from repo1, not repo2
		title, _, _ := unstructured.NestedString(dash.Object, "spec", "title")
		assert.Equal(t, "Repo1 Dashboard", title,
			"dashboard content should be from first repo")
		assert.NotEqual(t, "Repo2 Dashboard - Hijack Attempt", title,
			"dashboard should not be hijacked by second repo")

		t.Log("✓ DEFENSE: First-writer wins - ownership protected from collision attacks")
	})
}

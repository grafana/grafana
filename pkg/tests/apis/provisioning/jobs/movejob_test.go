package jobs

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_MoveJob(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "move-test-repo"
	testRepo := common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Workflows:  []string{"write"},
		Copies: map[string]string{
			"../testdata/all-panels.json":    "dashboard1.json",
			"../testdata/text-options.json":  "dashboard2.json",
			"../testdata/timeline-demo.json": "folder/dashboard3.json",
		},
	}
	helper.CreateLocalRepo(t, testRepo)

	helper.RequireRepoDashboardCount(t, repo, 3)
	helper.RequireRepoFolderCount(t, repo, 2)

	t.Run("move single file", func(t *testing.T) {
		helper.DebugState(t, repo, "BEFORE MOVE SINGLE FILE")

		spec := provisioning.JobSpec{
			Action: provisioning.JobActionMove,
			Move: &provisioning.MoveJobOptions{
				Paths:      []string{"dashboard1.json"},
				TargetPath: "moved/",
			},
		}
		helper.TriggerJobAndWaitForSuccess(t, repo, spec)

		helper.DebugState(t, repo, "AFTER MOVE SINGLE FILE")
		// TODO: This additional sync should not be necessary - the move job should handle sync properly
		helper.SyncAndWait(t, repo, nil)

		// Verify file is moved in repository
		helper.RequireRepoFileExists(t, repo, "moved", "dashboard1.json")

		// Verify original file is gone from repository
		helper.RequireRepoFileNotFound(t, repo, "dashboard1.json")

		// Verify other files still exist at original locations
		helper.RequireRepoFileExists(t, repo, "dashboard2.json")
		helper.RequireRepoFileExists(t, repo, "folder", "dashboard3.json")

		// Verify dashboard still exists in Grafana after sync
		// Verify that dashboards have the correct source paths
		foundPaths := make(map[string]bool)
		for _, dashboard := range helper.RequireRepoDashboardCount(t, repo, 3) {
			sourcePath := dashboard.GetAnnotations()["grafana.app/sourcePath"]
			foundPaths[sourcePath] = true
		}

		require.True(t, foundPaths["moved/dashboard1.json"], "should have dashboard with moved source path")
		require.True(t, foundPaths["dashboard2.json"], "should have dashboard2 in original location")
		require.True(t, foundPaths["folder/dashboard3.json"], "should have dashboard3 in original nested location")
	})

	t.Run("move multiple files and folder", func(t *testing.T) {
		helper.DebugState(t, repo, "BEFORE MOVE MULTIPLE FILES")

		// Create move job for multiple files including a folder
		spec := provisioning.JobSpec{
			Action: provisioning.JobActionMove,
			Move: &provisioning.MoveJobOptions{
				Paths:      []string{"dashboard2.json", "folder/"},
				TargetPath: "archived/",
			},
		}
		helper.TriggerJobAndWaitForSuccess(t, repo, spec)

		helper.DebugState(t, repo, "AFTER MOVE MULTIPLE FILES")
		// TODO: This additional sync should not be necessary - the move job should handle sync properly
		helper.SyncAndWait(t, repo, nil)

		// Verify files are moved in repository
		helper.RequireRepoFileExists(t, repo, "archived", "dashboard2.json")
		helper.RequireRepoFileExists(t, repo, "archived", "folder", "dashboard3.json")

		// Verify original files are gone from repository
		helper.RequireRepoFileNotFound(t, repo, "dashboard2.json")
		helper.RequireRepoFileNotFound(t, repo, "folder", "dashboard3.json")

		// Verify dashboards still exist in Grafana after sync
		// Note: Since dashboard1.json was moved in the previous test, we now expect all 3 dashboards
		// to be accessible from their moved locations (dashboard1 from moved/, dashboard2 and dashboard3 from archived/)
		// Verify that dashboards have the correct source paths after cumulative moves
		foundPaths := make(map[string]bool)
		for _, dashboard := range helper.RequireRepoDashboardCount(t, repo, 3) {
			sourcePath := dashboard.GetAnnotations()["grafana.app/sourcePath"]
			foundPaths[sourcePath] = true
		}

		require.True(t, foundPaths["moved/dashboard1.json"], "should have dashboard1 from first move")
		require.True(t, foundPaths["archived/dashboard2.json"], "should have dashboard2 in archived location")
		require.True(t, foundPaths["archived/folder/dashboard3.json"], "should have dashboard3 in archived nested location")
	})

	t.Run("move non-existent file is rejected", func(t *testing.T) {
		body := common.AsJSON(provisioning.JobSpec{
			Action: provisioning.JobActionMove,
			Move: &provisioning.MoveJobOptions{
				Paths:      []string{"non-existent.json"},
				TargetPath: "moved/",
			},
		})

		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(t.Context())

		require.Error(t, result.Error(), "move job for non-existent file should be rejected at creation")
	})

	t.Run("move non-existent uid", func(t *testing.T) {
		spec := provisioning.JobSpec{
			Action: provisioning.JobActionMove,
			Move: &provisioning.MoveJobOptions{
				TargetPath: "moved-nonexistent/",
				Resources: []provisioning.ResourceRef{
					{
						Name:  "non-existent-move-uid",
						Kind:  "Dashboard",
						Group: "dashboard.grafana.app",
					},
				},
			},
		}

		job := helper.TriggerJobAndWaitForComplete(t, repo, spec)
		state := common.MustNestedString(job.Object, "status", "state")
		require.Equal(t, "error", state, "move job should have failed due to non-existent uid")
	})

	t.Run("move without target path", func(t *testing.T) {
		// Create move job without target path (should fail validation at creation time)
		spec := provisioning.JobSpec{
			Action: provisioning.JobActionMove,
			Move: &provisioning.MoveJobOptions{
				Paths: []string{"moved/dashboard1.json"},
				// TargetPath intentionally omitted
			},
		}

		// The job should be rejected by the admission controller with validation error
		body := common.AsJSON(&spec)
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(t.Context())

		require.Error(t, result.Error(), "move job without target path should fail validation")
		statusError := helper.RequireApiErrorStatus(result.Error(), metav1.StatusReasonInvalid, 422)
		require.Contains(t, statusError.Message, "spec.move.targetPath", "error should mention missing target path")
	})

	t.Run("move by resource reference", func(t *testing.T) {
		// Delete the existing repository to avoid conflicts with validation rules
		err := helper.Repositories.Resource.Delete(t.Context(), repo, metav1.DeleteOptions{})
		require.NoError(t, err)

		// Wait for repository to be fully deleted
		helper.WaitForRepositoryDeleted(t, repo)

		// Create modified test files with unique UIDs for ResourceRef testing
		allPanelsContent := helper.LoadFile("../testdata/all-panels.json")
		textOptionsContent := helper.LoadFile("../testdata/text-options.json")
		timelineDemoContent := helper.LoadFile("../testdata/timeline-demo.json")

		// Modify UIDs to be unique for ResourceRef tests
		allPanelsModified := renameDashboard(t, allPanelsContent, "moveref1")
		textOptionsModified := renameDashboard(t, textOptionsContent, "moveref2")
		timelineDemoModified := renameDashboard(t, timelineDemoContent, "moveref3")

		// Create temporary files and copy them to the provisioning path
		tmpDir := t.TempDir()
		tmpFile1 := filepath.Join(tmpDir, "move-ref-test-1.json")
		tmpFile2 := filepath.Join(tmpDir, "move-ref-test-2.json")
		tmpFile3 := filepath.Join(tmpDir, "move-ref-test-3.json")

		require.NoError(t, os.WriteFile(tmpFile1, []byte(allPanelsModified), 0644))
		require.NoError(t, os.WriteFile(tmpFile2, []byte(textOptionsModified), 0644))
		require.NoError(t, os.WriteFile(tmpFile3, []byte(timelineDemoModified), 0644))

		// Copy files to provisioning path to set up test - use refRepo's path
		helper.CopyToProvisioningPath(t, tmpFile1, "move-source-1.json")
		helper.CopyToProvisioningPath(t, tmpFile2, "move-source-2.json")
		helper.CopyToProvisioningPath(t, tmpFile3, "move-source-3.json")

		// Create a unique repository for resource reference testing to avoid contamination
		const refRepo = "move-ref-test-repo"
		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       refRepo,
			SyncTarget: "folder",
			Workflows:  []string{"write"},
		})

		t.Run("move single dashboard by resource reference", func(t *testing.T) {
			spec := provisioning.JobSpec{
				Action: provisioning.JobActionMove,
				Move: &provisioning.MoveJobOptions{
					TargetPath: "moved-by-ref/",
					Resources: []provisioning.ResourceRef{
						{
							Name:  "moveref1", // UID from modified all-panels.json
							Kind:  "Dashboard",
							Group: "dashboard.grafana.app",
						},
					},
				},
			}

			helper.TriggerJobAndWaitForSuccess(t, refRepo, spec)
			// Verify corresponding file is moved in repository
			helper.RequireRepoFileExists(t, refRepo, "moved-by-ref", "move-source-1.json")

			// Verify original file is deleted from repository
			helper.RequireRepoFileNotFound(t, refRepo, "move-source-1.json")

			// Verify dashboard still exists in Grafana (should be updated after sync)
			helper.SyncAndWait(t, refRepo, nil)
			_, err = helper.DashboardsV1.Resource.Get(t.Context(), "moveref1", metav1.GetOptions{})
			require.NoError(t, err, "dashboard should still exist in Grafana after move")

			// Verify other resource still exists in original location
			helper.RequireRepoFileExists(t, refRepo, "move-source-2.json")
		})

		t.Run("move multiple resources by reference", func(t *testing.T) {
			spec := provisioning.JobSpec{
				Action: provisioning.JobActionMove,
				Move: &provisioning.MoveJobOptions{
					TargetPath: "archived-by-ref/",
					Resources: []provisioning.ResourceRef{
						{
							Name:  "moveref2", // UID from modified text-options.json
							Kind:  "Dashboard",
							Group: "dashboard.grafana.app",
						},
					},
				},
			}
			helper.TriggerJobAndWaitForSuccess(t, refRepo, spec)

			// Verify file is moved in repository
			helper.RequireRepoFileExists(t, refRepo, "archived-by-ref", "move-source-2.json")

			// Verify original file is deleted from repository
			helper.RequireRepoFileNotFound(t, refRepo, "move-source-2.json")

			// Verify dashboard still exists in Grafana after sync
			helper.SyncAndWait(t, refRepo, nil)
			_, err = helper.DashboardsV1.Resource.Get(t.Context(), "moveref2", metav1.GetOptions{})
			require.NoError(t, err, "dashboard should still exist in Grafana after move")
		})

		t.Run("move resource from nested folder to root path", func(t *testing.T) {
			// Reproduces https://github.com/grafana/git-ui-sync-project/issues/919
			// Moving a resource from an inner folder to the base folder ("/") should
			// relocate the file to root, not delete it.
			rootMoveContent := renameDashboard(t, allPanelsContent, "movetoroot1")
			tmpRootMove := filepath.Join(tmpDir, "move-to-root-test.json")
			require.NoError(t, os.WriteFile(tmpRootMove, []byte(rootMoveContent), 0644))
			helper.CopyToProvisioningPath(t, tmpRootMove, "inner-folder/move-to-root.json")

			helper.SyncAndWait(t, refRepo, nil)

			// Verify dashboard exists before the move
			_, err = helper.DashboardsV1.Resource.Get(t.Context(), "movetoroot1", metav1.GetOptions{})
			require.NoError(t, err, "dashboard should exist before move")
			helper.RequireRepoFileExists(t, refRepo, "inner-folder", "move-to-root.json")

			spec := provisioning.JobSpec{
				Action: provisioning.JobActionMove,
				Move: &provisioning.MoveJobOptions{
					TargetPath: "/",
					Resources: []provisioning.ResourceRef{
						{
							Name:  "movetoroot1",
							Kind:  "Dashboard",
							Group: "dashboard.grafana.app",
						},
					},
				},
			}

			helper.TriggerJobAndWaitForSuccess(t, refRepo, spec)
			helper.SyncAndWait(t, refRepo, nil)

			// The dashboard must NOT be deleted — it should still exist in Grafana
			_, err = helper.DashboardsV1.Resource.Get(t.Context(), "movetoroot1", metav1.GetOptions{})
			require.NoError(t, err, "dashboard should NOT be deleted when moving to root path '/'")

			// The file should now live at the repository root
			helper.RequireRepoFileExists(t, refRepo, "move-to-root.json")

			// The file should be gone from the nested folder
			helper.RequireRepoFileNotFound(t, refRepo, "inner-folder", "move-to-root.json")
		})

		t.Run("mixed move - paths and resources", func(t *testing.T) {
			// Setup fresh resources for mixed test
			tmpMixed1 := filepath.Join(tmpDir, "mixed-move-1.json")
			tmpMixed2 := filepath.Join(tmpDir, "mixed-move-2.json")

			allPanelsMixed := renameDashboard(t, allPanelsContent, "mixedmove1")
			textOptionsMixed := renameDashboard(t, textOptionsContent, "mixedmove2")

			require.NoError(t, os.WriteFile(tmpMixed1, []byte(allPanelsMixed), 0644))
			require.NoError(t, os.WriteFile(tmpMixed2, []byte(textOptionsMixed), 0644))

			helper.CopyToProvisioningPath(t, tmpMixed1, "mixed-move-1.json") // UID: mixedmove1
			helper.CopyToProvisioningPath(t, tmpMixed2, "mixed-move-2.json") // UID: mixedmove2

			helper.SyncAndWait(t, refRepo, nil)

			// Create move job that combines both paths and resource references
			spec := provisioning.JobSpec{
				Action: provisioning.JobActionMove,
				Move: &provisioning.MoveJobOptions{
					TargetPath: "mixed-target/",
					Paths:      []string{"mixed-move-1.json"}, // Move by path
					Resources: []provisioning.ResourceRef{
						{
							Name:  "mixedmove2", // Move by resource reference
							Kind:  "Dashboard",
							Group: "dashboard.grafana.app",
						},
					},
				},
			}
			helper.TriggerJobAndWaitForSuccess(t, refRepo, spec)

			// Verify both targeted resources are moved in repository
			helper.RequireRepoFileExists(t, refRepo, "mixed-target", "mixed-move-1.json")
			helper.RequireRepoFileExists(t, refRepo, "mixed-target", "mixed-move-2.json")

			// Verify files are deleted from original locations
			helper.RequireRepoFileNotFound(t, refRepo, "mixed-move-1.json")
			helper.RequireRepoFileNotFound(t, refRepo, "mixed-move-2.json")

			// Verify dashboards still exist in Grafana after sync
			helper.SyncAndWait(t, refRepo, nil)
			_, err = helper.DashboardsV1.Resource.Get(t.Context(), "mixedmove1", metav1.GetOptions{})
			require.NoError(t, err, "dashboard moved by path should still exist in Grafana")

			_, err = helper.DashboardsV1.Resource.Get(t.Context(), "mixedmove2", metav1.GetOptions{})
			require.NoError(t, err, "dashboard moved by resource ref should still exist in Grafana")
		})
	})
}

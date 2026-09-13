package jobs

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// renameDashboard rewrites a dashboard fixture's identity to name. The gdev fixtures are
// dashboard.grafana.app/v2 resources keyed by metadata.name (there is no top-level uid), so
// ResourceRef tests assign a unique name by editing the envelope rather than the legacy uid.
func renameDashboard(t *testing.T, content []byte, name string) string {
	t.Helper()
	var obj map[string]any
	require.NoError(t, json.Unmarshal(content, &obj))
	meta, ok := obj["metadata"].(map[string]any)
	require.True(t, ok, "dashboard fixture is missing a metadata object")
	meta["name"] = name
	out, err := json.Marshal(obj)
	require.NoError(t, err)
	return string(out)
}

func TestIntegrationProvisioning_DeleteJob(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "delete-job-test-repo"
	testRepo := common.TestRepo{
		Name:      repo,
		Workflows: []string{"write"},
		Copies: map[string]string{
			"../testdata/all-panels.json":    "dashboard1.json",
			"../testdata/text-options.json":  "dashboard2.json",
			"../testdata/timeline-demo.json": "folder/dashboard3.json",
		},
	}

	helper.CreateLocalRepo(t, testRepo)

	helper.RequireRepoDashboardCount(t, repo, 3)
	helper.RequireRepoFolderCount(t, repo, 1)

	t.Run("delete single file", func(t *testing.T) {
		// FIXME: make the tests in a way that we can simply have a spec and some expectations per scenario.

		// Debug state before delete
		helper.DebugState(t, repo, "BEFORE DELETE")

		// Verify file exists in repository before attempting delete
		helper.RequireRepoFileExists(t, repo, "dashboard1.json")

		spec := provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"dashboard1.json"},
			},
		}
		// Create delete job for single file
		helper.TriggerJobAndWaitForSuccess(t, repo, spec)

		// Debug state after successful delete
		helper.DebugState(t, repo, "AFTER DELETE")

		// Verify file is deleted from repository
		helper.RequireRepoFileNotFound(t, repo, "dashboard1.json")

		// Verify dashboard is removed from Grafana after sync
		helper.RequireRepoDashboardCount(t, repo, 2)

		// Verify other files still exist
		helper.RequireRepoFileExists(t, repo, "dashboard2.json")
		helper.RequireRepoFileExists(t, repo, "folder", "dashboard3.json")
	})

	t.Run("delete multiple files", func(t *testing.T) {
		spec := provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"dashboard2.json", "folder/dashboard3.json"},
			},
		}
		helper.TriggerJobAndWaitForSuccess(t, repo, spec)

		// Verify files are deleted from repository
		helper.RequireRepoFileNotFound(t, repo, "dashboard2.json")
		helper.RequireRepoFileNotFound(t, repo, "folder", "dashboard3.json")

		// Verify all dashboards are removed from Grafana after sync
		helper.RequireRepoDashboardCount(t, repo, 0)
	})

	t.Run("delete by resource reference", func(t *testing.T) {
		// FIXME: do not create this on top of the other one. Isolate the cases
		// Create modified test files with unique UIDs for ResourceRef testing
		// Read and modify the testdata files to have unique UIDs that don't conflict with existing resources
		allPanelsContent := helper.LoadFile("../testdata/all-panels.json")
		textOptionsContent := helper.LoadFile("../testdata/text-options.json")
		timelineDemoContent := helper.LoadFile("../testdata/timeline-demo.json")

		// FIXME: use generic objects
		// Modify UIDs to be unique for ResourceRef tests
		allPanelsModified := renameDashboard(t, allPanelsContent, "resourceref1")
		textOptionsModified := renameDashboard(t, textOptionsContent, "resourceref2")
		timelineDemoModified := renameDashboard(t, timelineDemoContent, "resourceref3")

		// Create temporary files and copy them to the provisioning path
		tmpDir := t.TempDir()
		tmpFile1 := filepath.Join(tmpDir, "resource-test-1.json")
		tmpFile2 := filepath.Join(tmpDir, "resource-test-2.json")
		tmpFile3 := filepath.Join(tmpDir, "resource-test-3.json")

		require.NoError(t, os.WriteFile(tmpFile1, []byte(allPanelsModified), 0644))
		require.NoError(t, os.WriteFile(tmpFile2, []byte(textOptionsModified), 0644))
		require.NoError(t, os.WriteFile(tmpFile3, []byte(timelineDemoModified), 0644))

		// Copy the temporary files to the provisioning path
		helper.CopyToProvisioningPath(t, tmpFile1, "resource-test-1.json")        // UID: resourceref1
		helper.CopyToProvisioningPath(t, tmpFile2, "resource-test-2.json")        // UID: resourceref2
		helper.CopyToProvisioningPath(t, tmpFile3, "nested/resource-test-3.json") // UID: resourceref3

		// Trigger sync to populate the new resources
		helper.SyncAndWait(t, repo, nil)

		// Verify the new resources are created
		helper.RequireRepoDashboardCount(t, repo, 3)

		t.Run("delete single dashboard by resource reference", func(t *testing.T) {
			spec := provisioning.JobSpec{
				Action: provisioning.JobActionDelete,
				Delete: &provisioning.DeleteJobOptions{
					Resources: []provisioning.ResourceRef{
						{
							Name:  "resourceref1", // UID from modified all-panels.json
							Kind:  "Dashboard",
							Group: "dashboard.grafana.app",
						},
					},
				},
			}

			helper.TriggerJobAndWaitForSuccess(t, repo, spec)

			// Verify corresponding file is deleted from repository
			helper.RequireRepoFileNotFound(t, repo, "resource-test-1.json")

			// Verify dashboard is removed from Grafana (check count like other successful tests)
			helper.RequireRepoDashboardCount(t, repo, 2)

			// Verify other resources still exist
			helper.RequireRepoFileExists(t, repo, "resource-test-2.json")
			helper.RequireRepoFileExists(t, repo, "nested", "resource-test-3.json")
		})

		t.Run("delete multiple resources by reference", func(t *testing.T) {
			spec := provisioning.JobSpec{
				Action: provisioning.JobActionDelete,
				Delete: &provisioning.DeleteJobOptions{
					Resources: []provisioning.ResourceRef{
						{
							Name:  "resourceref2", // UID from modified text-options.json
							Kind:  "Dashboard",
							Group: "dashboard.grafana.app",
						},
						{
							Name:  "resourceref3", // UID from modified timeline-demo.json
							Kind:  "Dashboard",
							Group: "dashboard.grafana.app",
						},
					},
				},
			}
			helper.TriggerJobAndWaitForSuccess(t, repo, spec)

			// Verify both dashboards are removed from Grafana
			helper.RequireDashboardsNotFound(t, "resourceref2", "resourceref3")

			// Verify corresponding files are deleted from repository
			helper.RequireRepoFileNotFound(t, repo, "resource-test-2.json")
			helper.RequireRepoFileNotFound(t, repo, "nested", "resource-test-3.json")

			// Verify specific dashboards are removed from Grafana
			helper.RequireRepoDashboardCount(t, repo, 0)
		})

		t.Run("mixed deletion - paths and resources", func(t *testing.T) {
			// FIXME: do not build this case on top of the other one. Isolate the cases
			// Setup fresh resources for mixed test - reuse the modified content with unique UIDs
			tmpMixed1 := filepath.Join(tmpDir, "mixed-test-1.json")
			tmpMixed2 := filepath.Join(tmpDir, "mixed-test-2.json")
			tmpMixed3 := filepath.Join(tmpDir, "mixed-test-3.json")

			require.NoError(t, os.WriteFile(tmpMixed1, []byte(allPanelsModified), 0644))
			require.NoError(t, os.WriteFile(tmpMixed2, []byte(textOptionsModified), 0644))
			require.NoError(t, os.WriteFile(tmpMixed3, []byte(timelineDemoModified), 0644))

			helper.CopyToProvisioningPath(t, tmpMixed1, "mixed-test-1.json") // UID: resourceref1
			helper.CopyToProvisioningPath(t, tmpMixed2, "mixed-test-2.json") // UID: resourceref2
			helper.CopyToProvisioningPath(t, tmpMixed3, "mixed-test-3.json") // UID: resourceref3

			helper.SyncAndWait(t, repo, nil)

			spec := provisioning.JobSpec{
				Action: provisioning.JobActionDelete,
				Delete: &provisioning.DeleteJobOptions{
					Paths: []string{"mixed-test-1.json"}, // Delete by path
					Resources: []provisioning.ResourceRef{
						{
							Name:  "resourceref2", // Delete by resource reference
							Kind:  "Dashboard",
							Group: "dashboard.grafana.app",
						},
					},
				},
			}

			helper.TriggerJobAndWaitForSuccess(t, repo, spec)

			// Verify both targeted resources are deleted from Grafana
			helper.RequireDashboardsNotFound(t, "resourceref1", "resourceref2")

			// Verify the untargeted resource still exists
			helper.RequireDashboards(t, "resourceref3")

			// Verify files are properly deleted/preserved in repository
			helper.RequireRepoFileNotFound(t, repo, "mixed-test-1.json")
			helper.RequireRepoFileNotFound(t, repo, "mixed-test-2.json")
			helper.RequireRepoFileExists(t, repo, "mixed-test-3.json")
		})

		t.Run("delete folder by resource reference", func(t *testing.T) {
			// FIXME: do not build this case on top of the previous one. Isolate them
			// Create a dashboard inside a folder to automatically create the folder structure
			// This follows the same pattern as other tests in this file
			testDashboard := renameDashboard(t, allPanelsContent, "folder-dash")

			// Write the modified dashboard to a temporary file first
			tmpFolderDash := filepath.Join(tmpDir, "folder-dashboard.json")
			require.NoError(t, os.WriteFile(tmpFolderDash, []byte(testDashboard), 0644))

			// Copy it to the folder structure using the helper
			helper.CopyToProvisioningPath(t, tmpFolderDash, "test-folder/dashboard-in-folder.json")

			// Sync to create the folder and its contents
			helper.SyncAndWait(t, repo, nil)

			// Verify folder was created in Grafana as a Folder resource.
			// Folder names are generated with suffixes, so resolve the folder
			// through the dashboard that lives inside it.
			dash := helper.RequireDashboards(t, "folder-dash")[0]
			testFolderName := dash.GetAnnotations()[utils.AnnoKeyFolder]
			require.True(t, strings.HasPrefix(testFolderName, "test-folder"), "test-folder should exist as a Folder resource")
			helper.RequireFolders(t, testFolderName)

			// Verify dashboard inside the folder exists
			helper.RequireRepoFileExists(t, repo, "test-folder", "dashboard-in-folder.json")

			spec := provisioning.JobSpec{
				Action: provisioning.JobActionDelete,
				Delete: &provisioning.DeleteJobOptions{
					Resources: []provisioning.ResourceRef{
						{
							Name:  testFolderName, // Use the actual generated folder name
							Kind:  "Folder",
							Group: "folder.grafana.app",
						},
					},
				},
			}
			helper.TriggerJobAndWaitForSuccess(t, repo, spec)

			// Verify folder is deleted from Grafana
			helper.RequireFoldersNotFound(t, testFolderName)

			// Verify folder contents are also deleted from repository
			helper.RequireRepoFileNotFound(t, repo, "test-folder", "dashboard-in-folder.json")
		})

		t.Run("delete non-existent resource by reference", func(t *testing.T) {
			// Create delete job for non-existent resource
			spec := provisioning.JobSpec{
				Action: provisioning.JobActionDelete,
				Delete: &provisioning.DeleteJobOptions{
					Resources: []provisioning.ResourceRef{
						{
							Name:  "non-existent-uid",
							Kind:  "Dashboard",
							Group: "dashboard.grafana.app",
						},
					},
				},
			}

			job := helper.TriggerJobAndWaitForComplete(t, repo, spec)
			state := common.MustNestedString(job.Object, "status", "state")
			assert.Equal(t, string(provisioning.JobStateWarning), state, "delete job should have warned due to non-existent file")
		})
	})

	t.Run("delete non-existent file is rejected", func(t *testing.T) {
		body := common.AsJSON(provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"non-existent.json"},
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

		require.Error(t, result.Error(), "delete job for non-existent file should be rejected at creation")
	})

	t.Run("delete mixed existing and non-existent file is rejected", func(t *testing.T) {
		helper.CopyToProvisioningPath(t, "../testdata/all-panels.json", "test-delete-mixed.json")
		helper.SyncAndWait(t, repo, nil)

		body := common.AsJSON(provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{
					"test-delete-mixed.json", // This exists
					"non-existent-file.json", // This doesn't exist
				},
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

		require.Error(t, result.Error(), "delete job with any non-existent file should be rejected at creation")
	})

	t.Run("delete multiple non-existent files is rejected", func(t *testing.T) {
		body := common.AsJSON(provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{
					"does-not-exist-1.json",
					"does-not-exist-2.json",
					"does-not-exist-3.json",
				},
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

		require.Error(t, result.Error(), "delete job for all non-existent files should be rejected at creation")
	})
}

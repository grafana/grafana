package provisioning

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_DeleteJob(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()

	const repo = "delete-job-test-repo"
	testRepo := TestRepo{
		Name: repo,
		Copies: map[string]string{
			"testdata/all-panels.json":    "dashboard1.json",
			"testdata/text-options.json":  "dashboard2.json",
			"testdata/timeline-demo.json": "folder/dashboard3.json",
		},
		ExpectedDashboards: 3,
		ExpectedFolders:    1,
	}

	helper.CreateRepo(t, testRepo)

	t.Run("delete single file", func(t *testing.T) {
		// FIXME: make the tests in a way that we can simply have a spec and some expectations per scenario.

		// Debug state before delete
		helper.DebugState(t, repo, "BEFORE DELETE")

		// Verify file exists in repository before attempting delete
		_, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "dashboard1.json")
		require.NoError(t, err, "dashboard1.json should exist in repository before delete")

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

		// FIXME: create a helper to verify repository files

		// Verify file is deleted from repository
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "dashboard1.json")
		require.Error(t, err, "file should be deleted from repository")
		require.True(t, apierrors.IsNotFound(err), "should be not found error")

		// FIXME: create a helper to verify grafana resources
		// Verify dashboard is removed from Grafana after sync
		dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Equal(t, 2, len(dashboards.Items), "should have 2 dashboards after delete")

		// Verify other files still exist
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "dashboard2.json")
		require.NoError(t, err, "other files should still exist")
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "folder", "dashboard3.json")
		require.NoError(t, err, "nested files should still exist")
	})

	t.Run("delete multiple files", func(t *testing.T) {
		spec := provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"dashboard2.json", "folder/dashboard3.json"},
			},
		}
		helper.TriggerJobAndWaitForSuccess(t, repo, spec)

		// FIXME: use helper
		// Verify files are deleted from repository
		_, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "dashboard2.json")
		require.Error(t, err, "dashboard2.json should be deleted")
		require.True(t, apierrors.IsNotFound(err))

		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "folder", "dashboard3.json")
		require.Error(t, err, "folder/dashboard3.json should be deleted")
		require.True(t, apierrors.IsNotFound(err))

		// Verify all dashboards are removed from Grafana after sync
		dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Equal(t, 0, len(dashboards.Items), "should have 0 dashboards after deleting all")
	})

	t.Run("delete by resource reference", func(t *testing.T) {
		// FIXME: do not create this on top of the other one. Isolate the cases
		// Create modified test files with unique UIDs for ResourceRef testing
		// Read and modify the testdata files to have unique UIDs that don't conflict with existing resources
		allPanelsContent := helper.LoadFile("testdata/all-panels.json")
		textOptionsContent := helper.LoadFile("testdata/text-options.json")
		timelineDemoContent := helper.LoadFile("testdata/timeline-demo.json")

		// FIXME: use generic objects
		// Modify UIDs to be unique for ResourceRef tests
		allPanelsModified := strings.Replace(string(allPanelsContent), `"uid": "n1jR8vnnz"`, `"uid": "resourceref1"`, 1)
		textOptionsModified := strings.Replace(string(textOptionsContent), `"uid": "WZ7AhQiVz"`, `"uid": "resourceref2"`, 1)
		timelineDemoModified := strings.Replace(string(timelineDemoContent), `"uid": "mIJjFy8Kz"`, `"uid": "resourceref3"`, 1)

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
		dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.GreaterOrEqual(t, len(dashboards.Items), 3, "should have at least 3 dashboards after adding test resources")

		// Debug: print the actual dashboard names/UIDs to verify they match our expectations
		for i, dashboard := range dashboards.Items {
			t.Logf("Dashboard %d: name=%s, UID=%s", i+1, dashboard.GetName(), dashboard.GetUID())
		}

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

			// FIXME: use helpers
			// Verify corresponding file is deleted from repository
			_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "resource-test-1.json")
			require.Error(t, err, "file should be deleted from repository")
			require.True(t, apierrors.IsNotFound(err), "should be not found error")

			// Verify dashboard is removed from Grafana (check count like other successful tests)
			dashboards, err = helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.Equal(t, 2, len(dashboards.Items), "should have 2 dashboards after deleting 1 from 3")

			// Verify other resources still exist
			_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "resource-test-2.json")
			require.NoError(t, err, "other files should still exist")
			_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "nested", "resource-test-3.json")
			require.NoError(t, err, "nested files should still exist")
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

			// FIXME: use helpers
			// Verify both dashboards are removed from Grafana
			_, err = helper.DashboardsV1.Resource.Get(ctx, "resourceref2", metav1.GetOptions{})
			require.Error(t, err, "text-options dashboard should be deleted")
			require.True(t, apierrors.IsNotFound(err))

			_, err = helper.DashboardsV1.Resource.Get(ctx, "resourceref3", metav1.GetOptions{})
			require.Error(t, err, "timeline-demo dashboard should be deleted")
			require.True(t, apierrors.IsNotFound(err))

			// Verify corresponding files are deleted from repository
			_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "resource-test-2.json")
			require.Error(t, err, "resource-test-2.json should be deleted")

			_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "nested", "resource-test-3.json")
			require.Error(t, err, "nested/resource-test-3.json should be deleted")

			// Verify specific dashboards are removed from Grafana
			dashboards, err = helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.Equal(t, 0, len(dashboards.Items), "should have 0 dashboards after deleting 2 more (2 -> 0)")
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

			// FIXME: use the helpers
			// Verify both targeted resources are deleted from Grafana
			_, err = helper.DashboardsV1.Resource.Get(ctx, "resourceref1", metav1.GetOptions{})
			require.Error(t, err, "dashboard deleted by path should be removed")

			_, err = helper.DashboardsV1.Resource.Get(ctx, "resourceref2", metav1.GetOptions{})
			require.Error(t, err, "dashboard deleted by resource ref should be removed")

			// Verify the untargeted resource still exists
			_, err = helper.DashboardsV1.Resource.Get(ctx, "resourceref3", metav1.GetOptions{})
			require.NoError(t, err, "untargeted dashboard should still exist")

			// Verify files are properly deleted/preserved in repository
			_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "mixed-test-1.json")
			require.Error(t, err, "file deleted by path should be removed")

			_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "mixed-test-2.json")
			require.Error(t, err, "file for resource deleted by ref should be removed")

			_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "mixed-test-3.json")
			require.NoError(t, err, "untargeted file should still exist")
		})

		t.Run("delete folder by resource reference", func(t *testing.T) {
			// FIXME: do not build this case on top of the previous one. Isolate them
			// Create a dashboard inside a folder to automatically create the folder structure
			// This follows the same pattern as other tests in this file
			testDashboard := strings.Replace(string(allPanelsContent), `"uid": "n1jR8vnnz"`, `"uid": "folder-dash"`, 1)

			// Write the modified dashboard to a temporary file first
			tmpFolderDash := filepath.Join(tmpDir, "folder-dashboard.json")
			require.NoError(t, os.WriteFile(tmpFolderDash, []byte(testDashboard), 0644))

			// Copy it to the folder structure using the helper
			helper.CopyToProvisioningPath(t, tmpFolderDash, "test-folder/dashboard-in-folder.json")

			// Sync to create the folder and its contents
			helper.SyncAndWait(t, repo, nil)

			// Verify folder was created in Grafana as a Folder resource
			folders, err := helper.Folders.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)

			var testFolder *unstructured.Unstructured
			for _, folder := range folders.Items {
				// Folder names are generated with suffixes, so check if it starts with "test-folder"
				if strings.HasPrefix(folder.GetName(), "test-folder") {
					testFolder = &folder
					break
				}
			}
			require.NotNil(t, testFolder, "test-folder should exist as a Folder resource")
			testFolderName := testFolder.GetName()

			// Verify dashboard inside the folder exists
			_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "test-folder", "dashboard-in-folder.json")
			require.NoError(t, err, "dashboard inside folder should exist")

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

			// FIXME: use helpers
			// Verify folder is deleted from Grafana
			_, err = helper.Folders.Resource.Get(ctx, testFolderName, metav1.GetOptions{})
			require.Error(t, err, "folder should be deleted from Grafana")
			require.True(t, apierrors.IsNotFound(err), "should be not found error")

			// Verify folder contents are also deleted from repository
			_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "test-folder", "dashboard-in-folder.json")
			require.Error(t, err, "dashboard inside deleted folder should also be deleted")
			require.True(t, apierrors.IsNotFound(err), "should be not found error")
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
			state := mustNestedString(job.Object, "status", "state")
			assert.Equal(t, "error", state, "delete job should have failed due to non-existent file")
		})
	})

	t.Run("delete non-existent file", func(t *testing.T) {
		spec := provisioning.JobSpec{
			Action: provisioning.JobActionDelete,
			Delete: &provisioning.DeleteJobOptions{
				Paths: []string{"non-existent.json"},
			},
		}

		job := helper.TriggerJobAndWaitForComplete(t, repo, spec)
		state := mustNestedString(job.Object, "status", "state")
		assert.Equal(t, "error", state, "delete job should have failed due to non-existent file")
	})
}

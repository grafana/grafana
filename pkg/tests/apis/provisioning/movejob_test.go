package provisioning

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestIntegrationProvisioning_MoveJob(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := runGrafana(t)
	ctx := context.Background()
	const repo = "move-test-repo"
	localTmp := helper.RenderObject(t, "testdata/local-write.json.tmpl", map[string]any{
		"Name":        repo,
		"SyncEnabled": true,
		"SyncTarget":  "instance",
	})
	_, err := helper.Repositories.Resource.Create(ctx, localTmp, metav1.CreateOptions{})
	require.NoError(t, err)
	// Copy multiple test files to the repository
	helper.CopyToProvisioningPath(t, "testdata/all-panels.json", "dashboard1.json")
	helper.CopyToProvisioningPath(t, "testdata/text-options.json", "dashboard2.json")
	helper.CopyToProvisioningPath(t, "testdata/timeline-demo.json", "folder/dashboard3.json")
	// Trigger and wait for initial sync to populate resources
	helper.SyncAndWait(t, repo, nil)
	// Verify initial state - should have 3 dashboards and 1 folder
	dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err)
	require.Equal(t, 3, len(dashboards.Items), "should have 3 dashboards after sync")
	folders, err := helper.Folders.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err)
	require.Equal(t, 1, len(folders.Items), "should have 1 folder after sync")

	t.Run("move single file", func(t *testing.T) {
		// Create move job for single file
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(asJSON(&provisioning.JobSpec{
				Action: provisioning.JobActionMove,
				Move: &provisioning.MoveJobOptions{
					Paths:      []string{"dashboard1.json"},
					TargetPath: "moved/",
				},
			})).
			SetHeader("Content-Type", "application/json").
			Do(ctx)
		require.NoError(t, result.Error(), "should be able to create move job")

		raw, err := result.Raw()
		require.NoError(t, err)

		obj := &unstructured.Unstructured{}
		err = json.Unmarshal(raw, obj)
		require.NoError(t, err)

		// Wait for job to complete
		helper.AwaitJobSuccess(t, ctx, obj)

		// TODO: This additional sync should not be necessary - the move job should handle sync properly
		helper.SyncAndWait(t, repo, nil)

		// Verify file is moved in repository
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "moved", "dashboard1.json")
		require.NoError(t, err, "file should exist at new location in repository")

		// Verify original file is gone from repository
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "dashboard1.json")
		require.Error(t, err, "original file should be gone from repository")
		require.True(t, apierrors.IsNotFound(err), "should be not found error")

		// Verify other files still exist at original locations
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "dashboard2.json")
		require.NoError(t, err, "other files should still exist")
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "folder", "dashboard3.json")
		require.NoError(t, err, "nested files should still exist")

		// Verify dashboard still exists in Grafana after sync
		// Use eventually to let unified storage reflect the changes in dashboards.
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
			assert.NoError(collect, err)
			assert.Len(collect, dashboards.Items, 3, "should still have 3 dashboards after move")
			// Verify that dashboards have the correct source paths
			foundPaths := make(map[string]bool)
			for _, dashboard := range dashboards.Items {
				sourcePath := dashboard.GetAnnotations()["grafana.app/sourcePath"]
				foundPaths[sourcePath] = true
			}

			assert.True(t, foundPaths["moved/dashboard1.json"], "should have dashboard with moved source path")
			assert.True(t, foundPaths["dashboard2.json"], "should have dashboard2 in original location")
			assert.True(t, foundPaths["folder/dashboard3.json"], "should have dashboard3 in original nested location")
		}, time.Second*10, time.Millisecond*100, "Expected to eventually have 3 dashboards after move")
	})

	t.Run("move multiple files and folder", func(t *testing.T) {
		// Create move job for multiple files including a folder
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(asJSON(&provisioning.JobSpec{
				Action: provisioning.JobActionMove,
				Move: &provisioning.MoveJobOptions{
					Paths:      []string{"dashboard2.json", "folder/"},
					TargetPath: "archived/",
				},
			})).
			SetHeader("Content-Type", "application/json").
			Do(ctx)
		require.NoError(t, result.Error(), "should be able to create move job")

		raw, err := result.Raw()
		require.NoError(t, err)
		obj := &unstructured.Unstructured{}
		err = json.Unmarshal(raw, obj)
		require.NoError(t, err)

		// Wait for job to complete
		helper.AwaitJobSuccess(t, ctx, obj)

		// TODO: This additional sync should not be necessary - the move job should handle sync properly
		helper.SyncAndWait(t, repo, nil)

		// Verify files are moved in repository
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "archived", "dashboard2.json")
		require.NoError(t, err, "dashboard2.json should exist at new location")
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "archived", "folder", "dashboard3.json")
		require.NoError(t, err, "folder/dashboard3.json should exist at new nested location")

		// Verify original files are gone from repository
		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "dashboard2.json")
		require.Error(t, err, "dashboard2.json should be gone from original location")
		require.True(t, apierrors.IsNotFound(err))

		_, err = helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "folder", "dashboard3.json")
		require.Error(t, err, "folder should be gone from original location")
		require.True(t, apierrors.IsNotFound(err), err.Error())

		// Verify dashboards still exist in Grafana after sync
		// Note: Since dashboard1.json was moved in the previous test, we now expect all 3 dashboards
		// to be accessible from their moved locations (dashboard1 from moved/, dashboard2 and dashboard3 from archived/)
		dashboards, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Len(t, dashboards.Items, 3, "should still have 3 dashboards after move")

		// Verify that dashboards have the correct source paths after cumulative moves
		foundPaths := make(map[string]bool)
		for _, dashboard := range dashboards.Items {
			sourcePath := dashboard.GetAnnotations()["grafana.app/sourcePath"]
			foundPaths[sourcePath] = true
		}

		require.True(t, foundPaths["moved/dashboard1.json"], "should have dashboard1 from first move")
		require.True(t, foundPaths["archived/dashboard2.json"], "should have dashboard2 in archived location")
		require.True(t, foundPaths["archived/folder/dashboard3.json"], "should have dashboard3 in archived nested location")
	})

	t.Run("move non-existent file", func(t *testing.T) {
		// Create move job for non-existent file
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(asJSON(&provisioning.JobSpec{
				Action: provisioning.JobActionMove,
				Move: &provisioning.MoveJobOptions{
					Paths:      []string{"non-existent.json"},
					TargetPath: "moved/",
				},
			})).
			SetHeader("Content-Type", "application/json").
			Do(ctx)
		require.NoError(t, result.Error(), "should be able to create move job")

		// Wait for job to complete - should fail due to strict error handling
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			list := &unstructured.UnstructuredList{}
			err := helper.AdminREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("jobs").
				Do(ctx).Into(list)
			assert.NoError(collect, err, "should be able to list jobs")
			assert.NotEmpty(collect, list.Items, "expect at least one job")

			// Find the move job specifically
			var moveJob *unstructured.Unstructured
			for _, elem := range list.Items {
				assert.Equal(collect, repo, elem.GetLabels()["provisioning.grafana.app/repository"], "should have repo label")

				action := mustNestedString(elem.Object, "spec", "action")
				if action == "move" {
					// Check if this is the specific job we're looking for
					paths, found, err := unstructured.NestedStringSlice(elem.Object, "spec", "move", "paths")
					if err == nil && found && len(paths) > 0 && paths[0] == "non-existent.json" {
						moveJob = &elem
						break
					}
				}
			}
			assert.NotNil(collect, moveJob, "should find a move job for non-existent file")

			state := mustNestedString(moveJob.Object, "status", "state")
			assert.Equal(collect, "error", state, "move job should have failed due to non-existent file")
		}, time.Second*10, time.Millisecond*100, "Expected move job to fail with error state")
	})

	t.Run("move without target path", func(t *testing.T) {
		// Create move job without target path (should fail)
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("jobs").
			Body(asJSON(&provisioning.JobSpec{
				Action: provisioning.JobActionMove,
				Move: &provisioning.MoveJobOptions{
					Paths: []string{"moved/dashboard1.json"},
					// TargetPath intentionally omitted
				},
			})).
			SetHeader("Content-Type", "application/json").
			Do(ctx)
		require.NoError(t, result.Error(), "should be able to create move job")

		// Wait for job to complete - should fail due to missing target path
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			list := &unstructured.UnstructuredList{}
			err := helper.AdminREST.Get().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("jobs").
				Do(ctx).Into(list)
			assert.NoError(collect, err, "should be able to list jobs")
			assert.NotEmpty(collect, list.Items, "expect at least one job")

			// Find the move job specifically
			var moveJob *unstructured.Unstructured
			for _, elem := range list.Items {
				assert.Equal(collect, repo, elem.GetLabels()["provisioning.grafana.app/repository"], "should have repo label")

				action := mustNestedString(elem.Object, "spec", "action")
				if action == "move" {
					// Check if this is the job without target path
					targetPath, found, _ := unstructured.NestedString(elem.Object, "spec", "move", "targetPath")
					if !found || targetPath == "" {
						moveJob = &elem
						break
					}
				}
			}
			assert.NotNil(collect, moveJob, "should find a move job without target path")

			state := mustNestedString(moveJob.Object, "status", "state")
			assert.Equal(collect, "error", state, "move job should have failed due to missing target path")
		}, time.Second*10, time.Millisecond*100, "Expected move job to fail with error state")
	})

	t.Run("move by resource reference", func(t *testing.T) {
		// Create a unique repository for resource reference testing to avoid contamination
		const refRepo = "move-ref-test-repo"
		localRefTmp := helper.RenderObject(t, "testdata/local-write.json.tmpl", map[string]any{
			"Name":        refRepo,
			"SyncEnabled": true,
			"SyncTarget":  "folder",
		})
		_, err := helper.Repositories.Resource.Create(ctx, localRefTmp, metav1.CreateOptions{})
		require.NoError(t, err)

		// Create modified test files with unique UIDs for ResourceRef testing
		allPanelsContent := helper.LoadFile("testdata/all-panels.json")
		textOptionsContent := helper.LoadFile("testdata/text-options.json")
		timelineDemoContent := helper.LoadFile("testdata/timeline-demo.json")

		// Modify UIDs to be unique for ResourceRef tests
		allPanelsModified := strings.Replace(string(allPanelsContent), `"uid": "n1jR8vnnz"`, `"uid": "moveref1"`, 1)
		textOptionsModified := strings.Replace(string(textOptionsContent), `"uid": "WZ7AhQiVz"`, `"uid": "moveref2"`, 1)
		timelineDemoModified := strings.Replace(string(timelineDemoContent), `"uid": "mIJjFy8Kz"`, `"uid": "moveref3"`, 1)

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

		// Sync to populate resources in Grafana
		helper.SyncAndWait(t, refRepo, nil)

		t.Run("move single dashboard by resource reference", func(t *testing.T) {
			// Create move job for single dashboard using ResourceRef
			result := helper.AdminREST.Post().
				Namespace("default").
				Resource("repositories").
				Name(refRepo).
				SubResource("jobs").
				Body(asJSON(&provisioning.JobSpec{
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
				})).
				SetHeader("Content-Type", "application/json").
				Do(ctx)
			require.NoError(t, result.Error(), "should be able to create move job with ResourceRef")

			// Wait for job to complete
			helper.AwaitJobs(t, refRepo)

			// Verify corresponding file is moved in repository
			_, err = helper.Repositories.Resource.Get(ctx, refRepo, metav1.GetOptions{}, "files", "moved-by-ref", "move-source-1.json")
			require.NoError(t, err, "file should be moved to new location in repository")

			// Verify original file is deleted from repository
			_, err = helper.Repositories.Resource.Get(ctx, refRepo, metav1.GetOptions{}, "files", "move-source-1.json")
			require.Error(t, err, "original file should be deleted from repository")
			require.True(t, apierrors.IsNotFound(err), "should be not found error")

			// Verify dashboard still exists in Grafana (should be updated after sync)
			helper.SyncAndWait(t, refRepo, nil)
			_, err = helper.DashboardsV1.Resource.Get(ctx, "moveref1", metav1.GetOptions{})
			require.NoError(t, err, "dashboard should still exist in Grafana after move")

			// Verify other resource still exists in original location
			_, err = helper.Repositories.Resource.Get(ctx, refRepo, metav1.GetOptions{}, "files", "move-source-2.json")
			require.NoError(t, err, "other files should still exist in original location")
		})

		t.Run("move multiple resources by reference", func(t *testing.T) {
			// Create move job for remaining resource using ResourceRef
			result := helper.AdminREST.Post().
				Namespace("default").
				Resource("repositories").
				Name(refRepo).
				SubResource("jobs").
				Body(asJSON(&provisioning.JobSpec{
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
				})).
				SetHeader("Content-Type", "application/json").
				Do(ctx)
			require.NoError(t, result.Error(), "should be able to create move job with ResourceRef")

			// Wait for job to complete
			helper.AwaitJobs(t, refRepo)

			// Verify file is moved in repository
			_, err = helper.Repositories.Resource.Get(ctx, refRepo, metav1.GetOptions{}, "files", "archived-by-ref", "move-source-2.json")
			require.NoError(t, err, "file should be moved to new location")

			// Verify original file is deleted from repository
			_, err = helper.Repositories.Resource.Get(ctx, refRepo, metav1.GetOptions{}, "files", "move-source-2.json")
			require.Error(t, err, "original file should be deleted from repository")
			require.True(t, apierrors.IsNotFound(err), "should be not found error")

			// Verify dashboard still exists in Grafana after sync
			helper.SyncAndWait(t, refRepo, nil)
			_, err = helper.DashboardsV1.Resource.Get(ctx, "moveref2", metav1.GetOptions{})
			require.NoError(t, err, "dashboard should still exist in Grafana after move")
		})

		t.Run("mixed move - paths and resources", func(t *testing.T) {
			// Setup fresh resources for mixed test
			tmpMixed1 := filepath.Join(tmpDir, "mixed-move-1.json")
			tmpMixed2 := filepath.Join(tmpDir, "mixed-move-2.json")

			allPanelsMixed := strings.Replace(string(allPanelsContent), `"uid": "n1jR8vnnz"`, `"uid": "mixedmove1"`, 1)
			textOptionsMixed := strings.Replace(string(textOptionsContent), `"uid": "WZ7AhQiVz"`, `"uid": "mixedmove2"`, 1)

			require.NoError(t, os.WriteFile(tmpMixed1, []byte(allPanelsMixed), 0644))
			require.NoError(t, os.WriteFile(tmpMixed2, []byte(textOptionsMixed), 0644))

			helper.CopyToProvisioningPath(t, tmpMixed1, "mixed-move-1.json") // UID: mixedmove1
			helper.CopyToProvisioningPath(t, tmpMixed2, "mixed-move-2.json") // UID: mixedmove2

			helper.SyncAndWait(t, refRepo, nil)

			// Create move job that combines both paths and resource references
			result := helper.AdminREST.Post().
				Namespace("default").
				Resource("repositories").
				Name(refRepo).
				SubResource("jobs").
				Body(asJSON(&provisioning.JobSpec{
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
				})).
				SetHeader("Content-Type", "application/json").
				Do(ctx)
			require.NoError(t, result.Error(), "should be able to create mixed move job")

			// Wait for job to complete
			helper.AwaitJobs(t, refRepo)

			// Verify both targeted resources are moved in repository
			_, err = helper.Repositories.Resource.Get(ctx, refRepo, metav1.GetOptions{}, "files", "mixed-target", "mixed-move-1.json")
			require.NoError(t, err, "file moved by path should exist at new location")

			_, err = helper.Repositories.Resource.Get(ctx, refRepo, metav1.GetOptions{}, "files", "mixed-target", "mixed-move-2.json")
			require.NoError(t, err, "file moved by resource ref should exist at new location")

			// Verify files are deleted from original locations
			_, err = helper.Repositories.Resource.Get(ctx, refRepo, metav1.GetOptions{}, "files", "mixed-move-1.json")
			require.Error(t, err, "file moved by path should be deleted from original location")

			_, err = helper.Repositories.Resource.Get(ctx, refRepo, metav1.GetOptions{}, "files", "mixed-move-2.json")
			require.Error(t, err, "file moved by resource ref should be deleted from original location")

			// Verify dashboards still exist in Grafana after sync
			helper.SyncAndWait(t, refRepo, nil)
			_, err = helper.DashboardsV1.Resource.Get(ctx, "mixedmove1", metav1.GetOptions{})
			require.NoError(t, err, "dashboard moved by path should still exist in Grafana")

			_, err = helper.DashboardsV1.Resource.Get(ctx, "mixedmove2", metav1.GetOptions{})
			require.NoError(t, err, "dashboard moved by resource ref should still exist in Grafana")
		})
	})
}

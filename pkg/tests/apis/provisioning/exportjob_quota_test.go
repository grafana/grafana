package provisioning

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_ExportQuota(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("export succeeds when resources are within quota", func(t *testing.T) {
		helper := runGrafana(t, func(opts *testinfra.GrafanaOpts) {
			opts.ProvisioningMaxResourcesPerRepository = 10
		})
		ctx := context.Background()

		// Create 2 unmanaged dashboards directly in Grafana
		dashboard1 := helper.LoadYAMLOrJSONFile("exportunifiedtorepository/dashboard-test-v1.yaml")
		_, err := helper.DashboardsV1.Resource.Create(ctx, dashboard1, metav1.CreateOptions{})
		require.NoError(t, err, "should be able to create first dashboard")

		dashboard2 := helper.LoadYAMLOrJSONFile("exportunifiedtorepository/dashboard-test-v0.yaml")
		_, err = helper.DashboardsV0.Resource.Create(ctx, dashboard2, metav1.CreateOptions{})
		require.NoError(t, err, "should be able to create second dashboard")

		// Create an empty repository with instance target for export
		const repo = "export-quota-success"
		testRepo := TestRepo{
			Name:               repo,
			Target:             "instance",
			Copies:             map[string]string{},
			ExpectedDashboards: 2,
			ExpectedFolders:    0,
		}
		helper.CreateRepo(t, testRepo)

		// Wait for quota reconciliation to confirm limits are set on the repository
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonWithinQuota)

		// Export should succeed: 2 dashboards + 0 folders = 2 resources <= quota of 10
		spec := provisioning.JobSpec{
			Action: provisioning.JobActionPush,
			Push: &provisioning.ExportJobOptions{
				Folder: "",
				Path:   "",
			},
		}
		helper.TriggerJobAndWaitForSuccess(t, repo, spec)

		// Verify files were actually exported to the provisioning path
		files, err := countFilesInDir(helper.ProvisioningPath)
		require.NoError(t, err)
		require.Greater(t, files, 0, "should have exported dashboard files")
	})

	t.Run("export fails when existing resources already exceed the quota", func(t *testing.T) {
		helper := runGrafana(t, func(opts *testinfra.GrafanaOpts) {
			opts.ProvisioningMaxResourcesPerRepository = 1
		})
		ctx := context.Background()

		// Create 2 unmanaged dashboards — these alone will exceed the quota of 1
		dashboard1 := helper.LoadYAMLOrJSONFile("exportunifiedtorepository/dashboard-test-v1.yaml")
		_, err := helper.DashboardsV1.Resource.Create(ctx, dashboard1, metav1.CreateOptions{})
		require.NoError(t, err, "should be able to create first dashboard")

		dashboard2 := helper.LoadYAMLOrJSONFile("exportunifiedtorepository/dashboard-test-v0.yaml")
		_, err = helper.DashboardsV0.Resource.Create(ctx, dashboard2, metav1.CreateOptions{})
		require.NoError(t, err, "should be able to create second dashboard")

		const repo = "export-quota-resources-exceeded"
		testRepo := TestRepo{
			Name:               repo,
			Target:             "instance",
			Copies:             map[string]string{},
			ExpectedDashboards: 2,
			ExpectedFolders:    0,
		}
		helper.CreateRepo(t, testRepo)

		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonWithinQuota)

		// Export should fail: 2 dashboards + 0 folders = 2 resources > quota of 1
		spec := provisioning.JobSpec{
			Action: provisioning.JobActionPush,
			Push: &provisioning.ExportJobOptions{
				Folder: "",
				Path:   "",
			},
		}
		job := helper.TriggerJobAndWaitForComplete(t, repo, spec)

		jobObj := &provisioning.Job{}
		err = runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj)
		require.NoError(t, err)

		require.Equal(t, provisioning.JobStateError, jobObj.Status.State,
			"export job should fail when resources exceed quota")
		require.Equal(t, "export would exceed quota: 2/1 resources", jobObj.Status.Message,
			"error message should report the exact resource count vs quota limit")

		// Verify no files were exported since quota check happens before any writes
		files, err := countFilesInDir(helper.ProvisioningPath)
		require.NoError(t, err)
		require.Equal(t, 0, files, "should not have exported any files when quota is exceeded")
	})

	t.Run("export fails when exceeding folders and resources already exceed the quota", func(t *testing.T) {
		helper := runGrafana(t, func(opts *testinfra.GrafanaOpts) {
			opts.ProvisioningMaxResourcesPerRepository = 2
		})
		ctx := context.Background()

		// Create 1 unmanaged dashboard (alone would fit in quota of 2)
		dashboard := helper.LoadYAMLOrJSONFile("exportunifiedtorepository/dashboard-test-v1.yaml")
		_, err := helper.DashboardsV1.Resource.Create(ctx, dashboard, metav1.CreateOptions{})
		require.NoError(t, err, "should be able to create dashboard")

		// Create 2 unmanaged folders — together with the dashboard, the total
		// becomes 1 dashboard + 2 folders = 3 resources which exceeds the quota of 2.
		for i, name := range []string{"export-test-folder-1", "export-test-folder-2"} {
			folderObj := &unstructured.Unstructured{
				Object: map[string]interface{}{
					"apiVersion": foldersV1.FolderResourceInfo.GroupVersion().String(),
					"kind":       foldersV1.FolderResourceInfo.GroupVersionKind().Kind,
					"metadata": map[string]interface{}{
						"name": name,
					},
					"spec": map[string]interface{}{
						"title": fmt.Sprintf("Export Test Folder %d", i+1),
					},
				},
			}
			_, err = helper.Folders.Resource.Create(ctx, folderObj, metav1.CreateOptions{})
			require.NoError(t, err, "should be able to create folder %s", name)
		}

		const repo = "export-quota-folders-exceeded"
		testRepo := TestRepo{
			Name:               repo,
			Target:             "instance",
			Copies:             map[string]string{},
			ExpectedDashboards: 1,
			ExpectedFolders:    2,
		}
		helper.CreateRepo(t, testRepo)

		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonWithinQuota)

		// Export should fail: 1 dashboard + 2 folders = 3 resources > quota of 2
		spec := provisioning.JobSpec{
			Action: provisioning.JobActionPush,
			Push: &provisioning.ExportJobOptions{
				Folder: "",
				Path:   "",
			},
		}
		job := helper.TriggerJobAndWaitForComplete(t, repo, spec)

		jobObj := &provisioning.Job{}
		err = runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj)
		require.NoError(t, err)

		require.Equal(t, provisioning.JobStateError, jobObj.Status.State,
			"export job should fail when folders push total over quota")
		require.Equal(t, "export would exceed quota: 3/2 resources", jobObj.Status.Message,
			"error message should report the exact resource count vs quota limit")

		// Verify no files were exported since quota check happens before any writes
		files, err := countFilesInDir(helper.ProvisioningPath)
		require.NoError(t, err)
		require.Equal(t, 0, files, "should not have exported any files when quota is exceeded due to folders")
	})
}

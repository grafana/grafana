package quota

import (
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_ExportQuota(t *testing.T) {
	t.Run("export succeeds when resources are within quota", func(t *testing.T) {
		helper := sharedHelper(t)
		helper.SetQuotaStatus(provisioning.QuotaStatus{MaxResourcesPerRepository: 10})

		// Create 2 unmanaged dashboards directly in Grafana
		dashboard1 := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v1.yaml")
		created1, err := helper.DashboardsV1.Resource.Create(t.Context(), dashboard1, metav1.CreateOptions{})
		require.NoError(t, err, "should be able to create first dashboard")

		dashboard2 := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v0.yaml")
		created2, err := helper.DashboardsV0.Resource.Create(t.Context(), dashboard2, metav1.CreateOptions{})
		require.NoError(t, err, "should be able to create second dashboard")

		// Create an empty repository with instance target for export
		const repo = "export-quota-success"
		testRepo := common.TestRepo{
			Name:       repo,
			SyncTarget: "instance",
			Workflows:  []string{"write"},
			Copies:     map[string]string{},
		}
		helper.CreateLocalRepo(t, testRepo)

		helper.RequireDashboards(t, created1.GetName(), created2.GetName())
		helper.RequireRepoFolderCount(t, repo, 0)

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
		files, err := common.CountFilesInDir(helper.ProvisioningPath)
		require.NoError(t, err)
		require.Greater(t, files, 0, "should have exported dashboard files")
	})

	// The export writes everything the repository will manage; the quota is charged when the pull
	// takes ownership, so going over it skips resources there rather than refusing the export.
	t.Run("export over quota writes the files and the pull takes over what fits", func(t *testing.T) {
		helper := sharedHelper(t)
		helper.SetQuotaStatus(provisioning.QuotaStatus{MaxResourcesPerRepository: 1})

		// Create 2 unmanaged dashboards — these alone will exceed the quota of 1
		dashboard1 := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v1.yaml")
		created1, err := helper.DashboardsV1.Resource.Create(t.Context(), dashboard1, metav1.CreateOptions{})
		require.NoError(t, err, "should be able to create first dashboard")

		dashboard2 := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v0.yaml")
		created2, err := helper.DashboardsV0.Resource.Create(t.Context(), dashboard2, metav1.CreateOptions{})
		require.NoError(t, err, "should be able to create second dashboard")

		const repo = "export-quota-resources-exceeded"
		testRepo := common.TestRepo{
			Name:       repo,
			SyncTarget: "instance",
			Workflows:  []string{"write"},
			Copies:     map[string]string{},
		}
		helper.CreateLocalRepo(t, testRepo)

		helper.RequireDashboards(t, created1.GetName(), created2.GetName())
		helper.RequireRepoFolderCount(t, repo, 0)

		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonWithinQuota)

		helper.TriggerJobAndWaitForSuccess(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPush,
			Push: &provisioning.ExportJobOptions{
				Folder: "",
				Path:   "",
			},
		})

		files, err := common.CountFilesInDir(helper.ProvisioningPath)
		require.NoError(t, err)
		require.Equal(t, 2, files, "both dashboards should be in the repository, quota or not")

		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})

		jobObj := &provisioning.Job{}
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
			"the pull should warn for what it could not take over, not fail")
		require.Empty(t, jobObj.Status.Errors, "quota-skipped resources are warnings, not errors")
		require.Equal(t, 1, quotaWarnings(jobObj.Status.Warnings),
			"exactly one of the two dashboards should be skipped by the quota of 1")

		helper.RequireRepoDashboardCount(t, repo, 1)
		helper.WaitForConditionReason(t, repo, provisioning.ConditionTypePullStatus, provisioning.ReasonQuotaExceeded)
	})

	t.Run("export is not refused when folders push the total over quota", func(t *testing.T) {
		helper := sharedHelper(t)
		helper.SetQuotaStatus(provisioning.QuotaStatus{MaxResourcesPerRepository: 2})

		// Create 1 unmanaged dashboard (alone would fit in quota of 2)
		dashboard := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v1.yaml")
		createdDash, err := helper.DashboardsV1.Resource.Create(t.Context(), dashboard, metav1.CreateOptions{})
		require.NoError(t, err, "should be able to create dashboard")

		// Create 2 unmanaged folders — together with the dashboard, the total
		// becomes 1 dashboard + 2 folders = 3 resources which exceeds the quota of 2.
		folderNames := []string{"export-test-folder-1", "export-test-folder-2"}
		for i, name := range folderNames {
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
			_, err = helper.Folders.Resource.Create(t.Context(), folderObj, metav1.CreateOptions{})
			require.NoError(t, err, "should be able to create folder %s", name)
		}

		const repo = "export-quota-folders-exceeded"
		testRepo := common.TestRepo{
			Name:       repo,
			SyncTarget: "instance",
			Workflows:  []string{"write"},
			Copies:     map[string]string{},
		}
		helper.CreateLocalRepo(t, testRepo)

		helper.RequireDashboards(t, createdDash.GetName())
		helper.RequireFolders(t, folderNames...)

		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonWithinQuota)

		helper.TriggerJobAndWaitForSuccess(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPush,
			Push: &provisioning.ExportJobOptions{
				Folder: "",
				Path:   "",
			},
		})

		files, err := common.CountFilesInDir(helper.ProvisioningPath)
		require.NoError(t, err)
		require.Equal(t, 3, files, "the dashboard and both folders should be in the repository")

		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})

		jobObj := &provisioning.Job{}
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
			"the pull should warn for what it could not take over, not fail")
		require.Empty(t, jobObj.Status.Errors, "skipped resources are warnings, not errors")
		// The quota is not what limits this one: an unmanaged folder cannot be taken over by a
		// repository at all, so both folders warn and only the dashboard is taken over. What the
		// case pins is that counting them no longer refuses the export.
		require.Len(t, jobObj.Status.Warnings, 2, "both pre-existing folders should warn")
		require.Zero(t, quotaWarnings(jobObj.Status.Warnings),
			"the folders are refused as unmanaged, before the quota of 2 can bind")

		helper.RequireRepoDashboardCount(t, repo, 1)
		require.Empty(t, helper.ListRepoFolders(t, repo), "an unmanaged folder is not taken over")
	})
}

// quotaWarnings counts the job warnings the quota tracker records for a creation it skipped.
func quotaWarnings(warnings []string) int {
	var n int
	for _, w := range warnings {
		if strings.Contains(w, "resource quota exceeded") {
			n++
		}
	}
	return n
}

package git

import (
	"strings"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestIntegrationProvisioning_IncrementalSync_FolderMetadataOnlyDeletion(t *testing.T) {
	helper := sharedGitHelper(t)

	const repoName = "incr-meta-only-delete"
	const stableUID = "meta-only-delete-folder"
	const folderTitle = "Team dashboards"
	const metadataPath = "team/_folder.json"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		metadataPath:       common.FolderBody(t, stableUID, folderTitle),
		"team/first.json":  common.DashboardJSON("meta-only-delete-first", "First dashboard", 1),
		"team/second.json": common.DashboardJSON("meta-only-delete-second", "Second dashboard", 1),
	})
	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

	common.RequireFolderState(t, helper.Folders, stableUID, folderTitle, "team", "")
	beforeFolder := helper.RequireFolders(t, stableUID)[0]
	expectedDashboards := map[string]common.ExpectedDashboard{
		"meta-only-delete-first":  {Title: "First dashboard", SourcePath: "team/first.json", Folder: stableUID},
		"meta-only-delete-second": {Title: "Second dashboard", SourcePath: "team/second.json", Folder: stableUID},
	}
	common.RequireDashboards(t, helper.DashboardsV1, expectedDashboards)
	dashboardPaths := []string{"team/first.json", "team/second.json"}
	beforeDashboards := common.SnapshotDashboardsBySourcePath(t, helper.ProvisioningTestHelper, repoName, dashboardPaths)

	_, err := local.Git("rm", metadataPath)
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "delete only the folder manifest")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{Incremental: true},
	})
	jobObj := &provisioning.Job{}
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

	// Until incremental sync handles metadata, parsing must reject the manifest
	// before it can delete the live folder containing these unchanged dashboards.
	require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State)
	require.Empty(t, jobObj.Status.Errors)
	warnings := strings.Join(jobObj.Status.Warnings, "\n")
	require.Contains(t, warnings, metadataPath)
	require.Contains(t, warnings, "cannot declare folders through files")

	common.RequireFolderState(t, helper.Folders, stableUID, folderTitle, "team", "")
	afterFolder := helper.RequireFolders(t, stableUID)[0]
	require.Equal(t, beforeFolder.GetUID(), afterFolder.GetUID(), "the live folder must not be recreated")
	helper.RequireRepoFolderCount(t, repoName, 1)
	common.RequireDashboards(t, helper.DashboardsV1, expectedDashboards)
	helper.RequireRepoDashboardCount(t, repoName, len(expectedDashboards))
	afterDashboards := common.SnapshotDashboardsBySourcePath(t, helper.ProvisioningTestHelper, repoName, dashboardPaths)
	common.RequireDashboardsUpdatedInPlace(t, beforeDashboards, afterDashboards, dashboardPaths)
}

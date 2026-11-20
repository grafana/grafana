package git

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_FullSync_FolderMetadataRename(t *testing.T) {
	for _, tc := range []struct {
		name          string
		editDashboard bool
	}{
		{name: "unchanged-dashboard"},
		{name: "edited-dashboard", editDashboard: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			helper := sharedGitHelper(t)
			repoName := "full-meta-rename-" + tc.name
			const folderUID = "full-meta-rename-folder"
			const folderTitle = "Team dashboards"
			const dashboardUID = "full-meta-rename-dashboard"
			dashboardTitle := "Dashboard before rename"

			_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
				"old/_folder.json":   common.FolderBody(t, folderUID, folderTitle),
				"old/dashboard.json": common.DashboardJSON(dashboardUID, dashboardTitle, 1),
			})
			common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

			common.RequireFolderState(t, helper.Folders, folderUID, folderTitle, "old", "")
			folderBefore := helper.RequireFolders(t, folderUID)[0]
			folderSnapshot := common.SnapshotObject(t, &folderBefore)
			common.RequireDashboards(t, helper.DashboardsV1, map[string]common.ExpectedDashboard{
				dashboardUID: {Title: dashboardTitle, SourcePath: "old/dashboard.json", Folder: folderUID},
			})
			dashboardBefore, err := helper.DashboardsV1.Resource.Get(t.Context(), dashboardUID, metav1.GetOptions{})
			require.NoError(t, err)
			dashboardSnapshot := common.SnapshotObject(t, dashboardBefore)

			_, err = local.Git("mv", "old", "new")
			require.NoError(t, err)
			if tc.editDashboard {
				dashboardTitle = "Dashboard edited during rename"
				require.NoError(t, local.UpdateFile("new/dashboard.json", string(common.DashboardJSON(dashboardUID, dashboardTitle, 2))))
			}
			_, err = local.Git("add", ".")
			require.NoError(t, err)
			_, err = local.Git("commit", "-m", "rename the folder while retaining its metadata")
			require.NoError(t, err)
			_, err = local.Git("push")
			require.NoError(t, err)

			common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

			common.RequireFolderState(t, helper.Folders, folderUID, folderTitle, "new", "")
			folderAfter := helper.RequireFolders(t, folderUID)[0]
			common.RequireUpdatedInPlace(t, "folder", folderSnapshot, common.SnapshotObject(t, &folderAfter))
			helper.RequireRepoFolderCount(t, repoName, 1)
			common.RequireDashboards(t, helper.DashboardsV1, map[string]common.ExpectedDashboard{
				dashboardUID: {Title: dashboardTitle, SourcePath: "new/dashboard.json", Folder: folderUID},
			})
			helper.RequireRepoDashboardCount(t, repoName, 1)
			if !tc.editDashboard {
				dashboardAfter, err := helper.DashboardsV1.Resource.Get(t.Context(), dashboardUID, metav1.GetOptions{})
				require.NoError(t, err)
				common.RequireUpdatedInPlace(t, "dashboard", dashboardSnapshot, common.SnapshotObject(t, dashboardAfter))
			}
		})
	}
}

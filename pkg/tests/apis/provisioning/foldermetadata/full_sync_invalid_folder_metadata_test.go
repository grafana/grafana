package foldermetadata

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_FullSync_InvalidFolderMetadata(t *testing.T) {
	t.Run("invalid folder metadata created on existing folder keeps unstable uid and preserves children", func(t *testing.T) {
		helper := sharedHelper(t)
		ctx := context.Background()
		const repo = "full-sync-invalid-meta-existing"

		helper.CreateLocalRepo(t, common.TestRepo{
			Name:                   repo,
			SyncTarget:             "folder",
			SkipSync:               true,
			SkipResourceAssertions: true,
		})
		writeToProvisioningPath(t, helper, "myfolder/dashboard.json", common.DashboardJSON("existing-parent-dash", "Parent Dashboard", 1))
		writeToProvisioningPath(t, helper, "myfolder/child/child-dashboard.json", common.DashboardJSON("existing-child-dash", "Child Dashboard", 1))

		// Initial sync warns because myfolder and myfolder/child have no _folder.json metadata.
		common.SyncAndWait(t, helper, common.Repo(repo), common.Warning())

		parentUID := findFolderUIDBySourcePath(t, helper, repo, "myfolder")
		childUID := findFolderUIDBySourcePath(t, helper, repo, "myfolder/child")
		common.RequireDashboardTitle(t, helper.DashboardsV1, ctx, "existing-child-dash", "Child Dashboard")
		requireDashboardParents(t, helper, repo, map[string]string{
			"myfolder/dashboard.json":             parentUID,
			"myfolder/child/child-dashboard.json": childUID,
		})

		writeToProvisioningPath(t, helper, "myfolder/child/child-dashboard.json", common.DashboardJSON("existing-child-dash", "Child Dashboard Updated", 2))
		writeToProvisioningPath(t, helper, "myfolder/_folder.json", invalidFolderMetadataMissingNameJSON("Broken Folder"))

		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})
		common.RequireJobWarning(t, job)
		requireInvalidFolderMetadataWarning(t, job.Object, "myfolder", repository.FileActionUpdated)

		require.Equal(t, parentUID, findFolderUIDBySourcePath(t, helper, repo, "myfolder"))
		require.Equal(t, childUID, findFolderUIDBySourcePath(t, helper, repo, "myfolder/child"))
		common.RequireDashboardTitle(t, helper.DashboardsV1, ctx, "existing-child-dash", "Child Dashboard Updated")
		requireDashboardParents(t, helper, repo, map[string]string{
			"myfolder/dashboard.json":             parentUID,
			"myfolder/child/child-dashboard.json": childUID,
		})
	})

	t.Run("invalid folder metadata on new folder falls back to unstable uid and reconciles children", func(t *testing.T) {
		helper := sharedHelper(t)
		ctx := context.Background()
		const repo = "full-sync-invalid-meta-new"

		helper.CreateLocalRepo(t, common.TestRepo{
			Name:                   repo,
			SyncTarget:             "folder",
			SkipSync:               true,
			SkipResourceAssertions: true,
		})
		writeToProvisioningPath(t, helper, "myfolder/_folder.json", invalidFolderMetadataMissingNameJSON("Broken Folder"))
		writeToProvisioningPath(t, helper, "myfolder/dashboard.json", common.DashboardJSON("new-parent-dash", "Parent Dashboard", 1))
		writeToProvisioningPath(t, helper, "myfolder/child/child-dashboard.json", common.DashboardJSON("new-child-dash", "Child Dashboard", 1))

		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})
		common.RequireJobWarning(t, job)
		requireInvalidFolderMetadataWarning(t, job.Object, "myfolder", repository.FileActionCreated)

		parentUID := findFolderUIDBySourcePath(t, helper, repo, "myfolder")
		childUID := findFolderUIDBySourcePath(t, helper, repo, "myfolder/child")
		require.NotEmpty(t, parentUID)
		require.NotEmpty(t, childUID)
		common.RequireDashboardTitle(t, helper.DashboardsV1, ctx, "new-parent-dash", "Parent Dashboard")
		common.RequireDashboardTitle(t, helper.DashboardsV1, ctx, "new-child-dash", "Child Dashboard")
		requireDashboardParents(t, helper, repo, map[string]string{
			"myfolder/dashboard.json":             parentUID,
			"myfolder/child/child-dashboard.json": childUID,
		})
	})

	t.Run("resource move into existing folder with invalid metadata keeps using that folder uid", func(t *testing.T) {
		helper := sharedHelper(t)
		const repo = "fs-inv-move-existing"

		helper.CreateLocalRepo(t, common.TestRepo{
			Name:                   repo,
			SyncTarget:             "folder",
			SkipSync:               true,
			SkipResourceAssertions: true,
		})
		writeToProvisioningPath(t, helper, "dashboard.json", common.DashboardJSON("move-into-existing-invalid", "Move Into Existing Invalid", 1))
		writeToProvisioningPath(t, helper, "broken/existing.json", common.DashboardJSON("existing-invalid-target", "Existing Invalid Target", 1))

		// Initial sync warns because "broken" has no _folder.json metadata.
		common.SyncAndWait(t, helper, common.Repo(repo), common.Warning())

		brokenUID := findFolderUIDBySourcePath(t, helper, repo, "broken")
		require.NotEmpty(t, brokenUID)

		writeToProvisioningPath(t, helper, "broken/_folder.json", invalidFolderMetadataMissingNameJSON("Broken Folder"))

		initialWarningJob := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})
		common.RequireJobWarning(t, initialWarningJob)
		requireInvalidFolderMetadataWarning(t, initialWarningJob.Object, "broken", repository.FileActionUpdated)
		require.Equal(t, brokenUID, findFolderUIDBySourcePath(t, helper, repo, "broken"))

		moveInProvisioningPath(t, helper, "dashboard.json", "broken/moved-dashboard.json")

		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})
		common.RequireJobWarning(t, job)
		requireInvalidFolderMetadataWarning(t, job.Object, "broken", repository.FileActionUpdated)

		require.Equal(t, brokenUID, findFolderUIDBySourcePath(t, helper, repo, "broken"))
		requireDashboardParents(t, helper, repo, map[string]string{
			"broken/existing.json":        brokenUID,
			"broken/moved-dashboard.json": brokenUID,
		})
	})

	t.Run("resource move into new folder with invalid metadata falls back to unstable uid", func(t *testing.T) {
		helper := sharedHelper(t)
		const repo = "fs-inv-move-new"

		helper.CreateLocalRepo(t, common.TestRepo{
			Name:                   repo,
			SyncTarget:             "folder",
			SkipSync:               true,
			SkipResourceAssertions: true,
		})
		writeToProvisioningPath(t, helper, "dashboard.json", common.DashboardJSON("move-into-new-invalid", "Move Into New Invalid", 1))

		common.SyncAndWait(t, helper, common.Repo(repo), common.Succeeded())

		writeToProvisioningPath(t, helper, "broken/_folder.json", invalidFolderMetadataMissingNameJSON("Broken Folder"))
		moveInProvisioningPath(t, helper, "dashboard.json", "broken/dashboard.json")

		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})
		common.RequireJobWarning(t, job)
		requireInvalidFolderMetadataWarning(t, job.Object, "broken", repository.FileActionCreated)

		brokenUID := findFolderUIDBySourcePath(t, helper, repo, "broken")
		require.NotEmpty(t, brokenUID)
		requireDashboardParents(t, helper, repo, map[string]string{
			"broken/dashboard.json": brokenUID,
		})
	})

	t.Run("moving folder with invalid metadata deletes old path and recreates at new path", func(t *testing.T) {
		helper := sharedHelper(t)
		const repo = "fs-inv-folder-move"

		helper.CreateLocalRepo(t, common.TestRepo{
			Name:                   repo,
			SyncTarget:             "folder",
			SkipSync:               true,
			SkipResourceAssertions: true,
		})
		writeToProvisioningPath(t, helper, "broken/_folder.json", invalidFolderMetadataMissingNameJSON("Broken Folder"))
		writeToProvisioningPath(t, helper, "broken/dashboard.json", common.DashboardJSON("move-invalid-folder", "Move Invalid Folder", 1))

		initialJob := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})
		common.RequireJobWarning(t, initialJob)
		requireInvalidFolderMetadataWarning(t, initialJob.Object, "broken", repository.FileActionCreated)

		oldUID := findFolderUIDBySourcePath(t, helper, repo, "broken")
		require.NotEmpty(t, oldUID)

		moveInProvisioningPath(t, helper, "broken", "moved")

		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})
		common.RequireJobWarning(t, job)
		requireInvalidFolderMetadataWarning(t, job.Object, "moved", repository.FileActionCreated)

		newUID := findFolderUIDBySourcePath(t, helper, repo, "moved")
		require.NotEmpty(t, newUID)
		require.NotEqual(t, oldUID, newUID)
		assertNoFolderAtPath(t, helper, repo, "broken")
		assertNoFolderByUID(t, helper, oldUID)
		requireDashboardParents(t, helper, repo, map[string]string{
			"moved/dashboard.json": newUID,
		})
	})
}

func invalidFolderMetadataMissingNameJSON(title string) []byte {
	return []byte(`{
		"apiVersion": "folder.grafana.app/v1",
		"kind": "Folder",
		"metadata": {
			"name": ""
		},
		"spec": {
			"title": "` + title + `"
		}
	}`)
}

func requireInvalidFolderMetadataWarning(t *testing.T, job map[string]any, path string, action repository.FileAction) {
	t.Helper()
	warnings := common.MustNestedStringSlice(job, "status", "warnings")
	for _, warning := range warnings {
		if strings.Contains(warning, "invalid folder metadata") &&
			strings.Contains(warning, path) &&
			strings.Contains(warning, "action: "+string(action)) {
			return
		}
	}
	require.Failf(t, "warning not found", "expected invalid folder metadata warning for %q with action %q, got %v", path, action, warnings)
}

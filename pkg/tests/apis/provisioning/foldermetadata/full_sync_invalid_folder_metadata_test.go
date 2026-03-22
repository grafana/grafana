package foldermetadata

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	gitcommon "github.com/grafana/grafana/pkg/tests/apis/provisioning/git/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_FullSync_InvalidFolderMetadata(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("invalid folder metadata created on existing folder keeps unstable uid and preserves children", func(t *testing.T) {
		helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
		ctx := context.Background()
		const repo = "full-sync-invalid-meta-existing"

		helper.CreateRepo(t, common.TestRepo{
			Name:                   repo,
			Target:                 "folder",
			SkipSync:               true,
			SkipResourceAssertions: true,
		})
		writeToProvisioningPath(t, helper, "myfolder/dashboard.json", gitcommon.DashboardJSON("existing-parent-dash", "Parent Dashboard", 1))
		writeToProvisioningPath(t, helper, "myfolder/child/child-dashboard.json", gitcommon.DashboardJSON("existing-child-dash", "Child Dashboard", 1))

		helper.SyncAndWait(t, repo, nil)

		parentUID := findFolderUIDBySourcePath(t, helper, repo, "myfolder")
		childUID := findFolderUIDBySourcePath(t, helper, repo, "myfolder/child")
		common.RequireDashboardTitle(t, helper.DashboardsV1, ctx, "existing-child-dash", "Child Dashboard")
		requireDashboardParents(t, helper, repo, map[string]string{
			"myfolder/dashboard.json":             parentUID,
			"myfolder/child/child-dashboard.json": childUID,
		})

		writeToProvisioningPath(t, helper, "myfolder/child/child-dashboard.json", gitcommon.DashboardJSON("existing-child-dash", "Child Dashboard Updated", 2))
		writeToProvisioningPath(t, helper, "myfolder/_folder.json", invalidFolderMetadataMissingNameJSON("Broken Folder"))

		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})
		common.RequireJobWarning(t, job)
		requireWarningContains(t, job.Object, "invalid folder metadata")
		requireWarningContains(t, job.Object, "myfolder")

		require.Equal(t, parentUID, findFolderUIDBySourcePath(t, helper, repo, "myfolder"))
		require.Equal(t, childUID, findFolderUIDBySourcePath(t, helper, repo, "myfolder/child"))
		common.RequireDashboardTitle(t, helper.DashboardsV1, ctx, "existing-child-dash", "Child Dashboard Updated")
		requireDashboardParents(t, helper, repo, map[string]string{
			"myfolder/dashboard.json":             parentUID,
			"myfolder/child/child-dashboard.json": childUID,
		})
	})

	t.Run("invalid folder metadata on new folder falls back to unstable uid and reconciles children", func(t *testing.T) {
		helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
		ctx := context.Background()
		const repo = "full-sync-invalid-meta-new"

		helper.CreateRepo(t, common.TestRepo{
			Name:                   repo,
			Target:                 "folder",
			SkipSync:               true,
			SkipResourceAssertions: true,
		})
		writeToProvisioningPath(t, helper, "myfolder/_folder.json", invalidFolderMetadataMissingNameJSON("Broken Folder"))
		writeToProvisioningPath(t, helper, "myfolder/dashboard.json", gitcommon.DashboardJSON("new-parent-dash", "Parent Dashboard", 1))
		writeToProvisioningPath(t, helper, "myfolder/child/child-dashboard.json", gitcommon.DashboardJSON("new-child-dash", "Child Dashboard", 1))

		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})
		common.RequireJobWarning(t, job)
		requireWarningContains(t, job.Object, "invalid folder metadata")
		requireWarningContains(t, job.Object, "myfolder")

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
		helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
		const repo = "fs-inv-move-existing"

		helper.CreateRepo(t, common.TestRepo{
			Name:                   repo,
			Target:                 "folder",
			SkipSync:               true,
			SkipResourceAssertions: true,
		})
		writeToProvisioningPath(t, helper, "dashboard.json", gitcommon.DashboardJSON("move-into-existing-invalid", "Move Into Existing Invalid", 1))
		writeToProvisioningPath(t, helper, "broken/existing.json", gitcommon.DashboardJSON("existing-invalid-target", "Existing Invalid Target", 1))

		helper.SyncAndWait(t, repo, nil)

		brokenUID := findFolderUIDBySourcePath(t, helper, repo, "broken")
		require.NotEmpty(t, brokenUID)

		writeToProvisioningPath(t, helper, "broken/_folder.json", invalidFolderMetadataMissingNameJSON("Broken Folder"))

		initialWarningJob := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})
		common.RequireJobWarning(t, initialWarningJob)
		requireWarningContains(t, initialWarningJob.Object, "invalid folder metadata")
		require.Equal(t, brokenUID, findFolderUIDBySourcePath(t, helper, repo, "broken"))

		moveInProvisioningPath(t, helper, "dashboard.json", "broken/moved-dashboard.json")

		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})
		common.RequireJobWarning(t, job)
		requireWarningContains(t, job.Object, "invalid folder metadata")
		requireWarningContains(t, job.Object, "broken")

		require.Equal(t, brokenUID, findFolderUIDBySourcePath(t, helper, repo, "broken"))
		requireDashboardParents(t, helper, repo, map[string]string{
			"broken/existing.json":        brokenUID,
			"broken/moved-dashboard.json": brokenUID,
		})
	})

	t.Run("resource move into new folder with invalid metadata falls back to unstable uid", func(t *testing.T) {
		helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
		const repo = "fs-inv-move-new"

		helper.CreateRepo(t, common.TestRepo{
			Name:                   repo,
			Target:                 "folder",
			SkipSync:               true,
			SkipResourceAssertions: true,
		})
		writeToProvisioningPath(t, helper, "dashboard.json", gitcommon.DashboardJSON("move-into-new-invalid", "Move Into New Invalid", 1))

		helper.SyncAndWait(t, repo, nil)

		writeToProvisioningPath(t, helper, "broken/_folder.json", invalidFolderMetadataMissingNameJSON("Broken Folder"))
		moveInProvisioningPath(t, helper, "dashboard.json", "broken/dashboard.json")

		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})
		common.RequireJobWarning(t, job)
		requireWarningContains(t, job.Object, "invalid folder metadata")
		requireWarningContains(t, job.Object, "broken")

		brokenUID := findFolderUIDBySourcePath(t, helper, repo, "broken")
		require.NotEmpty(t, brokenUID)
		requireDashboardParents(t, helper, repo, map[string]string{
			"broken/dashboard.json": brokenUID,
		})
	})

	t.Run("moving folder with invalid metadata deletes old path and recreates at new path", func(t *testing.T) {
		helper := common.RunGrafana(t, common.WithProvisioningFolderMetadata)
		const repo = "fs-inv-folder-move"

		helper.CreateRepo(t, common.TestRepo{
			Name:                   repo,
			Target:                 "folder",
			SkipSync:               true,
			SkipResourceAssertions: true,
		})
		writeToProvisioningPath(t, helper, "broken/_folder.json", invalidFolderMetadataMissingNameJSON("Broken Folder"))
		writeToProvisioningPath(t, helper, "broken/dashboard.json", gitcommon.DashboardJSON("move-invalid-folder", "Move Invalid Folder", 1))

		initialJob := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})
		common.RequireJobWarning(t, initialJob)

		oldUID := findFolderUIDBySourcePath(t, helper, repo, "broken")
		require.NotEmpty(t, oldUID)

		moveInProvisioningPath(t, helper, "broken", "moved")

		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})
		common.RequireJobWarning(t, job)
		requireWarningContains(t, job.Object, "invalid folder metadata")
		requireWarningContains(t, job.Object, "moved")

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
		"apiVersion": "folder.grafana.app/v1beta1",
		"kind": "Folder",
		"metadata": {
			"name": ""
		},
		"spec": {
			"title": "` + title + `"
		}
	}`)
}

func requireWarningContains(t *testing.T, job map[string]any, needle string) {
	t.Helper()
	warnings := common.MustNestedStringSlice(job, "status", "warnings")
	for _, warning := range warnings {
		if strings.Contains(warning, needle) {
			return
		}
	}
	require.Failf(t, "warning not found", "expected warning containing %q, got %v", needle, warnings)
}

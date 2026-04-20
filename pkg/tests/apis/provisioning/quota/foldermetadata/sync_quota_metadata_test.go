package foldermetadata

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_QuotaWithFolderMetadata(t *testing.T) {
	t.Run("full sync: folder UID change via _folder.json succeeds at quota limit", func(t *testing.T) {
		// Quota allows exactly the resources that exist after initial sync.
		// Changing the folder UID in _folder.json is a replacement (create new +
		// delete old) that should be net-zero and succeed even at the limit.
		ctx := context.Background()
		helper := sharedGitHelperWithQuota(t, 3)

		const repo = "quota-meta-uid-change"
		_, local := helper.CreateFolderTargetGitRepo(t, repo, map[string][]byte{
			"subfolder/_folder.json":   folderMetadataJSON("original-uid", "My Folder"),
			"subfolder/dashboard.json": common.DashboardJSON("dash-uid-change-001", "Dashboard One", 1),
		})

		// Full sync: root folder + subfolder (original-uid) + dashboard = 3 resources.
		common.SyncAndWait(t, helper, common.Repo(repo), common.Succeeded())
		common.RequireRepoDashboardCount(t, helper, ctx, repo, 1)
		common.RequireRepoFolderCount(t, helper, ctx, repo, 2)
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonQuotaReached)

		common.RequireFolderState(t, helper.Folders, "original-uid", "My Folder", "subfolder", repo)

		// Change the UID in _folder.json — this triggers a folder replacement.
		require.NoError(t, local.UpdateFile("subfolder/_folder.json", string(folderMetadataJSON("new-uid", "My Folder"))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "change folder UID")
		require.NoError(t, err)
		_, err = local.Git("push", "origin", "main")
		require.NoError(t, err)

		// A full sync should replace the folder (delete old, create new) — net zero.
		common.SyncAndWait(t, helper, common.Repo(repo), common.Succeeded())

		// The new folder should exist and the old one should be gone.
		common.RequireFolderState(t, helper.Folders, "new-uid", "My Folder", "subfolder", repo)
		requireFolderNotExists(t, helper, "original-uid")

		// Resource counts unchanged: root folder + subfolder (new-uid) + dashboard = 3.
		common.RequireRepoDashboardCount(t, helper, ctx, repo, 1)
		common.RequireRepoFolderCount(t, helper, ctx, repo, 2)
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonQuotaReached)
	})

	t.Run("full sync: folder UID change is blocked when repo is over quota", func(t *testing.T) {
		// When the repo is already over quota the pre-sync check blocks any
		// sync whose net change does not bring the repo back within limits.
		// A folder UID change (FileActionUpdated, net 0) does not reduce the
		// count, so the sync is expected to be blocked.
		ctx := context.Background()
		helper := sharedGitHelper(t)

		const repo = "quota-meta-uid-over"
		_, local := helper.CreateFolderTargetGitRepo(t, repo, map[string][]byte{
			"subfolder/_folder.json":   folderMetadataJSON("stable-uid", "My Folder"),
			"subfolder/dashboard.json": common.DashboardJSON("dash-over-001", "Dashboard One", 1),
		})

		// Full sync without quota: root + subfolder + dashboard = 3 resources.
		common.SyncAndWait(t, helper, common.Repo(repo), common.Succeeded())
		common.RequireRepoDashboardCount(t, helper, ctx, repo, 1)
		common.RequireRepoFolderCount(t, helper, ctx, repo, 2)

		// Lower the quota below the current count to put the repo over limit.
		helper.SetQuotaStatus(provisioning.QuotaStatus{MaxResourcesPerRepository: 2})
		helper.TriggerRepositoryReconciliation(t, repo)
		helper.WaitForResourceQuotaLimit(t, repo, 2)

		// Sync once so the "quota exceeded" condition is recorded.
		common.SyncAndWait(t, helper, common.Repo(repo), common.Succeeded())
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonQuotaExceeded)

		// Change the UID in _folder.json while over quota.
		require.NoError(t, local.UpdateFile("subfolder/_folder.json", string(folderMetadataJSON("replacement-uid", "My Folder"))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "change folder UID while over quota")
		require.NoError(t, err)
		_, err = local.Git("push", "origin", "main")
		require.NoError(t, err)

		// The sync should be blocked by the pre-sync quota check.
		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})
		jobObj := &provisioning.Job{}
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
			"sync should be blocked because the repo is over quota")
		require.Contains(t, jobObj.Status.Message, "sync skipped",
			"job message should indicate the sync was skipped due to quota")

		// The original folder should remain unchanged.
		common.RequireFolderState(t, helper.Folders, "stable-uid", "My Folder", "subfolder", repo)
		common.RequireRepoDashboardCount(t, helper, ctx, repo, 1)
	})

	t.Run("full sync: invalid _folder.json falls back to hash UID under quota pressure", func(t *testing.T) {
		// When _folder.json is malformed the folder reverts to hash-based
		// identity. If that UID differs from the stable one a replacement
		// occurs. At the quota limit this exercises the same create-before-
		// delete path as a normal UID change.
		ctx := context.Background()
		helper := sharedGitHelperWithQuota(t, 3)

		const repo = "quota-meta-invalid"
		_, local := helper.CreateFolderTargetGitRepo(t, repo, map[string][]byte{
			"subfolder/_folder.json":   folderMetadataJSON("valid-uid", "My Folder"),
			"subfolder/dashboard.json": common.DashboardJSON("dash-invalid-001", "Dashboard One", 1),
		})

		// Full sync: root + subfolder (valid-uid) + dashboard = 3 resources.
		common.SyncAndWait(t, helper, common.Repo(repo), common.Succeeded())
		common.RequireRepoDashboardCount(t, helper, ctx, repo, 1)
		common.RequireRepoFolderCount(t, helper, ctx, repo, 2)
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonQuotaReached)

		common.RequireFolderState(t, helper.Folders, "valid-uid", "My Folder", "subfolder", repo)

		// Corrupt _folder.json so it's no longer valid metadata.
		require.NoError(t, local.UpdateFile("subfolder/_folder.json", "this is not JSON"))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "corrupt folder metadata")
		require.NoError(t, err)
		_, err = local.Git("push", "origin", "main")
		require.NoError(t, err)

		// Full sync: the folder should fall back to hash-based identity.
		// This may produce warnings about invalid metadata but should not error.
		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{},
		})
		jobObj := &provisioning.Job{}
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

		t.Logf("Job state: %s", jobObj.Status.State)
		t.Logf("Job message: %s", jobObj.Status.Message)
		t.Logf("Job warnings: %v", jobObj.Status.Warnings)
		t.Logf("Job errors: %v", jobObj.Status.Errors)

		require.Empty(t, jobObj.Status.Errors, "invalid metadata should not cause errors")

		// The dashboard should still exist regardless of folder UID changes.
		common.RequireRepoDashboardCount(t, helper, ctx, repo, 1)
		common.RequireRepoFolderCount(t, helper, ctx, repo, 2)
	})

	t.Run("incremental sync: folder UID change via _folder.json succeeds at quota limit", func(t *testing.T) {
		// Same scenario as the full-sync test but via incremental sync.
		// The replacement folders are processed by deleteFolders() after
		// applyIncrementalChanges(), so quota must be released in time.
		ctx := context.Background()
		helper := sharedGitHelperWithQuota(t, 3)

		const repo = "quota-meta-incr-uid"
		_, local := helper.CreateFolderTargetGitRepo(t, repo, map[string][]byte{
			"subfolder/_folder.json":   folderMetadataJSON("incr-original-uid", "My Folder"),
			"subfolder/dashboard.json": common.DashboardJSON("dash-incr-001", "Dashboard One", 1),
		})

		// Full sync first to establish baseline.
		common.SyncAndWait(t, helper, common.Repo(repo), common.Succeeded())
		common.RequireRepoDashboardCount(t, helper, ctx, repo, 1)
		common.RequireRepoFolderCount(t, helper, ctx, repo, 2)
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonQuotaReached)

		common.RequireFolderState(t, helper.Folders, "incr-original-uid", "My Folder", "subfolder", repo)

		// Change the UID in _folder.json.
		require.NoError(t, local.UpdateFile("subfolder/_folder.json", string(folderMetadataJSON("incr-new-uid", "My Folder"))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "change folder UID incrementally")
		require.NoError(t, err)
		_, err = local.Git("push", "origin", "main")
		require.NoError(t, err)

		// Incremental sync should handle the replacement.
		common.SyncAndWait(t, helper, common.Repo(repo), common.Incremental, common.Succeeded())

		// The new folder should exist and the old one should be gone.
		common.RequireFolderState(t, helper.Folders, "incr-new-uid", "My Folder", "subfolder", repo)
		requireFolderNotExists(t, helper, "incr-original-uid")

		// Resource counts unchanged.
		common.RequireRepoDashboardCount(t, helper, ctx, repo, 1)
		common.RequireRepoFolderCount(t, helper, ctx, repo, 2)
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonQuotaReached)
	})
}

package git

import (
	"context"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestIntegrationProvisioning_IncrementalGitQuota(t *testing.T) {
	helper := sharedGitHelper(t)

	// ─── Skips creates when the repository is at its resource quota ──────────
	t.Run("skips creates when at quota", func(t *testing.T) {
		helper.CleanupAllResources(t, context.Background())
		helper.SetQuotaStatus(provisioning.QuotaStatus{MaxResourcesPerRepository: 2})
		ctx := context.Background()

		const repo = "incr-quota-blocks-repo"
		_, local := helper.CreateGitRepo(t, repo, map[string][]byte{
			"dashboard1.json": common.DashboardJSON("incr-quota-dash-001", "Dashboard One", 1),
			"dashboard2.json": common.DashboardJSON("incr-quota-dash-002", "Dashboard Two", 1),
		})

		// Initial full sync fills the quota (2/2).
		common.SyncAndWait(t, helper, common.Repo(repo), common.Succeeded())
		common.RequireRepoDashboardCount(t, helper, ctx, repo, 2)
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonQuotaReached)

		// Create dashboard3
		require.NoError(t, local.CreateFile("dashboard3.json",
			string(common.DashboardJSON("incr-quota-dash-003", "Dashboard Three", 1))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "add dashboard3 (quota-blocked by sync)")
		require.NoError(t, err)
		_, err = local.Git("push", "origin", "main")
		require.NoError(t, err)

		// Trigger incremental sync and collect the completed job object.
		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{Incremental: true},
		})

		jobObj := &provisioning.Job{}
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

		// The sync should finish with a Warning state because dashboard3 was skipped.
		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
			"incremental sync should warn when a create is skipped due to quota")
		require.Empty(t, jobObj.Status.Errors,
			"quota-skipped resources produce warnings, not errors")

		require.Len(t, jobObj.Status.Warnings, 1,
			"exactly 1 quota warning expected for the skipped dashboard")
		require.Equal(t, "resource quota exceeded, skipping creation of dashboard3.json (file: dashboard3.json, action: ignored)",
			jobObj.Status.Warnings[0],
			"quota warning should identify the skipped file")

		// Quota is still at 2/2 — dashboard3 was never created.
		common.RequireRepoDashboardCount(t, helper, ctx, repo, 2)
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonQuotaReached)
	})

	// ─── Delete-and-create in the same incremental window respects priority ──
	t.Run("delete and create in same incremental window respects deletion-first priority", func(t *testing.T) {
		helper.CleanupAllResources(t, context.Background())
		helper.SetQuotaStatus(provisioning.QuotaStatus{MaxResourcesPerRepository: 1})
		ctx := context.Background()

		const repo = "incr-quota-swap-repo"
		_, local := helper.CreateGitRepo(t, repo, map[string][]byte{
			"dashboard1.json": common.DashboardJSON("incr-swap-dash-001", "Dashboard One", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repo), common.Succeeded())
		common.RequireRepoDashboardCount(t, helper, ctx, repo, 1)
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonQuotaReached)

		// Commit A — remove dashboard1.json from the git tree.
		require.NoError(t, local.DeleteFile("dashboard1.json"))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "delete dashboard1")
		require.NoError(t, err)
		_, err = local.Git("push", "origin", "main")
		require.NoError(t, err)

		// Commit B — add dashboard2.json. The write API would reject this while
		// dashboard1 is still in Grafana's database (quota still 1/1 from
		// Grafana's perspective until the deletion is synced), so we push
		// directly to git and let the incremental sync sort it out.
		require.NoError(t, local.CreateFile("dashboard2.json",
			string(common.DashboardJSON("incr-swap-dash-002", "Dashboard Two", 1))))
		_, err = local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "add dashboard2")
		require.NoError(t, err)
		_, err = local.Git("push", "origin", "main")
		require.NoError(t, err)

		// A single incremental sync covers both commits (lastRef → currentRef).
		// sortChangesByActionPriority ensures the delete runs first, freeing the
		// quota slot before the create is attempted.
		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{Incremental: true},
		})

		jobObj := &provisioning.Job{}
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

		// Both operations should succeed — no quota violations expected.
		require.Equal(t, provisioning.JobStateSuccess, jobObj.Status.State,
			"delete-then-create in the same window should succeed at quota=1")
		require.Empty(t, jobObj.Status.Warnings, "no quota warnings expected when the delete frees room for the create")

		// dashboard1 deleted, dashboard2 created — net zero, still at 1/1.
		common.RequireRepoDashboardCount(t, helper, ctx, repo, 1)
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonQuotaReached)
	})

	// ─── Delete releases a slot for the *next* incremental sync ──────────────
	t.Run("delete in one incremental sync releases quota for a subsequent sync", func(t *testing.T) {
		helper.CleanupAllResources(t, context.Background())
		helper.SetQuotaStatus(provisioning.QuotaStatus{MaxResourcesPerRepository: 2})
		ctx := context.Background()

		const repo = "incr-quota-release-repo"
		_, local := helper.CreateGitRepo(t, repo, map[string][]byte{
			"dashboard1.json": common.DashboardJSON("incr-rel-dash-001", "Dashboard One", 1),
			"dashboard2.json": common.DashboardJSON("incr-rel-dash-002", "Dashboard Two", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repo), common.Succeeded())
		common.RequireRepoDashboardCount(t, helper, ctx, repo, 2)
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonQuotaReached)

		// Incremental sync 1 — commit a deletion of dashboard1 to the git repo,
		// freeing one quota slot when the sync picks it up.
		require.NoError(t, local.DeleteFile("dashboard1.json"))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "delete dashboard1")
		require.NoError(t, err)
		_, err = local.Git("push", "origin", "main")
		require.NoError(t, err)

		common.SyncAndWait(t, helper, common.Repo(repo), common.Incremental, common.Succeeded())
		common.RequireRepoDashboardCount(t, helper, ctx, repo, 1)
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonWithinQuota)

		// Incremental sync 2 — commit dashboard3 to the git repo; the freed slot
		// should be picked up during the incremental sync.
		require.NoError(t, local.CreateFile("dashboard3.json",
			string(common.DashboardJSON("incr-rel-dash-003", "Dashboard Three", 1))))
		_, err = local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "add dashboard3")
		require.NoError(t, err)
		_, err = local.Git("push", "origin", "main")
		require.NoError(t, err)

		common.SyncAndWait(t, helper, common.Repo(repo), common.Incremental, common.Succeeded())
		common.RequireRepoDashboardCount(t, helper, ctx, repo, 2)
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonQuotaReached)
	})

	// ─── Folder+dashboard pair skipped when at quota ───────────────
	t.Run("folder and its dashboard creation are skipped when at quota", func(t *testing.T) {
		helper.CleanupAllResources(t, context.Background())
		// quota=3 accounts for exactly: 1 folder + 2 dashboards from the initial
		// setup, so the repo starts at capacity.
		helper.SetQuotaStatus(provisioning.QuotaStatus{MaxResourcesPerRepository: 3})
		ctx := context.Background()

		const repo = "incr-quota-folder-block-repo"
		_, local := helper.CreateGitRepo(t, repo, map[string][]byte{
			"folder1/dashboard1.json": common.DashboardJSON("incr-fblock-dash-001", "Dashboard One", 1),
			"folder1/dashboard2.json": common.DashboardJSON("incr-fblock-dash-002", "Dashboard Two", 1),
		})

		// Initial full sync: 2 dashboards + 1 implicit folder = 3/3 resources.
		common.SyncAndWait(t, helper, common.Repo(repo), common.Succeeded())
		common.RequireRepoDashboardCount(t, helper, ctx, repo, 2)
		common.RequireRepoFolderCount(t, helper, ctx, repo, 1)
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonQuotaReached)

		// Push a new dashboard inside a brand-new subfolder.
		require.NoError(t, local.CreateFile("folder2/dashboard3.json",
			string(common.DashboardJSON("incr-fblock-dash-003", "Dashboard Three", 1))))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "add folder2/dashboard3 (quota-blocked)")
		require.NoError(t, err)
		_, err = local.Git("push", "origin", "main")
		require.NoError(t, err)

		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{Incremental: true},
		})

		jobObj := &provisioning.Job{}
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))

		// The dashboard (and with it the new folder) must be skipped.
		require.Equal(t, provisioning.JobStateWarning, jobObj.Status.State,
			"incremental sync should warn when a create is skipped due to quota")
		require.Empty(t, jobObj.Status.Errors, "quota-skipped resources produce warnings, not errors")
		require.Len(t, jobObj.Status.Warnings, 1,
			"exactly 1 quota warning expected for the skipped dashboard")
		require.Equal(t,
			"resource quota exceeded, skipping creation of folder2/dashboard3.json (file: folder2/dashboard3.json, action: ignored)",
			jobObj.Status.Warnings[0],
			"quota warning should identify the skipped file")

		// Still 2 dashboards and 1 folder — folder2 was never created.
		common.RequireRepoDashboardCount(t, helper, ctx, repo, 2)
		common.RequireRepoFolderCount(t, helper, ctx, repo, 1)
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonQuotaReached)
	})

	// ─── Delete folder's last dashboard: orphaned folder cleaned up ───────────
	t.Run("deleting folder's only dashboard releases quota and cleans up orphaned folder", func(t *testing.T) {
		helper.CleanupAllResources(t, context.Background())
		// quota=3: 1 folder (folder1) + 1 subfolder dashboard + 1 root dashboard = 3/3.
		helper.SetQuotaStatus(provisioning.QuotaStatus{MaxResourcesPerRepository: 3})
		ctx := context.Background()

		const repo = "incr-quota-folder-cleanup-repo"
		_, local := helper.CreateGitRepo(t, repo, map[string][]byte{
			"folder1/dashboard1.json": common.DashboardJSON("incr-fclean-dash-001", "Dashboard One", 1),
			"dashboard2.json":         common.DashboardJSON("incr-fclean-dash-002", "Dashboard Two", 1),
		})

		// Initial full sync: folder1 + dash1 + dash2 = 3/3 resources.
		common.SyncAndWait(t, helper, common.Repo(repo), common.Succeeded())
		common.RequireRepoDashboardCount(t, helper, ctx, repo, 2)
		common.RequireRepoFolderCount(t, helper, ctx, repo, 1)
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonQuotaReached)

		// Remove the only dashboard inside folder1 so the folder becomes orphaned.
		require.NoError(t, local.DeleteFile("folder1/dashboard1.json"))
		_, err := local.Git("add", ".")
		require.NoError(t, err)
		_, err = local.Git("commit", "-m", "delete folder1/dashboard1")
		require.NoError(t, err)
		_, err = local.Git("push", "origin", "main")
		require.NoError(t, err)

		// Incremental sync processes the deletion; orphan cleanup removes folder1.
		common.SyncAndWait(t, helper, common.Repo(repo), common.Incremental, common.Succeeded())

		// dashboard1 and folder1 are gone; only dashboard2 remains.
		common.RequireRepoDashboardCount(t, helper, ctx, repo, 1)
		common.RequireRepoFolderCount(t, helper, ctx, repo, 0)
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonWithinQuota)
	})

	// ─── Unlimited quota never blocks incremental creates ─────────────────────
	t.Run("unlimited quota does not block incremental creates", func(t *testing.T) {
		helper.CleanupAllResources(t, context.Background())
		helper.SetQuotaStatus(provisioning.QuotaStatus{})
		ctx := context.Background()

		const repo = "incr-quota-unlimited-repo"
		_, local := helper.CreateGitRepo(t, repo, map[string][]byte{
			"dashboard1.json": common.DashboardJSON("incr-ulim-dash-001", "Dashboard One", 1),
		})

		common.SyncAndWait(t, helper, common.Repo(repo), common.Succeeded())
		common.RequireRepoDashboardCount(t, helper, ctx, repo, 1)

		// Add three more dashboards as separate git commits pushed to the remote.
		for i, uid := range []string{"incr-ulim-dash-002", "incr-ulim-dash-003", "incr-ulim-dash-004"} {
			require.NoError(t, local.CreateFile(uid+".json",
				string(common.DashboardJSON(uid, "Dashboard "+uid, 1))),
				"create file %d should succeed", i+2)
			_, err := local.Git("add", ".")
			require.NoError(t, err)
			_, err = local.Git("commit", "-m", "add "+uid)
			require.NoError(t, err)
			_, err = local.Git("push", "origin", "main")
			require.NoError(t, err)
		}

		// A single incremental sync covers all three commits.
		job := helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull:   &provisioning.SyncJobOptions{Incremental: true},
		})

		jobObj := &provisioning.Job{}
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(job.Object, jobObj))
		require.Equal(t, provisioning.JobStateSuccess, jobObj.Status.State,
			"unlimited quota should allow all creates")
		require.Empty(t, jobObj.Status.Warnings, "no quota warnings expected with unlimited quota")

		common.RequireRepoDashboardCount(t, helper, ctx, repo, 4)
		helper.WaitForQuotaReconciliation(t, repo, provisioning.ReasonQuotaUnlimited)
	})
}

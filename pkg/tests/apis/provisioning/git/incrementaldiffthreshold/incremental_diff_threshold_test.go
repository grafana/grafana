package incrementaldiffthreshold

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/nanogit/gittest"
)

// testSyncIntervalSeconds is the repo-level sync interval requested in this
// package. The admission mutator enforces a 10s minimum, so any smaller value
// would be silently rounded up.
const testSyncIntervalSeconds = 10

// TestIntegrationProvisioning_IncrementalDiffThreshold_AboveThreshold_SchedulesFullSync
// verifies that when the number of changed files in a new commit exceeds the
// controller-level `max_incremental_changes` threshold, the next interval
// reconcile schedules a FULL sync (Job.Spec.Pull.Incremental == false).
func TestIntegrationProvisioning_IncrementalDiffThreshold_AboveThreshold_SchedulesFullSync(t *testing.T) {
	h := sharedGitHelper(t)

	const repoName = "diff-threshold-above"

	_, local := createGitRepoWithSyncEnabled(t, h, repoName, testSyncIntervalSeconds, map[string][]byte{
		"dashboard-seed.json": common.DashboardJSON("diff-above-seed", "Seed", 1),
	})

	// Wait until the controller's initial full sync (ObservedGeneration<1 path)
	// has finished and populated Status.Sync.LastRef. Later interval ticks
	// compare against that ref when deciding incremental vs full.
	waitForInitialSyncCompleted(t, h, repoName)

	// Remember the set of pull jobs already present so we can identify the
	// interval-scheduled one we're about to create.
	seenJobs := snapshotPullJobNames(t, h, repoName)

	// Push (threshold + 1) files in a single commit. CompareFiles will report
	// `len(changes) > maxIncrementalChanges`, so CanUseIncrementalSyncInController
	// must return false.
	const fileCount = testMaxIncrementalChanges + 1
	addDashboardFiles(t, local, "above", fileCount)
	commitAndPush(t, local, fmt.Sprintf("add %d dashboards (above threshold)", fileCount))

	intervalJob := waitForNewPullJob(t, h, repoName, seenJobs)
	require.NotNil(t, intervalJob.Spec.Pull,
		"interval-scheduled pull job must have Pull options set")
	require.False(t, intervalJob.Spec.Pull.Incremental,
		"diff of %d files (> threshold %d) should be scheduled as a full sync",
		fileCount, testMaxIncrementalChanges)
}

// TestIntegrationProvisioning_IncrementalDiffThreshold_BelowThreshold_SchedulesIncrementalSync
// verifies that when the number of changed files in a new commit is below the
// controller-level threshold, the next interval reconcile schedules an
// INCREMENTAL sync (Job.Spec.Pull.Incremental == true).
func TestIntegrationProvisioning_IncrementalDiffThreshold_BelowThreshold_SchedulesIncrementalSync(t *testing.T) {
	h := sharedGitHelper(t)

	const repoName = "diff-threshold-below"

	_, local := createGitRepoWithSyncEnabled(t, h, repoName, testSyncIntervalSeconds, map[string][]byte{
		"dashboard-seed.json": common.DashboardJSON("diff-below-seed", "Seed", 1),
	})

	waitForInitialSyncCompleted(t, h, repoName)

	seenJobs := snapshotPullJobNames(t, h, repoName)

	// Push (threshold - 1) files. The size guard passes and, with no
	// folder-metadata-only deletions in this diff, the controller picks
	// incremental.
	const fileCount = testMaxIncrementalChanges - 1
	require.Greater(t, fileCount, 0, "below-threshold file count must be positive")
	addDashboardFiles(t, local, "below", fileCount)
	commitAndPush(t, local, fmt.Sprintf("add %d dashboards (below threshold)", fileCount))

	intervalJob := waitForNewPullJob(t, h, repoName, seenJobs)
	require.NotNil(t, intervalJob.Spec.Pull,
		"interval-scheduled pull job must have Pull options set")
	require.True(t, intervalJob.Spec.Pull.Incremental,
		"diff of %d files (< threshold %d) should be scheduled as an incremental sync",
		fileCount, testMaxIncrementalChanges)
}

// ── Helpers ────────────────────────────────────────────────────────────────

// createGitRepoWithSyncEnabled provisions a git-backed Grafana repository with
// sync enabled and a custom interval. Unlike GitTestHelper.CreateGitRepo, this
// exposes the sync config because the interval-scheduled reconcile path is
// what exercises the max_incremental_changes threshold.
func createGitRepoWithSyncEnabled(
	t *testing.T,
	h *common.GitTestHelper,
	repoName string,
	syncIntervalSeconds int,
	initialFiles map[string][]byte,
) (*gittest.RemoteRepository, *gittest.LocalRepo) {
	t.Helper()
	ctx := context.Background()

	gitServer := h.GitServer()
	user, err := gitServer.CreateUser(ctx)
	require.NoError(t, err, "failed to create git user")

	remote, err := gitServer.CreateRepo(ctx, repoName, user)
	require.NoError(t, err, "failed to create git remote repository")

	local, err := gittest.NewLocalRepo(ctx)
	require.NoError(t, err, "failed to create git local repository")
	t.Cleanup(func() {
		if err := local.Cleanup(); err != nil {
			t.Logf("failed to cleanup local repo: %v", err)
		}
	})

	_, err = local.InitWithRemote(user, remote)
	require.NoError(t, err, "failed to initialize local repo with remote")

	for filePath, content := range initialFiles {
		require.NoError(t, local.CreateFile(filePath, string(content)),
			"failed to create initial file %s", filePath)
	}
	if len(initialFiles) > 0 {
		_, err = local.Git("add", ".")
		require.NoError(t, err, "failed to add initial files")
		_, err = local.Git("commit", "-m", "initial commit")
		require.NoError(t, err, "failed to commit initial files")
		_, err = local.Git("push")
		require.NoError(t, err, "failed to push initial files")
	}

	repoObj := h.RenderObject(t, common.TestdataPath("git.json.tmpl"), map[string]any{
		"Name":                repoName,
		"Title":               fmt.Sprintf("Test Repository %s", repoName),
		"URL":                 remote.URL,
		"Branch":              "main",
		"TokenUser":           user.Username,
		"Token":               user.Password,
		"SyncEnabled":         true,
		"SyncTarget":          "folder",
		"SyncIntervalSeconds": syncIntervalSeconds,
		"WorkflowsJSON":       `[]`,
	})

	_, err = h.Repositories.Resource.Create(ctx, repoObj, metav1.CreateOptions{})
	require.NoError(t, err, "failed to create repository")

	h.WaitForHealthyRepository(t, repoName)

	return remote, local
}

// waitForInitialSyncCompleted blocks until the repository's first sync has
// finished successfully and populated LastRef.
func waitForInitialSyncCompleted(t *testing.T, h *common.GitTestHelper, repoName string) {
	t.Helper()

	require.EventuallyWithT(t, func(c *assert.CollectT) {
		repoObj, err := h.Repositories.Resource.Get(context.Background(), repoName, metav1.GetOptions{})
		if !assert.NoError(c, err, "failed to get repository") {
			return
		}
		repo := common.MustFromUnstructured[v0alpha1.Repository](t, repoObj)

		assert.Equal(c, string(v0alpha1.JobStateSuccess), string(repo.Status.Sync.State),
			"initial sync state should be success (got %q)", repo.Status.Sync.State)
		assert.NotEmpty(c, repo.Status.Sync.LastRef,
			"initial sync should populate LastRef")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault,
		"initial sync should complete and populate LastRef")
}

// snapshotPullJobNames returns the names of all pull jobs currently visible
// for the repo (active queue + historic). We diff against this set later to
// identify the interval-scheduled job.
func snapshotPullJobNames(t *testing.T, h *common.GitTestHelper, repoName string) map[string]struct{} {
	t.Helper()
	seen := make(map[string]struct{})

	// Historic jobs.
	result, err := h.Repositories.Resource.Get(context.Background(), repoName, metav1.GetOptions{}, "jobs")
	require.NoError(t, err, "failed to list historic jobs")
	list, err := result.ToList()
	require.NoError(t, err, "historic jobs result should be a list")
	for i := range list.Items {
		item := &list.Items[i]
		job := common.MustFromUnstructured[v0alpha1.Job](t, item)
		if job.Spec.Action == v0alpha1.JobActionPull {
			seen[item.GetName()] = struct{}{}
		}
	}

	// Active jobs (controller-queued jobs live here until the worker picks
	// them up; they may or may not be in the historic list yet).
	active, err := h.Jobs.Resource.List(context.Background(), metav1.ListOptions{})
	require.NoError(t, err, "failed to list active jobs")
	for i := range active.Items {
		item := &active.Items[i]
		if item.GetLabels()[jobs.LabelRepository] != repoName {
			continue
		}
		job := common.MustFromUnstructured[v0alpha1.Job](t, item)
		if job.Spec.Action == v0alpha1.JobActionPull {
			seen[item.GetName()] = struct{}{}
		}
	}

	return seen
}

// waitForNewPullJob polls until a pull job for the repo appears that was not
// in the given seen-set. The controller's interval reconcile is what creates
// it. Historic jobs have a `-<hash>` suffix appended to the original name, so
// we strip that suffix before comparing to `seen`.
//
// The controller only re-processes a repo when its informer re-emits the
// object — either on status mutation or on the SharedInformerFactory's 60s
// resync tick. That 60s tick sits right at our polling timeout, so we nudge
// the controller by touching the repo's status once enough sync-age has
// elapsed for shouldResync() to return true.
func waitForNewPullJob(
	t *testing.T,
	h *common.GitTestHelper,
	repoName string,
	seen map[string]struct{},
) *v0alpha1.Job {
	t.Helper()

	var newJob *v0alpha1.Job
	var lastNudge time.Time
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		// Check active jobs first — the fresh controller-queued job starts here.
		active, err := h.Jobs.Resource.List(context.Background(), metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list active jobs") {
			return
		}
		for i := range active.Items {
			item := &active.Items[i]
			if item.GetLabels()[jobs.LabelRepository] != repoName {
				continue
			}
			if _, ok := seen[item.GetName()]; ok {
				continue
			}
			job := common.MustFromUnstructured[v0alpha1.Job](t, item)
			if job.Spec.Action != v0alpha1.JobActionPull {
				continue
			}
			newJob = job
			return
		}

		// Fall back to historic jobs (active job may already have been drained).
		result, err := h.Repositories.Resource.Get(context.Background(), repoName, metav1.GetOptions{}, "jobs")
		if !assert.NoError(c, err, "failed to list historic jobs") {
			return
		}
		list, err := result.ToList()
		if !assert.NoError(c, err, "historic jobs result should be a list") {
			return
		}
		for i := range list.Items {
			item := &list.Items[i]
			// Historic jobs suffix the original name with `-<hash>`.
			baseName := trimHistoricSuffix(item.GetName())
			if _, ok := seen[item.GetName()]; ok {
				continue
			}
			if _, ok := seen[baseName]; ok {
				continue
			}
			job := common.MustFromUnstructured[v0alpha1.Job](t, item)
			if job.Spec.Action != v0alpha1.JobActionPull {
				continue
			}
			newJob = job
			return
		}

		// No new job yet. Nudge the controller periodically so it re-enqueues
		// the repo even without waiting for the 60s informer resync. We only
		// nudge once enough sync-age has elapsed for shouldResync() to return
		// true; earlier nudges would be processed but skipped.
		if time.Since(lastNudge) > 2*time.Second {
			if shouldNudgeRepo(t, h, repoName) {
				h.TriggerRepositoryReconciliation(t, repoName)
				lastNudge = time.Now()
			}
		}

		c.Errorf("no new pull job yet for repo %s (seen %d)", repoName, len(seen))
	}, common.WaitTimeoutDefault, 500*time.Millisecond,
		"controller should schedule an interval sync after the new commit")

	require.NotNil(t, newJob, "new pull job must be populated")
	return newJob
}

// shouldNudgeRepo reports whether enough time has elapsed since the last sync
// finished for shouldResync() on the controller side to return true. We avoid
// nudging before that because the controller would just observe syncAge <
// syncInterval and return without queueing a job.
func shouldNudgeRepo(t *testing.T, h *common.GitTestHelper, repoName string) bool {
	t.Helper()
	repoObj, err := h.Repositories.Resource.Get(context.Background(), repoName, metav1.GetOptions{})
	if err != nil {
		return false
	}
	repo := common.MustFromUnstructured[v0alpha1.Repository](t, repoObj)
	if repo.Status.Sync.Finished == 0 {
		return false
	}
	syncInterval := time.Duration(repo.Spec.Sync.IntervalSeconds) * time.Second
	// shouldResync() uses a 1s tolerance on the controller side; match it here
	// so we don't race the controller with a nudge that's a few ms too early.
	tolerance := time.Second
	syncAge := time.Since(time.UnixMilli(repo.Status.Sync.Finished))
	return syncAge >= (syncInterval - tolerance)
}

// trimHistoricSuffix removes the `-<hash>` suffix that historic jobs receive
// when they're promoted out of the active queue.
func trimHistoricSuffix(name string) string {
	for i := len(name) - 1; i > 0; i-- {
		if name[i] == '-' {
			return name[:i]
		}
	}
	return name
}

// addDashboardFiles writes a batch of distinct dashboards to the local clone
// under unique names so each file is a new `Created` entry in the diff.
func addDashboardFiles(t *testing.T, local *gittest.LocalRepo, prefix string, count int) {
	t.Helper()
	for i := range count {
		uid := fmt.Sprintf("diff-%s-%03d", prefix, i)
		filename := fmt.Sprintf("dashboard-%s-%03d.json", prefix, i)
		require.NoError(t,
			local.CreateFile(filename, string(common.DashboardJSON(uid, fmt.Sprintf("Dash %s %d", prefix, i), 1))),
			"failed to create %s", filename)
	}
}

// commitAndPush stages everything in the working tree, commits with the given
// message, and pushes.
func commitAndPush(t *testing.T, local *gittest.LocalRepo, message string) {
	t.Helper()
	_, err := local.Git("add", ".")
	require.NoError(t, err, "git add failed")
	_, err = local.Git("commit", "-m", message)
	require.NoError(t, err, "git commit failed")
	_, err = local.Git("push")
	require.NoError(t, err, "git push failed")
}

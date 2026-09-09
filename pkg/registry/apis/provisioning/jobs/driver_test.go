package jobs

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	appjobs "github.com/grafana/grafana/apps/provisioning/pkg/jobs"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

func newConflictError() error {
	return apierrors.NewConflict(
		schema.GroupResource{Group: provisioning.GROUP, Resource: "jobs"},
		"test-job",
		nil,
	)
}

// TestSumTotalChanges verifies the driver totals the per-summary TotalChanges the
// recorder set (see TestUpdateSummary_TotalChanges for the action-aware population),
// skipping nil entries.
func TestSumTotalChanges(t *testing.T) {
	require.Equal(t, 0, sumTotalChanges(nil))

	summaries := []*provisioning.JobResourceSummary{
		{TotalChanges: 5},
		nil,
		{TotalChanges: 3},
	}
	require.Equal(t, 8, sumTotalChanges(summaries))
}

// TestSumTotalDryRun verifies pull request jobs count viewed-but-not-actionable
// (Noop) files alongside changes, while every other action falls back to
// TotalChanges (identical to sumTotalChanges), skipping nil entries.
func TestSumTotalDryRun(t *testing.T) {
	require.Equal(t, 0, sumTotalDryRun(provisioning.JobActionPullRequest, nil))

	prSummaries := []*provisioning.JobResourceSummary{
		{Create: 2, Update: 1, Delete: 1, Noop: 3},
		nil,
		{Create: 1},
	}
	require.Equal(t, 8, sumTotalDryRun(provisioning.JobActionPullRequest, prSummaries))

	prSummariesLarge := []*provisioning.JobResourceSummary{
		{Create: 8, Update: 5, Noop: 2}, // all 15 files are evaluated, uncapped
	}
	require.Equal(t, 15, sumTotalDryRun(provisioning.JobActionPullRequest, prSummariesLarge))

	pullSummaries := []*provisioning.JobResourceSummary{
		{TotalChanges: 5, Noop: 10},
		{TotalChanges: 3},
	}
	require.Equal(t, 8, sumTotalDryRun(provisioning.JobActionPull, pullSummaries))
}

func makeTestJob(rv string) *provisioning.Job {
	return &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:            "test-job",
			Namespace:       "test-ns",
			ResourceVersion: rv,
		},
		Spec: provisioning.JobSpec{
			Repository: "test-repo",
			Action:     provisioning.JobActionPull,
		},
	}
}

// TestOnProgress_IncrementsProgressUpdates verifies that each successful progress
// update bumps the job's ProgressUpdates count, and that the running total is
// carried forward across the status overwrite that happens on every call.
func TestOnProgress_IncrementsProgressUpdates(t *testing.T) {
	store := &MockStore{}
	driver := &jobProcessor{store: store}
	driver.currentJob = makeTestJob("1")

	// Echo the job back so the driver's local copy keeps the persisted count.
	store.EXPECT().Update(mock.Anything, mock.Anything).
		RunAndReturn(func(_ context.Context, job *provisioning.Job) (*provisioning.Job, error) {
			return job.DeepCopy(), nil
		})

	progressFn := driver.onProgress()
	status := provisioning.JobStatus{State: provisioning.JobStateWorking, Message: "test"}

	require.NoError(t, progressFn(context.Background(), status))
	assert.Equal(t, int64(1), driver.currentJob.Status.ProgressUpdates)

	require.NoError(t, progressFn(context.Background(), status))
	assert.Equal(t, int64(2), driver.currentJob.Status.ProgressUpdates)

	require.NoError(t, progressFn(context.Background(), status))
	assert.Equal(t, int64(3), driver.currentJob.Status.ProgressUpdates)
}

// TestOnProgress_FailedWriteDoesNotInflateCount verifies that a failed
// (non-conflict) status write does not leave an increment behind on the
// in-memory job. The progress recorder ignores progress errors and keeps
// going, so a failed write must not bump ProgressUpdates for the next call.
func TestOnProgress_FailedWriteDoesNotInflateCount(t *testing.T) {
	store := &MockStore{}
	driver := &jobProcessor{store: store}
	driver.currentJob = makeTestJob("1")

	// First write fails with a non-conflict error (no retry).
	store.EXPECT().Update(mock.Anything, mock.Anything).
		Return(nil, errors.New("boom")).Once()
	// Second write succeeds; echo the job back so the persisted count sticks.
	store.EXPECT().Update(mock.Anything, mock.Anything).
		RunAndReturn(func(_ context.Context, job *provisioning.Job) (*provisioning.Job, error) {
			return job.DeepCopy(), nil
		}).Once()

	progressFn := driver.onProgress()
	status := provisioning.JobStatus{State: provisioning.JobStateWorking, Message: "test"}

	require.Error(t, progressFn(context.Background(), status))
	assert.Equal(t, int64(0), driver.currentJob.Status.ProgressUpdates,
		"a failed write must not increment the count")

	require.NoError(t, progressFn(context.Background(), status))
	assert.Equal(t, int64(1), driver.currentJob.Status.ProgressUpdates,
		"the first successful write is the first counted update")
}

// TestOnProgress_DeadlockOnConflict verifies that the onProgress callback
// does not deadlock when Store.Update returns a conflict error.
//
// Root cause: when Update returns a conflict, the retry loop calls `continue`
// without releasing d.mu. The next iteration calls d.mu.Lock() on the same
// goroutine — permanent deadlock since sync.Mutex is non-reentrant.
func TestOnProgress_DeadlockOnConflict(t *testing.T) {
	store := &MockStore{}
	driver := &jobProcessor{store: store}
	driver.currentJob = makeTestJob("100")

	// First Update: conflict triggers retry
	store.EXPECT().Update(mock.Anything, mock.Anything).Return(nil, newConflictError()).Once()
	// Retry fetches latest version
	freshJob := makeTestJob("200")
	store.EXPECT().Get(mock.Anything, "test-ns", "test-job").Return(freshJob, nil).Once()
	// Second Update: succeeds
	updatedJob := makeTestJob("201")
	store.EXPECT().Update(mock.Anything, mock.Anything).Return(updatedJob, nil).Once()

	progressFn := driver.onProgress()
	status := provisioning.JobStatus{State: provisioning.JobStateWorking, Message: "test"}

	done := make(chan error, 1)
	go func() {
		done <- progressFn(context.Background(), status)
	}()

	select {
	case err := <-done:
		assert.NoError(t, err, "onProgress should succeed after conflict retry")
	case <-time.After(3 * time.Second):
		t.Fatal("DEADLOCK: onProgress hung — d.mu.Lock() called on goroutine that already holds it (missing Unlock before continue)")
	}
}

// TestOnProgress_AllRetriesConflict verifies that when ALL retries get
// conflicts, onProgress returns an error without deadlocking or leaking d.mu.
func TestOnProgress_AllRetriesConflict(t *testing.T) {
	store := &MockStore{}
	driver := &jobProcessor{store: store}
	driver.currentJob = makeTestJob("100")

	// All attempts return conflict — the 3rd attempt has attempt < maxRetries-1 == false,
	// so it takes the non-conflict error path. But attempts 0 and 1 hit the `continue`.
	store.EXPECT().Update(mock.Anything, mock.Anything).Return(nil, newConflictError()).Once() // attempt 0
	freshJob := makeTestJob("200")
	store.EXPECT().Get(mock.Anything, "test-ns", "test-job").Return(freshJob, nil).Once()      // retry fetch for attempt 1
	store.EXPECT().Update(mock.Anything, mock.Anything).Return(nil, newConflictError()).Once() // attempt 1
	freshJob2 := makeTestJob("300")
	store.EXPECT().Get(mock.Anything, "test-ns", "test-job").Return(freshJob2, nil).Once()     // retry fetch for attempt 2
	store.EXPECT().Update(mock.Anything, mock.Anything).Return(nil, newConflictError()).Once() // attempt 2 (last, no continue)

	progressFn := driver.onProgress()
	status := provisioning.JobStatus{State: provisioning.JobStateWorking, Message: "test"}

	done := make(chan error, 1)
	go func() {
		done <- progressFn(context.Background(), status)
	}()

	select {
	case err := <-done:
		assert.Error(t, err, "should return error after exhausting retries")
	case <-time.After(3 * time.Second):
		t.Fatal("DEADLOCK: onProgress hung during conflict retry exhaustion")
	}

	// Verify d.mu is NOT still held
	lockCh := make(chan struct{})
	go func() {
		driver.mu.Lock()
		close(lockCh)
		driver.mu.Unlock()
	}()
	select {
	case <-lockCh:
		// mutex is free
	case <-time.After(1 * time.Second):
		t.Fatal("d.mu is still held after onProgress returned — mutex leaked on conflict retry path")
	}
}

// TestOnProgress_MutexNotLeakedOnConflict verifies that after a conflict +
// successful retry, the mutex is properly released and other goroutines
// can acquire it (simulating the main driver thread).
func TestOnProgress_MutexNotLeakedOnConflict(t *testing.T) {
	store := &MockStore{}
	driver := &jobProcessor{store: store}
	driver.currentJob = makeTestJob("100")

	store.EXPECT().Update(mock.Anything, mock.Anything).Return(nil, newConflictError()).Once()
	store.EXPECT().Get(mock.Anything, "test-ns", "test-job").Return(makeTestJob("200"), nil).Once()
	store.EXPECT().Update(mock.Anything, mock.Anything).Return(makeTestJob("201"), nil).Once()

	progressFn := driver.onProgress()
	status := provisioning.JobStatus{State: provisioning.JobStateWorking, Message: "test"}

	done := make(chan error, 1)
	go func() {
		done <- progressFn(context.Background(), status)
	}()

	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("DEADLOCK in onProgress")
	}

	// Simulate what the main driver thread does after processJobWithLeaseCheck
	// returns (line 235 in driver.go). If the leaked goroutine held d.mu, this
	// would block forever.
	lockCh := make(chan struct{})
	go func() {
		driver.mu.Lock()
		close(lockCh)
		driver.mu.Unlock()
	}()
	select {
	case <-lockCh:
		// The main thread can acquire d.mu — no deadlock
	case <-time.After(1 * time.Second):
		t.Fatal("main thread cannot acquire d.mu — leaked goroutine from onProgress still holds the lock")
	}
}

// --- processJob tests ---

// makeOrphanJob creates a test job with the given action targeting a repo that
// may not exist. Unlike makeTestJob it accepts an arbitrary action.
func makeOrphanJob(action provisioning.JobAction) *provisioning.Job {
	return &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-job",
			Namespace: "test-ns",
		},
		Spec: provisioning.JobSpec{
			Repository: "deleted-repo",
			Action:     action,
		},
	}
}

// makeRepoConfig returns a minimal provisioning.Repository config for use
// with mock repository objects.
func makeRepoConfig(name string, deletionTimestamp *metav1.Time, labels map[string]string) *provisioning.Repository {
	return &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name:              name,
			Namespace:         "test-ns",
			DeletionTimestamp: deletionTimestamp,
			Labels:            labels,
		},
		Spec: provisioning.RepositorySpec{
			Type: provisioning.GitHubRepositoryType,
		},
	}
}

func newNotFoundError() error {
	return apierrors.NewNotFound(
		schema.GroupResource{Group: provisioning.GROUP, Resource: "repositories"},
		"deleted-repo",
	)
}

func setupDriverForProcessJob(worker *MockWorker, repoGetter *MockRepoGetter) *jobProcessor {
	return &jobProcessor{
		workers:    []Worker{worker},
		repoGetter: repoGetter,
	}
}

func TestProcessJob_OrphanCleanup_RepoNotFound(t *testing.T) {
	for _, action := range []provisioning.JobAction{
		provisioning.JobActionReleaseResources,
		provisioning.JobActionDeleteResources,
	} {
		t.Run(string(action), func(t *testing.T) {
			worker := &MockWorker{}
			repoGetter := &MockRepoGetter{}
			recorder := &MockJobProgressRecorder{}
			driver := setupDriverForProcessJob(worker, repoGetter)
			driver.currentJob = makeOrphanJob(action)

			worker.EXPECT().IsSupported(mock.Anything, mock.Anything).Return(true)
			repoGetter.EXPECT().GetRepository(mock.Anything, "test-ns", "deleted-repo").
				Return(nil, newNotFoundError())
			worker.EXPECT().Process(mock.Anything, nil, mock.Anything, recorder).Return(nil)

			err := driver.processJob(context.Background(), recorder)
			require.NoError(t, err)

			// Verify worker.Process was called with nil repo
			worker.AssertCalled(t, "Process", mock.Anything, nil, mock.Anything, recorder)
		})
	}
}

func TestProcessJob_OrphanCleanup_RepoTerminating(t *testing.T) {
	for _, action := range []provisioning.JobAction{
		provisioning.JobActionReleaseResources,
		provisioning.JobActionDeleteResources,
	} {
		t.Run(string(action), func(t *testing.T) {
			worker := &MockWorker{}
			repoGetter := &MockRepoGetter{}
			recorder := &MockJobProgressRecorder{}
			driver := setupDriverForProcessJob(worker, repoGetter)
			driver.currentJob = makeOrphanJob(action)

			now := metav1.Now()
			repoCfg := makeRepoConfig("deleted-repo", &now, nil)
			mockRepo := &repository.MockRepository{}
			mockRepo.On("Config").Return(repoCfg)

			worker.EXPECT().IsSupported(mock.Anything, mock.Anything).Return(true)
			repoGetter.EXPECT().GetRepository(mock.Anything, "test-ns", "deleted-repo").
				Return(mockRepo, nil)
			worker.EXPECT().Process(mock.Anything, mockRepo, mock.Anything, recorder).Return(nil)

			err := driver.processJob(context.Background(), recorder)
			require.NoError(t, err)

			worker.AssertCalled(t, "Process", mock.Anything, mockRepo, mock.Anything, recorder)
		})
	}
}

func TestProcessJob_NormalAction_RepoNotFound_ReturnsError(t *testing.T) {
	worker := &MockWorker{}
	repoGetter := &MockRepoGetter{}
	recorder := &MockJobProgressRecorder{}
	driver := setupDriverForProcessJob(worker, repoGetter)
	driver.currentJob = makeTestJob("1")

	worker.EXPECT().IsSupported(mock.Anything, mock.Anything).Return(true)
	repoGetter.EXPECT().GetRepository(mock.Anything, "test-ns", "test-repo").
		Return(nil, newNotFoundError())

	err := driver.processJob(context.Background(), recorder)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to get repository")

	worker.AssertNotCalled(t, "Process", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
}

func TestProcessJob_NormalAction_RepoTerminating_SkipsJob(t *testing.T) {
	worker := &MockWorker{}
	repoGetter := &MockRepoGetter{}
	recorder := &MockJobProgressRecorder{}
	driver := setupDriverForProcessJob(worker, repoGetter)
	driver.currentJob = makeTestJob("1")

	now := metav1.Now()
	repoCfg := makeRepoConfig("test-repo", &now, nil)
	mockRepo := &repository.MockRepository{}
	mockRepo.On("Config").Return(repoCfg)

	worker.EXPECT().IsSupported(mock.Anything, mock.Anything).Return(true)
	repoGetter.EXPECT().GetRepository(mock.Anything, "test-ns", "test-repo").
		Return(mockRepo, nil)

	err := driver.processJob(context.Background(), recorder)
	require.NoError(t, err)

	worker.AssertNotCalled(t, "Process", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
}

func TestProcessJob_NormalAction_RepoPendingDelete_SkipsJob(t *testing.T) {
	worker := &MockWorker{}
	repoGetter := &MockRepoGetter{}
	recorder := &MockJobProgressRecorder{}
	driver := setupDriverForProcessJob(worker, repoGetter)
	driver.currentJob = makeTestJob("1")

	repoCfg := makeRepoConfig("test-repo", nil, map[string]string{
		appcontroller.LabelPendingDelete: "true",
	})
	mockRepo := &repository.MockRepository{}
	mockRepo.On("Config").Return(repoCfg)

	worker.EXPECT().IsSupported(mock.Anything, mock.Anything).Return(true)
	repoGetter.EXPECT().GetRepository(mock.Anything, "test-ns", "test-repo").
		Return(mockRepo, nil)
	recorder.EXPECT().Record(mock.Anything, mock.Anything)

	err := driver.processJob(context.Background(), recorder)
	require.NoError(t, err)

	worker.AssertNotCalled(t, "Process", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
}

// TestProcessJob_AuthFailureRepo_SkipsJob covers a repository already known to
// be unreachable due to an auth failure (e.g. revoked credentials). Running
// the job would only produce a failure the user can't act on from the job
// itself -- and one that counts against the job success rate -- so it is
// skipped with a warning result instead, leaving the repository status as the
// place the reason is surfaced.
func TestProcessJob_AuthFailureRepo_SkipsJob(t *testing.T) {
	worker := &MockWorker{}
	repoGetter := &MockRepoGetter{}
	recorder := &MockJobProgressRecorder{}
	driver := setupDriverForProcessJob(worker, repoGetter)
	driver.currentJob = makeTestJob("1")

	repoCfg := makeRepoConfig("test-repo", nil, nil)
	repoCfg.Status.Health = provisioning.HealthStatus{
		Healthy: false,
		Error:   provisioning.HealthFailureHealth,
		Checked: time.Now().UnixMilli(),
		Message: []string{"authentication failed"},
	}
	repoCfg.Status.Conditions = []metav1.Condition{{
		Type:   provisioning.ConditionTypeReady,
		Status: metav1.ConditionFalse,
		Reason: provisioning.ReasonAuthenticationFailed,
	}}
	mockRepo := &repository.MockRepository{}
	mockRepo.On("Config").Return(repoCfg)

	worker.EXPECT().IsSupported(mock.Anything, mock.Anything).Return(true)
	repoGetter.EXPECT().GetRepository(mock.Anything, "test-ns", "test-repo").
		Return(mockRepo, nil)
	recorder.EXPECT().Record(mock.Anything, mock.Anything)

	err := driver.processJob(context.Background(), recorder)
	require.NoError(t, err, "an unreachable repository must not fail the job")

	worker.AssertNotCalled(t, "Process", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
}

// TestProcessJob_AuthFailureRepo_TestActionStillRuns covers the synthetic test
// action, whose worker does no repository work and exists to exercise the queue.
// It must run even against an authentication-failed repository -- otherwise a
// performance test targeting an unhealthy repo would finish immediately as a
// warning instead of generating load.
func TestProcessJob_AuthFailureRepo_TestActionStillRuns(t *testing.T) {
	worker := &MockWorker{}
	repoGetter := &MockRepoGetter{}
	recorder := &MockJobProgressRecorder{}
	driver := setupDriverForProcessJob(worker, repoGetter)
	driver.currentJob = makeTestJob("1")
	driver.currentJob.Spec.Action = provisioning.JobActionTest

	repoCfg := makeRepoConfig("test-repo", nil, nil)
	repoCfg.Status.Health = provisioning.HealthStatus{
		Healthy: false,
		Error:   provisioning.HealthFailureHealth,
		Checked: time.Now().UnixMilli(),
		Message: []string{"authentication failed"},
	}
	repoCfg.Status.Conditions = []metav1.Condition{{
		Type:   provisioning.ConditionTypeReady,
		Status: metav1.ConditionFalse,
		Reason: provisioning.ReasonAuthenticationFailed,
	}}
	mockRepo := &repository.MockRepository{}
	mockRepo.On("Config").Return(repoCfg)

	worker.EXPECT().IsSupported(mock.Anything, mock.Anything).Return(true)
	repoGetter.EXPECT().GetRepository(mock.Anything, "test-ns", "test-repo").
		Return(mockRepo, nil)
	worker.EXPECT().Process(mock.Anything, mockRepo, mock.Anything, recorder).Return(nil)

	err := driver.processJob(context.Background(), recorder)
	require.NoError(t, err)

	worker.AssertCalled(t, "Process", mock.Anything, mockRepo, mock.Anything, recorder)
}

// TestProcessJob_StaleAuthFailureCondition_CallsWorker covers the race where a
// spec edit that repairs credentials bumps Generation immediately, but the
// Ready condition still reflects the pre-fix reconcile until the controller
// catches up (ready.ObservedGeneration lags behind). Skipping on that stale
// condition would silently drop a webhook-triggered job with no retry, so the
// job must run once the generations disagree.
func TestProcessJob_StaleAuthFailureCondition_CallsWorker(t *testing.T) {
	worker := &MockWorker{}
	repoGetter := &MockRepoGetter{}
	recorder := &MockJobProgressRecorder{}
	driver := setupDriverForProcessJob(worker, repoGetter)
	driver.currentJob = makeTestJob("1")

	repoCfg := makeRepoConfig("test-repo", nil, nil)
	repoCfg.Generation = 2 // spec was just edited to repair credentials
	repoCfg.Status.Health = provisioning.HealthStatus{
		Healthy: false,
		Error:   provisioning.HealthFailureHealth,
		Checked: time.Now().UnixMilli(),
		Message: []string{"authentication failed"},
	}
	repoCfg.Status.Conditions = []metav1.Condition{{
		Type:               provisioning.ConditionTypeReady,
		Status:             metav1.ConditionFalse,
		Reason:             provisioning.ReasonAuthenticationFailed,
		ObservedGeneration: 1, // stale -- controller hasn't reconciled generation 2 yet
	}}
	mockRepo := &repository.MockRepository{}
	mockRepo.On("Config").Return(repoCfg)

	worker.EXPECT().IsSupported(mock.Anything, mock.Anything).Return(true)
	repoGetter.EXPECT().GetRepository(mock.Anything, "test-ns", "test-repo").
		Return(mockRepo, nil)
	worker.EXPECT().Process(mock.Anything, mockRepo, mock.Anything, recorder).Return(nil)

	err := driver.processJob(context.Background(), recorder)
	require.NoError(t, err)

	worker.AssertCalled(t, "Process", mock.Anything, mockRepo, mock.Anything, recorder)
}

// TestProcessJob_UnhealthyButReachableRepo_CallsWorker covers a repository
// that's unhealthy for a reason that doesn't mean it's unreachable -- e.g. a
// write blocked by branch protection or write-only permissions. Reads (and
// other writes) still work against a repository like this, so the job must
// still run rather than being skipped as if credentials were broken.
// classifyTestResultReason classifies this as InvalidSpec rather than
// AuthenticationFailed precisely so the skip below can't trigger on it.
func TestProcessJob_UnhealthyButReachableRepo_CallsWorker(t *testing.T) {
	worker := &MockWorker{}
	repoGetter := &MockRepoGetter{}
	recorder := &MockJobProgressRecorder{}
	driver := setupDriverForProcessJob(worker, repoGetter)
	driver.currentJob = makeTestJob("1")

	repoCfg := makeRepoConfig("test-repo", nil, nil)
	repoCfg.Status.Health = provisioning.HealthStatus{
		Healthy: false,
		Error:   provisioning.HealthFailureHealth,
		Checked: time.Now().UnixMilli(),
		Message: []string{repository.WritePermissionDeniedDetail},
	}
	repoCfg.Status.Conditions = []metav1.Condition{{
		Type:   provisioning.ConditionTypeReady,
		Status: metav1.ConditionFalse,
		Reason: provisioning.ReasonInvalidSpec,
	}}
	mockRepo := &repository.MockRepository{}
	mockRepo.On("Config").Return(repoCfg)

	worker.EXPECT().IsSupported(mock.Anything, mock.Anything).Return(true)
	repoGetter.EXPECT().GetRepository(mock.Anything, "test-ns", "test-repo").
		Return(mockRepo, nil)
	worker.EXPECT().Process(mock.Anything, mockRepo, mock.Anything, recorder).Return(nil)

	err := driver.processJob(context.Background(), recorder)
	require.NoError(t, err)

	worker.AssertCalled(t, "Process", mock.Anything, mockRepo, mock.Anything, recorder)
}

// TestProcessJob_HookPermissionFailure_CallsWorker covers a repository whose
// webhook management failed with a permission error (e.g. the token lacks
// webhook-admin scope) while its content check still passes. That's recorded
// as HealthFailureHook, not HealthFailureHealth, and its Ready condition
// carries the same AuthenticationFailed reason an auth failure would -- but
// repo reads/writes still work fine, so the job must still run. The skip is
// gated on HealthFailureHealth specifically to exclude this case.
func TestProcessJob_HookPermissionFailure_CallsWorker(t *testing.T) {
	worker := &MockWorker{}
	repoGetter := &MockRepoGetter{}
	recorder := &MockJobProgressRecorder{}
	driver := setupDriverForProcessJob(worker, repoGetter)
	driver.currentJob = makeTestJob("1")

	repoCfg := makeRepoConfig("test-repo", nil, nil)
	repoCfg.Status.Health = provisioning.HealthStatus{
		Healthy: false,
		Error:   provisioning.HealthFailureHook,
		Checked: time.Now().UnixMilli(),
		Message: []string{"execute webhook create: " + repository.ErrPermissionDenied.Error()},
	}
	repoCfg.Status.Conditions = []metav1.Condition{{
		Type:   provisioning.ConditionTypeReady,
		Status: metav1.ConditionFalse,
		Reason: provisioning.ReasonAuthenticationFailed,
	}}
	mockRepo := &repository.MockRepository{}
	mockRepo.On("Config").Return(repoCfg)

	worker.EXPECT().IsSupported(mock.Anything, mock.Anything).Return(true)
	repoGetter.EXPECT().GetRepository(mock.Anything, "test-ns", "test-repo").
		Return(mockRepo, nil)
	worker.EXPECT().Process(mock.Anything, mockRepo, mock.Anything, recorder).Return(nil)

	err := driver.processJob(context.Background(), recorder)
	require.NoError(t, err)

	worker.AssertCalled(t, "Process", mock.Anything, mockRepo, mock.Anything, recorder)
}

// TestProcessJob_UncheckedHealth_CallsWorker guards the skip above against
// blocking a repository that simply hasn't had its first health check yet:
// unhealthy is only trusted once Checked is set.
func TestProcessJob_UncheckedHealth_CallsWorker(t *testing.T) {
	worker := &MockWorker{}
	repoGetter := &MockRepoGetter{}
	recorder := &MockJobProgressRecorder{}
	driver := setupDriverForProcessJob(worker, repoGetter)
	driver.currentJob = makeTestJob("1")

	repoCfg := makeRepoConfig("test-repo", nil, nil)
	repoCfg.Status.Health = provisioning.HealthStatus{Healthy: false}
	mockRepo := &repository.MockRepository{}
	mockRepo.On("Config").Return(repoCfg)

	worker.EXPECT().IsSupported(mock.Anything, mock.Anything).Return(true)
	repoGetter.EXPECT().GetRepository(mock.Anything, "test-ns", "test-repo").
		Return(mockRepo, nil)
	worker.EXPECT().Process(mock.Anything, mockRepo, mock.Anything, recorder).Return(nil)

	err := driver.processJob(context.Background(), recorder)
	require.NoError(t, err)

	worker.AssertCalled(t, "Process", mock.Anything, mockRepo, mock.Anything, recorder)
}

func TestProcessJob_HealthyRepo_CallsWorker(t *testing.T) {
	worker := &MockWorker{}
	repoGetter := &MockRepoGetter{}
	recorder := &MockJobProgressRecorder{}
	driver := setupDriverForProcessJob(worker, repoGetter)
	driver.currentJob = makeTestJob("1")

	repoCfg := makeRepoConfig("test-repo", nil, nil)
	mockRepo := &repository.MockRepository{}
	mockRepo.On("Config").Return(repoCfg)

	worker.EXPECT().IsSupported(mock.Anything, mock.Anything).Return(true)
	repoGetter.EXPECT().GetRepository(mock.Anything, "test-ns", "test-repo").
		Return(mockRepo, nil)
	worker.EXPECT().Process(mock.Anything, mockRepo, mock.Anything, recorder).Return(nil)

	err := driver.processJob(context.Background(), recorder)
	require.NoError(t, err)

	worker.AssertCalled(t, "Process", mock.Anything, mockRepo, mock.Anything, recorder)
}

func TestProcessJob_HealthyRepo_WorkerError_PropagatesError(t *testing.T) {
	worker := &MockWorker{}
	repoGetter := &MockRepoGetter{}
	recorder := &MockJobProgressRecorder{}
	driver := setupDriverForProcessJob(worker, repoGetter)
	driver.currentJob = makeTestJob("1")

	repoCfg := makeRepoConfig("test-repo", nil, nil)
	mockRepo := &repository.MockRepository{}
	mockRepo.On("Config").Return(repoCfg)

	worker.EXPECT().IsSupported(mock.Anything, mock.Anything).Return(true)
	repoGetter.EXPECT().GetRepository(mock.Anything, "test-ns", "test-repo").
		Return(mockRepo, nil)
	worker.EXPECT().Process(mock.Anything, mockRepo, mock.Anything, recorder).
		Return(errors.New("sync failed"))

	err := driver.processJob(context.Background(), recorder)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "sync failed")
}

func TestProcessJob_NoSupportedWorkers_ReturnsError(t *testing.T) {
	worker := &MockWorker{}
	repoGetter := &MockRepoGetter{}
	recorder := &MockJobProgressRecorder{}
	driver := setupDriverForProcessJob(worker, repoGetter)
	driver.currentJob = makeTestJob("1")

	worker.EXPECT().IsSupported(mock.Anything, mock.Anything).Return(false)

	err := driver.processJob(context.Background(), recorder)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no workers were registered to handle the job")
}

func TestProcessJob_OrphanCleanup_RepoRecreated_ReturnsError(t *testing.T) {
	for _, action := range []provisioning.JobAction{
		provisioning.JobActionReleaseResources,
		provisioning.JobActionDeleteResources,
	} {
		t.Run(string(action), func(t *testing.T) {
			worker := &MockWorker{}
			repoGetter := &MockRepoGetter{}
			recorder := &MockJobProgressRecorder{}
			driver := setupDriverForProcessJob(worker, repoGetter)
			driver.currentJob = makeOrphanJob(action)

			repoCfg := makeRepoConfig("deleted-repo", nil, nil)
			mockRepo := &repository.MockRepository{}
			mockRepo.On("Config").Return(repoCfg)

			worker.EXPECT().IsSupported(mock.Anything, mock.Anything).Return(true)
			repoGetter.EXPECT().GetRepository(mock.Anything, "test-ns", "deleted-repo").
				Return(mockRepo, nil)

			err := driver.processJob(context.Background(), recorder)
			require.Error(t, err)
			assert.Contains(t, err.Error(), "exists and is healthy")

			worker.AssertNotCalled(t, "Process", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
		})
	}
}

func TestProcessJob_NilCurrentJob_ReturnsNil(t *testing.T) {
	driver := &jobProcessor{}
	recorder := &MockJobProgressRecorder{}

	err := driver.processJob(context.Background(), recorder)
	require.NoError(t, err)
}

// TestProcessJobWithLeaseCheck_LeaseExpiry_CancelsAndWaitsForWorker verifies that
// losing the lease actively cancels the in-flight worker and does not report the
// abort until the worker has actually stopped. Without this, a reaped-and-re-claimed
// job could keep running on this pod while another pod runs the same job.
func TestProcessJobWithLeaseCheck_LeaseExpiry_CancelsAndWaitsForWorker(t *testing.T) {
	worker := &MockWorker{}
	repoGetter := &MockRepoGetter{}
	recorder := &MockJobProgressRecorder{}
	driver := setupDriverForProcessJob(worker, repoGetter)
	driver.currentJob = makeTestJob("1")

	repoCfg := makeRepoConfig("test-repo", nil, nil)
	mockRepo := &repository.MockRepository{}
	mockRepo.On("Config").Return(repoCfg)

	workerStarted := make(chan struct{})
	workerReturned := make(chan struct{})

	worker.EXPECT().IsSupported(mock.Anything, mock.Anything).Return(true)
	repoGetter.EXPECT().GetRepository(mock.Anything, "test-ns", "test-repo").
		Return(mockRepo, nil)
	// A well-behaved worker: block until its context is cancelled, then return.
	worker.EXPECT().Process(mock.Anything, mockRepo, mock.Anything, recorder).
		RunAndReturn(func(ctx context.Context, _ repository.Repository, _ provisioning.Job, _ JobProgressRecorder) error {
			close(workerStarted)
			<-ctx.Done()
			close(workerReturned)
			return ctx.Err()
		})

	leaseExpired := make(chan struct{})
	done := make(chan error, 1)
	go func() {
		done <- driver.processJobWithLeaseCheck(context.Background(), recorder, leaseExpired)
	}()

	// Wait until the worker is running, then signal that the lease was lost.
	select {
	case <-workerStarted:
	case <-time.After(3 * time.Second):
		t.Fatal("worker.Process was not invoked")
	}
	close(leaseExpired)

	select {
	case err := <-done:
		require.Error(t, err)
		assert.Contains(t, err.Error(), "aborted due to lease expiry")
		// The worker must have observed cancellation and returned before
		// processJobWithLeaseCheck reported the abort.
		select {
		case <-workerReturned:
		default:
			t.Fatal("processJobWithLeaseCheck returned before the worker stopped — in-flight work was not cancelled and awaited")
		}
	case <-time.After(3 * time.Second):
		t.Fatal("processJobWithLeaseCheck did not abort after lease expiry")
	}
}

func TestWithJobAuthorSignature(t *testing.T) {
	tests := []struct {
		name        string
		annotations map[string]string
		expected    *repository.CommitSignature
	}{
		{
			name: "name and email set the signature",
			annotations: map[string]string{
				appjobs.AnnoAuthor:      "Test User",
				appjobs.AnnoAuthorEmail: "test@example.com",
			},
			expected: &repository.CommitSignature{Name: "Test User", Email: "test@example.com"},
		},
		{
			name:        "a name without an email keeps the default commit identity",
			annotations: map[string]string{appjobs.AnnoAuthor: "Test User"},
			expected:    nil,
		},
		{
			name:        "no author annotations leaves the context untouched",
			annotations: map[string]string{"unrelated": "value"},
			expected:    nil,
		},
		{
			name:        "nil annotations leaves the context untouched",
			annotations: nil,
			expected:    nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			job := &provisioning.Job{ObjectMeta: metav1.ObjectMeta{Annotations: tt.annotations}}
			ctx := withJobAuthorSignature(context.Background(), job)
			assert.Equal(t, tt.expected, repository.GetAuthorSignature(ctx))
		})
	}
}

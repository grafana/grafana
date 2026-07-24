package jobs

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	clienttesting "k8s.io/client-go/testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	fakeclientset "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	provisioningv0alpha1 "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func newTestStore(client provisioningv0alpha1.ProvisioningV0alpha1Interface) *persistentStore {
	return &persistentStore{
		client:       client,
		clock:        time.Now,
		expiry:       30 * time.Second,
		queueMetrics: RegisterQueueMetrics(prometheus.NewPedanticRegistry()),
	}
}

// TestClaim_StampsOwnerToken verifies that claiming a job stamps a unique owner
// token alongside the claim timestamp, so ownership can be verified later.
func TestClaim_StampsOwnerToken(t *testing.T) {
	fakeClient := newTestClientset()
	store := newTestStore(fakeClient)

	ctx, _, err := identity.WithProvisioningIdentity(context.Background(), "stacks-123")
	require.NoError(t, err)

	_, err = fakeClient.Jobs("stacks-123").Create(ctx, &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "test-job", Namespace: "stacks-123"},
		Spec:       provisioning.JobSpec{Repository: "test-repo", Action: provisioning.JobActionPull},
	}, metav1.CreateOptions{})
	require.NoError(t, err)

	claimed, rollback, err := store.Claim(ctx)
	require.NoError(t, err)
	require.NotNil(t, claimed)
	defer rollback()

	assert.NotEmpty(t, claimed.Labels[LabelJobClaim], "claim timestamp should be set")
	assert.NotEmpty(t, claimed.Labels[LabelJobClaimOwner], "claim owner token should be set")
}

// TestClaim_RollbackSkipsJobOwnedByAnother verifies that the claim rollback does not
// strip the claim from a job that is now owned by another worker. Job names are
// deterministic, so by the time we roll back, the same name may be a re-created job
// another worker is running; clearing its claim would reintroduce duplicate execution.
func TestClaim_RollbackSkipsJobOwnedByAnother(t *testing.T) {
	fakeClient := newTestClientset()
	store := newTestStore(fakeClient)

	ctx, _, err := identity.WithProvisioningIdentity(context.Background(), "stacks-123")
	require.NoError(t, err)

	_, err = fakeClient.Jobs("stacks-123").Create(ctx, &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "test-job", Namespace: "stacks-123"},
		Spec:       provisioning.JobSpec{Repository: "test-repo", Action: provisioning.JobActionPull},
	}, metav1.CreateOptions{})
	require.NoError(t, err)

	_, rollback, err := store.Claim(ctx)
	require.NoError(t, err)

	// Simulate another worker taking over the same job name after our claim.
	taken, err := fakeClient.Jobs("stacks-123").Get(ctx, "test-job", metav1.GetOptions{})
	require.NoError(t, err)
	taken.Labels[LabelJobClaimOwner] = "another-worker"
	_, err = fakeClient.Jobs("stacks-123").Update(ctx, taken, metav1.UpdateOptions{})
	require.NoError(t, err)

	// Rolling back our (now lost) claim must not disturb the other worker's job.
	rollback()

	after, err := fakeClient.Jobs("stacks-123").Get(ctx, "test-job", metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, "another-worker", after.Labels[LabelJobClaimOwner], "rollback must not strip another worker's claim")
	assert.NotEmpty(t, after.Labels[LabelJobClaim], "rollback must not clear the active claim timestamp")
}

// lostRowOnUpdate simulates the list->update race in Claim: another worker
// completed and deleted the job between our List and Update, so the
// update-becomes-create is rejected because the object still carries the
// resourceVersion from the List. Unified storage surfaces this as a plain
// 500/Unknown (see apistore prepareObjectForStorage + the apiserver's
// errToAPIStatus fallback), NOT a typed Conflict/Invalid/NotFound.
func lostRowOnUpdate() error {
	return &apierrors.StatusError{ErrStatus: metav1.Status{
		Status:  metav1.StatusFailure,
		Code:    http.StatusInternalServerError,
		Reason:  metav1.StatusReasonUnknown,
		Message: "resourceVersion should not be set on objects to be created",
	}}
}

// TestClaim_SkipsJobLostBetweenListAndUpdate verifies that when the claim Update
// for one candidate fails (the row was completed+deleted in the race window), the
// claim moves on to the next candidate instead of failing the whole Claim call.
func TestClaim_SkipsJobLostBetweenListAndUpdate(t *testing.T) {
	cs := fakeclientset.NewSimpleClientset()
	store := newTestStore(cs.ProvisioningV0alpha1())

	ctx, _, err := identity.WithProvisioningIdentity(context.Background(), "stacks-123")
	require.NoError(t, err)

	for _, name := range []string{"job-a", "job-b"} {
		_, err = cs.ProvisioningV0alpha1().Jobs("stacks-123").Create(ctx, &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "stacks-123"},
			Spec:       provisioning.JobSpec{Repository: "test-repo", Action: provisioning.JobActionPull},
		}, metav1.CreateOptions{})
		require.NoError(t, err)
	}

	// Fail the first claim Update as if that job was deleted in the race window,
	// then let the tracker handle subsequent updates normally.
	var updates int
	cs.PrependReactor("update", "jobs", func(clienttesting.Action) (bool, runtime.Object, error) {
		updates++
		if updates == 1 {
			return true, nil, lostRowOnUpdate()
		}
		return false, nil, nil
	})

	claimed, rollback, err := store.Claim(ctx)
	require.NoError(t, err, "a failed claim on one candidate must not fail the whole Claim call")
	require.NotNil(t, claimed)
	defer rollback()

	assert.NotEmpty(t, claimed.Labels[LabelJobClaim], "the surviving candidate should be claimed")
	assert.GreaterOrEqual(t, updates, 2, "should have skipped the lost candidate and claimed the next")
}

// TestClaim_FailsFastOnUnexpectedError verifies that a non-race error (e.g. the
// apiserver being unavailable) aborts the claim immediately instead of retrying every
// listed candidate. Otherwise a single tick would fire up to 16 doomed writes per driver
// at an already-struggling apiserver.
func TestClaim_FailsFastOnUnexpectedError(t *testing.T) {
	cs := fakeclientset.NewSimpleClientset()
	store := newTestStore(cs.ProvisioningV0alpha1())

	ctx, _, err := identity.WithProvisioningIdentity(context.Background(), "stacks-123")
	require.NoError(t, err)

	for _, name := range []string{"job-a", "job-b", "job-c"} {
		_, err = cs.ProvisioningV0alpha1().Jobs("stacks-123").Create(ctx, &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "stacks-123"},
			Spec:       provisioning.JobSpec{Repository: "test-repo", Action: provisioning.JobActionPull},
		}, metav1.CreateOptions{})
		require.NoError(t, err)
	}

	var updates int
	cs.PrependReactor("update", "jobs", func(clienttesting.Action) (bool, runtime.Object, error) {
		updates++
		return true, nil, apierrors.NewServiceUnavailable("apiserver down")
	})

	claimed, rollback, err := store.Claim(ctx)
	require.Error(t, err)
	assert.NotErrorIs(t, err, ErrNoJobs, "an unexpected error must surface, not be masked as ErrNoJobs")
	assert.Nil(t, claimed)
	assert.Nil(t, rollback)
	assert.Equal(t, 1, updates, "must fail fast on the first unexpected error, not hammer every candidate")
}

// TestClaim_LostRowReturnsNoJobs verifies that when the only candidate cannot be
// claimed (lost in the race window), Claim reports ErrNoJobs rather than a hard
// error, so the driver simply retries on its next tick.
func TestClaim_LostRowReturnsNoJobs(t *testing.T) {
	cs := fakeclientset.NewSimpleClientset()
	store := newTestStore(cs.ProvisioningV0alpha1())

	ctx, _, err := identity.WithProvisioningIdentity(context.Background(), "stacks-123")
	require.NoError(t, err)

	_, err = cs.ProvisioningV0alpha1().Jobs("stacks-123").Create(ctx, &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{Name: "only-job", Namespace: "stacks-123"},
		Spec:       provisioning.JobSpec{Repository: "test-repo", Action: provisioning.JobActionPull},
	}, metav1.CreateOptions{})
	require.NoError(t, err)

	cs.PrependReactor("update", "jobs", func(clienttesting.Action) (bool, runtime.Object, error) {
		return true, nil, lostRowOnUpdate()
	})

	claimed, rollback, err := store.Claim(ctx)
	require.ErrorIs(t, err, ErrNoJobs, "an unclaimable sole candidate must surface as ErrNoJobs, not a hard error")
	assert.Nil(t, claimed)
	assert.Nil(t, rollback)
}

// TestRenewLease_LostToAnotherOwner verifies that a worker cannot renew a claim
// that now belongs to a different owner (same job name, different owner token).
// This is the core protection against two workers processing the same job: once
// a job is reaped and re-claimed by another worker, the original worker's renewal
// must fail with ErrLeaseLost so it aborts instead of continuing to run.
func TestRenewLease_LostToAnotherOwner(t *testing.T) {
	fakeClient := newTestClientset()
	store := newTestStore(fakeClient)

	ctx, _, err := identity.WithProvisioningIdentity(context.Background(), "stacks-123")
	require.NoError(t, err)

	// The store's job is claimed by owner-B.
	created, err := fakeClient.Jobs("stacks-123").Create(ctx, &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-job",
			Namespace: "stacks-123",
			UID:       "uid-1",
			Labels: map[string]string{
				LabelJobClaim:      "1000000000000",
				LabelJobClaimOwner: "owner-B",
			},
		},
		Spec: provisioning.JobSpec{Repository: "test-repo", Action: provisioning.JobActionPull},
	}, metav1.CreateOptions{})
	require.NoError(t, err)

	// We hold a claim with owner-A on the same job name/UID.
	ours := created.DeepCopy()
	ours.Labels[LabelJobClaimOwner] = "owner-A"

	err = store.RenewLease(ctx, ours)
	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrLeaseLost), "expected ErrLeaseLost, got %v", err)
}

// TestRenewLease_LostToReincarnatedJob verifies that a matching owner token is not
// enough: if the object was deleted and re-created under the same name (new UID),
// renewal must still fail.
func TestRenewLease_LostToReincarnatedJob(t *testing.T) {
	fakeClient := newTestClientset()
	store := newTestStore(fakeClient)

	ctx, _, err := identity.WithProvisioningIdentity(context.Background(), "stacks-123")
	require.NoError(t, err)

	created, err := fakeClient.Jobs("stacks-123").Create(ctx, &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-job",
			Namespace: "stacks-123",
			UID:       "uid-2", // reincarnated object has a new UID
			Labels: map[string]string{
				LabelJobClaim:      "1000000000000",
				LabelJobClaimOwner: "owner-A",
			},
		},
		Spec: provisioning.JobSpec{Repository: "test-repo", Action: provisioning.JobActionPull},
	}, metav1.CreateOptions{})
	require.NoError(t, err)

	// Same owner token, but we still hold the original UID.
	ours := created.DeepCopy()
	ours.UID = "uid-1"

	err = store.RenewLease(ctx, ours)
	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrLeaseLost), "expected ErrLeaseLost, got %v", err)
}

// TestComplete_RefusesJobOwnedByAnother verifies that a worker which has lost its
// lease does not delete the job now owned by another worker. Complete must report
// NotFound and leave the job in the store untouched.
func TestComplete_RefusesJobOwnedByAnother(t *testing.T) {
	fakeClient := newTestClientset()
	store := newTestStore(fakeClient)

	ctx, _, err := identity.WithProvisioningIdentity(context.Background(), "stacks-123")
	require.NoError(t, err)

	// The store holds a job now owned by owner-B (a reincarnation with a new UID).
	_, err = fakeClient.Jobs("stacks-123").Create(ctx, &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-job",
			Namespace: "stacks-123",
			UID:       "uid-2",
			Labels: map[string]string{
				LabelJobClaim:      "2000000000000",
				LabelJobClaimOwner: "owner-B",
			},
		},
		Spec: provisioning.JobSpec{Repository: "test-repo", Action: provisioning.JobActionPull},
	}, metav1.CreateOptions{})
	require.NoError(t, err)

	// We try to complete our stale claim (original UID, owner-A).
	stale := &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-job",
			Namespace: "stacks-123",
			UID:       "uid-1",
			Labels: map[string]string{
				LabelJobClaim:      "1000000000000",
				LabelJobClaimOwner: "owner-A",
			},
		},
		Spec: provisioning.JobSpec{Repository: "test-repo", Action: provisioning.JobActionPull},
	}

	err = store.Complete(ctx, stale)
	require.Error(t, err)
	assert.True(t, apierrors.IsNotFound(err), "expected NotFound, got %v", err)

	// The job owned by owner-B must still be in the store.
	still, err := fakeClient.Jobs("stacks-123").Get(ctx, "test-job", metav1.GetOptions{})
	require.NoError(t, err)
	assert.Equal(t, "owner-B", still.Labels[LabelJobClaimOwner])
}

// TestComplete_SucceedsForOwner verifies the happy path: the rightful owner
// completes and the job is removed from the active store.
func TestComplete_SucceedsForOwner(t *testing.T) {
	fakeClient := newTestClientset()
	store := newTestStore(fakeClient)

	ctx, _, err := identity.WithProvisioningIdentity(context.Background(), "stacks-123")
	require.NoError(t, err)

	created, err := fakeClient.Jobs("stacks-123").Create(ctx, &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-job",
			Namespace: "stacks-123",
			UID:       "uid-1",
			Labels: map[string]string{
				LabelJobClaim:      "1000000000000",
				LabelJobClaimOwner: "owner-A",
			},
		},
		Spec: provisioning.JobSpec{Repository: "test-repo", Action: provisioning.JobActionPull},
	}, metav1.CreateOptions{})
	require.NoError(t, err)

	err = store.Complete(ctx, created.DeepCopy())
	require.NoError(t, err)

	_, err = fakeClient.Jobs("stacks-123").Get(ctx, "test-job", metav1.GetOptions{})
	assert.True(t, apierrors.IsNotFound(err), "job should be deleted, got %v", err)
}

func newTestClientset() provisioningv0alpha1.ProvisioningV0alpha1Interface {
	//nolint:staticcheck // NewSimpleClientset is needed; NewClientset requires schema registration not available for this type.
	return fakeclientset.NewSimpleClientset().ProvisioningV0alpha1()
}

// TestRenewLease_StaleResourceVersion verifies that after RenewLease, the
// in-memory job's ResourceVersion matches what K8s actually has.
//
// Bug: RenewLease discards the K8s Update return value (`_`) and stores
// the stale ResourceVersion from the prior Get call. This guarantees that
// the next Store.Update (e.g., from onProgress) will get a conflict error.
func TestRenewLease_StaleResourceVersion(t *testing.T) {
	fakeClient := newTestClientset()

	store := &persistentStore{
		client: fakeClient,
		clock:  time.Now,
		expiry: 30 * time.Second,
		queueMetrics: QueueMetrics{
			queueSize:     nil,
			queueWaitTime: nil,
		},
	}

	ctx, _, err := identity.WithProvisioningIdentity(context.Background(), "stacks-123")
	require.NoError(t, err)

	created, err := fakeClient.Jobs("stacks-123").Create(ctx, &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-job",
			Namespace: "stacks-123",
			Labels: map[string]string{
				LabelJobClaim: "1000000000000",
			},
		},
		Spec: provisioning.JobSpec{
			Repository: "test-repo",
			Action:     provisioning.JobActionPull,
		},
	}, metav1.CreateOptions{})
	require.NoError(t, err)

	// Copy the job, simulating what jobDriver stores in d.currentJob
	jobInMemory := created.DeepCopy()

	err = store.RenewLease(ctx, jobInMemory)
	require.NoError(t, err)

	// Now fetch the actual state from K8s
	actual, err := fakeClient.Jobs("stacks-123").Get(ctx, "test-job", metav1.GetOptions{})
	require.NoError(t, err)

	assert.Equal(t, actual.ResourceVersion, jobInMemory.ResourceVersion,
		"After RenewLease, in-memory ResourceVersion (%s) must match K8s ResourceVersion (%s). "+
			"A mismatch means RenewLease stored a stale version, which guarantees a conflict "+
			"on the next Update call (e.g., from onProgress).",
		jobInMemory.ResourceVersion, actual.ResourceVersion,
	)
}

// TestRenewLease_ResourceVersionProgresses verifies that consecutive
// RenewLease calls keep the in-memory ResourceVersion in sync with K8s.
func TestRenewLease_ResourceVersionProgresses(t *testing.T) {
	fakeClient := newTestClientset()

	store := &persistentStore{
		client: fakeClient,
		clock:  time.Now,
		expiry: 30 * time.Second,
		queueMetrics: QueueMetrics{
			queueSize:     nil,
			queueWaitTime: nil,
		},
	}

	ctx, _, err := identity.WithProvisioningIdentity(context.Background(), "stacks-123")
	require.NoError(t, err)

	created, err := fakeClient.Jobs("stacks-123").Create(ctx, &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-job",
			Namespace: "stacks-123",
			Labels: map[string]string{
				LabelJobClaim: "1000000000000",
			},
		},
		Spec: provisioning.JobSpec{
			Repository: "test-repo",
			Action:     provisioning.JobActionPull,
		},
	}, metav1.CreateOptions{})
	require.NoError(t, err)

	jobInMemory := created.DeepCopy()

	// Do 3 consecutive lease renewals. After each, the in-memory RV should
	// stay in sync with K8s.
	for i := range 3 {
		err = store.RenewLease(ctx, jobInMemory)
		require.NoError(t, err, "RenewLease iteration %d", i)

		actual, err := fakeClient.Jobs("stacks-123").Get(ctx, "test-job", metav1.GetOptions{})
		require.NoError(t, err)

		assert.Equal(t, actual.ResourceVersion, jobInMemory.ResourceVersion,
			"RenewLease iteration %d: in-memory RV (%s) != K8s RV (%s) — stale version stored",
			i, jobInMemory.ResourceVersion, actual.ResourceVersion,
		)
	}
}

// TestRenewLease_ThenUpdateDoesNotConflict verifies that an Update call
// immediately after RenewLease does NOT produce a conflict. This is the
// real-world scenario: lease renewal followed by a progress update.
func TestRenewLease_ThenUpdateDoesNotConflict(t *testing.T) {
	fakeClient := newTestClientset()

	store := &persistentStore{
		client: fakeClient,
		clock:  time.Now,
		expiry: 30 * time.Second,
		queueMetrics: QueueMetrics{
			queueSize:     nil,
			queueWaitTime: nil,
		},
	}

	ctx, _, err := identity.WithProvisioningIdentity(context.Background(), "stacks-123")
	require.NoError(t, err)

	created, err := fakeClient.Jobs("stacks-123").Create(ctx, &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-job",
			Namespace: "stacks-123",
			Labels: map[string]string{
				LabelJobClaim: "1000000000000",
			},
		},
		Spec: provisioning.JobSpec{
			Repository: "test-repo",
			Action:     provisioning.JobActionPull,
		},
	}, metav1.CreateOptions{})
	require.NoError(t, err)

	jobInMemory := created.DeepCopy()

	// Simulate lease renewal (like leaseRenewalLoop)
	err = store.RenewLease(ctx, jobInMemory)
	require.NoError(t, err)

	// Simulate progress update (like onProgress) — this should NOT conflict
	jobInMemory.Status = provisioning.JobStatus{
		State:   provisioning.JobStateWorking,
		Message: "progress update after lease renewal",
	}
	_, err = store.Update(ctx, jobInMemory)
	assert.NoError(t, err,
		"Update after RenewLease should not conflict. "+
			"If it does, RenewLease stored a stale ResourceVersion.")
}

func TestGenerateJobName(t *testing.T) {
	t.Run("pull and migrate share a deterministic sync name", func(t *testing.T) {
		pull := &provisioning.Job{Spec: provisioning.JobSpec{Repository: "repo", Action: provisioning.JobActionPull}}
		migrate := &provisioning.Job{Spec: provisioning.JobSpec{Repository: "repo", Action: provisioning.JobActionMigrate}}
		generateJobName(pull)
		generateJobName(migrate)
		assert.Equal(t, "repo-sync", pull.Name)
		assert.Equal(t, "repo-sync", migrate.Name)
	})

	t.Run("test jobs get unique names so concurrent load can be queued on one repository", func(t *testing.T) {
		first := &provisioning.Job{Spec: provisioning.JobSpec{Repository: "repo", Action: provisioning.JobActionTest}}
		second := &provisioning.Job{Spec: provisioning.JobSpec{Repository: "repo", Action: provisioning.JobActionTest}}
		generateJobName(first)
		generateJobName(second)
		assert.NotEqual(t, first.Name, second.Name,
			"two test jobs on the same repository must not collide on name")
		assert.Contains(t, first.Name, "repo-test-")
		assert.Contains(t, second.Name, "repo-test-")
	})
}

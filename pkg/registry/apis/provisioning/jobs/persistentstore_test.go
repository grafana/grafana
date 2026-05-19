package jobs

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	fakeclientset "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	provisioningv0alpha1 "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

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

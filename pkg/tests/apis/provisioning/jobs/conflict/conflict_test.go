package conflict

import (
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// TestIntegrationProvisioning_JobConflict tests that if two concurrent drivers try to update a
// job they received before the other updated it, that one will fail. This is critical for concurrent jobs.
func TestIntegrationProvisioning_JobConflict(t *testing.T) {
	helper := sharedHelper(t)

	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Job",
			"metadata": map[string]interface{}{
				"name":      "test-job-conflict",
				"namespace": "default",
			},
			"spec": map[string]interface{}{
				"action":     string(provisioning.JobActionPull),
				"repository": "test-repo",
				"pull": map[string]interface{}{
					"incremental": false,
				},
			},
		},
	}
	createdJob, err := helper.Jobs.Resource.Create(t.Context(), obj, metav1.CreateOptions{})
	require.NoError(t, err)

	job, err := helper.Jobs.Resource.Get(t.Context(), createdJob.GetName(), metav1.GetOptions{})
	require.NoError(t, err)
	job2, err := helper.Jobs.Resource.Get(t.Context(), createdJob.GetName(), metav1.GetOptions{})
	require.NoError(t, err)

	client1Update := job.DeepCopy()
	if client1Update.GetLabels() == nil {
		client1Update.SetLabels(make(map[string]string))
	}
	labels := client1Update.GetLabels()
	labels["provisioning.grafana.app/claim"] = "client1-claim"
	client1Update.SetLabels(labels)
	updatedJob, err := helper.Jobs.Resource.Update(t.Context(), client1Update, metav1.UpdateOptions{})
	require.NoError(t, err)
	require.NotEqual(t, job.GetResourceVersion(), updatedJob.GetResourceVersion())

	client2Update := job2.DeepCopy()
	if client2Update.GetLabels() == nil {
		client2Update.SetLabels(make(map[string]string))
	}
	labels2 := client2Update.GetLabels()
	labels2["provisioning.grafana.app/claim"] = "client2-claim"
	client2Update.SetLabels(labels2)
	_, err = helper.Jobs.Resource.Update(t.Context(), client2Update, metav1.UpdateOptions{})
	require.Error(t, err)
	require.True(t, apierrors.IsConflict(err), "should get conflict error when updating with stale resource version")

	err = helper.Jobs.Resource.Delete(t.Context(), createdJob.GetName(), metav1.DeleteOptions{})
	require.NoError(t, err)
}

// TestIntegrationProvisioning_JobDeleteConflict covers the delete half of the same
// optimistic-concurrency contract, through the real apiserver and unified storage.
//
// CleanupQueue clears a terminating repository's pending jobs by deleting each one under a
// ResourceVersion precondition, so a job a worker claims between the List and the Delete is
// never removed mid-execution. On conflict it re-fetches and retries the delete against the
// fresh version when the job turns out to be unclaimed. Both halves rest on the storage
// actually enforcing the precondition rather than treating the delete as unconditional —
// which is what this asserts.
func TestIntegrationProvisioning_JobDeleteConflict(t *testing.T) {
	helper := sharedHelper(t)

	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Job",
			"metadata": map[string]interface{}{
				"name":      "test-job-delete-conflict",
				"namespace": "default",
			},
			"spec": map[string]interface{}{
				"action":     string(provisioning.JobActionPull),
				"repository": "test-repo",
				"pull": map[string]interface{}{
					"incremental": false,
				},
			},
		},
	}
	createdJob, err := helper.Jobs.Resource.Create(t.Context(), obj, metav1.CreateOptions{})
	require.NoError(t, err)

	// The version CleanupQueue would have observed in its List.
	staleVersion := createdJob.GetResourceVersion()
	require.NotEmpty(t, staleVersion)

	// A worker claims the job after that List, bumping its resource version.
	claim := createdJob.DeepCopy()
	claim.SetLabels(map[string]string{"provisioning.grafana.app/claim": "client1-claim"})
	claimedJob, err := helper.Jobs.Resource.Update(t.Context(), claim, metav1.UpdateOptions{})
	require.NoError(t, err)
	require.NotEqual(t, staleVersion, claimedJob.GetResourceVersion())

	// Deleting against the stale version must conflict instead of removing the claimed job.
	err = helper.Jobs.Resource.Delete(t.Context(), createdJob.GetName(), metav1.DeleteOptions{
		Preconditions: &metav1.Preconditions{ResourceVersion: &staleVersion},
	})
	require.Error(t, err)
	require.True(t, apierrors.IsConflict(err), "should get conflict error when deleting with stale resource version")

	survivor, err := helper.Jobs.Resource.Get(t.Context(), createdJob.GetName(), metav1.GetOptions{})
	require.NoError(t, err, "a conflicting delete must leave the job in place")
	require.Equal(t, claimedJob.GetResourceVersion(), survivor.GetResourceVersion())

	// Retrying against the version from the re-fetch — what deleteUnclaimedJob does once it
	// has confirmed the job is still a cleanup candidate — must succeed.
	freshVersion := survivor.GetResourceVersion()
	err = helper.Jobs.Resource.Delete(t.Context(), createdJob.GetName(), metav1.DeleteOptions{
		Preconditions: &metav1.Preconditions{ResourceVersion: &freshVersion},
	})
	require.NoError(t, err)

	_, err = helper.Jobs.Resource.Get(t.Context(), createdJob.GetName(), metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err), "job should be gone after the conditional delete succeeds")
}

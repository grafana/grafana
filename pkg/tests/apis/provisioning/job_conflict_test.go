package provisioning

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationProvisioning_JobConflict tests that if two concurrent drivers try to update a
// job they received before the other updated it, that one will fail. This is critical for concurrent jobs
func TestIntegrationProvisioning_JobConflict(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// disable the controllers so the jobs don't get auto-processed
	helper := runGrafana(t, func(opts *testinfra.GrafanaOpts) {
		opts.DisableControllers = true
	})
	ctx := context.Background()

	// create a job
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
	createdJob, err := helper.Jobs.Resource.Create(ctx, obj, metav1.CreateOptions{})
	require.NoError(t, err)

	// have two clients get the same job before either has updated it. this simulates the race condition
	// between two concurrent workers.
	job, err := helper.Jobs.Resource.Get(ctx, createdJob.GetName(), metav1.GetOptions{})
	require.NoError(t, err)
	job2, err := helper.Jobs.Resource.Get(ctx, createdJob.GetName(), metav1.GetOptions{})
	require.NoError(t, err)

	// have the first client update the job, this should update the RV
	client1Update := job.DeepCopy()
	if client1Update.GetLabels() == nil {
		client1Update.SetLabels(make(map[string]string))
	}
	labels := client1Update.GetLabels()
	labels["provisioning.grafana.app/claim"] = "client1-claim"
	client1Update.SetLabels(labels)
	updatedJob, err := helper.Jobs.Resource.Update(ctx, client1Update, metav1.UpdateOptions{})
	require.NoError(t, err)
	require.NotEqual(t, job.GetResourceVersion(), updatedJob.GetResourceVersion())

	// now when client two tries to update the job, the RV is no longer what it originally received
	client2Update := job2.DeepCopy()
	if client2Update.GetLabels() == nil {
		client2Update.SetLabels(make(map[string]string))
	}
	labels2 := client2Update.GetLabels()
	labels2["provisioning.grafana.app/claim"] = "client2-claim"
	client2Update.SetLabels(labels2)
	_, err = helper.Jobs.Resource.Update(ctx, client2Update, metav1.UpdateOptions{})
	require.Error(t, err)
	require.True(t, apierrors.IsConflict(err), "should get conflict error when updating with stale resource version")

	// clean up
	err = helper.Jobs.Resource.Delete(ctx, createdJob.GetName(), metav1.DeleteOptions{})
	require.NoError(t, err)
}

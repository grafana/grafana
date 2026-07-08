package nats

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioningNATS_JobProcessedOverNATS proves the job-queue
// driver is woken by a live NATS notification. The driver has two wake sources:
// the job-create notification (fed by the job informer) and a fallback poll,
// which WithNATS pushes out to 10 minutes. So a job that reaches a terminal
// historic state within liveDeliveryWait must have been picked up because the
// live ADDED notification woke the driver, not the poll.
func TestIntegrationProvisioningNATS_JobProcessedOverNATS(t *testing.T) {
	helper := sharedHelper(t)
	ctx := t.Context()

	const repo = "nats-job-repo"
	createLocalRepo(t, helper, repo)

	// The repository must be healthy before a pull job can succeed; this first
	// reconcile itself rides on NATS.
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		healthy, found, err := unstructured.NestedBool(obj.Object, "status", "health", "healthy")
		assert.NoError(collect, err)
		assert.True(collect, found && healthy, "repository should be healthy before syncing")
	}, liveDeliveryWait, liveDeliveryTick, "repository should become healthy over NATS")

	// Post a pull job directly (sync is disabled, so nothing else queues one).
	body := common.AsJSON(&provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})
	result := helper.AdminREST.Post().
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("jobs").
		Body(body).
		SetHeader("Content-Type", "application/json").
		Do(ctx)
	obj, err := result.Get()
	require.NoError(t, err, "should be able to queue a pull job")
	job, ok := obj.(*unstructured.Unstructured)
	require.True(t, ok, "expected unstructured job, got %T", obj)
	uid := string(job.GetUID())
	require.NotEmpty(t, uid, "queued job should have a UID")

	// The historic job (keyed by the active job's UID) must reach success within
	// the live-delivery window.
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		hj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "jobs", uid)
		if !assert.NoError(collect, err, "historic job should be retrievable") {
			return
		}
		state := common.MustNestedString(hj.Object, "status", "state")
		assert.Equal(collect, string(provisioning.JobStateSuccess), state, "job should succeed")
	}, liveDeliveryWait, liveDeliveryTick, "pull job should be processed over NATS within %s", liveDeliveryWait)
}

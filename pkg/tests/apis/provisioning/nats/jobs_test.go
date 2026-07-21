package nats

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioningNATS_JobProcessedOverNATS proves the job-queue
// driver is woken by a live NATS notification, without depending on a
// repository. The Job references a repository that does not exist, so the
// driver fails it fast — but it can only act that quickly if the job-create
// notification woke it: the driver's fallback poll is 10 minutes out
// (WithNATS). Reaching a terminal state (or being archived away) within
// liveDeliveryWait therefore proves live delivery.
func TestIntegrationProvisioningNATS_JobProcessedOverNATS(t *testing.T) {
	helper := sharedHelper(t)

	job := helper.CreatePullJob(t, "nats-job-direct", "ghost-repo")

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		got, err := helper.Jobs.Resource.Get(t.Context(), job.GetName(), metav1.GetOptions{})
		if apierrors.IsNotFound(err) {
			// Archived to a historic job — it was picked up and processed.
			return
		}
		if !assert.NoError(collect, err) {
			return
		}
		state := common.MustNestedString(got.Object, "status", "state")
		assert.Contains(collect, []string{
			string(provisioning.JobStateSuccess),
			string(provisioning.JobStateError),
		}, state, "job should be picked up and reach a terminal state")
	}, liveDeliveryWait, liveDeliveryTick, "job should be processed over NATS within %s", liveDeliveryWait)
}

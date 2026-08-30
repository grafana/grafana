package relist

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioningNATSReList_JobProcessedViaReList proves the
// periodic re-list alone feeds the job driver's work queue. No watch
// notifications are published in this package and the informer's initial list
// ran before this job existed, so the only way the driver can learn the key is
// the re-list delivering the unclaimed job. The Job references a repository
// that does not exist, so the driver fails it fast once it picks it up;
// reaching a terminal state (or being archived away) proves the re-list is a
// working recovery path for jobs whose live event was missed.
func TestIntegrationProvisioningNATSReList_JobProcessedViaReList(t *testing.T) {
	helper := sharedHelper(t)

	job := helper.CreatePullJob(t, "nats-relist-job", "ghost-repo")

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
		}, state, "job should be picked up via the re-list and reach a terminal state")
	}, 30*time.Second, 200*time.Millisecond, "job should be processed via the periodic re-list")
}

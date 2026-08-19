package historicjob

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioningNATSHistoricJob_CleanedViaListing proves the
// historic-job cleanup path driven by the informer's periodic re-list (LIST),
// not by live NATS notifications. HistoricJob is re-list only, so its cleanup
// controller only acts on what the re-list surfaces.
//
// HistoricJobs are read-only through the API, so they cannot be created
// directly; instead a Job is created directly (referencing a repository that
// does not exist) so it fails fast and is archived into a HistoricJob — no
// repository resource involved. With a short history_expiration, that
// HistoricJob must then be swept by the listing-driven cleanup.
func TestIntegrationProvisioningNATSHistoricJob_CleanedViaListing(t *testing.T) {
	helper := sharedHelper(t)

	historicJobs := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: "default",
		GVR:       provisioning.HistoricJobResourceInfo.GroupVersionResource(),
	})

	// Create a Job directly against a non-existent repository so the driver
	// fails it fast and archives it — producing a HistoricJob without a repo.
	helper.CreatePullJob(t, "nats-historicjob-src", "ghost-repo")

	// The failed job must first be archived into a HistoricJob and then removed
	// by the re-list-driven cleanup. A single loop tracks that we observed the
	// archived job at least once (so an always-empty list can't pass trivially)
	// and that the list has since drained. This tolerates the short retention
	// window without racing a two-phase assertion.
	var archived bool
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		items := listHistoricJobs(t.Context(), collect, historicJobs)
		if len(items) > 0 {
			archived = true
		}
		assert.True(collect, archived, "the failed job should be archived into a historic job")
		assert.Empty(collect, items, "historic jobs should be removed by the re-list-driven cleanup")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "historic job should be archived then swept by the listing-driven cleanup")
}

func listHistoricJobs(ctx context.Context, collect *assert.CollectT, client *apis.K8sResourceClient) []unstructured.Unstructured {
	list, err := client.Resource.List(ctx, metav1.ListOptions{})
	if !assert.NoError(collect, err, "should list historic jobs") {
		return nil
	}
	return list.Items
}

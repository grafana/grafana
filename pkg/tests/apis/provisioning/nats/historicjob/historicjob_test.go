package historicjob

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioningNATSHistoricJob_CleanedViaListing proves the
// historic-job cleanup path that is driven by the informer's periodic re-list
// (LIST), not by live NATS notifications. HistoricJob is re-list only, so its
// cleanup controller only ever acts on what the re-list surfaces. With a short
// history_expiration, a HistoricJob produced by a completed sync must be swept
// away by that listing-driven cleanup.
func TestIntegrationProvisioningNATSHistoricJob_CleanedViaListing(t *testing.T) {
	helper := sharedHelper(t)
	ctx := t.Context()

	const repo = "nats-historicjob-repo"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "folderless",
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	// Run one pull job to completion, which writes exactly one HistoricJob
	// (sync is disabled, so nothing else queues jobs). SyncAndWait only returns
	// after the historic entry exists, so a subsequent empty list can only be
	// the result of the cleanup having removed it.
	helper.SyncAndWait(t, repo, nil)

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		result, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "jobs")
		if !assert.NoError(collect, err, "should list historic jobs") {
			return
		}
		list, err := result.ToList()
		if !assert.NoError(collect, err, "historic jobs result should be a list") {
			return
		}
		assert.Empty(collect, list.Items, "historic jobs should be removed by the re-list-driven cleanup")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "historic jobs should be swept by the listing-driven cleanup")
}

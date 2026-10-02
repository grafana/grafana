package relistkeys

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

const (
	repoKeysSample       = `grafana_provisioning_informer_relist_projection_total{group="provisioning.grafana.app",projection="keys",resource="repositories"}`
	repoObjectsSample    = `grafana_provisioning_informer_relist_projection_total{group="provisioning.grafana.app",projection="objects",resource="repositories"}`
	repoHydrationsSample = `grafana_provisioning_informer_relist_hydrations_total{group="provisioning.grafana.app",resource="repositories"}`
)

// Nothing publishes watch notifications here, so a created Repository can only
// reach the controller through the periodic re-list, and with the setting on that
// re-list carries keys rather than bodies. Reaching healthy therefore proves the
// controller reconciles from identities alone, reading back what it needs.
func TestIntegrationProvisioningKeysReList_RepositoryReconciledFromKeys(t *testing.T) {
	helper := sharedHelper(t)

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       "keys-relist-repo",
		LocalPath:  filepath.Join(helper.ProvisioningPath, "keys-relist-repo"),
		SyncTarget: "folder",
		SkipSync:   true,
	})
}

// Reconciling proves the pipeline works; this proves it kept working on keys.
//
// This server holds a handful of repositories, which is below the read-back
// break-even, so the shipped policy here is: take the cheap keys list every
// tick, and when something has actually changed take the full list rather than
// read it back. So the assertion is that settled ticks run on keys and that
// nothing is ever read back at this size -- not that the full list never runs,
// which at this snapshot size is the correct answer whenever a repository moves.
//
// The counters are cumulative and the server is shared with the other tests
// here, so everything is measured as a delta from the moment this repository
// settled.
func TestIntegrationProvisioningKeysReList_UsesTheKeysProjectionForRepositories(t *testing.T) {
	helper := sharedHelper(t)

	const name = "keys-relist-repo-projection"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       name,
		LocalPath:  filepath.Join(helper.ProvisioningPath, name),
		SyncTarget: "folder",
		SkipSync:   true,
	})

	keysBefore := scrapeMetric(t, helper, repoKeysSample)
	hydrationsBefore := scrapeMetric(t, helper, repoHydrationsSample)

	const ticks = 3
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		assert.GreaterOrEqual(collect, scrapeMetric(t, helper, repoKeysSample), keysBefore+ticks,
			"later ticks must run on the keys projection")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)

	assert.Equal(t, hydrationsBefore, scrapeMetric(t, helper, repoHydrationsSample),
		"below the break-even nothing is read back: a changed repository takes the list instead")
}

// The quota count reads the snapshot the keys-only re-list writes, so it is the
// one consumer that needs more than identities. A removed repository has to leave
// the count: if the projection re-added it, or the snapshot never dropped it, the
// surviving repository would stay over quota forever.
func TestIntegrationProvisioningKeysReList_DeletedRepositoryLeavesTheQuotaCount(t *testing.T) {
	helper := sharedHelper(t)

	const (
		kept    = "keys-relist-quota-kept"
		removed = "keys-relist-quota-removed"
	)

	helper.SetQuotaStatus(provisioning.QuotaStatus{MaxRepositories: 0})
	t.Cleanup(func() { helper.SetQuotaStatus(provisioning.QuotaStatus{}) })

	for _, name := range []string{kept, removed} {
		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       name,
			LocalPath:  filepath.Join(helper.ProvisioningPath, name),
			SyncTarget: "folder",
			SkipSync:   true,
		})
	}

	helper.SetQuotaStatus(provisioning.QuotaStatus{MaxRepositories: 1})
	helper.WaitForConditionReason(t, kept, provisioning.ConditionTypeNamespaceQuota, provisioning.ReasonQuotaExceeded)

	require.NoError(t, helper.Repositories.Resource.Delete(t.Context(), removed, metav1.DeleteOptions{}))
	helper.WaitForRepositoryDeleted(t, removed)

	helper.WaitForConditionReason(t, kept, provisioning.ConditionTypeNamespaceQuota, provisioning.ReasonQuotaReached)
}

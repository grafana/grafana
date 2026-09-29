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

// Reconciling proves the pipeline works; this proves it kept working on keys, and
// that a settled repository stops costing a read. The counters are cumulative and
// the server is shared with the other tests here, so everything is measured as a
// delta from the moment this repository settled.
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
	objectsBefore := scrapeMetric(t, helper, repoObjectsSample)
	hydrationsBefore := scrapeMetric(t, helper, repoHydrationsSample)

	const ticks = 3
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		assert.GreaterOrEqual(collect, scrapeMetric(t, helper, repoKeysSample), keysBefore+ticks,
			"later ticks must run on the keys projection")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)

	assert.Equal(t, objectsBefore, scrapeMetric(t, helper, repoObjectsSample),
		"no tick past the initial list may have fallen back to full objects")
	// The initial list is always full objects, so the projection only starts
	// paying once a snapshot exists to carry forward. Fewer reads than ticks is
	// the proof it does: an unchanged repository costs nothing.
	assert.Less(t, scrapeMetric(t, helper, repoHydrationsSample)-hydrationsBefore, float64(ticks),
		"a settled repository must not be read back on every tick")
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

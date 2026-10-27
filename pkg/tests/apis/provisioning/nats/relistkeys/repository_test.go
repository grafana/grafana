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

// The app-sdk's informer reports the projection, labelled by kind rather than by resource, and names the keys-only
// one "identities".
const (
	repoKeysSample    = `grafana_provisioning_informer_bus_relist_projection_total{group="provisioning.grafana.app",kind="Repository",projection="identities",version="v0alpha1"}`
	repoObjectsSample = `grafana_provisioning_informer_bus_relist_projection_total{group="provisioning.grafana.app",kind="Repository",projection="objects",version="v0alpha1"}`
)

// Nothing publishes watch notifications here, so a created Repository reaches the
// controller only through the keys-only re-list; reaching healthy proves it
// reconciles from identities.
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
// The store needs identities only, so every tick runs on keys, including ones
// where the repository changed.
//
// The counters are cumulative and the server is shared, so everything is a delta
// from when this repository was created.
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

	const ticks = 3
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		assert.GreaterOrEqual(collect, scrapeMetric(t, helper, repoKeysSample), keysBefore+ticks,
			"later ticks must run on the keys projection")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
	assert.Equal(t, objectsBefore, scrapeMetric(t, helper, repoObjectsSample), "no tick may fall back to full objects")
}

// The quota count reads the informer's store: a removed repository has to leave
// it once it is gone, or the survivor stays over quota forever.
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

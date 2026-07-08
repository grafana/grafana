package nats

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// localRepo is the sync-disabled, folderless local repository used by the
// repository tests. Sync-disabled + folderless keeps it side-effect free (it
// provisions nothing the shared cleanup must remove).
func localRepo(name string) common.TestRepo {
	return common.TestRepo{
		Name:                   name,
		SyncTarget:             "folderless",
		SkipSync:               true,
		SkipResourceAssertions: true,
	}
}

// TestIntegrationProvisioningNATS_RepositoryCreateReconciledOverNATS proves the
// repository controller is driven by a live NATS notification. CreateLocalRepo
// blocks until the controller marks the repository healthy; with the re-list
// pushed to 10m (WithNATS) and the informer's initial list predating this repo,
// that reconcile can only have come from the live ADDED notification.
func TestIntegrationProvisioningNATS_RepositoryCreateReconciledOverNATS(t *testing.T) {
	helper := sharedHelper(t)
	helper.CreateLocalRepo(t, localRepo("nats-repo-create"))
}

// TestIntegrationProvisioningNATS_RepositoryUpdateReconciledOverNATS proves the
// controller also reacts to update events over NATS: after the repository is
// healthy, aging its health timestamp triggers a fresh health check that
// advances status.health.checked — again far sooner than the 10m re-list.
func TestIntegrationProvisioningNATS_RepositoryUpdateReconciledOverNATS(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "nats-repo-update"
	helper.CreateLocalRepo(t, localRepo(repo))
	helper.RequireRepositoryReReconciles(t, repo)
}

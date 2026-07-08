package nats

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioningNATS_RepositoryCreateReconciledOverNATS proves the
// repository controller is driven by a live NATS notification. The repository
// is created without waiting, and WaitForHealthyRepository is the explicit
// reconcile assertion: with the re-list pushed to 10m (WithNATS) and the
// informer's initial list predating this repo, the controller could only have
// marked it healthy in response to the live ADDED notification. Sync is
// disabled so the repo provisions nothing the shared cleanup must remove.
func TestIntegrationProvisioningNATS_RepositoryCreateReconciledOverNATS(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "nats-repo-create"

	helper.CreateRepositoryNoWait(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "folder",
		SkipSync:               true,
		SkipResourceAssertions: true,
	})
	helper.WaitForHealthyRepository(t, repo)
}

// TestIntegrationProvisioningNATS_RepositoryUpdateReconciledOverNATS proves the
// controller also reacts to update events over NATS: once the repo is healthy,
// RequireRepositoryReReconciles ages its health timestamp and asserts the
// controller re-runs the health check — again far sooner than the 10m re-list.
func TestIntegrationProvisioningNATS_RepositoryUpdateReconciledOverNATS(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "nats-repo-update"

	helper.CreateRepositoryNoWait(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "folder",
		SkipSync:               true,
		SkipResourceAssertions: true,
	})
	helper.WaitForHealthyRepository(t, repo)
	helper.RequireRepositoryReReconciles(t, repo)
}

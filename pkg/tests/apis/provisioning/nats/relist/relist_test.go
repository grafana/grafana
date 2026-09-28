package relist

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioningNATSReList_RepositoryReconciledViaReList proves the
// re-list fallback reconciles a newly-created repository. Nothing publishes
// watch notifications in this package, and the informer's initial list ran at
// startup before this repo existed, so WaitForHealthyRepository can only be
// satisfied by the periodic re-list.
func TestIntegrationProvisioningNATSReList_RepositoryReconciledViaReList(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "nats-relist-create"

	helper.CreateRepositoryNoWait(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		SkipSync:   true,
	})
	helper.WaitForHealthyRepository(t, repo)
}

// TestIntegrationProvisioningNATSReList_RepositoryReCheckedViaReList proves the
// re-list also picks up updates: after the repository is healthy, aging its
// health timestamp triggers a fresh health check on a subsequent re-list — with
// no live notification in play.
func TestIntegrationProvisioningNATSReList_RepositoryReCheckedViaReList(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "nats-relist-update"

	helper.CreateRepositoryNoWait(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		SkipSync:   true,
	})
	helper.WaitForHealthyRepository(t, repo)
	helper.RequireRepositoryReReconciles(t, repo)
}

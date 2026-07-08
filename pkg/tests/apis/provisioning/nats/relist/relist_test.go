package relist

import (
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// localRepo is the sync-disabled, folderless local repository used by the
// re-list tests.
func localRepo(name string) common.TestRepo {
	return common.TestRepo{
		Name:                   name,
		SyncTarget:             "folderless",
		SkipSync:               true,
		SkipResourceAssertions: true,
	}
}

// TestIntegrationProvisioningNATSReList_RepositoryReconciledViaReList proves the
// re-list fallback reconciles a newly-created repository. Nothing publishes
// watch notifications in this package, and the informer's initial list ran at
// startup before this repo existed, so CreateLocalRepo's wait-for-healthy can
// only be satisfied by the periodic re-list.
func TestIntegrationProvisioningNATSReList_RepositoryReconciledViaReList(t *testing.T) {
	helper := sharedHelper(t)
	helper.CreateLocalRepo(t, localRepo("nats-relist-create"))
}

// TestIntegrationProvisioningNATSReList_RepositoryReCheckedViaReList proves the
// re-list also picks up updates: after the repository is healthy, aging its
// health timestamp triggers a fresh health check on a subsequent re-list — with
// no live notification in play.
func TestIntegrationProvisioningNATSReList_RepositoryReCheckedViaReList(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "nats-relist-update"
	helper.CreateLocalRepo(t, localRepo(repo))
	helper.RequireRepositoryReReconciles(t, repo)
}

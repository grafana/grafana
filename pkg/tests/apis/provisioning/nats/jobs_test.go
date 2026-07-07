package nats

import (
	"testing"

	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioningNATS_SyncJobProcessedOverNATS verifies the
// job-queue controller processes a sync Job whose creation is delivered over the
// NATS-backed job informer. Posting a pull job creates a Job resource; the
// driver only claims and runs it after the informer delivers that create event.
// The observable result is a successful historic job for the repository.
//
// The repository is created with an empty, folderless sync target so the
// completed job provisions no resources — this keeps the test focused on the
// job-queue delivery/processing path rather than resource provisioning, and
// leaves nothing behind for the shared server's per-test cleanup.
func TestIntegrationProvisioningNATS_SyncJobProcessedOverNATS(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "nats-sync-repo"

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "folderless",
		SkipSync:               true,
		SkipResourceAssertions: true,
	})

	// Posts a pull Job and waits for it to reach a terminal state, failing the
	// test if it errors. This only completes if the driver claimed and ran the
	// job after receiving its create event over NATS.
	helper.SyncAndWait(t, repo, nil)

	// The completed job must be recorded as a successful historic job.
	job := helper.AwaitLatestHistoricJob(t, repo)
	state := common.MustNestedString(job.Object, "status", "state")
	require.Equal(t, string(provisioning.JobStateSuccess), state,
		"sync job processed over NATS should succeed")
}

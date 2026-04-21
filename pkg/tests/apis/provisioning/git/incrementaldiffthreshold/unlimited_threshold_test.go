package incrementaldiffthreshold

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_IncrementalDiffThreshold_Zero_DisablesSizeCheck
// verifies the `0 = unlimited` contract end-to-end: when
// `provisioning.max_incremental_changes` is set to 0 the controller must
// schedule an INCREMENTAL sync even for diffs that would be above any positive
// threshold. The package-level shared env uses threshold=5, so this test
// constructs its own Grafana instance with threshold=0 via
// `RunGrafanaWithGitServer` rather than the shared env.
//
// The diff size used here is deliberately larger than the shared env's
// threshold (5) so the same diff shape would be scheduled as a full sync in
// the above-threshold test — making the contract-break visible if the size
// check ever stops honouring the 0-disables guard.
func TestIntegrationProvisioning_IncrementalDiffThreshold_Zero_DisablesSizeCheck(t *testing.T) {
	h := common.RunGrafanaWithGitServer(t,
		common.WithoutProvisioningFolderMetadata,
		common.WithProvisioningMaxIncrementalChanges(0),
	)

	const (
		repoName  = "diff-threshold-unlimited"
		fileCount = testMaxIncrementalChanges + 5 // deliberately above the shared env's threshold
	)

	_, local := createGitRepoWithSyncEnabled(t, h, repoName, testSyncIntervalSeconds, map[string][]byte{
		"dashboard-seed.json": common.DashboardJSON("diff-unlimited-seed", "Seed", 1),
	})

	waitForInitialSyncCompleted(t, h, repoName)

	seenJobs := snapshotPullJobNames(t, h, repoName)

	addDashboardFiles(t, local, "unlimited", fileCount)
	commitAndPush(t, local, fmt.Sprintf("add %d dashboards (threshold=0, unlimited)", fileCount))

	intervalJob := waitForNewPullJob(t, h, repoName, seenJobs)
	require.NotNil(t, intervalJob.Spec.Pull,
		"interval-scheduled pull job must have Pull options set")
	require.True(t, intervalJob.Spec.Pull.Incremental,
		"with max_incremental_changes=0 the controller must schedule incremental "+
			"regardless of diff size (got full sync for a diff of %d files)", fileCount)
}

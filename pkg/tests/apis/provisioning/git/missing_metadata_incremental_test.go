package git

import (
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/stretchr/testify/require"
)

func TestIntegrationProvisioning_IncrementalSync_MissingFolderMetadata(t *testing.T) {
	helper := sharedGitHelper(t)

	const repoName = "incr-missing-meta"

	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("root-dash", "Root Dashboard", 1),
	})

	// Full sync.
	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

	// Add a dashboard inside a folder with no _folder.json.
	require.NoError(t, local.CreateFile("myfolder/dashboard2.json", string(common.DashboardJSON("folder-dash", "Folder Dashboard", 1))))
	_, err := local.Git("add", ".")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "add dashboard in folder without metadata")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	// Trigger incremental sync.
	job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{Incremental: true},
	})
	common.HasOnlyMissingFolderMetadataWarnings("myfolder")(t, job)

	helper.RequireRepoDashboardCount(t, repoName, 2)
}

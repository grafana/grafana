package git

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_IncrementalSync_EmptyFolderCleanup_FlagDisabled(t *testing.T) {
	helper := sharedGitHelper(t)
	const repoName = "empty-folder-cleanup-no-metadata"
	_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
		"dashboard.json":          common.DashboardJSON("cleanup-root", "Root", 1),
		"removed/empty/.keep":     []byte("remove"),
		"hidden/.keep":            []byte("hide"),
		"retained/.keep":          []byte("retain"),
		"retained/dashboard.json": common.DashboardJSON("cleanup-retained", "Retained", 1),
	})
	common.SyncAndWait(t, helper, common.Repo(repoName), common.Warning())
	common.RequireRepoFolders(t, helper.Folders, repoName, []string{"removed", "removed/empty", "hidden", "retained"})

	_, err := local.Git("rm", "removed/empty/.keep", "retained/.keep")
	require.NoError(t, err)
	_, err = local.Git("mv", "hidden", ".ci")
	require.NoError(t, err)
	_, err = local.Git("commit", "-m", "remove empty folders")
	require.NoError(t, err)
	_, err = local.Git("push")
	require.NoError(t, err)

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Warning())
	common.RequireRepoFolders(t, helper.Folders, repoName, []string{"retained"})
	helper.RequireRepoDashboardCount(t, repoName, 2)
}

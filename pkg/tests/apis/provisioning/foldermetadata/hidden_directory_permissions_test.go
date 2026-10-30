package foldermetadata

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_HiddenPaths_UnreadableLocalDirectory(t *testing.T) {
	helper := sharedHelper(t)
	const repoName = "unreadable-hidden-directory"
	helper.CreateLocalRepo(t, common.TestRepo{Name: repoName, SyncTarget: "folder", Workflows: []string{"write"}})
	helper.WriteToProvisioningPath(t, ".git/config", []byte("hidden content"))
	helper.WriteToProvisioningPath(t, "visible/.keep", []byte{})
	helper.WriteToProvisioningPath(t, "visible/dashboard.json", common.DashboardJSON("visible-dashboard", "Visible", 1))

	hidden := filepath.Join(helper.ProvisioningPath, ".git")
	restorePermissions := func() {
		require.NoError(t, os.Chmod(hidden, 0700)) //nolint:gosec // Inspection and cleanup need directory traversal permission.
	}
	t.Cleanup(restorePermissions)
	require.NoError(t, os.Chmod(hidden, 0))
	if _, err := os.ReadDir(hidden); err == nil {
		t.Skip("directory permissions do not prevent reads in this environment")
	} else {
		require.ErrorIs(t, err, os.ErrPermission)
	}

	job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{Action: provisioning.JobActionFixFolderMetadata})
	common.HasState(provisioning.JobStateSuccess)(t, job)
	common.HasNoErrors()(t, job)
	requireNoHiddenPathWarnings(t, job)
	require.FileExists(t, filepath.Join(helper.ProvisioningPath, "visible/_folder.json"))
	require.NoFileExists(t, filepath.Join(helper.ProvisioningPath, "visible/.keep"))

	job = helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})
	common.HasState(provisioning.JobStateSuccess)(t, job)
	common.HasNoErrors()(t, job)
	requireNoHiddenPathWarnings(t, job)
	common.RequireRepoFolders(t, helper.Folders, repoName, []string{"", "visible"})
	helper.RequireRepoDashboardCount(t, repoName, 1)

	restorePermissions()
	content, err := os.ReadFile(filepath.Join(hidden, "config")) //nolint:gosec // Read the file created in the test provisioning directory.
	require.NoError(t, err)
	require.Equal(t, "hidden content", string(content))
	require.NoFileExists(t, filepath.Join(hidden, "_folder.json"))
}

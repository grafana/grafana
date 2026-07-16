package foldermetadata

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// move posts a file move (POST with originalPath) to the files endpoint and asserts a 200.
func move(t *testing.T, helper *common.ProvisioningTestHelper, repo, originalPath, targetPath string, body []byte) {
	t.Helper()
	resp := helper.PostFilesRequest(t, repo, common.FilesPostOptions{
		TargetPath:   targetPath,
		OriginalPath: originalPath,
		Body:         string(body),
	})
	require.NoError(t, resp.Body.Close())
	require.Equal(t, http.StatusOK, resp.StatusCode, "moving %q to %q should succeed", originalPath, targetPath)
}

func TestIntegrationProvisioning_MoveFile_FolderMetadataFlag(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "folder-metadata-move-test-repo"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name: repo, SyncTarget: "instance", Workflows: []string{"write"},
	})

	files := helper.NewFilesClient(repo)

	t.Run("content move into new folder writes _folder.json with matching UID", func(t *testing.T) {
		resp := files.Post(t, "move-src-1.json", common.DashboardJSON("move-dash-1", "Move Dash 1", 1))
		require.Equal(t, http.StatusOK, resp.StatusCode, "creating source dashboard should succeed")

		move(t, helper, repo, "move-src-1.json", "move-dest-1/dashboard.json",
			common.DashboardJSON("move-dash-1", "Move Dash 1 Updated", 2))

		uid, title := files.RequireValidFolderMetadata(t, "move-dest-1/_folder.json")
		require.Equal(t, "move-dest-1", title)

		_, err := helper.Folders.Resource.Get(t.Context(), uid, metav1.GetOptions{})
		require.NoError(t, err, "Grafana folder should exist with the UID from _folder.json")

		_, err = helper.Repositories.Resource.Get(t.Context(), repo, metav1.GetOptions{}, "files", "move-src-1.json")
		require.Error(t, err, "original file should no longer exist after the move")
	})

	t.Run("nested-dest move writes _folder.json for every ancestor with distinct UIDs", func(t *testing.T) {
		resp := files.Post(t, "move-src-2.json", common.DashboardJSON("move-dash-2", "Move Dash 2", 1))
		require.Equal(t, http.StatusOK, resp.StatusCode, "creating source dashboard should succeed")

		move(t, helper, repo, "move-src-2.json", "anc-x/anc-y/dashboard.json",
			common.DashboardJSON("move-dash-2", "Move Dash 2 Updated", 2))

		parentUID, _ := files.RequireValidFolderMetadata(t, "anc-x/_folder.json")
		childUID, childTitle := files.RequireValidFolderMetadata(t, "anc-x/anc-y/_folder.json")
		require.Equal(t, "anc-y", childTitle)
		require.NotEqual(t, parentUID, childUID, "each ancestor folder gets a distinct UID")

		_, err := helper.Folders.Resource.Get(t.Context(), parentUID, metav1.GetOptions{})
		require.NoError(t, err, "parent Grafana folder should exist")
		_, err = helper.Folders.Resource.Get(t.Context(), childUID, metav1.GetOptions{})
		require.NoError(t, err, "child Grafana folder should exist")
	})

	t.Run("move into existing managed folder does not change its _folder.json UID", func(t *testing.T) {
		resp := files.Post(t, "existing-move-folder/", nil)
		require.Equal(t, http.StatusOK, resp.StatusCode, "creating destination folder should succeed")
		existingUID := files.ReadFolderUID(t, "existing-move-folder/_folder.json")
		require.NotEmpty(t, existingUID)

		resp = files.Post(t, "move-src-3.json", common.DashboardJSON("move-dash-3", "Move Dash 3", 1))
		require.Equal(t, http.StatusOK, resp.StatusCode, "creating source dashboard should succeed")

		move(t, helper, repo, "move-src-3.json", "existing-move-folder/dashboard.json",
			common.DashboardJSON("move-dash-3", "Move Dash 3 Updated", 2))

		uidAfter := files.ReadFolderUID(t, "existing-move-folder/_folder.json")
		require.Equal(t, existingUID, uidAfter, "moving into an existing folder must not change its UID")
	})

	t.Run("rename move (no body) into new folder writes _folder.json", func(t *testing.T) {
		resp := files.Post(t, "move-src-4.json", common.DashboardJSON("move-dash-4", "Move Dash 4", 1))
		require.Equal(t, http.StatusOK, resp.StatusCode, "creating source dashboard should succeed")

		move(t, helper, repo, "move-src-4.json", "rename-dest/move-src-4.json", nil)

		uid, title := files.RequireValidFolderMetadata(t, "rename-dest/_folder.json")
		require.Equal(t, "rename-dest", title)

		_, err := helper.Folders.Resource.Get(t.Context(), uid, metav1.GetOptions{})
		require.NoError(t, err, "Grafana folder should exist with the UID from _folder.json")

		_, err = helper.Repositories.Resource.Get(t.Context(), repo, metav1.GetOptions{}, "files", "move-src-4.json")
		require.Error(t, err, "original file should no longer exist after the rename move")
	})
}

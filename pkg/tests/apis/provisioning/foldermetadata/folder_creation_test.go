package foldermetadata

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_CreateFolder_FolderMetadataFlag(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "folder-metadata-test-repo"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name: repo, SyncTarget: "instance", Workflows: []string{"write"},
		Copies: map[string]string{
			"../testdata/.keep": "no-meta-existing-folder/.keep",
		},
	})

	files := helper.NewFilesClient(repo)

	t.Run("simple folder creation writes _folder.json with stable UID", func(t *testing.T) {
		resp := files.Post(t, "meta-test-folder/", nil)
		require.Equal(t, http.StatusOK, resp.StatusCode, "creating folder should succeed")

		uid, title := files.RequireValidFolderMetadata(t, "meta-test-folder/_folder.json")
		require.Equal(t, "meta-test-folder", title)

		_, err := helper.Repositories.Resource.Get(t.Context(), repo, metav1.GetOptions{}, "files", "meta-test-folder/.keep")
		require.Error(t, err, ".keep should not exist when flag is enabled")

		_, err = helper.Folders.Resource.Get(t.Context(), uid, metav1.GetOptions{})
		require.NoError(t, err, "Grafana folder should exist with the stable UID from _folder.json")
	})

	t.Run("nested creation writes _folder.json for every folder in the path", func(t *testing.T) {
		resp := files.Post(t, "parent-folder/child-folder/", nil)
		require.Equal(t, http.StatusOK, resp.StatusCode, "creating nested folder should succeed")

		parentUID, _ := files.RequireValidFolderMetadata(t, "parent-folder/_folder.json")
		childUID, childTitle := files.RequireValidFolderMetadata(t, "parent-folder/child-folder/_folder.json")

		require.NotEqual(t, parentUID, childUID, "each folder gets a distinct UID")
		require.Equal(t, "child-folder", childTitle)

		_, err := helper.Folders.Resource.Get(t.Context(), childUID, metav1.GetOptions{})
		require.NoError(t, err, "child Grafana folder should exist with the stable UID")
	})

	t.Run("duplicate folder creation returns 409 Conflict", func(t *testing.T) {
		resp := files.Post(t, "duplicate-folder/", nil)
		require.Equal(t, http.StatusOK, resp.StatusCode, "first creation should succeed")

		resp2 := files.Post(t, "duplicate-folder/", nil)
		require.Equal(t, http.StatusConflict, resp2.StatusCode, "second creation should return 409 Conflict")
	})

	t.Run("dashboard creation in new folder writes _folder.json", func(t *testing.T) {
		body := common.DashboardJSON("implicit-dash-001", "Implicit Dashboard", 1)
		resp := files.Post(t, "implicit-folder/dashboard.json", body)
		require.Equal(t, http.StatusOK, resp.StatusCode, "creating dashboard in new folder should succeed")

		uid, title := files.RequireValidFolderMetadata(t, "implicit-folder/_folder.json")
		require.Equal(t, "implicit-folder", title)

		_, err := helper.Folders.Resource.Get(t.Context(), uid, metav1.GetOptions{})
		require.NoError(t, err, "Grafana folder should exist with the UID from _folder.json")
	})

	t.Run("explicit folder creation after dashboard reuses existing _folder.json UID", func(t *testing.T) {
		body := common.DashboardJSON("reuse-dash-001", "Reuse Dashboard", 1)
		resp := files.Post(t, "reuse-folder/dashboard.json", body)
		require.Equal(t, http.StatusOK, resp.StatusCode, "creating dashboard should succeed")

		uid := files.ReadFolderUID(t, "reuse-folder/_folder.json")
		require.NotEmpty(t, uid, "implicit _folder.json should have a UID")

		resp2 := files.Post(t, "reuse-folder/", nil)
		require.Equal(t, http.StatusConflict, resp2.StatusCode, "explicit folder creation should return 409 because folder already exists")

		uid2 := files.ReadFolderUID(t, "reuse-folder/_folder.json")
		require.Equal(t, uid, uid2, "UID must not change after explicit folder creation attempt")
	})

	t.Run("nested dashboard creation writes _folder.json for all ancestor folders", func(t *testing.T) {
		body := common.DashboardJSON("nested-dash-001", "Nested Dashboard", 1)
		resp := files.Post(t, "ancestor-a/ancestor-b/dashboard.json", body)
		require.Equal(t, http.StatusOK, resp.StatusCode, "creating nested dashboard should succeed: %s", string(resp.Body))

		parentUID, _ := files.RequireValidFolderMetadata(t, "ancestor-a/_folder.json")
		childUID, _ := files.RequireValidFolderMetadata(t, "ancestor-a/ancestor-b/_folder.json")

		require.NotEqual(t, parentUID, childUID, "each folder gets a distinct UID")

		_, err := helper.Folders.Resource.Get(t.Context(), parentUID, metav1.GetOptions{})
		require.NoError(t, err, "parent Grafana folder should exist")
		_, err = helper.Folders.Resource.Get(t.Context(), childUID, metav1.GetOptions{})
		require.NoError(t, err, "child Grafana folder should exist")
	})

	t.Run("dashboard created on existing folder with no meta doesn't write _folder.json", func(t *testing.T) {
		body := common.DashboardJSON("nested-dash-002", "Nested Dashboard", 1)
		resp := files.Post(t, "no-meta-existing-folder/should-have-meta/dashboard.json", body)
		require.Equal(t, http.StatusOK, resp.StatusCode, "creating nested dashboard should succeed: %s", string(resp.Body))

		_, err := helper.Repositories.Resource.Get(t.Context(), repo, metav1.GetOptions{}, "files", "no-meta-existing-folder/_folder.json")
		require.Error(t, err, "_folder.json should not exist when flag is enabled")

		childUID, _ := files.RequireValidFolderMetadata(t, "no-meta-existing-folder/should-have-meta/_folder.json")
		_, err = helper.Folders.Resource.Get(t.Context(), childUID, metav1.GetOptions{})
		require.NoError(t, err, "child Grafana folder should exist")
	})

	t.Run("child created inside existing managed folder gets its own _folder.json", func(t *testing.T) {
		resp := files.Post(t, "managed-parent/", nil)
		require.Equal(t, http.StatusOK, resp.StatusCode, "creating parent folder should succeed")

		parentUID := files.ReadFolderUID(t, "managed-parent/_folder.json")
		require.NotEmpty(t, parentUID, "parent should have a non-empty stable UID")

		resp2 := files.Post(t, "managed-parent/child-folder/", nil)
		require.Equal(t, http.StatusOK, resp2.StatusCode, "creating child folder should succeed")

		childUID := files.ReadFolderUID(t, "managed-parent/child-folder/_folder.json")
		require.NotEmpty(t, childUID, "child should have a non-empty stable UID")
		require.NotEqual(t, parentUID, childUID, "child and parent UIDs must differ")

		parentUID2 := files.ReadFolderUID(t, "managed-parent/_folder.json")
		require.Equal(t, parentUID, parentUID2, "parent UID must be unchanged after child creation")

		_, err := helper.Folders.Resource.Get(t.Context(), parentUID, metav1.GetOptions{})
		require.NoError(t, err, "parent Grafana folder should exist")
		_, err = helper.Folders.Resource.Get(t.Context(), childUID, metav1.GetOptions{})
		require.NoError(t, err, "child Grafana folder should exist")
	})
}

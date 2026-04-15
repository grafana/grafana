package foldermetadata

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_UpdateFolderMetadata(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	const repo = "update-folder-metadata-repo"
	helper.CreateLocalRepo(t, common.TestRepo{Name: repo, SyncTarget: "instance", Workflows: []string{"write"}, SkipResourceAssertions: true})

	files := helper.NewFilesClient(repo)

	// Create a folder to work with
	resp := files.Post(t, "update-test/")
	require.Equal(t, http.StatusOK, resp.StatusCode, "setup: creating folder should succeed")

	originalUID := files.ReadFolderUID(t, ctx, "update-test/_folder.json")
	require.NotEmpty(t, originalUID, "setup: folder should have a UID")
	originalTitle := files.ReadFolderTitle(t, ctx, "update-test/_folder.json")
	require.Equal(t, "update-test", originalTitle, "setup: folder should have initial title")

	t.Run("update folder title via PUT to folder path succeeds", func(t *testing.T) {
		resp := files.Put(t, "update-test/", common.FolderBody(t, originalUID, "Updated Title"))
		require.Equal(t, http.StatusOK, resp.StatusCode, "PUT to folder path should update title: %s", resp.BodyString())

		newTitle := files.ReadFolderTitle(t, ctx, "update-test/_folder.json")
		require.Equal(t, "Updated Title", newTitle, "title should be updated in _folder.json")

		newUID := files.ReadFolderUID(t, ctx, "update-test/_folder.json")
		require.Equal(t, originalUID, newUID, "UID must not change after title update")
	})

	t.Run("update folder title updates Grafana folder object", func(t *testing.T) {
		resp := files.Put(t, "update-test/", common.FolderBody(t, originalUID, "Grafana Updated"))
		require.Equal(t, http.StatusOK, resp.StatusCode, "updating folder title should succeed: %s", resp.BodyString())

		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			folderObj, err := helper.Folders.Resource.Get(ctx, originalUID, metav1.GetOptions{})
			if err != nil {
				collect.Errorf("could not get folder: %v", err)
				return
			}
			title, _, _ := unstructured.NestedString(folderObj.Object, "spec", "title")
			assert.Equal(collect, "Grafana Updated", title, "Grafana folder title should be updated")
		}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "Grafana folder title should eventually be updated")
	})

	t.Run("update with omitted ID succeeds (uses existing ID)", func(t *testing.T) {
		resp := files.Put(t, "update-test/", common.FolderBody(t, "", "No ID Provided"))
		require.Equal(t, http.StatusOK, resp.StatusCode, "update with omitted ID should succeed: %s", resp.BodyString())

		newTitle := files.ReadFolderTitle(t, ctx, "update-test/_folder.json")
		require.Equal(t, "No ID Provided", newTitle, "title should be updated")

		newUID := files.ReadFolderUID(t, ctx, "update-test/_folder.json")
		require.Equal(t, originalUID, newUID, "UID must not change")
	})

	t.Run("changing folder ID is rejected", func(t *testing.T) {
		resp := files.Put(t, "update-test/", common.FolderBody(t, "different-uid", "ID Changed"))
		require.Equal(t, http.StatusBadRequest, resp.StatusCode, "changing folder ID must be rejected: %s", resp.BodyString())
		require.Contains(t, resp.BodyString(), "folder ID change is not allowed")

		unchangedUID := files.ReadFolderUID(t, ctx, "update-test/_folder.json")
		require.Equal(t, originalUID, unchangedUID, "UID must not have changed after rejected request")
	})

	t.Run("empty title is rejected", func(t *testing.T) {
		resp := files.Put(t, "update-test/", common.FolderBody(t, originalUID, ""))
		require.Equal(t, http.StatusBadRequest, resp.StatusCode, "empty title must be rejected: %s", resp.BodyString())
		require.Contains(t, resp.BodyString(), "title must not be empty")
	})

	t.Run("missing spec title field is rejected", func(t *testing.T) {
		// Raw JSON with spec.title completely absent (not just empty string).
		body := []byte(`{"apiVersion":"folder.grafana.app/v1","kind":"Folder","metadata":{},"spec":{}}`)
		resp := files.Put(t, "update-test/", body)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode, "missing title must be rejected: %s", resp.BodyString())
	})

	t.Run("invalid JSON body is rejected", func(t *testing.T) {
		resp := files.Put(t, "update-test/", []byte(`{not valid json}`))
		require.Equal(t, http.StatusBadRequest, resp.StatusCode, "invalid JSON must be rejected")
	})

	t.Run("PUT to non-existent folder path fails", func(t *testing.T) {
		resp := files.Put(t, "no-such-folder/", common.FolderBody(t, "some-uid", "ghost"))
		require.NotEqual(t, http.StatusOK, resp.StatusCode, "PUT to non-existent folder should fail")
	})

	t.Run("nested folder title update works", func(t *testing.T) {
		resp := files.Post(t, "nested-parent/nested-child/")
		require.Equal(t, http.StatusOK, resp.StatusCode, "setup: creating nested folder should succeed")

		childUID := files.ReadFolderUID(t, ctx, "nested-parent/nested-child/_folder.json")
		require.NotEmpty(t, childUID)

		resp = files.Put(t, "nested-parent/nested-child/", common.FolderBody(t, childUID, "Child Renamed"))
		require.Equal(t, http.StatusOK, resp.StatusCode, "nested title update should succeed: %s", resp.BodyString())

		newTitle := files.ReadFolderTitle(t, ctx, "nested-parent/nested-child/_folder.json")
		require.Equal(t, "Child Renamed", newTitle)

		newUID := files.ReadFolderUID(t, ctx, "nested-parent/nested-child/_folder.json")
		require.Equal(t, childUID, newUID, "nested folder UID must not change")
	})
}

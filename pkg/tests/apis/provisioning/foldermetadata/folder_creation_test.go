package foldermetadata

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_CreateFolder_FolderMetadataFlag(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	const repo = "folder-metadata-test-repo"
	helper.CreateLocalRepo(t, common.TestRepo{Name: repo, SyncTarget: "instance", Workflows: []string{"write"}, SkipResourceAssertions: true})

	files := helper.NewFilesClient(repo)

	t.Run("simple folder creation writes _folder.json with stable UID", func(t *testing.T) {
		resp := files.Post(t, "meta-test-folder/")
		require.Equal(t, http.StatusOK, resp.StatusCode, "creating folder should succeed")

		uid, title := files.RequireValidFolderMetadata(t, ctx, "meta-test-folder/_folder.json")
		require.Equal(t, "meta-test-folder", title)

		_, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "meta-test-folder/.keep")
		require.Error(t, err, ".keep should not exist when flag is enabled")

		_, err = helper.Folders.Resource.Get(ctx, uid, metav1.GetOptions{})
		require.NoError(t, err, "Grafana folder should exist with the stable UID from _folder.json")
	})

	t.Run("nested creation writes _folder.json for every folder in the path", func(t *testing.T) {
		resp := files.Post(t, "parent-folder/child-folder/")
		require.Equal(t, http.StatusOK, resp.StatusCode, "creating nested folder should succeed")

		parentUID, _ := files.RequireValidFolderMetadata(t, ctx, "parent-folder/_folder.json")
		childUID, childTitle := files.RequireValidFolderMetadata(t, ctx, "parent-folder/child-folder/_folder.json")

		require.NotEqual(t, parentUID, childUID, "each folder gets a distinct UID")
		require.Equal(t, "child-folder", childTitle)

		_, err := helper.Folders.Resource.Get(ctx, childUID, metav1.GetOptions{})
		require.NoError(t, err, "child Grafana folder should exist with the stable UID")
	})

	t.Run("duplicate folder creation returns 409 Conflict", func(t *testing.T) {
		resp := files.Post(t, "duplicate-folder/")
		require.Equal(t, http.StatusOK, resp.StatusCode, "first creation should succeed")

		resp2 := files.Post(t, "duplicate-folder/")
		require.Equal(t, http.StatusConflict, resp2.StatusCode, "second creation should return 409 Conflict")
	})

	t.Run("child created inside existing managed folder gets its own _folder.json", func(t *testing.T) {
		resp := files.Post(t, "managed-parent/")
		require.Equal(t, http.StatusOK, resp.StatusCode, "creating parent folder should succeed")

		parentUID := files.ReadFolderUID(t, ctx, "managed-parent/_folder.json")
		require.NotEmpty(t, parentUID, "parent should have a non-empty stable UID")

		resp2 := files.Post(t, "managed-parent/child-folder/")
		require.Equal(t, http.StatusOK, resp2.StatusCode, "creating child folder should succeed")

		childUID := files.ReadFolderUID(t, ctx, "managed-parent/child-folder/_folder.json")
		require.NotEmpty(t, childUID, "child should have a non-empty stable UID")
		require.NotEqual(t, parentUID, childUID, "child and parent UIDs must differ")

		parentUID2 := files.ReadFolderUID(t, ctx, "managed-parent/_folder.json")
		require.Equal(t, parentUID, parentUID2, "parent UID must be unchanged after child creation")

		_, err := helper.Folders.Resource.Get(ctx, parentUID, metav1.GetOptions{})
		require.NoError(t, err, "parent Grafana folder should exist")
		_, err = helper.Folders.Resource.Get(ctx, childUID, metav1.GetOptions{})
		require.NoError(t, err, "child Grafana folder should exist")
	})
}

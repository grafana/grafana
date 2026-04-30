package foldermetadata

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_FolderMetadataFileProtection(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	const repo = "folder-protection-test-repo"
	helper.CreateLocalRepo(t, common.TestRepo{Name: repo, SyncTarget: "instance", Workflows: []string{"write"}, SkipResourceAssertions: true})

	files := helper.NewFilesClient(repo)

	// Create a managed folder so its _folder.json exists for PUT/DELETE tests.
	resp := files.Post(t, "protected-folder/")
	require.Equal(t, http.StatusOK, resp.StatusCode, "setup: creating protected-folder should succeed")

	t.Run("POST to _folder.json is blocked", func(t *testing.T) {
		resp := files.Do(t, http.MethodPost, "new-folder/_folder.json", common.FolderBody(t, "some-uid", "attempt"))
		require.Equal(t, http.StatusForbidden, resp.StatusCode, "direct POST to _folder.json must be blocked")
	})

	t.Run("PUT to existing _folder.json is blocked", func(t *testing.T) {
		resp := files.Put(t, "protected-folder/_folder.json", common.FolderBody(t, "tampered-uid", "tampered"))
		require.Equal(t, http.StatusForbidden, resp.StatusCode, "PUT to _folder.json must be blocked")
	})

	t.Run("DELETE of _folder.json is blocked", func(t *testing.T) {
		resp := files.Delete(t, "protected-folder/_folder.json")
		require.Equal(t, http.StatusForbidden, resp.StatusCode, "DELETE of _folder.json must be blocked")
	})

	t.Run("GET of _folder.json is still allowed", func(t *testing.T) {
		uid := files.ReadFolderUID(t, ctx, "protected-folder/_folder.json")
		require.NotEmpty(t, uid)
	})

	rootBody := common.FolderBody(t, "root-uid", "root")

	for _, tc := range []struct {
		name   string
		method string
		body   []byte
	}{
		{name: "POST to root _folder.json is blocked", method: http.MethodPost, body: rootBody},
		{name: "PUT to root _folder.json is blocked", method: http.MethodPut, body: rootBody},
		{name: "DELETE of root _folder.json is blocked", method: http.MethodDelete},
	} {
		t.Run(tc.name, func(t *testing.T) {
			resp := files.Do(t, tc.method, "_folder.json", tc.body)
			require.Equal(t, http.StatusForbidden, resp.StatusCode)
		})
	}
}

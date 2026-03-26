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
	helper.CreateRepo(t, common.TestRepo{Name: repo, Target: "instance", SkipResourceAssertions: true})

	files := helper.NewFilesClient(repo)

	// Create a managed folder so its _folder.json exists for PUT/DELETE tests.
	resp := files.Post(t, "protected-folder/")
	require.Equal(t, http.StatusOK, resp.StatusCode, "setup: creating protected-folder should succeed")

	t.Run("POST to _folder.json is blocked", func(t *testing.T) {
		body := []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"some-uid"},"spec":{"title":"attempt"}}`)
		resp := files.Do(t, http.MethodPost, "new-folder/_folder.json", body)
		require.Equal(t, http.StatusForbidden, resp.StatusCode, "direct POST to _folder.json must be blocked")
	})

	t.Run("PUT to existing _folder.json is blocked", func(t *testing.T) {
		body := []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"tampered-uid"},"spec":{"title":"tampered"}}`)
		resp := files.Put(t, "protected-folder/_folder.json", body)
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

	rootFolderBody := []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"root-uid"},"spec":{"title":"root"}}`)

	for _, tc := range []struct {
		name   string
		method string
		body   []byte
	}{
		{name: "POST to root _folder.json is blocked", method: http.MethodPost, body: rootFolderBody},
		{name: "PUT to root _folder.json is blocked", method: http.MethodPut, body: rootFolderBody},
		{name: "DELETE of root _folder.json is blocked", method: http.MethodDelete},
	} {
		t.Run(tc.name, func(t *testing.T) {
			resp := files.Do(t, tc.method, "_folder.json", tc.body)
			require.Equal(t, http.StatusForbidden, resp.StatusCode)
		})
	}
}

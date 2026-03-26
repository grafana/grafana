package foldermetadata

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_FolderMetadataFileProtection(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	const repo = "folder-protection-test-repo"
	helper.CreateRepo(t, common.TestRepo{Name: repo, Target: "instance", SkipResourceAssertions: true})

	addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()
	filesURL := func(filePath string) string {
		return fmt.Sprintf("http://admin:admin@%s/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/%s/files/%s",
			addr, repo, filePath)
	}

	// Create a managed folder so its _folder.json exists for PUT/DELETE tests.
	req, err := http.NewRequest(http.MethodPost, filesURL("protected-folder/"), nil)
	require.NoError(t, err)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	// nolint:errcheck
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode, "setup: creating protected-folder should succeed")

	t.Run("POST to _folder.json is blocked", func(t *testing.T) {
		body := []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"some-uid"},"spec":{"title":"attempt"}}`)
		req, err := http.NewRequest(http.MethodPost, filesURL("new-folder/_folder.json"), bytes.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		// nolint:errcheck
		defer resp.Body.Close()
		require.Equal(t, http.StatusForbidden, resp.StatusCode, "direct POST to _folder.json must be blocked")
	})

	t.Run("PUT to existing _folder.json is blocked", func(t *testing.T) {
		body := []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"tampered-uid"},"spec":{"title":"tampered"}}`)
		req, err := http.NewRequest(http.MethodPut, filesURL("protected-folder/_folder.json"), bytes.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		// nolint:errcheck
		defer resp.Body.Close()
		require.Equal(t, http.StatusForbidden, resp.StatusCode, "PUT to _folder.json must be blocked")
	})

	t.Run("DELETE of _folder.json is blocked", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodDelete, filesURL("protected-folder/_folder.json"), nil)
		require.NoError(t, err)
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		// nolint:errcheck
		defer resp.Body.Close()
		require.Equal(t, http.StatusForbidden, resp.StatusCode, "DELETE of _folder.json must be blocked")
	})

	t.Run("GET of _folder.json is still allowed", func(t *testing.T) {
		wrapObj, err := helper.Repositories.Resource.Get(ctx, repo, metav1.GetOptions{}, "files", "protected-folder/_folder.json")
		require.NoError(t, err, "_folder.json must remain readable")
		uid, _, _ := unstructured.NestedString(wrapObj.Object, "resource", "file", "metadata", "name")
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
			var bodyReader io.Reader
			if tc.body != nil {
				bodyReader = bytes.NewReader(tc.body)
			}
			req, err := http.NewRequest(tc.method, filesURL("_folder.json"), bodyReader)
			require.NoError(t, err)
			if tc.body != nil {
				req.Header.Set("Content-Type", "application/json")
			}
			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			// nolint:errcheck
			defer resp.Body.Close()
			require.Equal(t, http.StatusForbidden, resp.StatusCode)
		})
	}
}

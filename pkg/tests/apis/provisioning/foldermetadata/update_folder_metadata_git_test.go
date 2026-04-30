package foldermetadata

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationGitFiles_UpdateFolderMetadataOnNewBranch verifies that renaming
// a provisioned folder with the "new branch" workflow succeeds. Before the fix,
// WriteFolderMetadataUpdate read the existing _folder.json from the target ref;
// because the branch didn't exist yet, resolveRefToHash failed with ErrRefNotFound.
// The fix falls back to reading from the configured branch.
func TestIntegrationGitFiles_UpdateFolderMetadataOnNewBranch(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "update-folder-metadata-branch"
	helper.CreateGitRepo(t, repoName, nil, "write", "branch")

	// Create a folder on the default branch so we have a _folder.json to update.
	resp := postFolderViaFilesAPI(t, helper, repoName, "rename-target/", "", "Create folder for rename test")
	body, _ := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode, "creating folder on default branch should succeed: %s", string(body))

	originalUID := readFolderFieldOnRef(t, helper, ctx, repoName, "rename-target/_folder.json", "", "metadata", "name")
	require.NotEmpty(t, originalUID, "setup: folder should have a UID")
	originalTitle := readFolderFieldOnRef(t, helper, ctx, repoName, "rename-target/_folder.json", "", "spec", "title")
	require.NotEmpty(t, originalTitle, "setup: folder should have a title")

	t.Run("rename folder on new branch succeeds", func(t *testing.T) {
		const newBranch = "rename-folder/new-title"

		resp := putFolderViaFilesAPI(t, helper, repoName,
			"rename-target/", newBranch, "Rename folder on new branch",
			common.FolderBody(t, originalUID, "Renamed Title"))
		body, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode, "PUT to rename folder on new branch should succeed: %s", string(body))

		// The _folder.json on the new branch must have the updated title.
		newTitle := readFolderFieldOnRef(t, helper, ctx, repoName,
			"rename-target/_folder.json", newBranch, "spec", "title")
		require.Equal(t, "Renamed Title", newTitle, "title should be updated on the new branch")

		// The UID must be preserved.
		newUID := readFolderFieldOnRef(t, helper, ctx, repoName,
			"rename-target/_folder.json", newBranch, "metadata", "name")
		require.Equal(t, originalUID, newUID, "UID must not change after rename")

		// The default branch must be untouched.
		defaultTitle := readFolderFieldOnRef(t, helper, ctx, repoName,
			"rename-target/_folder.json", "", "spec", "title")
		require.Equal(t, originalTitle, defaultTitle, "default branch title must not change")
	})

	t.Run("second rename on the same branch updates existing branch", func(t *testing.T) {
		const branch = "rename-folder/second-rename"

		// First rename creates the branch.
		resp := putFolderViaFilesAPI(t, helper, repoName,
			"rename-target/", branch, "First rename",
			common.FolderBody(t, originalUID, "First Rename"))
		body, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode, "first rename on new branch should succeed: %s", string(body))

		// Second rename hits the branch that now exists (no fallback needed).
		resp = putFolderViaFilesAPI(t, helper, repoName,
			"rename-target/", branch, "Second rename",
			common.FolderBody(t, originalUID, "Second Rename"))
		body, _ = io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode, "second rename on existing branch should succeed: %s", string(body))

		title := readFolderFieldOnRef(t, helper, ctx, repoName,
			"rename-target/_folder.json", branch, "spec", "title")
		require.Equal(t, "Second Rename", title, "title should reflect the second rename")

		uid := readFolderFieldOnRef(t, helper, ctx, repoName,
			"rename-target/_folder.json", branch, "metadata", "name")
		require.Equal(t, originalUID, uid, "UID must not change after multiple renames")
	})

	t.Run("rename nested folder on new branch succeeds", func(t *testing.T) {
		// Create a nested folder on the default branch.
		resp := postFolderViaFilesAPI(t, helper, repoName, "rename-target/child/", "", "Create child folder")
		body, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode, "creating nested folder should succeed: %s", string(body))

		childUID := readFolderFieldOnRef(t, helper, ctx, repoName,
			"rename-target/child/_folder.json", "", "metadata", "name")
		require.NotEmpty(t, childUID, "child folder should have a UID")

		const nestedBranch = "rename-folder/nested-child"

		resp = putFolderViaFilesAPI(t, helper, repoName,
			"rename-target/child/", nestedBranch, "Rename nested folder",
			common.FolderBody(t, childUID, "Renamed Child"))
		body, _ = io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode, "PUT to rename nested folder should succeed: %s", string(body))

		title := readFolderFieldOnRef(t, helper, ctx, repoName,
			"rename-target/child/_folder.json", nestedBranch, "spec", "title")
		require.Equal(t, "Renamed Child", title, "nested folder title should be updated on the branch")

		uid := readFolderFieldOnRef(t, helper, ctx, repoName,
			"rename-target/child/_folder.json", nestedBranch, "metadata", "name")
		require.Equal(t, childUID, uid, "nested folder UID must not change")
	})
}

// ── helpers ────────────────────────────────────────────────────────────────

// putFolderViaFilesAPI sends a raw HTTP PUT to the files endpoint for a folder
// path. We build the URL manually because the K8s REST client strips the
// trailing slash that the files endpoint needs to distinguish folders from files.
func putFolderViaFilesAPI(t *testing.T, helper *common.GitTestHelper, repoName, folderPath, ref, message string, body []byte) *http.Response {
	t.Helper()

	addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()
	rawURL := fmt.Sprintf(
		"http://admin:admin@%s/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/%s/files/%s",
		addr, repoName, folderPath,
	)

	parsedURL, err := url.Parse(rawURL)
	require.NoError(t, err)

	params := parsedURL.Query()
	if message != "" {
		params.Set("message", message)
	}
	if ref != "" {
		params.Set("ref", ref)
	}
	parsedURL.RawQuery = params.Encode()

	req, err := http.NewRequest(http.MethodPut, parsedURL.String(), bytes.NewReader(body))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)

	return resp
}

// readFolderFieldOnRef reads a field from a _folder.json on a specific branch
// via the files subresource API. Pass an empty ref to read from the default
// branch. fields is the JSON path under "resource" → "file", e.g.
// ("metadata", "name") or ("spec", "title").
func readFolderFieldOnRef(
	t *testing.T, helper *common.GitTestHelper, ctx context.Context,
	repoName, filePath, ref string, fields ...string,
) string {
	t.Helper()

	subresourceParts := append([]string{"files"}, strings.Split(filePath, "/")...)
	req := helper.AdminREST.Get().
		Namespace("default").
		Resource("repositories").
		Name(repoName).
		SubResource(subresourceParts...)

	if ref != "" {
		req = req.Param("ref", ref)
	}

	result := req.Do(ctx)
	require.NoError(t, result.Error(), "%s (ref=%q): should be readable via the files endpoint", filePath, ref)

	wrapObj := &unstructured.Unstructured{}
	require.NoError(t, result.Into(wrapObj), "%s (ref=%q): failed to decode response", filePath, ref)

	keyPath := append([]string{"resource", "file"}, fields...)
	val, _, _ := unstructured.NestedString(wrapObj.Object, keyPath...)
	return val
}

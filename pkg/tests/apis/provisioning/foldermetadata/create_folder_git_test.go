package foldermetadata

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"testing"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

func TestIntegrationGitFiles_CreateFolderWithFolderMetadata(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := sharedGitHelper(t)
	ctx := context.Background()

	repoName := "test-folder-metadata-files"
	_, _ = helper.CreateGitRepo(t, repoName, nil, "write", "branch")

	t.Run("create folder on default branch writes _folder.json", func(t *testing.T) {
		resp := postFolderViaFilesAPI(t, helper, repoName, "meta-folder/", "", "Create folder with metadata")
		body, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode, "should create folder on default branch: %s", string(body))

		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "meta-folder", "_folder.json").
			Do(ctx)
		require.NoError(t, result.Error(), "_folder.json should exist in the folder")
	})

	t.Run("create folder on new branch writes _folder.json", func(t *testing.T) {
		branchName := "metadata-branch"

		resp := postFolderViaFilesAPI(t, helper, repoName, "branch-meta-folder/", branchName, "Create folder with metadata on branch")
		body, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode, "should create folder on new branch: %s", string(body))

		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "branch-meta-folder", "_folder.json").
			Param("ref", branchName).
			Do(ctx)
		require.NoError(t, result.Error(), "_folder.json should exist on the branch")

		result = helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "branch-meta-folder", "_folder.json").
			Do(ctx)
		require.True(t, apierrors.IsNotFound(result.Error()), "_folder.json should not exist on the default branch")
	})

	t.Run("create nested folder on new branch writes _folder.json for every segment", func(t *testing.T) {
		branchName := "nested-metadata-branch"

		resp := postFolderViaFilesAPI(t, helper, repoName, "outer/inner/", branchName, "Create nested folder on branch")
		body, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode, "should create nested folder on new branch: %s", string(body))

		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "outer", "_folder.json").
			Param("ref", branchName).
			Do(ctx)
		require.NoError(t, result.Error(), "parent _folder.json should exist on the branch")

		result = helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "outer", "inner", "_folder.json").
			Param("ref", branchName).
			Do(ctx)
		require.NoError(t, result.Error(), "child _folder.json should exist on the branch")
	})

	t.Run("create nested folder on new branch reuses ancestor metadata from default branch", func(t *testing.T) {
		// First, create a parent folder on the default branch so it has _folder.json.
		resp := postFolderViaFilesAPI(t, helper, repoName, "existing-parent/", "", "Create parent on default branch")
		body, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode, "creating parent on default branch should succeed: %s", string(body))

		// Read the parent UID from the default branch.
		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "existing-parent", "_folder.json").
			Do(ctx)
		require.NoError(t, result.Error(), "parent _folder.json should exist on default branch")

		// Now create a child inside that parent on a NEW branch.
		// This is the scenario that previously failed with "file already exists" because
		// the code tried to re-create parent/_folder.json on the new branch even though
		// it already existed on the default branch (which the new branch inherits from).
		branchName := "branch-with-existing-parent"
		resp = postFolderViaFilesAPI(t, helper, repoName, "existing-parent/new-child/", branchName, "Create child on new branch")
		body, _ = io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode, "creating child under existing parent on new branch should succeed: %s", string(body))

		// Verify the child _folder.json was created on the branch.
		result = helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "existing-parent", "new-child", "_folder.json").
			Param("ref", branchName).
			Do(ctx)
		require.NoError(t, result.Error(), "child _folder.json should exist on the branch")

		// Verify the parent _folder.json is still readable on the branch (inherited from default).
		result = helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repoName).
			SubResource("files", "existing-parent", "_folder.json").
			Param("ref", branchName).
			Do(ctx)
		require.NoError(t, result.Error(), "parent _folder.json should be readable on the branch (inherited)")
	})
}

// postFolderViaFilesAPI makes a raw HTTP POST to the files endpoint to create a folder.
// We build the URL manually because the K8s REST client may strip the trailing
// slash that the files endpoint needs to distinguish folders from files.
func postFolderViaFilesAPI(t *testing.T, helper *common.GitTestHelper, repoName, folderPath, ref, message string) *http.Response {
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

	req, err := http.NewRequest(http.MethodPost, parsedURL.String(), nil)
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)

	return resp
}

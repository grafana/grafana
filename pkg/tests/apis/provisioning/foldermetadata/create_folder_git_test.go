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

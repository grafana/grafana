package foldermetadata

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/google/go-github/v82/github"
	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/client-go/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// githubHealthCheckMockClient mocks the GitHub API calls that still happen for
// GitHub-typed repositories even though git transport is backed by local gittest.
func githubHealthCheckMockClient() *http.Client {
	return ghmock.NewMockedHTTPClient(
		ghmock.WithRequestMatchHandler(
			ghmock.GetReposBranchesProtectionByOwnerByRepoByBranch,
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(http.StatusForbidden)
			}),
		),
		ghmock.WithRequestMatchHandler(
			ghmock.GetReposRulesBranchesByOwnerByRepoByBranch,
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode([]*github.RepositoryRule{})
			}),
		),
	)
}

// TestIntegrationGitHubFiles_DashboardBranchURLs verifies that dashboard writes
// through a healthy GitHub-typed gittest repo return GitHub URL wrappers for both
// new branch creation and a later update to the same branch.
func TestIntegrationGitHubFiles_DashboardBranchURLs(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()
	helper.GetEnv().GithubRepoFactory.Client = githubHealthCheckMockClient()

	const repoName = "github-dashboard-urls"
	remote, _ := helper.CreateGithubRepo(t, repoName, nil, "", "write", "branch")

	const branch = "feature-dashboard-urls"
	const dashboardPath = "dashboard.json"

	result := helper.AdminREST.Post().
		Namespace(helper.Namespace).
		Resource("repositories").
		Name(repoName).
		SubResource("files", dashboardPath).
		Param("ref", branch).
		Param("message", "Create dashboard on branch").
		Body(common.DashboardJSON("github-url-dash", "GitHub URL Dashboard", 1)).
		SetHeader("Content-Type", "application/json").
		Do(ctx)
	require.NoError(t, result.Error(), "should create dashboard on branch")
	assertGitHubFileURLs(t, decodeResourceWrapperResult(t, result), remote.URL, branch, dashboardPath)

	result = helper.AdminREST.Put().
		Namespace(helper.Namespace).
		Resource("repositories").
		Name(repoName).
		SubResource("files", dashboardPath).
		Param("ref", branch).
		Param("message", "Update dashboard on branch").
		Body(common.DashboardJSON("github-url-dash", "GitHub URL Dashboard Updated", 2)).
		SetHeader("Content-Type", "application/json").
		Do(ctx)
	require.NoError(t, result.Error(), "should update dashboard on existing branch")
	assertGitHubFileURLs(t, decodeResourceWrapperResult(t, result), remote.URL, branch, dashboardPath)
}

// TestIntegrationGitHubFiles_FolderMetadataBranchURLs verifies the folder
// metadata branch update path returns URLs for the concrete _folder.json file,
// which is the regression surface for folder rename/update operations.
func TestIntegrationGitHubFiles_FolderMetadataBranchURLs(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()
	helper.GetEnv().GithubRepoFactory.Client = githubHealthCheckMockClient()

	const repoName = "github-folder-urls"
	remote, _ := helper.CreateGithubRepo(t, repoName, nil, "", "write", "branch")

	resp := postFolderViaFilesAPI(t, helper, repoName, "team-a/", "", "Create folder")
	body, _ := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode, "creating folder on default branch should succeed: %s", string(body))

	uid := readFolderFieldOnRef(t, helper, ctx, repoName, "team-a/_folder.json", "", "metadata", "name")
	require.NotEmpty(t, uid, "setup: folder should have a UID")

	const branch = "feature-folder-urls"
	resp = putFolderViaFilesAPI(t, helper, repoName,
		"team-a/", branch, "Rename folder on branch",
		common.FolderBody(t, uid, "Team A Renamed"))
	defer func() { _ = resp.Body.Close() }()
	wrapper := decodeResourceWrapperResponse(t, resp)
	assertGitHubFileURLs(t, wrapper, remote.URL, branch, "team-a/_folder.json")
}

// decodeResourceWrapperResult reads a Kubernetes REST result from the files
// endpoint and decodes the ResourceWrapper returned by dashboard file writes.
func decodeResourceWrapperResult(t *testing.T, result rest.Result) *provisioning.ResourceWrapper {
	t.Helper()

	raw, err := result.Raw()
	require.NoError(t, err, "failed to read resource wrapper response")
	return decodeResourceWrapperBytes(t, raw)
}

// decodeResourceWrapperResponse reads a raw HTTP response from folder file
// helpers, which build URLs manually to preserve trailing slash folder paths.
func decodeResourceWrapperResponse(t *testing.T, resp *http.Response) *provisioning.ResourceWrapper {
	t.Helper()

	body, err := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	require.NoError(t, err, "failed to read resource wrapper response")
	require.Equal(t, http.StatusOK, resp.StatusCode, "expected successful files response: %s", string(body))
	return decodeResourceWrapperBytes(t, body)
}

// decodeResourceWrapperBytes unmarshals a files API response body into the
// typed wrapper and includes the raw body in failures for easier diagnosis.
func decodeResourceWrapperBytes(t *testing.T, body []byte) *provisioning.ResourceWrapper {
	t.Helper()

	wrapper := &provisioning.ResourceWrapper{}
	require.NoError(t, json.Unmarshal(body, wrapper), "failed to decode resource wrapper: %s", string(body))
	return wrapper
}

// assertGitHubFileURLs checks the GitHub-specific URL wrapper fields for a file
// on a non-default branch. gittest exposes clone URLs with .git, but Grafana's
// GitHub URL helpers intentionally emit browser URLs without that suffix.
func assertGitHubFileURLs(t *testing.T, wrapper *provisioning.ResourceWrapper, repoURL, branch, filePath string) {
	t.Helper()

	repoURL = strings.TrimSuffix(repoURL, ".git")

	require.NotNil(t, wrapper.URLs, "expected GitHub repository URLs")
	require.Contains(t, repoURL, wrapper.URLs.RepositoryURL)
	require.Equal(t, fmt.Sprintf("%s/blob/%s/%s", repoURL, branch, filePath), wrapper.URLs.SourceURL)
	require.Equal(t, fmt.Sprintf("%s/compare/main...%s", repoURL, branch), wrapper.URLs.CompareURL)
	require.Equal(t, fmt.Sprintf("%s/compare/main...%s?quick_pull=1&labels=grafana", repoURL, branch), wrapper.URLs.NewPullRequestURL)
}

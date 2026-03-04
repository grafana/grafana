package provisioning

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/go-github/v82/github"
	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationGitHubBranchProtection tests that branch protection rules are properly validated
// when configuring a GitHub repository with the write workflow.
func TestIntegrationGitHubBranchProtection(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()

	// Start test git server that responds to nanogit's smart HTTP protocol
	gitServer := startTestGitServer(t)
	defer gitServer.Close()

	makeRepoConfig := func(name string, workflows []string) []byte {
		repoConfig := map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			"metadata": map[string]any{
				"name": name,
			},
			"spec": map[string]any{
				"title":     "Branch Protection Test",
				"type":      "github",
				"workflows": workflows,
				"github": map[string]any{
					"url":    gitServer.URL + "/owner/repo",
					"branch": "main",
				},
				"sync": map[string]any{
					"enabled": false,
					"target":  "folder",
				},
			},
			"secure": map[string]any{
				"token": map[string]any{
					"create": "test-token",
				},
			},
		}
		b, _ := json.Marshal(repoConfig)
		return b
	}

	t.Run("write workflow with required pull request reviews returns error", func(t *testing.T) {
		repoFactory := helper.GetEnv().GithubRepoFactory
		repoFactory.Client = ghmock.NewMockedHTTPClient(
			ghmock.WithRequestMatchHandler(
				ghmock.GetReposBranchesProtectionByOwnerByRepoByBranch,
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					w.WriteHeader(http.StatusOK)
					protection := &github.Protection{
						RequiredPullRequestReviews: &github.PullRequestReviewsEnforcement{},
					}
					_, _ = w.Write(ghmock.MustMarshal(protection))
				}),
			),
		)
		helper.SetGithubRepositoryFactory(repoFactory)

		rawBody, _ := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name("test-bp-required-pr").
			SubResource("test").
			Body(makeRepoConfig("test-bp-required-pr", []string{"write"})).
			SetHeader("Content-Type", "application/json").
			Do(ctx).
			Raw()

		var testResults provisioning.TestResults
		require.NoError(t, json.Unmarshal(rawBody, &testResults))
		require.False(t, testResults.Success, "test should fail when required PR reviews are enabled")
		require.NotEmpty(t, testResults.Errors, "should have errors")
		require.Equal(t, "spec.workflows", testResults.Errors[0].Field, "error should target spec.workflows")
		require.Contains(t, testResults.Errors[0].Detail, "required pull request reviews")
		require.Contains(t, testResults.Errors[0].Detail, "protection rules that prevent direct pushes")
	})

	t.Run("write workflow with locked branch returns error", func(t *testing.T) {
		repoFactory := helper.GetEnv().GithubRepoFactory
		repoFactory.Client = ghmock.NewMockedHTTPClient(
			ghmock.WithRequestMatchHandler(
				ghmock.GetReposBranchesProtectionByOwnerByRepoByBranch,
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					w.WriteHeader(http.StatusOK)
					protection := &github.Protection{
						LockBranch: &github.LockBranch{Enabled: github.Ptr(true)},
					}
					_, _ = w.Write(ghmock.MustMarshal(protection))
				}),
			),
		)
		helper.SetGithubRepositoryFactory(repoFactory)

		rawBody, _ := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name("test-bp-locked").
			SubResource("test").
			Body(makeRepoConfig("test-bp-locked", []string{"write"})).
			SetHeader("Content-Type", "application/json").
			Do(ctx).
			Raw()

		var testResults provisioning.TestResults
		require.NoError(t, json.Unmarshal(rawBody, &testResults))
		require.False(t, testResults.Success, "test should fail when branch is locked")
		require.NotEmpty(t, testResults.Errors, "should have errors")
		require.Equal(t, "spec.workflows", testResults.Errors[0].Field, "error should target spec.workflows")
		require.Contains(t, testResults.Errors[0].Detail, "branch is locked")
		require.Contains(t, testResults.Errors[0].Detail, "protection rules that prevent direct pushes")
	})

	t.Run("write workflow with multiple protection rules returns error with all reasons", func(t *testing.T) {
		repoFactory := helper.GetEnv().GithubRepoFactory
		repoFactory.Client = ghmock.NewMockedHTTPClient(
			ghmock.WithRequestMatchHandler(
				ghmock.GetReposBranchesProtectionByOwnerByRepoByBranch,
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					w.WriteHeader(http.StatusOK)
					protection := &github.Protection{
						RequiredPullRequestReviews: &github.PullRequestReviewsEnforcement{},
						LockBranch:                 &github.LockBranch{Enabled: github.Ptr(true)},
					}
					_, _ = w.Write(ghmock.MustMarshal(protection))
				}),
			),
		)
		helper.SetGithubRepositoryFactory(repoFactory)

		rawBody, _ := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name("test-bp-multiple").
			SubResource("test").
			Body(makeRepoConfig("test-bp-multiple", []string{"write"})).
			SetHeader("Content-Type", "application/json").
			Do(ctx).
			Raw()

		var testResults provisioning.TestResults
		require.NoError(t, json.Unmarshal(rawBody, &testResults))
		require.False(t, testResults.Success, "test should fail when multiple protection rules are enabled")
		require.NotEmpty(t, testResults.Errors, "should have errors")
		require.Equal(t, "spec.workflows", testResults.Errors[0].Field, "error should target spec.workflows")
		require.Contains(t, testResults.Errors[0].Detail, "required pull request reviews")
		require.Contains(t, testResults.Errors[0].Detail, "branch is locked")
		require.Contains(t, testResults.Errors[0].Detail, "protection rules that prevent direct pushes")
	})

	t.Run("write workflow with unprotected branch succeeds", func(t *testing.T) {
		repoFactory := helper.GetEnv().GithubRepoFactory
		repoFactory.Client = ghmock.NewMockedHTTPClient(
			ghmock.WithRequestMatchHandler(
				ghmock.GetReposBranchesProtectionByOwnerByRepoByBranch,
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					w.WriteHeader(http.StatusNotFound)
					_, _ = w.Write(ghmock.MustMarshal(&github.ErrorResponse{
						Message: "Branch not protected",
					}))
				}),
			),
		)
		helper.SetGithubRepositoryFactory(repoFactory)

		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name("test-bp-unprotected").
			SubResource("test").
			Body(makeRepoConfig("test-bp-unprotected", []string{"write"})).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error())

		obj, err := result.Get()
		require.NoError(t, err)

		testResults := parseTestResults(t, obj)
		require.True(t, testResults.Success, "test should succeed when branch is not protected")
		require.Equal(t, 200, testResults.Code)
	})

	t.Run("branch workflow with protected branch succeeds", func(t *testing.T) {
		repoFactory := helper.GetEnv().GithubRepoFactory
		repoFactory.Client = ghmock.NewMockedHTTPClient(
			ghmock.WithRequestMatchHandler(
				ghmock.GetReposBranchesProtectionByOwnerByRepoByBranch,
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					w.WriteHeader(http.StatusOK)
					protection := &github.Protection{
						RequiredPullRequestReviews: &github.PullRequestReviewsEnforcement{},
						LockBranch:                 &github.LockBranch{Enabled: github.Ptr(true)},
					}
					_, _ = w.Write(ghmock.MustMarshal(protection))
				}),
			),
		)
		helper.SetGithubRepositoryFactory(repoFactory)

		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name("test-bp-branch-wf").
			SubResource("test").
			Body(makeRepoConfig("test-bp-branch-wf", []string{"branch"})).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error())

		obj, err := result.Get()
		require.NoError(t, err)

		testResults := parseTestResults(t, obj)
		require.True(t, testResults.Success, "test should succeed with branch workflow even if branch is protected")
		require.Equal(t, 200, testResults.Code)
	})
}

// startTestGitServer creates a minimal HTTP server that responds to git smart HTTP protocol requests.
// This allows nanogit to successfully connect and validate the repository URL.
//
// Why not use Gitea or a full git server?
// We use this lightweight mock because:
//  1. Speed: Starts instantly vs. Gitea which takes seconds to initialize
//  2. Simplicity: ~20 lines vs. managing a full server lifecycle, database, and configuration
//  3. Scope: We only need to validate git connectivity, not test actual git operations
//  4. Isolation: No external dependencies or ports to manage
//  5. Reliability: No risk of Gitea version incompatibilities or setup issues
//
// This test focuses on GitHub API branch protection validation, not git protocol correctness.
// The git server just needs to respond correctly to nanogit's initial connectivity check.
func startTestGitServer(t *testing.T) *httptest.Server {
	t.Helper()

	mux := http.NewServeMux()

	// Handle git-upload-pack info request (used for repository validation)
	mux.HandleFunc("/owner/repo.git/info/refs", func(w http.ResponseWriter, r *http.Request) {
		service := r.URL.Query().Get("service")
		if service == "git-upload-pack" {
			w.Header().Set("Content-Type", "application/x-git-upload-pack-advertisement")
			w.WriteHeader(http.StatusOK)
			// Minimal valid git protocol response
			_, _ = w.Write([]byte("001e# service=git-upload-pack\n0000"))
		} else {
			w.WriteHeader(http.StatusBadRequest)
		}
	})

	// Handle git-upload-pack request (used for fetching)
	mux.HandleFunc("/owner/repo.git/git-upload-pack", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/x-git-upload-pack-result")
		w.WriteHeader(http.StatusOK)
		// Minimal response with a ref
		_, _ = w.Write([]byte("003d7fd1a60b01f91b314f59955a4e4d4e80d8edf11d refs/heads/main\n0000"))
	})

	server := httptest.NewServer(mux)
	t.Logf("Test git server started at %s", server.URL)
	return server
}

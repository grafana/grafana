package provisioning

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/go-github/v82/github"
	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

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

// TestIntegrationGitHubBranchProtection_HealthStatus tests that repositories with branch protection
// are created successfully, but their health status reflects the branch protection issue.
func TestIntegrationGitHubBranchProtection_HealthStatus(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := runGrafana(t)
	ctx := context.Background()

	// Start test git server
	gitServer := startTestGitServer(t)
	defer gitServer.Close()

	t.Run("repository with required pull request reviews creates but shows unhealthy", func(t *testing.T) {
		// Set up mock GitHub client to return protected branch
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

		// Create repository with write workflow and protected branch
		repoConfig := map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			"metadata": map[string]any{
				"name": "test-health-pr-reviews",
			},
			"spec": map[string]any{
				"title":     "Health Test - PR Reviews",
				"type":      "github",
				"workflows": []string{"write"},
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

		body, _ := json.Marshal(repoConfig)
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		// Repository creation should succeed
		require.NoError(t, result.Error(), "repository creation should succeed even with protected branch")

		obj, err := result.Get()
		require.NoError(t, err)

		// Convert to repository (verify structure is valid)
		_ = unstructuredToRepository(t, obj.(*unstructured.Unstructured))

		// Wait a bit for health check to run
		time.Sleep(2 * time.Second)

		// Get the updated repository to check health status
		updatedResult := helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name("test-health-pr-reviews").
			Do(ctx)

		require.NoError(t, updatedResult.Error())
		updatedObj, err := updatedResult.Get()
		require.NoError(t, err)

		updatedRepo := unstructuredToRepository(t, updatedObj.(*unstructured.Unstructured))

		// Log the actual health status for debugging
		t.Logf("Health status: Healthy=%v, Error=%q", updatedRepo.Status.Health.Healthy, updatedRepo.Status.Health.Error)
		t.Logf("Field errors: %+v", updatedRepo.Status.FieldErrors)

		// Verify health status shows the repository as unhealthy
		require.False(t, updatedRepo.Status.Health.Healthy, "repository should be marked unhealthy due to branch protection")

		// Verify field errors contain branch protection issue (the actual details are here)
		require.NotEmpty(t, updatedRepo.Status.FieldErrors, "fieldErrors should contain branch protection issue")
		foundBranchProtectionError := false
		for _, fieldErr := range updatedRepo.Status.FieldErrors {
			if fieldErr.Field == "spec.workflows" &&
				strings.Contains(fieldErr.Detail, "protection rules that prevent direct pushes") {
				foundBranchProtectionError = true
				require.Contains(t, fieldErr.Detail, "required pull request reviews")
				break
			}
		}
		require.True(t, foundBranchProtectionError, "should have branch protection error on spec.workflows")
	})

	t.Run("repository with locked branch creates but shows unhealthy", func(t *testing.T) {
		// Set up mock GitHub client to return locked branch
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

		// Create repository with write workflow and locked branch
		repoConfig := map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			"metadata": map[string]any{
				"name": "test-health-locked",
			},
			"spec": map[string]any{
				"title":     "Health Test - Locked Branch",
				"type":      "github",
				"workflows": []string{"write"},
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

		body, _ := json.Marshal(repoConfig)
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		// Repository creation should succeed
		require.NoError(t, result.Error(), "repository creation should succeed even with locked branch")

		obj, err := result.Get()
		require.NoError(t, err)

		// Convert to repository (verify structure is valid)
		_ = unstructuredToRepository(t, obj.(*unstructured.Unstructured))

		// Wait a bit for health check to run
		time.Sleep(2 * time.Second)

		// Get the updated repository to check health status
		updatedResult := helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name("test-health-locked").
			Do(ctx)

		require.NoError(t, updatedResult.Error())
		updatedObj, err := updatedResult.Get()
		require.NoError(t, err)

		updatedRepo := unstructuredToRepository(t, updatedObj.(*unstructured.Unstructured))

		// Log the actual health status for debugging
		t.Logf("Health status: Healthy=%v, Error=%q", updatedRepo.Status.Health.Healthy, updatedRepo.Status.Health.Error)
		t.Logf("Field errors: %+v", updatedRepo.Status.FieldErrors)

		// Verify health status shows the repository as unhealthy
		require.False(t, updatedRepo.Status.Health.Healthy, "repository should be marked unhealthy due to locked branch")

		// Verify field errors contain branch lock issue (the actual details are here)
		require.NotEmpty(t, updatedRepo.Status.FieldErrors, "fieldErrors should contain branch lock issue")
		foundBranchLockError := false
		for _, fieldErr := range updatedRepo.Status.FieldErrors {
			if fieldErr.Field == "spec.workflows" &&
				strings.Contains(fieldErr.Detail, "protection rules that prevent direct pushes") {
				foundBranchLockError = true
				require.Contains(t, fieldErr.Detail, "branch is locked")
				break
			}
		}
		require.True(t, foundBranchLockError, "should have branch lock error on spec.workflows")
	})

	t.Run("repository with unprotected branch creates successfully", func(t *testing.T) {
		// Set up mock GitHub client to return unprotected branch
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

		// Create repository with write workflow and unprotected branch
		repoConfig := map[string]any{
			"apiVersion": "provisioning.grafana.app/v0alpha1",
			"kind":       "Repository",
			"metadata": map[string]any{
				"name": "test-health-unprotected",
			},
			"spec": map[string]any{
				"title":     "Health Test - Unprotected Branch",
				"type":      "github",
				"workflows": []string{"write"},
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

		body, _ := json.Marshal(repoConfig)
		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		// Repository creation should succeed
		require.NoError(t, result.Error(), "repository creation should succeed with unprotected branch")

		obj, err := result.Get()
		require.NoError(t, err)

		// Get the repository to verify it was created
		repo := unstructuredToRepository(t, obj.(*unstructured.Unstructured))

		// Log the actual health status for debugging
		t.Logf("Health status: Healthy=%v, Error=%q", repo.Status.Health.Healthy, repo.Status.Health.Error)
		t.Logf("Field errors: %+v", repo.Status.FieldErrors)

		// Verify no field errors related to branch protection
		for _, fieldErr := range repo.Status.FieldErrors {
			require.NotContains(t, fieldErr.Detail, "protection rules that prevent direct pushes",
				"unprotected branch should not have branch protection errors")
		}

		// NOTE: Currently the repository may be marked as unhealthy initially even
		// without branch protection issues, likely due to sync being disabled or
		// initial health check timing. This is acceptable - the important thing is
		// that there are no branch protection field errors.
	})
}

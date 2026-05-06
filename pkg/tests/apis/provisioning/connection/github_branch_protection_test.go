package connection

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
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationGitHubBranchProtection tests that branch protection rules are properly validated
// when configuring a GitHub repository with the write workflow.
func TestIntegrationGitHubBranchProtection(t *testing.T) {
	helper := sharedHelper(t)
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
			ghmock.WithRequestMatchHandler(
				ghmock.GetReposRulesBranchesByOwnerByRepoByBranch,
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					w.WriteHeader(http.StatusOK)
					// Return empty rulesets array (no rulesets configured)
					_, _ = w.Write([]byte("[]"))
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
			ghmock.WithRequestMatchHandler(
				ghmock.GetReposRulesBranchesByOwnerByRepoByBranch,
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					w.WriteHeader(http.StatusOK)
					_, _ = w.Write([]byte("[]"))
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
			ghmock.WithRequestMatchHandler(
				ghmock.GetReposRulesBranchesByOwnerByRepoByBranch,
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					w.WriteHeader(http.StatusOK)
					_, _ = w.Write([]byte("[]"))
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
			ghmock.WithRequestMatchHandler(
				ghmock.GetReposRulesBranchesByOwnerByRepoByBranch,
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					w.WriteHeader(http.StatusOK)
					_, _ = w.Write([]byte("[]"))
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

		testResults := common.ParseTestResults(t, obj)
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
			// No need to mock rulesets since branch protection check isn't called with branch workflow
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

		testResults := common.ParseTestResults(t, obj)
		require.True(t, testResults.Success, "test should succeed with branch workflow even if branch is protected")
		require.Equal(t, 200, testResults.Code)
	})

	t.Run("write workflow with forbidden (403) branch protection check succeeds", func(t *testing.T) {
		// Simulate a 403 Forbidden response when checking branch protection.
		// This happens when the token lacks admin permissions to view branch protection settings.
		// The test should succeed (skip the check gracefully) rather than fail.
		repoFactory := helper.GetEnv().GithubRepoFactory
		repoFactory.Client = ghmock.NewMockedHTTPClient(
			ghmock.WithRequestMatchHandler(
				ghmock.GetReposBranchesProtectionByOwnerByRepoByBranch,
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					w.WriteHeader(http.StatusForbidden)
					_, _ = w.Write([]byte(`{"message":"Resource not accessible by integration"}`))
				}),
			),
			ghmock.WithRequestMatchHandler(
				ghmock.GetReposRulesBranchesByOwnerByRepoByBranch,
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					w.WriteHeader(http.StatusOK)
					_, _ = w.Write([]byte("[]"))
				}),
			),
		)
		helper.SetGithubRepositoryFactory(repoFactory)

		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name("test-bp-forbidden").
			SubResource("test").
			Body(makeRepoConfig("test-bp-forbidden", []string{"write"})).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error())

		obj, err := result.Get()
		require.NoError(t, err)

		testResults := common.ParseTestResults(t, obj)
		require.True(t, testResults.Success, "test should succeed when branch protection check returns 403 (lacks admin permissions)")
		require.Equal(t, 200, testResults.Code)
	})

	// Rulesets-specific test cases
	t.Run("write workflow with ruleset requiring pull request returns error", func(t *testing.T) {
		repoFactory := helper.GetEnv().GithubRepoFactory
		// Mock no classic branch protection, but rulesets require PR
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
			ghmock.WithRequestMatchHandler(
				ghmock.GetReposRulesBranchesByOwnerByRepoByBranch,
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					// Rules API returns array of rule objects
					rules := []map[string]interface{}{
						{
							"type":                "pull_request",
							"ruleset_source_type": "Repository",
							"ruleset_source":      "test-owner/test-repo",
							"ruleset_id":          1,
							"parameters":          map[string]interface{}{},
						},
					}
					w.WriteHeader(http.StatusOK)
					require.NoError(t, json.NewEncoder(w).Encode(rules))
				}),
			),
		)
		helper.SetGithubRepositoryFactory(repoFactory)

		rawBody, _ := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name("test-ruleset-pr").
			SubResource("test").
			Body(makeRepoConfig("test-ruleset-pr", []string{"write"})).
			SetHeader("Content-Type", "application/json").
			Do(ctx).
			Raw()

		var testResults provisioning.TestResults
		require.NoError(t, json.Unmarshal(rawBody, &testResults))
		require.False(t, testResults.Success, "test should fail when ruleset requires pull request")
		require.NotEmpty(t, testResults.Errors, "should have errors")
		require.Equal(t, "spec.workflows", testResults.Errors[0].Field, "error should target spec.workflows")
		require.Contains(t, testResults.Errors[0].Detail, "ruleset requires pull request")
		require.Contains(t, testResults.Errors[0].Detail, "protection rules that prevent direct pushes")
	})

	t.Run("write workflow with ruleset having non-blocking rules succeeds", func(t *testing.T) {
		repoFactory := helper.GetEnv().GithubRepoFactory
		// Mock no classic branch protection, rulesets only have non-blocking rules
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
			ghmock.WithRequestMatchHandler(
				ghmock.GetReposRulesBranchesByOwnerByRepoByBranch,
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					// Rules API returns non-blocking rules
					rules := []map[string]interface{}{
						{
							"type":                "required_status_checks",
							"ruleset_source_type": "Repository",
							"ruleset_source":      "test-owner/test-repo",
							"ruleset_id":          2,
							"parameters":          map[string]interface{}{},
						},
					}
					w.WriteHeader(http.StatusOK)
					require.NoError(t, json.NewEncoder(w).Encode(rules))
				}),
			),
		)
		helper.SetGithubRepositoryFactory(repoFactory)

		rawBody, _ := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name("test-ruleset-non-blocking").
			SubResource("test").
			Body(makeRepoConfig("test-ruleset-non-blocking", []string{"write"})).
			SetHeader("Content-Type", "application/json").
			Do(ctx).
			Raw()

		var testResults provisioning.TestResults
		require.NoError(t, json.Unmarshal(rawBody, &testResults))
		require.True(t, testResults.Success, "test should succeed when ruleset only has non-blocking rules")
	})

	t.Run("write workflow with both classic protection and rulesets returns error with all reasons", func(t *testing.T) {
		repoFactory := helper.GetEnv().GithubRepoFactory
		// Mock both classic branch protection and rulesets
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
			ghmock.WithRequestMatchHandler(
				ghmock.GetReposRulesBranchesByOwnerByRepoByBranch,
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					// Rules API returns pull_request rule
					rules := []map[string]interface{}{
						{
							"type":                "pull_request",
							"ruleset_source_type": "Repository",
							"ruleset_source":      "test-owner/test-repo",
							"ruleset_id":          3,
							"parameters":          map[string]interface{}{},
						},
					}
					w.WriteHeader(http.StatusOK)
					require.NoError(t, json.NewEncoder(w).Encode(rules))
				}),
			),
		)
		helper.SetGithubRepositoryFactory(repoFactory)

		rawBody, _ := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name("test-combined-protection").
			SubResource("test").
			Body(makeRepoConfig("test-combined-protection", []string{"write"})).
			SetHeader("Content-Type", "application/json").
			Do(ctx).
			Raw()

		var testResults provisioning.TestResults
		require.NoError(t, json.Unmarshal(rawBody, &testResults))
		require.False(t, testResults.Success, "test should fail when both classic protection and rulesets are active")
		require.NotEmpty(t, testResults.Errors, "should have errors")
		require.Equal(t, "spec.workflows", testResults.Errors[0].Field, "error should target spec.workflows")
		// Should contain both classic protection and ruleset reasons
		require.Contains(t, testResults.Errors[0].Detail, "branch is locked")
		require.Contains(t, testResults.Errors[0].Detail, "ruleset requires pull request")
		require.Contains(t, testResults.Errors[0].Detail, "protection rules that prevent direct pushes")
	})

	t.Run("write workflow with disabled ruleset succeeds", func(t *testing.T) {
		repoFactory := helper.GetEnv().GithubRepoFactory
		// Mock ruleset that is disabled (should be ignored)
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
			ghmock.WithRequestMatchHandler(
				ghmock.GetReposRulesBranchesByOwnerByRepoByBranch,
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					// Rules API does not return disabled rulesets (empty array)
					rules := []interface{}{}
					w.WriteHeader(http.StatusOK)
					require.NoError(t, json.NewEncoder(w).Encode(rules))
				}),
			),
		)
		helper.SetGithubRepositoryFactory(repoFactory)

		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name("test-disabled-ruleset").
			SubResource("test").
			Body(makeRepoConfig("test-disabled-ruleset", []string{"write"})).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error())

		obj, err := result.Get()
		require.NoError(t, err)

		testResults := common.ParseTestResults(t, obj)
		require.True(t, testResults.Success, "test should succeed when ruleset is disabled")
		require.Equal(t, 200, testResults.Code)
	})

	t.Run("write workflow with ruleset not matching branch succeeds", func(t *testing.T) {
		repoFactory := helper.GetEnv().GithubRepoFactory
		// Mock ruleset that doesn't match the branch we're testing (main)
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
			ghmock.WithRequestMatchHandler(
				ghmock.GetReposRulesBranchesByOwnerByRepoByBranch,
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					// Rules API returns only rules matching the queried branch (none in this case)
					rules := []interface{}{}
					w.WriteHeader(http.StatusOK)
					require.NoError(t, json.NewEncoder(w).Encode(rules))
				}),
			),
		)
		helper.SetGithubRepositoryFactory(repoFactory)

		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name("test-non-matching-ruleset").
			SubResource("test").
			Body(makeRepoConfig("test-non-matching-ruleset", []string{"write"})).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error())

		obj, err := result.Get()
		require.NoError(t, err)

		testResults := common.ParseTestResults(t, obj)
		require.True(t, testResults.Success, "test should succeed when ruleset doesn't match the branch")
		require.Equal(t, 200, testResults.Code)
	})

	t.Run("write workflow with forbidden (403) rulesets check succeeds", func(t *testing.T) {
		// Simulate a 403 Forbidden response when checking rulesets.
		// This happens when the token lacks permissions to view rulesets.
		// The test should succeed (skip the check gracefully) rather than fail.
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
			ghmock.WithRequestMatchHandler(
				ghmock.GetReposRulesBranchesByOwnerByRepoByBranch,
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					w.WriteHeader(http.StatusForbidden)
					_, _ = w.Write([]byte(`{"message":"Resource not accessible"}`))
				}),
			),
		)
		helper.SetGithubRepositoryFactory(repoFactory)

		result := helper.AdminREST.Post().
			Namespace("default").
			Resource("repositories").
			Name("test-ruleset-forbidden").
			SubResource("test").
			Body(makeRepoConfig("test-ruleset-forbidden", []string{"write"})).
			SetHeader("Content-Type", "application/json").
			Do(ctx)

		require.NoError(t, result.Error())

		obj, err := result.Get()
		require.NoError(t, err)

		testResults := common.ParseTestResults(t, obj)
		require.True(t, testResults.Success, "test should succeed when rulesets check returns 403 (gracefully skip)")
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

	// Handle git-upload-pack and git-receive-pack info requests
	mux.HandleFunc("/owner/repo.git/info/refs", func(w http.ResponseWriter, r *http.Request) {
		service := r.URL.Query().Get("service")
		switch service {
		case "git-upload-pack":
			w.Header().Set("Content-Type", "application/x-git-upload-pack-advertisement")
			w.WriteHeader(http.StatusOK)
			// Minimal valid git protocol response
			_, _ = w.Write([]byte("001e# service=git-upload-pack\n0000"))
		case "git-receive-pack":
			w.Header().Set("Content-Type", "application/x-git-receive-pack-advertisement")
			w.WriteHeader(http.StatusOK)
			// Minimal valid git protocol response for push operations
			_, _ = w.Write([]byte("001f# service=git-receive-pack\n0000"))
		default:
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

	// Handle git-receive-pack request (used for pushing/write permission checks)
	mux.HandleFunc("/owner/repo.git/git-receive-pack", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/x-git-receive-pack-result")
		w.WriteHeader(http.StatusOK)
		// Minimal response indicating success
		_, _ = w.Write([]byte("0000"))
	})

	server := httptest.NewServer(mux)
	t.Logf("Test git server started at %s", server.URL)
	return server
}

// TestIntegrationGitHubBranchProtection_HealthStatus tests that repositories with branch protection
// are created successfully, but their health status reflects the branch protection issue.
func TestIntegrationGitHubBranchProtection_HealthStatus(t *testing.T) {
	helper := sharedHelper(t)
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
			ghmock.WithRequestMatchHandler(
				ghmock.GetReposRulesBranchesByOwnerByRepoByBranch,
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					w.WriteHeader(http.StatusOK)
					_, _ = w.Write([]byte("[]"))
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
		_ = common.MustFromUnstructured[provisioning.Repository](t, obj.(*unstructured.Unstructured))

		// Wait for health check to run and mark repository as unhealthy
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			repoStatus, err := helper.Repositories.Resource.Get(ctx, "test-health-pr-reviews", metav1.GetOptions{})
			if !assert.NoError(collect, err, "failed to get repository status") {
				return
			}

			repo := common.MustFromUnstructured[provisioning.Repository](t, repoStatus)

			// Log the actual health status for debugging
			t.Logf("Health status: Healthy=%v, Error=%q", repo.Status.Health.Healthy, repo.Status.Health.Error)
			t.Logf("Field errors: %+v", repo.Status.FieldErrors)

			// Repository should be marked unhealthy
			assert.False(collect, repo.Status.Health.Healthy, "repository should be marked unhealthy due to branch protection")

			// Field errors should contain branch protection issue
			assert.NotEmpty(collect, repo.Status.FieldErrors, "fieldErrors should contain branch protection issue")

			// Look for branch protection error on spec.workflows
			foundBranchProtectionError := false
			for _, fieldErr := range repo.Status.FieldErrors {
				if fieldErr.Field == "spec.workflows" &&
					strings.Contains(fieldErr.Detail, "protection rules that prevent direct pushes") &&
					strings.Contains(fieldErr.Detail, "required pull request reviews") {
					foundBranchProtectionError = true
					break
				}
			}
			assert.True(collect, foundBranchProtectionError, "should have branch protection error on spec.workflows")
		}, 15*time.Second, 500*time.Millisecond, "repository should be marked unhealthy with branch protection errors")
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
			ghmock.WithRequestMatchHandler(
				ghmock.GetReposRulesBranchesByOwnerByRepoByBranch,
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					w.WriteHeader(http.StatusOK)
					_, _ = w.Write([]byte("[]"))
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
		_ = common.MustFromUnstructured[provisioning.Repository](t, obj.(*unstructured.Unstructured))

		// Wait for health check to run and mark repository as unhealthy
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			repoStatus, err := helper.Repositories.Resource.Get(ctx, "test-health-locked", metav1.GetOptions{})
			if !assert.NoError(collect, err, "failed to get repository status") {
				return
			}

			repo := common.MustFromUnstructured[provisioning.Repository](t, repoStatus)

			// Log the actual health status for debugging
			t.Logf("Health status: Healthy=%v, Error=%q", repo.Status.Health.Healthy, repo.Status.Health.Error)
			t.Logf("Field errors: %+v", repo.Status.FieldErrors)

			// Repository should be marked unhealthy
			assert.False(collect, repo.Status.Health.Healthy, "repository should be marked unhealthy due to locked branch")

			// Field errors should contain branch lock issue
			assert.NotEmpty(collect, repo.Status.FieldErrors, "fieldErrors should contain branch lock issue")

			// Look for branch lock error on spec.workflows
			foundBranchLockError := false
			for _, fieldErr := range repo.Status.FieldErrors {
				if fieldErr.Field == "spec.workflows" &&
					strings.Contains(fieldErr.Detail, "protection rules that prevent direct pushes") &&
					strings.Contains(fieldErr.Detail, "branch is locked") {
					foundBranchLockError = true
					break
				}
			}
			assert.True(collect, foundBranchLockError, "should have branch lock error on spec.workflows")
		}, 15*time.Second, 500*time.Millisecond, "repository should be marked unhealthy with branch lock errors")
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
			ghmock.WithRequestMatchHandler(
				ghmock.GetReposRulesBranchesByOwnerByRepoByBranch,
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					w.WriteHeader(http.StatusOK)
					_, _ = w.Write([]byte("[]"))
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

		// Convert to repository (verify structure is valid)
		_ = common.MustFromUnstructured[provisioning.Repository](t, obj.(*unstructured.Unstructured))

		// Wait for health check to run, then verify no branch protection errors
		require.EventuallyWithT(t, func(collect *assert.CollectT) {
			repoStatus, err := helper.Repositories.Resource.Get(ctx, "test-health-unprotected", metav1.GetOptions{})
			if !assert.NoError(collect, err, "failed to get repository status") {
				return
			}

			repo := common.MustFromUnstructured[provisioning.Repository](t, repoStatus)

			// Log the actual health status for debugging
			t.Logf("Health status: Healthy=%v, Error=%q", repo.Status.Health.Healthy, repo.Status.Health.Error)
			t.Logf("Field errors: %+v", repo.Status.FieldErrors)

			// Verify health check has run (checked timestamp should be set)
			assert.Greater(collect, repo.Status.Health.Checked, int64(0), "health check should have run")

			// Verify no field errors related to branch protection
			for _, fieldErr := range repo.Status.FieldErrors {
				assert.NotContains(collect, fieldErr.Detail, "protection rules that prevent direct pushes",
					"unprotected branch should not have branch protection errors")
			}
		}, 15*time.Second, 500*time.Millisecond, "health check should run without branch protection errors")
	})
}

package webhook

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/google/go-github/v82/github"
	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// githubHealthCheckMocks returns ghmock handlers that satisfy the GitHub
// branch protection health check (returns no protections).
func githubHealthCheckMocks() []ghmock.MockBackendOption {
	return []ghmock.MockBackendOption{
		ghmock.WithRequestMatchHandler(
			ghmock.GetReposBranchesProtectionByOwnerByRepoByBranch,
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				// Return 403 — simulates a token without admin permissions.
				// The client gracefully skips the check for 403.
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
	}
}

func TestIntegrationProvisioning_GithubRepoNoWebhookWithoutURL(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	// Mock GitHub API for branch protection health check.
	helper.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient(githubHealthCheckMocks()...)

	const repoName = "github-no-webhook"
	helper.CreateGithubRepo(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("gh-dash", "GitHub Dashboard", 1),
	}, "" /* no webhook URL */, "write")

	obj, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{})
	require.NoError(t, err)

	repo := common.MustFromUnstructured[provisioning.Repository](t, obj)
	require.Nil(t, repo.Status.Webhook, "github repository without webhook URL should not have a webhook")
}

func TestIntegrationProvisioning_GithubRepoWebhookCreated(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	mockOpts := append(githubHealthCheckMocks(),
		ghmock.WithRequestMatchHandler(
			ghmock.GetReposHooksByOwnerByRepo,
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode([]*github.Hook{})
			}),
		),
		ghmock.WithRequestMatchHandler(
			ghmock.PostReposHooksByOwnerByRepo,
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(&github.Hook{
					ID:     github.Ptr(int64(456)),
					URL:    github.Ptr("https://grafana.example.com/hook"),
					Events: []string{"pull_request", "push"},
				})
			}),
		),
	)
	helper.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient(mockOpts...)

	const repoName = "github-with-webhook"
	helper.CreateGithubRepo(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("gh-webhook-dash", "GitHub Webhook Dashboard", 1),
	}, "https://grafana.example.com", "write")

	obj, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{})
	require.NoError(t, err)

	repo := common.MustFromUnstructured[provisioning.Repository](t, obj)
	require.NotNil(t, repo.Status.Webhook, "github repository with webhook URL and workflows should have a webhook")
	require.Equal(t, int64(456), repo.Status.Webhook.ID)
}

func TestIntegrationProvisioning_GithubRepoWebhookRecreatedWhenMissing(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	// Mock GitHub API for health check + webhook creation.
	mockOpts := append(githubHealthCheckMocks(),
		ghmock.WithRequestMatchHandler(
			ghmock.GetReposHooksByOwnerByRepo,
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode([]*github.Hook{})
			}),
		),
		ghmock.WithRequestMatchHandler(
			ghmock.PostReposHooksByOwnerByRepo,
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(&github.Hook{
					ID:     github.Ptr(int64(789)),
					URL:    github.Ptr("https://grafana.example.com/hook"),
					Events: []string{"pull_request", "push"},
				})
			}),
		),
	)
	helper.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient(mockOpts...)

	// Step 1: Create a github repo with webhook — webhook gets created.
	const repoName = "github-webhook-restart"
	helper.CreateGithubRepo(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("restart-dash", "Restart Dashboard", 1),
	}, "https://grafana.example.com", "write")

	obj, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{})
	require.NoError(t, err)
	repo := common.MustFromUnstructured[provisioning.Repository](t, obj)
	require.NotNil(t, repo.Status.Webhook, "webhook should exist after creation")

	// Step 2: Clear Status.Webhook to simulate restart / state loss.
	patch := []byte(`{"status":{"webhook":null}}`)
	_, err = helper.Repositories.Resource.Patch(ctx, repoName, types.MergePatchType, patch, metav1.PatchOptions{}, "status")
	require.NoError(t, err, "failed to clear webhook status")

	// Verify it's cleared.
	obj, err = helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{})
	require.NoError(t, err)
	repo = common.MustFromUnstructured[provisioning.Repository](t, obj)
	require.Nil(t, repo.Status.Webhook, "webhook should be nil after patch")

	// Step 3: Trigger reconciliation by updating the spec (bumps generation).
	// Retry on conflict since the controller may update the resource concurrently.
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		latest, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		updated := latest.DeepCopy()
		updated.Object["spec"].(map[string]any)["title"] = "Restart Dashboard (updated)"
		_, err = helper.Repositories.Resource.Update(ctx, updated, metav1.UpdateOptions{})
		assert.NoError(collect, err)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "spec update should succeed")

	// Step 4: Wait for the webhook to be re-created by the controller.
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		repo := common.MustFromUnstructured[provisioning.Repository](t, obj)
		assert.NotNil(collect, repo.Status.Webhook, "webhook should be re-created after restart")
		if repo.Status.Webhook != nil {
			assert.Equal(collect, int64(789), repo.Status.Webhook.ID)
		}
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "webhook should be re-created by the controller")
}

func TestIntegrationProvisioning_WebhookLastRotatedSetOnCreation(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	mockOpts := append(githubHealthCheckMocks(),
		ghmock.WithRequestMatchHandler(
			ghmock.GetReposHooksByOwnerByRepo,
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode([]*github.Hook{})
			}),
		),
		ghmock.WithRequestMatchHandler(
			ghmock.PostReposHooksByOwnerByRepo,
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(&github.Hook{
					ID:     github.Ptr(int64(100)),
					URL:    github.Ptr("https://grafana.example.com/hook"),
					Events: []string{"pull_request", "push"},
				})
			}),
		),
	)
	helper.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient(mockOpts...)

	const repoName = "github-last-rotated"
	helper.CreateGithubRepo(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("rotated-dash", "Rotated Dashboard", 1),
	}, "https://grafana.example.com", "write")

	obj, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{})
	require.NoError(t, err)

	repo := common.MustFromUnstructured[provisioning.Repository](t, obj)
	require.NotNil(t, repo.Status.Webhook)
	require.Greater(t, repo.Status.Webhook.LastRotated, int64(0), "LastRotated should be set on initial webhook creation")
}

func TestIntegrationProvisioning_WebhookSecretRotatedWhenExpired(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	// Mock: health check + webhook creation + webhook get/edit for rotation.
	mockOpts := append(githubHealthCheckMocks(),
		ghmock.WithRequestMatchHandler(
			ghmock.GetReposHooksByOwnerByRepo,
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode([]*github.Hook{})
			}),
		),
		ghmock.WithRequestMatchHandler(
			ghmock.PostReposHooksByOwnerByRepo,
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(&github.Hook{
					ID:     github.Ptr(int64(200)),
					URL:    github.Ptr("https://grafana.example.com/hook"),
					Events: []string{"pull_request", "push"},
				})
			}),
		),
		ghmock.WithRequestMatchHandler(
			ghmock.GetReposHooksByOwnerByRepoByHookId,
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(&github.Hook{
					ID:     github.Ptr(int64(200)),
					URL:    github.Ptr("https://grafana.example.com/hook"),
					Events: []string{"pull_request", "push"},
				})
			}),
		),
		ghmock.WithRequestMatchHandler(
			ghmock.PatchReposHooksByOwnerByRepoByHookId,
			http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(&github.Hook{
					ID:     github.Ptr(int64(200)),
					URL:    github.Ptr("https://grafana.example.com/hook"),
					Events: []string{"pull_request", "push"},
				})
			}),
		),
	)
	helper.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient(mockOpts...)

	// Step 1: Create repo with webhook.
	const repoName = "github-rotation-test"
	helper.CreateGithubRepo(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("rotation-dash", "Rotation Dashboard", 1),
	}, "https://grafana.example.com", "write")

	obj, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{})
	require.NoError(t, err)
	repo := common.MustFromUnstructured[provisioning.Repository](t, obj)
	require.NotNil(t, repo.Status.Webhook)
	originalLastRotated := repo.Status.Webhook.LastRotated
	require.Greater(t, originalLastRotated, int64(0))

	// Step 2: Patch LastRotated to a past value to simulate expired rotation.
	expiredTimestamp := int64(1) // epoch + 1ms — well past any rotation interval
	patch := []byte(fmt.Sprintf(`{"status":{"webhook":{"id":200,"url":"https://grafana.example.com/hook","subscribedEvents":["pull_request","push"],"lastRotated":%d}}}`, expiredTimestamp))
	_, err = helper.Repositories.Resource.Patch(ctx, repoName, types.MergePatchType, patch, metav1.PatchOptions{}, "status")
	require.NoError(t, err)

	// Step 3: Trigger reconciliation.
	// Retry on conflict since the controller may update the resource concurrently.
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		latest, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		updated := latest.DeepCopy()
		updated.Object["spec"].(map[string]any)["title"] = "Rotation Dashboard (updated)"
		_, err = helper.Repositories.Resource.Update(ctx, updated, metav1.UpdateOptions{})
		assert.NoError(collect, err)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "spec update should succeed")

	// Step 4: Wait for rotation — LastRotated should be updated to a recent value.
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		repo := common.MustFromUnstructured[provisioning.Repository](t, obj)
		if !assert.NotNil(collect, repo.Status.Webhook) {
			return
		}
		assert.Greater(collect, repo.Status.Webhook.LastRotated, expiredTimestamp, "LastRotated should be updated after rotation")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "webhook secret should be rotated when expired")
}

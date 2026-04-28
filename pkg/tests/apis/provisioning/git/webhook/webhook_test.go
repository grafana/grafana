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
// branch protection health check (returns 403 — gracefully skipped).
func githubHealthCheckMocks() []ghmock.MockBackendOption {
	return []ghmock.MockBackendOption{
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
	}
}

// webhookCreationMocks returns ghmock handlers for webhook creation.
func webhookCreationMocks(hookID int64) []ghmock.MockBackendOption {
	return []ghmock.MockBackendOption{
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
					ID:     github.Ptr(hookID),
					URL:    github.Ptr("https://grafana.example.com/hook"),
					Events: []string{"pull_request", "push"},
				})
			}),
		),
	}
}

// waitForWebhook polls until Status.Webhook is populated with the expected ID.
func waitForWebhook(t *testing.T, helper *common.GitTestHelper, repoName string, expectedID int64) {
	t.Helper()
	ctx := context.Background()
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{})
		require.NoError(collect, err)
		repo := common.MustFromUnstructured[provisioning.Repository](t, obj)
		require.NotNil(collect, repo.Status.Webhook, "webhook should be set")
		require.NotEmpty(collect, repo.Secure.WebhookSecret.Name, "webhook secret should be created")
		require.Equal(collect, expectedID, repo.Status.Webhook.ID)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "webhook should be created")
}

func TestIntegrationProvisioning_GithubRepoNoWebhookWithoutURL(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	// No webhook URL → no webhook created. Health check mocks not needed since
	// we don't wait for healthy, but the controller will still attempt health check.
	helper.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient(githubHealthCheckMocks()...)

	const repoName = "github-no-webhook"
	helper.CreateGithubRepo(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("gh-dash", "GitHub Dashboard", 1),
	}, "", "write")

	// Give the controller time to reconcile, then check webhook is still nil.
	// We can't wait for "healthy" since the repo won't be healthy (git auth fails).
	// Instead, wait for the controller to have processed it (observedGeneration set).
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		repo := common.MustFromUnstructured[provisioning.Repository](t, obj)
		assert.Equal(collect, repo.Generation, repo.Status.ObservedGeneration, "controller should have processed the repo")
		assert.Nil(collect, repo.Status.Webhook, "no webhook should be created without URL")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "repo should be reconciled without webhook")
}

func TestIntegrationProvisioning_GithubRepoWebhookCreated(t *testing.T) {
	helper := sharedGitHelper(t)

	mockOpts := append(githubHealthCheckMocks(), webhookCreationMocks(456)...)
	helper.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient(mockOpts...)

	const repoName = "github-with-webhook"
	helper.CreateGithubRepo(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("gh-webhook-dash", "GitHub Webhook Dashboard", 1),
	}, "https://grafana.example.com", "write")

	waitForWebhook(t, helper, repoName, 456)
}

func TestIntegrationProvisioning_GithubRepoWebhookRecreatedWhenMissing(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	mockOpts := append(githubHealthCheckMocks(), webhookCreationMocks(789)...)
	helper.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient(mockOpts...)

	const repoName = "github-webhook-restart"
	helper.CreateGithubRepo(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("restart-dash", "Restart Dashboard", 1),
	}, "https://grafana.example.com", "write")

	waitForWebhook(t, helper, repoName, 789)

	// Clear Status.Webhook to simulate restart / state loss. Retry to absorb a
	// concurrent reconcile that rotates secure.webhookSecret between the
	// apistore's optimistic read and the resource server's re-read — the stale
	// secure name makes the server reject this status patch with
	// "secure value not found" even though the patch itself doesn't touch secure.
	patch := []byte(`{"status":{"webhook":null}}`)
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		_, err := helper.Repositories.Resource.Patch(ctx, repoName, types.MergePatchType, patch, metav1.PatchOptions{}, "status")
		assert.NoError(collect, err)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "clear webhook status")

	// Trigger reconciliation by updating the spec.
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

	// Webhook should be re-created by the controller.
	waitForWebhook(t, helper, repoName, 789)
}

func TestIntegrationProvisioning_WebhookLastRotatedSetOnCreation(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	mockOpts := append(githubHealthCheckMocks(), webhookCreationMocks(100)...)
	helper.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient(mockOpts...)

	const repoName = "github-last-rotated"
	helper.CreateGithubRepo(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("rotated-dash", "Rotated Dashboard", 1),
	}, "https://grafana.example.com", "write")

	// Wait for webhook, then check LastRotated.
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		repo := common.MustFromUnstructured[provisioning.Repository](t, obj)
		if !assert.NotNil(collect, repo.Status.Webhook) {
			return
		}
		assert.Greater(collect, repo.Status.Webhook.LastRotated, int64(0), "LastRotated should be set on creation")
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "webhook with LastRotated should be created")
}

func TestIntegrationProvisioning_WebhookSecretRotatedWhenExpired(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	// Mock: health check + webhook creation + webhook get/edit for rotation.
	mockOpts := append(githubHealthCheckMocks(), webhookCreationMocks(200)...)
	mockOpts = append(mockOpts,
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

	const repoName = "github-rotation-test"
	helper.CreateGithubRepo(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("rotation-dash", "Rotation Dashboard", 1),
	}, "https://grafana.example.com", "write")

	waitForWebhook(t, helper, repoName, 200)

	// Patch LastRotated to a past value to simulate expired rotation. Retry to
	// absorb a concurrent reconcile that rotates secure.webhookSecret between
	// the apistore's optimistic read and the resource server's re-read — the
	// stale secure name makes the server reject this status patch with
	// "secure value not found" even though the patch itself doesn't touch secure.
	expiredTimestamp := int64(1)
	patch := []byte(fmt.Sprintf(`{"status":{"webhook":{"id":200,"url":"https://grafana.example.com/hook","subscribedEvents":["pull_request","push"],"lastRotated":%d}}}`, expiredTimestamp))
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		_, err := helper.Repositories.Resource.Patch(ctx, repoName, types.MergePatchType, patch, metav1.PatchOptions{}, "status")
		assert.NoError(collect, err)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "expire LastRotated")

	// Trigger reconciliation.
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

	// Wait for rotation — LastRotated should be updated.
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

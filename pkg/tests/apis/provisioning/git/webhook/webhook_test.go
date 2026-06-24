package webhook

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"testing"

	"github.com/google/go-github/v82/github"
	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
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
			http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				var hook github.Hook
				if err := json.NewDecoder(r.Body).Decode(&hook); err != nil {
					http.Error(w, err.Error(), http.StatusBadRequest)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(&github.Hook{
					ID:     github.Ptr(hookID),
					URL:    hook.GetConfig().URL,
					Config: hook.Config,
					Events: hook.Events,
					Active: hook.Active,
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

func TestIntegrationProvisioning_GithubRepoNoWebhookWhenDisabled(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	// The package enables a public root URL so webhook delivery can be tested;
	// this repo opts out explicitly and should not register a webhook.
	helper.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient(githubHealthCheckMocks()...)

	const repoName = "github-webhook-disabled"
	helper.CreateGithubRepoWithWebhookDisabled(t, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("gh-dash", "GitHub Dashboard", 1),
	}, "write")

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

// TestIntegrationProvisioning_GithubPullRequestWebhookPostsComment verifies the
// end-to-end PR webhook path without a real GitHub PR: a pushed gittest feature
// branch supplies the diff, the webhook payload supplies PR metadata, and the
// mocked GitHub comments endpoint captures the PR worker's generated comment.
func TestIntegrationProvisioning_GithubPullRequestWebhookPostsComment(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	var commentsMu sync.Mutex
	var comments []string
	mockOpts := append(githubHealthCheckMocks(), webhookCreationMocks(654)...)
	mockOpts = append(mockOpts, ghmock.WithRequestMatchHandler(
		ghmock.PostReposIssuesCommentsByOwnerByRepoByIssueNumber,
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var comment github.IssueComment
			if err := json.NewDecoder(r.Body).Decode(&comment); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}

			// Capture the exact PR comment body so the test can verify what the
			// pull request worker would post to GitHub.
			commentsMu.Lock()
			comments = append(comments, comment.GetBody())
			commentsMu.Unlock()

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(&github.IssueComment{
				ID:   github.Ptr(int64(1)),
				Body: github.Ptr(comment.GetBody()),
			})
		}),
	))
	helper.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient(mockOpts...)

	const repoName = "github-pr-comment"
	const dashboardPath = "dashboard.json"
	_, local := helper.CreateGithubRepo(t, repoName, map[string][]byte{
		dashboardPath: common.DashboardJSON("gh-pr-comment-dash", "GitHub PR Comment Dashboard", 1),
	}, "https://grafana.example.com", "write")
	waitForWebhook(t, helper, repoName, 654)
	helper.SyncAndWait(t, repoName)

	const branchName = "feature-pr-comment"
	_, err := local.Git("checkout", "-b", branchName)
	require.NoError(t, err, "failed to create feature branch")
	err = local.UpdateFile(dashboardPath, string(common.DashboardJSON("gh-pr-comment-dash", "GitHub PR Comment Dashboard Updated", 2)))
	require.NoError(t, err, "failed to update dashboard")
	_, err = local.Git("add", dashboardPath)
	require.NoError(t, err, "failed to add dashboard")
	_, err = local.Git("commit", "-m", "Update dashboard")
	require.NoError(t, err, "failed to commit dashboard update")
	headSHA, err := local.Git("rev-parse", "HEAD")
	require.NoError(t, err, "failed to resolve feature branch SHA")
	_, err = local.Git("push", "-u", "origin", branchName)
	require.NoError(t, err, "failed to push feature branch")

	prURL := fmt.Sprintf("https://github.example.com/git/%s/pull/123", repoName)
	payload, err := json.Marshal(map[string]any{
		"action": "opened",
		"repository": map[string]any{
			"full_name": fmt.Sprintf("git/%s", repoName),
		},
		"pull_request": map[string]any{
			"number":   123,
			"html_url": prURL,
			"base": map[string]any{
				"ref": "main",
			},
			"head": map[string]any{
				"ref": branchName,
				"sha": strings.TrimSpace(headSHA),
			},
		},
	})
	require.NoError(t, err, "failed to marshal pull request payload")

	// Sign with the webhook secret Grafana persisted for this repository,
	// because the webhook handler validates against that decrypted value.
	obj, err := helper.Repositories.Resource.Get(ctx, repoName, metav1.GetOptions{})
	require.NoError(t, err, "failed to read repository")
	repo := common.MustFromUnstructured[provisioning.Repository](t, obj)
	secretName := repo.Secure.WebhookSecret.Name
	require.NotEmpty(t, secretName, "webhook secret should be stored")

	decrypted, err := helper.GetEnv().DecryptService.Decrypt(ctx, provisioning.GROUP, repo.Namespace, secretName)
	require.NoError(t, err, "failed to decrypt webhook secret")
	require.Len(t, decrypted, 1)
	result, ok := decrypted[secretName]
	require.True(t, ok, "decrypted webhook secret should be returned")
	require.NoError(t, result.Error(), "webhook secret decrypt result should not contain an error")
	value := result.Value()
	require.NotNil(t, value, "webhook secret value should be present")

	mac := hmac.New(sha256.New, []byte(value.DangerouslyExposeAndConsumeValue()))
	_, _ = mac.Write(payload)
	signature := "sha256=" + hex.EncodeToString(mac.Sum(nil))

	// Post the signed PR event and wait for the queued worker before reading
	// the captured comment.
	code := 0
	webhookResult := helper.AdminREST.Post().
		Namespace(helper.Namespace).
		Resource("repositories").
		Name(repoName).
		SubResource("webhook").
		Body(payload).
		SetHeader("Content-Type", "application/json").
		SetHeader(github.EventTypeHeader, "pull_request").
		SetHeader(github.DeliveryIDHeader, fmt.Sprintf("%s-delivery", repoName)).
		SetHeader(github.SHA256SignatureHeader, signature).
		Do(ctx).
		StatusCode(&code)

	require.NoError(t, webhookResult.Error(), "webhook should accept pull request payload")
	require.Equal(t, http.StatusAccepted, code, "webhook should queue a pull request job")

	jobObj, err := webhookResult.Get()
	require.NoError(t, err, "webhook response should include the queued job")
	job, ok := jobObj.(*unstructured.Unstructured)
	require.True(t, ok, "webhook response should be an unstructured job, got %T", jobObj)
	helper.AwaitJobSuccess(t, ctx, job)

	commentsMu.Lock()
	capturedComments := append([]string(nil), comments...)
	commentsMu.Unlock()
	require.Len(t, capturedComments, 1, "expected one pull request comment")

	comment := capturedComments[0]
	require.Contains(t, comment, "Grafana spotted some changes to your dashboard")
	require.Contains(t, comment, dashboardPath)

	// Verify the dashboard and preview links the PR worker posted are
	// well-formed and carry the context needed by the reviewer UI.
	originalMarker := "[original]("
	originalStart := strings.Index(comment, originalMarker)
	require.NotEqualf(t, -1, originalStart, "comment should contain original link:\n%s", comment)
	originalRemainder := comment[originalStart+len(originalMarker):]
	originalEnd := strings.Index(originalRemainder, ")")
	require.NotEqualf(t, -1, originalEnd, "comment should close original link:\n%s", comment)
	originalURL, err := url.Parse(originalRemainder[:originalEnd])
	require.NoError(t, err, "comment should contain a valid original URL")
	require.Equal(t, "/d/gh-pr-comment-dash/github-pr-comment-dashboard-updated", originalURL.Path)

	previewMarker := "[preview]("
	previewStart := strings.Index(comment, previewMarker)
	require.NotEqualf(t, -1, previewStart, "comment should contain preview link:\n%s", comment)
	previewRemainder := comment[previewStart+len(previewMarker):]
	previewEnd := strings.Index(previewRemainder, ")")
	require.NotEqualf(t, -1, previewEnd, "comment should close preview link:\n%s", comment)
	previewURL, err := url.Parse(previewRemainder[:previewEnd])
	require.NoError(t, err, "comment should contain a valid preview URL")
	require.Equal(t, fmt.Sprintf("/admin/provisioning/%s/dashboard/preview/%s", repoName, dashboardPath), previewURL.Path)
	require.Equal(t, branchName, previewURL.Query().Get("ref"))
	require.Equal(t, url.QueryEscape(prURL), previewURL.Query().Get("pull_request_url"))
	require.Contains(t, previewURL.RawQuery, "pull_request_url="+url.QueryEscape(url.QueryEscape(prURL)))
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

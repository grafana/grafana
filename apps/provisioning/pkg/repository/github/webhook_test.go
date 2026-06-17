package github

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	repo "github.com/grafana/grafana/apps/provisioning/pkg/repository"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

func TestParseWebhooks(t *testing.T) {
	tests := []struct {
		messageType string
		name        string
		expected    provisioning.WebhookResponse
	}{
		{"ping", "check", provisioning.WebhookResponse{
			Code: http.StatusOK,
		}},
		{"pull_request", "opened", provisioning.WebhookResponse{
			Code: http.StatusAccepted, // 202
			Job: &provisioning.JobSpec{
				Repository: "unit-test-repo",
				Action:     provisioning.JobActionPullRequest,
				PullRequest: &provisioning.PullRequestJobOptions{
					Ref:  "dashboard/1733653266690",
					Hash: "ab5446a53df9e5f8bdeed52250f51fad08e822bc",
					PR:   12,
					URL:  "https://github.com/grafana/git-ui-sync-demo/pull/12",
				},
			},
		}},
		{"push", "different_branch", provisioning.WebhookResponse{
			Code: http.StatusOK, // we don't care about a branch that isn't the one we configured
		}},
		{"push", "nothing_relevant", provisioning.WebhookResponse{
			Code: http.StatusAccepted,
			Job: &provisioning.JobSpec{ // we want to always push a sync job
				Repository: "unit-test-repo",
				Action:     provisioning.JobActionPull,
				Pull: &provisioning.SyncJobOptions{
					Incremental: true,
				},
			},
		}},
		{"push", "nested", provisioning.WebhookResponse{
			Code: http.StatusAccepted,
			Job: &provisioning.JobSpec{
				Repository: "unit-test-repo",
				Action:     provisioning.JobActionPull,
				Pull: &provisioning.SyncJobOptions{
					Incremental: true,
				},
			},
		}},
		{"push", "keep_file_only", provisioning.WebhookResponse{
			Code: http.StatusAccepted,
			Job: &provisioning.JobSpec{
				Repository: "unit-test-repo",
				Action:     provisioning.JobActionPull,
				Pull: &provisioning.SyncJobOptions{
					Incremental: false,
				},
			},
		}},
		{"push", "keep_file_with_others", provisioning.WebhookResponse{
			Code: http.StatusAccepted,
			Job: &provisioning.JobSpec{
				Repository: "unit-test-repo",
				Action:     provisioning.JobActionPull,
				Pull: &provisioning.SyncJobOptions{
					Incremental: true,
				},
			},
		}},
		{"push", "multiple_keep_files", provisioning.WebhookResponse{
			Code: http.StatusAccepted,
			Job: &provisioning.JobSpec{
				Repository: "unit-test-repo",
				Action:     provisioning.JobActionPull,
				Pull: &provisioning.SyncJobOptions{
					Incremental: false,
				},
			},
		}},
		{"issue_comment", "created", provisioning.WebhookResponse{
			Code: http.StatusNotImplemented,
		}},
	}

	cfg := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name: "unit-test-repo",
		},
		Spec: provisioning.RepositorySpec{
			Sync: provisioning.SyncOptions{
				Enabled: true, // required to accept sync job
			},
			GitHub: &provisioning.GitHubRepositoryConfig{
				URL:    "https://github.com/grafana/git-ui-sync-demo",
				Branch: "main",

				GenerateDashboardPreviews: true,
			},
		},
	}
	mockRepo := NewMockGithubRepository(t)
	mockRepo.EXPECT().Config().Return(cfg).Maybe()
	gh := &githubWebhookRepository{
		GithubRepository: mockRepo,
		WebhookManager:   repo.NewWebhookManager(nil, cfg, "", subscribedEvents, "", repo.NewIncrementalSyncPolicy(false, 5)),
		owner:            "grafana",
		repo:             "git-ui-sync-demo",
	}

	for _, tt := range tests {
		name := fmt.Sprintf("webhook-%s-%s.json", tt.messageType, tt.name)
		t.Run(name, func(t *testing.T) {
			// nolint:gosec
			payload, err := os.ReadFile(path.Join("testdata", name))
			require.NoError(t, err)

			rsp, err := gh.parseWebhook(context.Background(), tt.messageType, payload)
			require.NoError(t, err)

			require.Equal(t, tt.expected.Code, rsp.Code)
			require.Equal(t, tt.expected.Job, rsp.Job)
		})
	}
}

func TestParsePushEvent_LargeDiffForcesFullSync(t *testing.T) {
	cfg := &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{
			Name: "unit-test-repo",
		},
		Spec: provisioning.RepositorySpec{
			Sync: provisioning.SyncOptions{
				Enabled: true,
			},
			GitHub: &provisioning.GitHubRepositoryConfig{
				URL:    "https://github.com/grafana/git-ui-sync-demo",
				Branch: "main",
			},
		},
	}
	mockRepo := NewMockGithubRepository(t)
	mockRepo.EXPECT().Config().Return(cfg).Maybe()
	gh := &githubWebhookRepository{
		GithubRepository: mockRepo,
		WebhookManager:   repo.NewWebhookManager(nil, cfg, "", subscribedEvents, "", repo.NewIncrementalSyncPolicy(false, 5)),
		owner:            "grafana",
		repo:             "git-ui-sync-demo",
	}

	// nolint:gosec
	payload, err := os.ReadFile(path.Join("testdata", "webhook-push-large_diff.json"))
	require.NoError(t, err)

	rsp, err := gh.parseWebhook(context.Background(), "push", payload)
	require.NoError(t, err)

	require.Equal(t, http.StatusAccepted, rsp.Code)
	require.NotNil(t, rsp.Job)
	require.NotNil(t, rsp.Job.Pull)
	require.False(t, rsp.Job.Pull.Incremental, "large diff should force full sync when above threshold")
}

func TestGitHubRepository_Webhook_ReplayProtection(t *testing.T) {
	pushPayload := `{
		"ref": "refs/heads/main",
		"repository": {
			"full_name": "grafana/grafana"
		}
	}`
	// A byte-different but still valid push payload — produces a different
	// HMAC signature, so it is a distinct (non-replayed) request.
	otherPayload := `{
		"ref": "refs/heads/main",
		"after": "deadbeef",
		"repository": {
			"full_name": "grafana/grafana"
		}
	}`

	const defaultSecret = "webhook-secret"

	// newSignedRequest signs payload with secret and sets the headers GitHub
	// sends. deliveryID populates X-GitHub-Delivery; it is intentionally
	// independent of the signature so tests can vary it freely.
	newSignedRequest := func(payload, deliveryID, secret string) *http.Request {
		req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
		req.Header.Set("X-GitHub-Event", "push")
		req.Header.Set("Content-Type", "application/json")
		if deliveryID != "" {
			req.Header.Set("X-GitHub-Delivery", deliveryID)
		}

		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write([]byte(payload))
		signature := hex.EncodeToString(mac.Sum(nil))
		req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

		return req
	}

	newRepo := func(cache *replayCache, secret string) *githubWebhookRepository {
		cfg := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
			Spec: provisioning.RepositorySpec{
				GitHub: &provisioning.GitHubRepositoryConfig{Branch: "main"},
				Sync:   provisioning.SyncOptions{Enabled: true},
			},
			Status: provisioning.RepositoryStatus{
				Webhook: &provisioning.WebhookStatus{},
			},
		}
		mockRepo := NewMockGithubRepository(t)
		mockRepo.EXPECT().Config().Return(cfg).Maybe()
		return &githubWebhookRepository{
			GithubRepository: mockRepo,
			WebhookManager:   repo.NewWebhookManager(nil, cfg, "", subscribedEvents, common.RawSecureValue(secret), repo.NewIncrementalSyncPolicy(false, 5)),
			owner:            "grafana",
			repo:             "grafana",
			replayCache:      cache,
		}
	}

	t.Run("first delivery is accepted", func(t *testing.T) {
		gh := newRepo(newReplayCache(time.Hour), defaultSecret)

		rsp, err := gh.Webhook(context.Background(), newSignedRequest(pushPayload, "delivery-1", defaultSecret))
		require.NoError(t, err)
		require.Equal(t, http.StatusAccepted, rsp.Code)
	})

	t.Run("replayed request is silently dropped", func(t *testing.T) {
		gh := newRepo(newReplayCache(time.Hour), defaultSecret)

		// First delivery succeeds with the normal accepted-job response.
		first, err := gh.Webhook(context.Background(), newSignedRequest(pushPayload, "delivery-dup", defaultSecret))
		require.NoError(t, err)
		require.Equal(t, http.StatusAccepted, first.Code)

		// Replaying the same signed request returns a generic 200 OK — same
		// shape as other no-op paths so an attacker can't tell from the
		// response whether the payload was previously processed.
		dup, err := gh.Webhook(context.Background(), newSignedRequest(pushPayload, "delivery-dup", defaultSecret))
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, dup.Code)
		require.Equal(t, "ok", dup.Message)
		require.Nil(t, dup.Job, "replay must not enqueue a job")
	})

	t.Run("replay with a fresh delivery id is still dropped", func(t *testing.T) {
		// Regression: the X-GitHub-Delivery header is not covered by the HMAC,
		// so an attacker can replay a captured (body, signature) under a new
		// delivery ID. Keying on the signature must still catch it.
		gh := newRepo(newReplayCache(time.Hour), defaultSecret)

		_, err := gh.Webhook(context.Background(), newSignedRequest(pushPayload, "delivery-A", defaultSecret))
		require.NoError(t, err)

		dup, err := gh.Webhook(context.Background(), newSignedRequest(pushPayload, "delivery-B", defaultSecret))
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, dup.Code, "same signed body under a different delivery id is still a replay")
		require.Nil(t, dup.Job)
	})

	t.Run("distinct payloads are independent", func(t *testing.T) {
		gh := newRepo(newReplayCache(time.Hour), defaultSecret)

		_, err := gh.Webhook(context.Background(), newSignedRequest(pushPayload, "delivery-A", defaultSecret))
		require.NoError(t, err)

		// A different body yields a different signature, so it is processed.
		rsp, err := gh.Webhook(context.Background(), newSignedRequest(otherPayload, "delivery-B", defaultSecret))
		require.NoError(t, err)
		require.Equal(t, http.StatusAccepted, rsp.Code)
	})

	t.Run("identical body under different secrets does not collide", func(t *testing.T) {
		// The shared cache is consulted by every repository. Two repos with
		// distinct webhook secrets produce distinct signatures for the same
		// body, so one repo's delivery must not shadow another's.
		cache := newReplayCache(time.Hour)
		repoA := newRepo(cache, "secret-a")
		repoB := newRepo(cache, "secret-b")

		_, err := repoA.Webhook(context.Background(), newSignedRequest(pushPayload, "delivery-A", "secret-a"))
		require.NoError(t, err)

		rsp, err := repoB.Webhook(context.Background(), newSignedRequest(pushPayload, "delivery-B", "secret-b"))
		require.NoError(t, err)
		require.Equal(t, http.StatusAccepted, rsp.Code)
	})

	t.Run("repositories sharing a cache silently drop cross-instance replays", func(t *testing.T) {
		// Mirrors production: extras.Build rebuilds a repository per request
		// but threads the factory's single cache through each instance.
		cache := newReplayCache(time.Hour)
		first := newRepo(cache, defaultSecret)
		second := newRepo(cache, defaultSecret)

		_, err := first.Webhook(context.Background(), newSignedRequest(pushPayload, "delivery-1", defaultSecret))
		require.NoError(t, err)

		dup, err := second.Webhook(context.Background(), newSignedRequest(pushPayload, "delivery-2", defaultSecret))
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, dup.Code)
		require.Equal(t, "ok", dup.Message)
		require.Nil(t, dup.Job)
	})

	t.Run("expired entry is accepted again", func(t *testing.T) {
		const ttl = 50 * time.Millisecond
		gh := newRepo(newReplayCache(ttl), defaultSecret)

		_, err := gh.Webhook(context.Background(), newSignedRequest(pushPayload, "delivery-X", defaultSecret))
		require.NoError(t, err)

		// Once the entry expires, the same signed request is processed again.
		time.Sleep(ttl + 20*time.Millisecond)
		rsp, err := gh.Webhook(context.Background(), newSignedRequest(pushPayload, "delivery-X", defaultSecret))
		require.NoError(t, err)
		require.Equal(t, http.StatusAccepted, rsp.Code)
	})

	t.Run("invalid signature is rejected before the replay check", func(t *testing.T) {
		gh := newRepo(newReplayCache(time.Hour), defaultSecret)

		req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(pushPayload))
		req.Header.Set("X-GitHub-Event", "push")
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-GitHub-Delivery", "delivery-bad-sig")
		req.Header.Set("X-Hub-Signature-256", "sha256=deadbeef")

		_, err := gh.Webhook(context.Background(), req)
		require.Error(t, err)

		// A subsequent valid request must still succeed — a failed signature
		// must not poison the replay cache.
		rsp, err := gh.Webhook(context.Background(), newSignedRequest(pushPayload, "delivery-good", defaultSecret))
		require.NoError(t, err)
		require.Equal(t, http.StatusAccepted, rsp.Code)
	})
}

func TestGitHubRepository_Webhook(t *testing.T) {
	tests := []struct {
		name          string
		config        *provisioning.Repository
		setupRequest  func() *http.Request
		expected      *provisioning.WebhookResponse
		expectedError error
	}{
		{
			name: "missing webhook configuration",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					// No webhook configuration
				},
			},
			setupRequest: func() *http.Request {
				req, _ := http.NewRequest("POST", "/webhook", nil)
				return req
			},
			expectedError: fmt.Errorf("unexpected webhook request"),
		},
		{
			name: "invalid signature",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{},
				},
			},
			setupRequest: func() *http.Request {
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader("invalid payload"))
				req.Header.Set("X-Hub-Signature-256", "invalid")
				req.Header.Set("Content-Type", "application/json")
				return req
			},
			expectedError: apierrors.NewUnauthorized("invalid signature"),
		},
		{
			name: "ping event",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{},
				},
			},
			setupRequest: func() *http.Request {
				payload := `{}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "ping")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			expected: &provisioning.WebhookResponse{
				Code:    http.StatusOK,
				Message: "ping received",
			},
		},
		{
			name: "push event for different branch",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
					Sync: provisioning.SyncOptions{
						Enabled: true,
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{},
				},
			},
			setupRequest: func() *http.Request {
				payload := `{
					"ref": "refs/heads/feature",
					"repository": {
						"full_name": "grafana/grafana"
					}
				}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "push")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			expected: &provisioning.WebhookResponse{
				Code: http.StatusOK,
			},
		},
		{
			name: "push event for main branch",
			config: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
					Sync: provisioning.SyncOptions{
						Enabled: true,
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{},
				},
			},
			setupRequest: func() *http.Request {
				payload := `{
					"ref": "refs/heads/main",
					"repository": {
						"full_name": "grafana/grafana"
					}
				}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "push")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			expected: &provisioning.WebhookResponse{
				Code: http.StatusAccepted,
				Job: &provisioning.JobSpec{
					Repository: "test-repo",
					Action:     provisioning.JobActionPull,
					Pull: &provisioning.SyncJobOptions{
						Incremental: true,
					},
				},
			},
		},
		{
			name: "push event with missing repository",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{},
				},
			},
			setupRequest: func() *http.Request {
				payload := `{
					"ref": "refs/heads/main"
				}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "push")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			expectedError: fmt.Errorf("missing repository in push event"),
		},
		{
			name: "push event with repository mismatch",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{},
				},
			},
			setupRequest: func() *http.Request {
				payload := `{
					"ref": "refs/heads/main",
					"repository": {
						"full_name": "different-owner/different-repo"
					}
				}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "push")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			expectedError: repo.ErrRepositoryMismatch,
		},
		{
			name: "push event when sync is disabled",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
					Sync: provisioning.SyncOptions{
						Enabled: false,
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{},
				},
			},
			setupRequest: func() *http.Request {
				payload := `{
					"ref": "refs/heads/main",
					"repository": {
						"full_name": "grafana/grafana"
					}
				}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "push")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			expected: &provisioning.WebhookResponse{
				Code: http.StatusOK,
			},
		},
		{
			name: "pull request event - opened",
			config: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{},
				},
			},
			setupRequest: func() *http.Request {
				payload := `{
					"action": "opened",
					"pull_request": {
						"html_url": "https://github.com/grafana/grafana/pull/123",
						"number": 123,
						"head": {
							"ref": "feature-branch",
							"sha": "abcdef1234567890"
						},
						"base": {
							"ref": "main"
						}
					},
					"repository": {
						"full_name": "grafana/grafana"
					}
				}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "pull_request")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			expected: &provisioning.WebhookResponse{
				Code:    http.StatusAccepted,
				Message: "pull request: opened",
				Job: &provisioning.JobSpec{
					Repository: "test-repo",
					Action:     provisioning.JobActionPullRequest,
					PullRequest: &provisioning.PullRequestJobOptions{
						URL:  "https://github.com/grafana/grafana/pull/123",
						PR:   123,
						Ref:  "feature-branch",
						Hash: "abcdef1234567890",
					},
				},
			},
		},
		{
			name: "pull request event - synchronize",
			config: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{},
				},
			},
			setupRequest: func() *http.Request {
				payload := `{
					"action": "synchronize",
					"pull_request": {
						"html_url": "https://github.com/grafana/grafana/pull/123",
						"number": 123,
						"head": {
							"ref": "feature-branch",
							"sha": "abcdef1234567890"
						},
						"base": {
							"ref": "main"
						}
					},
					"repository": {
						"full_name": "grafana/grafana"
					}
				}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "pull_request")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			expected: &provisioning.WebhookResponse{
				Code:    http.StatusAccepted,
				Message: "pull request: synchronize",
				Job: &provisioning.JobSpec{
					Repository: "test-repo",
					Action:     provisioning.JobActionPullRequest,
					PullRequest: &provisioning.PullRequestJobOptions{
						URL:  "https://github.com/grafana/grafana/pull/123",
						PR:   123,
						Ref:  "feature-branch",
						Hash: "abcdef1234567890",
					},
				},
			},
		},
		{
			name: "pull request event - wrong base branch",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{},
				},
			},
			setupRequest: func() *http.Request {
				payload := `{
					"action": "opened",
					"pull_request": {
						"html_url": "https://github.com/grafana/grafana/pull/123",
						"number": 123,
						"head": {
							"ref": "feature-branch",
							"sha": "abcdef1234567890"
						},
						"base": {
							"ref": "develop"
						}
					},
					"repository": {
						"full_name": "grafana/grafana"
					}
				}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "pull_request")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			expected: &provisioning.WebhookResponse{
				Code:    http.StatusOK,
				Message: "ignoring pull request event as develop is not  the configured branch",
			},
		},
		{
			name: "pull request event - ignored action",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{},
				},
			},
			setupRequest: func() *http.Request {
				payload := `{
					"action": "closed",
					"pull_request": {
						"html_url": "https://github.com/grafana/grafana/pull/123",
						"number": 123,
						"head": {
							"ref": "feature-branch",
							"sha": "abcdef1234567890"
						},
						"base": {
							"ref": "main"
						}
					},
					"repository": {
						"full_name": "grafana/grafana"
					}
				}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "pull_request")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			expected: &provisioning.WebhookResponse{
				Code:    http.StatusOK,
				Message: "ignore pull request event: closed",
			},
		},
		{
			name: "pull request event missing repository",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{},
				},
			},
			setupRequest: func() *http.Request {
				payload := `{
					"action": "opened",
					"pull_request": {
						"html_url": "https://github.com/grafana/grafana/pull/123",
						"number": 123,
						"head": {
							"ref": "feature-branch",
							"sha": "abcdef1234567890"
						},
						"base": {
							"ref": "main"
						}
					}
				}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "pull_request")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			expectedError: fmt.Errorf("missing repository in pull request event"),
		},
		{
			name: "pull request event with missing GitHub config",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					// GitHub config is intentionally missing
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{},
				},
			},
			setupRequest: func() *http.Request {
				payload := `{
					"action": "opened",
					"pull_request": {
						"html_url": "https://github.com/grafana/grafana/pull/123",
						"number": 123,
						"head": {
							"ref": "feature-branch",
							"sha": "abcdef1234567890"
						},
						"base": {
							"ref": "main"
						}
					},
					"repository": {
						"full_name": "grafana/grafana"
					}
				}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "pull_request")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			expectedError: fmt.Errorf("missing GitHub config"),
		},
		{
			name: "pull request event with repository mismatch",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{},
				},
			},
			setupRequest: func() *http.Request {
				payload := `{
					"action": "opened",
					"pull_request": {
						"html_url": "https://github.com/different-owner/different-repo/pull/123",
						"number": 123,
						"head": {
							"ref": "feature-branch",
							"sha": "abcdef1234567890"
						},
						"base": {
							"ref": "main"
						}
					},
					"repository": {
						"full_name": "different-owner/different-repo"
					}
				}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "pull_request")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			expectedError: repo.ErrRepositoryMismatch,
		},
		{
			name: "pull request event missing pull request info",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{},
				},
			},
			setupRequest: func() *http.Request {
				payload := `{
					"action": "opened",
					"repository": {
						"full_name": "grafana/grafana"
					}
				}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "pull_request")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			expectedError: fmt.Errorf("expected PR in event"),
		},
		{
			name: "ping event with new secrets store",
			config: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{},
				},
			},
			setupRequest: func() *http.Request {
				payload := `{}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "ping")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			expected: &provisioning.WebhookResponse{
				Code:    http.StatusOK,
				Message: "ping received",
			},
		},
		{
			name: "push event for main branch with new secrets store",
			config: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
					Sync: provisioning.SyncOptions{
						Enabled: true,
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{},
				},
			},
			setupRequest: func() *http.Request {
				payload := `{
					"ref": "refs/heads/main",
					"repository": {
						"full_name": "grafana/grafana"
					}
				}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "push")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			expected: &provisioning.WebhookResponse{
				Code: http.StatusAccepted,
				Job: &provisioning.JobSpec{
					Repository: "test-repo",
					Action:     provisioning.JobActionPull,
					Pull: &provisioning.SyncJobOptions{
						Incremental: true,
					},
				},
			},
		},
		{
			name: "unsupported event type",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{},
				},
			},
			setupRequest: func() *http.Request {
				payload := `{}`
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
				req.Header.Set("X-GitHub-Event", "team")
				req.Header.Set("Content-Type", "application/json")

				// Create a valid signature
				mac := hmac.New(sha256.New, []byte("webhook-secret"))
				mac.Write([]byte(payload))
				signature := hex.EncodeToString(mac.Sum(nil))
				req.Header.Set("X-Hub-Signature-256", "sha256="+signature)

				return req
			},
			expected: &provisioning.WebhookResponse{
				Code:    http.StatusNotImplemented,
				Message: "unsupported messageType: team",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a GitHub repository with the test config. A fresh cache
			// per subtest keeps replay state from leaking across cases.
			mockRepo := NewMockGithubRepository(t)
			mockRepo.EXPECT().Config().Return(tt.config).Maybe()
			manager := repo.NewWebhookManager(nil, tt.config, "", subscribedEvents, common.RawSecureValue("webhook-secret"), repo.NewIncrementalSyncPolicy(false, 5))
			repo := &githubWebhookRepository{
				GithubRepository: mockRepo,
				WebhookManager:   manager,
				owner:            "grafana",
				repo:             "grafana",
				replayCache:      newReplayCache(time.Hour),
			}

			// Call the Webhook method
			response, err := repo.Webhook(context.Background(), tt.setupRequest())

			// Check the error
			if tt.expectedError != nil {
				require.Error(t, err)
				var statusErr *apierrors.StatusError
				if errors.As(tt.expectedError, &statusErr) {
					var actualStatusErr *apierrors.StatusError
					require.True(t, errors.As(err, &actualStatusErr), "Expected StatusError but got different error type: %T", err)
					require.Equal(t, statusErr.Status().Message, actualStatusErr.Status().Message)
					require.Equal(t, statusErr.Status().Code, actualStatusErr.Status().Code)
				} else {
					require.Equal(t, tt.expectedError.Error(), err.Error())
				}
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.expected.Code, response.Code)
				require.Equal(t, tt.expected.Message, response.Message)

				if tt.expected.Job != nil {
					require.NotNil(t, response.Job)
					require.Equal(t, tt.expected.Job.Action, response.Job.Action)
					if tt.expected.Job.Pull != nil {
						require.Equal(t, tt.expected.Job.Pull.Incremental, response.Job.Pull.Incremental)
					}
					if tt.expected.Job.PullRequest != nil {
						require.Equal(t, tt.expected.Job.PullRequest.URL, response.Job.PullRequest.URL)
						require.Equal(t, tt.expected.Job.PullRequest.PR, response.Job.PullRequest.PR)
						require.Equal(t, tt.expected.Job.PullRequest.Ref, response.Job.PullRequest.Ref)
						require.Equal(t, tt.expected.Job.PullRequest.Hash, response.Job.PullRequest.Hash)
					}
				} else {
					require.Nil(t, response.Job)
				}
			}
		})
	}
}

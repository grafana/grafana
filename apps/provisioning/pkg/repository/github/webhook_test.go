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
	"slices"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
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
		{"issue_comment", "created", provisioning.WebhookResponse{
			Code: http.StatusNotImplemented,
		}},
	}

	gh := &githubWebhookRepository{
		config: &provisioning.Repository{
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
		},
		owner: "grafana",
		repo:  "git-ui-sync-demo",
	}

	for _, tt := range tests {
		name := fmt.Sprintf("webhook-%s-%s.json", tt.messageType, tt.name)
		t.Run(name, func(t *testing.T) {
			// nolint:gosec
			payload, err := os.ReadFile(path.Join("testdata", name))
			require.NoError(t, err)

			rsp, err := gh.parseWebhook(tt.messageType, payload)
			require.NoError(t, err)

			require.Equal(t, tt.expected.Code, rsp.Code)
			require.Equal(t, tt.expected.Job, rsp.Job)
		})
	}
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
			expectedError: fmt.Errorf("repository mismatch"),
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
			expectedError: fmt.Errorf("repository mismatch"),
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
			// Create a GitHub repository with the test config
			repo := &githubWebhookRepository{
				config: tt.config,
				owner:  "grafana",
				repo:   "grafana",
				secret: common.RawSecureValue("webhook-secret"),
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

func TestGitHubRepository_CommentPullRequest(t *testing.T) {
	tests := []struct {
		name          string
		setupMock     func(m *MockClient)
		prNumber      int
		comment       string
		expectedError error
	}{
		{
			name: "successfully comment on pull request",
			setupMock: func(m *MockClient) {
				m.On("CreatePullRequestComment", mock.Anything, "grafana", "grafana", 123, "Test comment").
					Return(nil)
			},
			prNumber:      123,
			comment:       "Test comment",
			expectedError: nil,
		},
		{
			name: "error commenting on pull request",
			setupMock: func(m *MockClient) {
				m.On("CreatePullRequestComment", mock.Anything, "grafana", "grafana", 456, "Error comment").
					Return(fmt.Errorf("failed to create comment"))
			},
			prNumber:      456,
			comment:       "Error comment",
			expectedError: fmt.Errorf("failed to create comment"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup mock GitHub client
			mockGH := NewMockClient(t)
			tt.setupMock(mockGH)

			// Create repository with mock
			repo := &githubWebhookRepository{
				gh: mockGH,
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						GitHub: &provisioning.GitHubRepositoryConfig{
							Branch: "main",
						},
					},
				},
				owner: "grafana",
				repo:  "grafana",
			}

			// Call the CommentPullRequest method
			err := repo.CommentPullRequest(context.Background(), tt.prNumber, tt.comment)

			// Check results
			if tt.expectedError != nil {
				require.Error(t, err)
				require.Equal(t, tt.expectedError.Error(), err.Error())
			} else {
				require.NoError(t, err)
			}

			// Verify all mock expectations were met
			mockGH.AssertExpectations(t)
		})
	}
}

func TestGitHubRepository_OnCreate(t *testing.T) {
	tests := []struct {
		name          string
		setupMock     func(m *MockClient)
		config        *provisioning.Repository
		webhookURL    string
		expectedHook  *provisioning.WebhookStatus
		expectedError error
	}{
		{
			name: "successfully create webhook",
			setupMock: func(m *MockClient) {
				m.On("CreateWebhook", mock.Anything, "grafana", "grafana", mock.MatchedBy(func(cfg WebhookConfig) bool {
					return cfg.URL == "https://example.com/webhook" &&
						cfg.ContentType == "json" &&
						cfg.Active == true
				})).Return(WebhookConfig{
					ID:     123,
					URL:    "https://example.com/webhook",
					Secret: "test-secret",
				}, nil)
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
			},
			webhookURL: "https://example.com/webhook",
			expectedHook: &provisioning.WebhookStatus{
				ID:  123,
				URL: "https://example.com/webhook",
			},
			expectedError: nil,
		},
		{
			name: "no webhook URL",
			setupMock: func(m *MockClient) {
				// No webhook creation expected
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
			},
			webhookURL:    "",
			expectedHook:  nil,
			expectedError: nil,
		},
		{
			name: "error creating webhook",
			setupMock: func(m *MockClient) {
				m.On("CreateWebhook", mock.Anything, "grafana", "grafana", mock.Anything).
					Return(WebhookConfig{}, fmt.Errorf("failed to create webhook"))
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
			},
			webhookURL:    "https://example.com/webhook",
			expectedHook:  nil,
			expectedError: fmt.Errorf("failed to create webhook"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup mock GitHub client
			mockGH := NewMockClient(t)
			tt.setupMock(mockGH)

			// Create repository with mock
			repo := &githubWebhookRepository{
				gh:         mockGH,
				config:     tt.config,
				owner:      "grafana",
				repo:       "grafana",
				webhookURL: tt.webhookURL,
			}

			// Call the OnCreate method
			hookOps, err := repo.OnCreate(context.Background())

			// Check results
			if tt.expectedError != nil {
				require.Error(t, err)
				require.Equal(t, tt.expectedError.Error(), err.Error())
				require.Nil(t, hookOps)
			} else {
				require.NoError(t, err)
				if tt.expectedHook != nil {
					require.NotNil(t, hookOps)
					require.Len(t, hookOps, 2)
					require.Equal(t, "replace", hookOps[0]["op"])
					require.Equal(t, "/status/webhook", hookOps[0]["path"])
					require.Equal(t, tt.expectedHook.ID, hookOps[0]["value"].(*provisioning.WebhookStatus).ID)
					require.Equal(t, tt.expectedHook.URL, hookOps[0]["value"].(*provisioning.WebhookStatus).URL)

					require.Equal(t, "replace", hookOps[1]["op"])
					require.Equal(t, "/secure/webhookSecret", hookOps[1]["path"])
					vals, ok := hookOps[1]["value"].(map[string]string)
					require.True(t, ok, "expected webhookSecret as map")
					require.Len(t, vals, 1, "with one property")
					require.NotEmpty(t, vals["create"], "secret should be created")

					_, err := uuid.Parse(vals["create"])
					require.NoError(t, err, "the secret is a valid UUID")
				} else {
					require.Nil(t, hookOps)
				}
			}

			// Verify all mock expectations were met
			mockGH.AssertExpectations(t)
		})
	}
}

func TestGitHubRepository_OnUpdate(t *testing.T) {
	tests := []struct {
		name          string
		setupMock     func(m *MockClient)
		config        *provisioning.Repository
		webhookURL    string
		expectedHook  *provisioning.WebhookStatus
		expectedError error
	}{
		{
			name: "successfully update webhook when webhook exists",
			setupMock: func(m *MockClient) {
				// Mock getting the existing webhook
				m.On("GetWebhook", mock.Anything, "grafana", "grafana", int64(123)).
					Return(WebhookConfig{
						ID:     123,
						URL:    "https://example.com/webhook",
						Events: []string{"push"},
					}, nil)

				// Mock editing the webhook
				m.On("EditWebhook", mock.Anything, "grafana", "grafana", mock.MatchedBy(func(hook WebhookConfig) bool {
					return hook.ID == 123 && hook.URL == "https://example.com/webhook-updated" &&
						slices.Equal(hook.Events, subscribedEvents)
				})).Return(nil)
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						ID:  123,
						URL: "https://example.com/webhook",
					},
				},
			},
			webhookURL: "https://example.com/webhook-updated",
			expectedHook: &provisioning.WebhookStatus{
				ID:               123,
				URL:              "https://example.com/webhook-updated",
				SubscribedEvents: subscribedEvents,
			},
			expectedError: nil,
		},
		{
			name: "create webhook when it doesn't exist",
			setupMock: func(m *MockClient) {
				// Mock webhook not found
				m.On("GetWebhook", mock.Anything, "grafana", "grafana", int64(123)).
					Return(WebhookConfig{}, ErrResourceNotFound)

				// Mock creating a new webhook
				m.On("CreateWebhook", mock.Anything, "grafana", "grafana", mock.MatchedBy(func(hook WebhookConfig) bool {
					return hook.URL == "https://example.com/webhook" &&
						hook.ContentType == "json" &&
						slices.Equal(hook.Events, subscribedEvents) &&
						hook.Active == true
				})).Return(WebhookConfig{
					ID:     456,
					URL:    "https://example.com/webhook",
					Events: subscribedEvents,
				}, nil)
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						ID:  123,
						URL: "https://example.com/old-webhook",
					},
				},
			},
			webhookURL: "https://example.com/webhook",
			expectedHook: &provisioning.WebhookStatus{
				ID:               456,
				URL:              "https://example.com/webhook",
				SubscribedEvents: subscribedEvents,
			},
			expectedError: nil,
		},
		{
			name: "no webhook URL provided",
			setupMock: func(m *MockClient) {
				// No mocks needed
			},
			config:        &provisioning.Repository{},
			webhookURL:    "",
			expectedHook:  nil,
			expectedError: nil,
		},
		{
			name: "error getting webhook",
			setupMock: func(m *MockClient) {
				m.On("GetWebhook", mock.Anything, "grafana", "grafana", int64(123)).
					Return(WebhookConfig{}, fmt.Errorf("failed to get webhook"))
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						ID:  123,
						URL: "https://example.com/webhook",
					},
				},
			},
			webhookURL:    "https://example.com/webhook",
			expectedHook:  nil,
			expectedError: fmt.Errorf("get webhook: failed to get webhook"),
		},
		{
			name: "error editing webhook",
			setupMock: func(m *MockClient) {
				// Mock getting the existing webhook
				m.On("GetWebhook", mock.Anything, "grafana", "grafana", int64(123)).
					Return(WebhookConfig{
						ID:     123,
						URL:    "https://example.com/webhook",
						Events: []string{"push"},
					}, nil)

				// Mock editing the webhook with error
				m.On("EditWebhook", mock.Anything, "grafana", "grafana", mock.Anything).
					Return(fmt.Errorf("failed to edit webhook"))
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						ID:  123,
						URL: "https://example.com/webhook",
					},
				},
			},
			webhookURL:    "https://example.com/webhook-updated",
			expectedHook:  nil,
			expectedError: fmt.Errorf("edit webhook: failed to edit webhook"),
		},
		{
			name: "create webhook when webhook status is nil",
			setupMock: func(m *MockClient) {
				// Mock creating a new webhook
				m.On("CreateWebhook", mock.Anything, "grafana", "grafana", mock.Anything).
					Return(WebhookConfig{
						ID:          456,
						URL:         "https://example.com/webhook",
						Events:      subscribedEvents,
						Active:      true,
						ContentType: "json",
					}, nil)
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: nil, // Webhook status is nil
				},
			},
			webhookURL: "https://example.com/webhook",
			expectedHook: &provisioning.WebhookStatus{
				ID:               456,
				URL:              "https://example.com/webhook",
				SubscribedEvents: subscribedEvents,
			},
			expectedError: nil,
		},
		{
			name: "create webhook when webhook ID is zero",
			setupMock: func(m *MockClient) {
				// Mock creating a new webhook
				m.On("CreateWebhook", mock.Anything, "grafana", "grafana", mock.Anything).
					Return(WebhookConfig{
						ID:          789,
						URL:         "https://example.com/webhook",
						Events:      subscribedEvents,
						Active:      true,
						ContentType: "json",
					}, nil)
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						ID:  0, // Webhook ID is zero
						URL: "https://example.com/webhook",
					},
				},
			},
			webhookURL: "https://example.com/webhook",
			expectedHook: &provisioning.WebhookStatus{
				ID:               789,
				URL:              "https://example.com/webhook",
				SubscribedEvents: subscribedEvents,
			},
			expectedError: nil,
		},
		{
			name: "error when creating webhook fails",
			setupMock: func(m *MockClient) {
				// Mock webhook creation failure
				m.On("CreateWebhook", mock.Anything, "grafana", "grafana", mock.Anything).
					Return(WebhookConfig{}, fmt.Errorf("failed to create webhook"))
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: nil, // Webhook status is nil
				},
			},
			webhookURL:    "https://example.com/webhook",
			expectedHook:  nil,
			expectedError: fmt.Errorf("failed to create webhook"),
		},
		{
			name: "creates webhook when ErrResourceNotFound",
			setupMock: func(m *MockClient) {
				// Mock webhook not found
				m.On("GetWebhook", mock.Anything, "grafana", "grafana", int64(123)).
					Return(WebhookConfig{}, ErrResourceNotFound)

				// Mock creating a new webhook
				m.On("CreateWebhook", mock.Anything, "grafana", "grafana", mock.MatchedBy(func(hook WebhookConfig) bool {
					return hook.URL == "https://example.com/webhook" &&
						hook.ContentType == "json" &&
						slices.Equal(hook.Events, subscribedEvents) &&
						hook.Active == true
				})).Return(WebhookConfig{
					ID:     456,
					URL:    "https://example.com/webhook",
					Events: subscribedEvents,
				}, nil)
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						ID:  123,
						URL: "https://example.com/old-webhook",
					},
				},
			},
			webhookURL: "https://example.com/webhook",
			expectedHook: &provisioning.WebhookStatus{
				ID:               456,
				URL:              "https://example.com/webhook",
				SubscribedEvents: subscribedEvents,
			},
			expectedError: nil,
		},
		{
			name: "error on create when not found",
			setupMock: func(m *MockClient) {
				// Mock webhook not found
				m.On("GetWebhook", mock.Anything, "grafana", "grafana", int64(123)).
					Return(WebhookConfig{}, ErrResourceNotFound)

				// Mock error when creating a new webhook
				m.On("CreateWebhook", mock.Anything, "grafana", "grafana", mock.MatchedBy(func(hook WebhookConfig) bool {
					return hook.URL == "https://example.com/webhook" &&
						hook.ContentType == "json" &&
						slices.Equal(hook.Events, subscribedEvents) &&
						hook.Active == true
				})).Return(WebhookConfig{}, fmt.Errorf("failed to create webhook"))
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						ID:  123,
						URL: "https://example.com/old-webhook",
					},
				},
			},
			webhookURL:    "https://example.com/webhook",
			expectedHook:  nil,
			expectedError: fmt.Errorf("failed to create webhook"),
		},
		{
			name: "no update needed when URL and events match",
			setupMock: func(m *MockClient) {
				// Mock getting the existing webhook with matching URL and events
				m.On("GetWebhook", mock.Anything, "grafana", "grafana", int64(123)).
					Return(WebhookConfig{
						ID:     123,
						URL:    "https://example.com/webhook",
						Events: subscribedEvents,
					}, nil)
				// No EditWebhook call expected since no changes needed
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						ID:  123,
						URL: "https://example.com/webhook",
					},
				},
				Secure: provisioning.SecureValues{
					WebhookSecret: common.InlineSecureValue{
						Name: "valid-secret",
					},
				},
			},
			webhookURL:    "https://example.com/webhook",
			expectedHook:  nil, // nothing changed
			expectedError: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup mock GitHub client
			mockGH := NewMockClient(t)
			tt.setupMock(mockGH)

			// Create repository with mock
			repo := &githubWebhookRepository{
				gh:         mockGH,
				config:     tt.config,
				owner:      "grafana",
				repo:       "grafana",
				webhookURL: tt.webhookURL,
			}

			// Call the OnUpdate method
			hookOps, err := repo.OnUpdate(context.Background())

			// Check results
			if tt.expectedError != nil {
				require.Error(t, err)
				require.Equal(t, tt.expectedError.Error(), err.Error())
				require.Nil(t, hookOps)
			} else {
				require.NoError(t, err)
				if tt.expectedHook != nil {
					require.NotNil(t, hookOps)
					require.Len(t, hookOps, 2)
					require.Equal(t, "replace", hookOps[0]["op"])
					require.Equal(t, "/status/webhook", hookOps[0]["path"])
					require.Equal(t, tt.expectedHook.ID, hookOps[0]["value"].(*provisioning.WebhookStatus).ID)
					require.Equal(t, tt.expectedHook.URL, hookOps[0]["value"].(*provisioning.WebhookStatus).URL)
					require.ElementsMatch(t, tt.expectedHook.SubscribedEvents, hookOps[0]["value"].(*provisioning.WebhookStatus).SubscribedEvents)

					require.Equal(t, "replace", hookOps[1]["op"])
					require.Equal(t, "/secure/webhookSecret", hookOps[1]["path"])
					vals, ok := hookOps[1]["value"].(map[string]string)
					require.True(t, ok, "expected webhookSecret as map")
					require.Len(t, vals, 1, "with one property")
					require.NotEmpty(t, vals["create"], "secret should be created")

					_, err := uuid.Parse(vals["create"])
					require.NoError(t, err, "the secret is a valid UUID")
				} else {
					require.Nil(t, hookOps)
				}
			}

			// Verify all mock expectations were met
			mockGH.AssertExpectations(t)
		})
	}
}

func TestGitHubRepository_OnDelete(t *testing.T) {
	tests := []struct {
		name          string
		setupMock     func(m *MockClient)
		config        *provisioning.Repository
		webhookURL    string
		expectedError error
	}{
		{
			name: "successfully delete webhook",
			setupMock: func(m *MockClient) {
				m.On("DeleteWebhook", mock.Anything, "grafana", "grafana", int64(123)).
					Return(nil)
			},
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
					Webhook: &provisioning.WebhookStatus{
						ID:  123,
						URL: "https://example.com/webhook",
					},
				},
			},
			webhookURL:    "https://example.com/webhook",
			expectedError: nil,
		},
		{
			name:      "no webhook URL provided",
			setupMock: func(_ *MockClient) {},
			config: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
			},
			webhookURL:    "",
			expectedError: nil,
		},
		{
			name: "webhook not found in status",
			setupMock: func(_ *MockClient) {
				// No secrets deletion or webhook deletion mocks needed - method returns early when webhook is nil
			},
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
					Webhook: nil, // Webhook status is nil
				},
			},
			webhookURL:    "https://example.com/webhook",
			expectedError: nil, // No error expected - method returns early when webhook is nil
		},
		{
			name: "error deleting webhook",
			setupMock: func(m *MockClient) {
				// Mock webhook deletion failure
				m.On("DeleteWebhook", mock.Anything, "grafana", "grafana", int64(123)).
					Return(fmt.Errorf("failed to delete webhook"))
			},
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
					Webhook: &provisioning.WebhookStatus{
						ID:  123,
						URL: "https://example.com/webhook",
					},
				},
			},
			webhookURL:    "https://example.com/webhook",
			expectedError: fmt.Errorf("delete webhook: failed to delete webhook"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup mock GitHub client
			mockGH := NewMockClient(t)
			mockRepo := NewMockGithubRepository(t)
			tt.setupMock(mockGH)

			// Create repository with mock
			repo := &githubWebhookRepository{
				GithubRepository: mockRepo,
				gh:               mockGH,
				config:           tt.config,
				owner:            "grafana",
				repo:             "grafana",
				webhookURL:       tt.webhookURL,
			}

			// Call the OnDelete method
			err := repo.OnDelete(context.Background())

			// Check results
			if tt.expectedError != nil {
				require.Error(t, err)
				require.Equal(t, tt.expectedError.Error(), err.Error())
			} else {
				require.NoError(t, err)
			}

			// Verify all mock expectations were met
			mockGH.AssertExpectations(t)
		})
	}
}

package webhooks

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

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	pgh "github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/github"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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
		webhookSecret string
		setupRequest  func() *http.Request
		mockSetup     func(t *testing.T, mockSecrets *secrets.MockService)
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
			name: "secret decryption error",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			setupRequest: func() *http.Request {
				req, _ := http.NewRequest("POST", "/webhook", nil)
				return req
			},
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return(nil, errors.New("decryption failed"))
			},
			expectedError: fmt.Errorf("failed to decrypt secret: decryption failed"),
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
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
			setupRequest: func() *http.Request {
				req, _ := http.NewRequest("POST", "/webhook", strings.NewReader("invalid payload"))
				req.Header.Set("X-Hub-Signature-256", "invalid")
				req.Header.Set("Content-Type", "application/json")
				return req
			},
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
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
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
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
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
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
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
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
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
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
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
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
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
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
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
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
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
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
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
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
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
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
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
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
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
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
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
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
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
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
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
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
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
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
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
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
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
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
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
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
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
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
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
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
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
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
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
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
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
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
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
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
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
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
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
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
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
			},
			expectedError: fmt.Errorf("expected PR in event"),
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
					Webhook: &provisioning.WebhookStatus{
						EncryptedSecret: []byte("encrypted-secret"),
					},
				},
			},
			webhookSecret: "webhook-secret",
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
			mockSetup: func(t *testing.T, mockSecrets *secrets.MockService) {
				mockSecrets.EXPECT().Decrypt(mock.Anything, []byte("encrypted-secret")).
					Return([]byte("webhook-secret"), nil)
			},
			expected: &provisioning.WebhookResponse{
				Code:    http.StatusNotImplemented,
				Message: "unsupported messageType: team",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock secrets service
			mockSecrets := secrets.NewMockService(t)

			// Set up the mock expectations
			if tt.mockSetup != nil {
				tt.mockSetup(t, mockSecrets)
			}

			// Create a GitHub repository with the test config
			repo := &githubWebhookRepository{
				config:  tt.config,
				owner:   "grafana",
				repo:    "grafana",
				secrets: mockSecrets,
			}

			// Call the Webhook method
			response, err := repo.Webhook(context.Background(), tt.setupRequest())

			// Check the error
			if tt.expectedError != nil {
				require.Error(t, err)
				var statusErr *apierrors.StatusError
				if errors.As(tt.expectedError, &statusErr) {
					var actualStatusErr *apierrors.StatusError
					require.True(t, errors.As(err, &actualStatusErr), "Expected StatusError but got different error type")
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

			// Verify all mock expectations were met
			mockSecrets.AssertExpectations(t)
		})
	}
}

func TestGitHubRepository_CommentPullRequest(t *testing.T) {
	tests := []struct {
		name          string
		setupMock     func(m *pgh.MockClient)
		prNumber      int
		comment       string
		expectedError error
	}{
		{
			name: "successfully comment on pull request",
			setupMock: func(m *pgh.MockClient) {
				m.On("CreatePullRequestComment", mock.Anything, "grafana", "grafana", 123, "Test comment").
					Return(nil)
			},
			prNumber:      123,
			comment:       "Test comment",
			expectedError: nil,
		},
		{
			name: "error commenting on pull request",
			setupMock: func(m *pgh.MockClient) {
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
			mockGH := pgh.NewMockClient(t)
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
		setupMock     func(m *pgh.MockClient)
		config        *provisioning.Repository
		webhookURL    string
		expectedHook  *provisioning.WebhookStatus
		expectedError error
	}{
		{
			name: "successfully create webhook",
			setupMock: func(m *pgh.MockClient) {
				m.On("CreateWebhook", mock.Anything, "grafana", "grafana", mock.MatchedBy(func(cfg pgh.WebhookConfig) bool {
					return cfg.URL == "https://example.com/webhook" &&
						cfg.ContentType == "json" &&
						cfg.Active == true
				})).Return(pgh.WebhookConfig{
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
				ID:     123,
				URL:    "https://example.com/webhook",
				Secret: "test-secret",
			},
			expectedError: nil,
		},
		{
			name: "no webhook URL",
			setupMock: func(m *pgh.MockClient) {
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
			setupMock: func(m *pgh.MockClient) {
				m.On("CreateWebhook", mock.Anything, "grafana", "grafana", mock.Anything).
					Return(pgh.WebhookConfig{}, fmt.Errorf("failed to create webhook"))
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
			mockGH := pgh.NewMockClient(t)
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
			hook, err := repo.OnCreate(context.Background())

			// Check results
			if tt.expectedError != nil {
				require.Error(t, err)
				require.Equal(t, tt.expectedError.Error(), err.Error())
				require.Nil(t, hook)
			} else {
				require.NoError(t, err)
				if tt.expectedHook != nil {
					require.NotNil(t, hook)
					require.Equal(t, tt.expectedHook.ID, hook.ID)
					require.Equal(t, tt.expectedHook.URL, hook.URL)
					require.NotEmpty(t, hook.Secret) // Secret is randomly generated, so just check it's not empty
				} else {
					require.Nil(t, hook)
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
		setupMock     func(m *pgh.MockClient)
		config        *provisioning.Repository
		webhookURL    string
		expectedHook  *provisioning.WebhookStatus
		expectedError error
	}{
		{
			name: "successfully update webhook when webhook exists",
			setupMock: func(m *pgh.MockClient) {
				// Mock getting the existing webhook
				m.On("GetWebhook", mock.Anything, "grafana", "grafana", int64(123)).
					Return(pgh.WebhookConfig{
						ID:     123,
						URL:    "https://example.com/webhook",
						Events: []string{"push"},
					}, nil)

				// Mock editing the webhook
				m.On("EditWebhook", mock.Anything, "grafana", "grafana", mock.MatchedBy(func(hook pgh.WebhookConfig) bool {
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
			setupMock: func(m *pgh.MockClient) {
				// Mock webhook not found
				m.On("GetWebhook", mock.Anything, "grafana", "grafana", int64(123)).
					Return(pgh.WebhookConfig{}, pgh.ErrResourceNotFound)

				// Mock creating a new webhook
				m.On("CreateWebhook", mock.Anything, "grafana", "grafana", mock.MatchedBy(func(hook pgh.WebhookConfig) bool {
					return hook.URL == "https://example.com/webhook" &&
						hook.ContentType == "json" &&
						slices.Equal(hook.Events, subscribedEvents) &&
						hook.Active == true
				})).Return(pgh.WebhookConfig{
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
			setupMock: func(m *pgh.MockClient) {
				// No mocks needed
			},
			config:        &provisioning.Repository{},
			webhookURL:    "",
			expectedHook:  nil,
			expectedError: nil,
		},
		{
			name: "error getting webhook",
			setupMock: func(m *pgh.MockClient) {
				m.On("GetWebhook", mock.Anything, "grafana", "grafana", int64(123)).
					Return(pgh.WebhookConfig{}, fmt.Errorf("failed to get webhook"))
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
			setupMock: func(m *pgh.MockClient) {
				// Mock getting the existing webhook
				m.On("GetWebhook", mock.Anything, "grafana", "grafana", int64(123)).
					Return(pgh.WebhookConfig{
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
			setupMock: func(m *pgh.MockClient) {
				// Mock creating a new webhook
				m.On("CreateWebhook", mock.Anything, "grafana", "grafana", mock.Anything).
					Return(pgh.WebhookConfig{
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
			setupMock: func(m *pgh.MockClient) {
				// Mock creating a new webhook
				m.On("CreateWebhook", mock.Anything, "grafana", "grafana", mock.Anything).
					Return(pgh.WebhookConfig{
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
			setupMock: func(m *pgh.MockClient) {
				// Mock webhook creation failure
				m.On("CreateWebhook", mock.Anything, "grafana", "grafana", mock.Anything).
					Return(pgh.WebhookConfig{}, fmt.Errorf("failed to create webhook"))
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
			setupMock: func(m *pgh.MockClient) {
				// Mock webhook not found
				m.On("GetWebhook", mock.Anything, "grafana", "grafana", int64(123)).
					Return(pgh.WebhookConfig{}, pgh.ErrResourceNotFound)

				// Mock creating a new webhook
				m.On("CreateWebhook", mock.Anything, "grafana", "grafana", mock.MatchedBy(func(hook pgh.WebhookConfig) bool {
					return hook.URL == "https://example.com/webhook" &&
						hook.ContentType == "json" &&
						slices.Equal(hook.Events, subscribedEvents) &&
						hook.Active == true
				})).Return(pgh.WebhookConfig{
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
			setupMock: func(m *pgh.MockClient) {
				// Mock webhook not found
				m.On("GetWebhook", mock.Anything, "grafana", "grafana", int64(123)).
					Return(pgh.WebhookConfig{}, pgh.ErrResourceNotFound)

				// Mock error when creating a new webhook
				m.On("CreateWebhook", mock.Anything, "grafana", "grafana", mock.MatchedBy(func(hook pgh.WebhookConfig) bool {
					return hook.URL == "https://example.com/webhook" &&
						hook.ContentType == "json" &&
						slices.Equal(hook.Events, subscribedEvents) &&
						hook.Active == true
				})).Return(pgh.WebhookConfig{}, fmt.Errorf("failed to create webhook"))
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
			setupMock: func(m *pgh.MockClient) {
				// Mock getting the existing webhook with matching URL and events
				m.On("GetWebhook", mock.Anything, "grafana", "grafana", int64(123)).
					Return(pgh.WebhookConfig{
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
						ID:     123,
						URL:    "https://example.com/webhook",
						Secret: "secret",
					},
				},
			},
			webhookURL: "https://example.com/webhook",
			expectedHook: &provisioning.WebhookStatus{
				ID:               123,
				URL:              "https://example.com/webhook",
				SubscribedEvents: subscribedEvents,
				Secret:           "secret",
			},
			expectedError: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup mock GitHub client
			mockGH := pgh.NewMockClient(t)
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
			hook, err := repo.OnUpdate(context.Background())

			// Check results
			if tt.expectedError != nil {
				require.Error(t, err)
				require.Equal(t, tt.expectedError.Error(), err.Error())
				require.Nil(t, hook)
			} else {
				require.NoError(t, err)
				if tt.expectedHook != nil {
					require.NotNil(t, hook)
					require.Equal(t, tt.expectedHook.ID, hook.ID)
					require.Equal(t, tt.expectedHook.URL, hook.URL)
					if tt.expectedHook.Secret != "" {
						require.Equal(t, tt.expectedHook.Secret, hook.Secret)
					} else {
						require.NotEmpty(t, hook.Secret) // Secret is randomly generated, so just check it's not empty
					}
					require.ElementsMatch(t, tt.expectedHook.SubscribedEvents, hook.SubscribedEvents)
				} else {
					require.Nil(t, hook)
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
		setupMock     func(m *pgh.MockClient)
		config        *provisioning.Repository
		webhookURL    string
		expectedError error
	}{
		{
			name: "successfully delete webhook",
			setupMock: func(m *pgh.MockClient) {
				// Mock deleting the webhook
				m.On("DeleteWebhook", mock.Anything, "grafana", "grafana", int64(123)).
					Return(nil)
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
			expectedError: nil,
		},
		{
			name: "no webhook URL provided",
			setupMock: func(m *pgh.MockClient) {
				// No mocks needed
			},
			config:        &provisioning.Repository{},
			webhookURL:    "",
			expectedError: nil,
		},
		{
			name: "webhook not found in status",
			setupMock: func(m *pgh.MockClient) {
				// No mocks needed
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
			expectedError: fmt.Errorf("webhook not found"),
		},
		{
			name: "error deleting webhook",
			setupMock: func(m *pgh.MockClient) {
				// Mock webhook deletion failure
				m.On("DeleteWebhook", mock.Anything, "grafana", "grafana", int64(123)).
					Return(fmt.Errorf("failed to delete webhook"))
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
			expectedError: fmt.Errorf("delete webhook: failed to delete webhook"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup mock GitHub client
			mockGH := pgh.NewMockClient(t)
			tt.setupMock(mockGH)

			// Create repository with mock
			repo := &githubWebhookRepository{
				gh:         mockGH,
				config:     tt.config,
				owner:      "grafana",
				repo:       "grafana",
				webhookURL: tt.webhookURL,
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

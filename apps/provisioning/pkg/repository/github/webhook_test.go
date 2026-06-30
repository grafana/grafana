package github

import (
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
	repo "github.com/grafana/grafana/apps/provisioning/pkg/repository"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

func TestParseWebhooks(t *testing.T) {
	tests := []struct {
		messageType string
		name        string
		expected    repo.WebhookEvent
	}{
		{"ping", "check", repo.WebhookEvent{
			Type: repo.WebhookEventPing,
		}},
		{"pull_request", "opened", repo.WebhookEvent{
			Type:      repo.WebhookEventPullRequest,
			RepoSlug:  "grafana/git-ui-sync-demo",
			Branch:    "main",
			Action:    repo.PullRequestActionOpened,
			PRNumber:  12,
			PRURL:     "https://github.com/grafana/git-ui-sync-demo/pull/12",
			SourceRef: "dashboard/1733653266690",
			Hash:      "ab5446a53df9e5f8bdeed52250f51fad08e822bc",
		}},
		{"push", "different_branch", repo.WebhookEvent{
			Type:         repo.WebhookEventPush,
			RepoSlug:     "grafana/git-ui-sync-demo",
			Branch:       "not-main",
			TotalChanges: 1,
		}},
		{"push", "nothing_relevant", repo.WebhookEvent{
			Type:         repo.WebhookEventPush,
			RepoSlug:     "grafana/git-ui-sync-demo",
			Branch:       "main",
			TotalChanges: 1,
		}},
		{"push", "nested", repo.WebhookEvent{
			Type:         repo.WebhookEventPush,
			RepoSlug:     "grafana/git-ui-sync-demo",
			Branch:       "main",
			TotalChanges: 5,
		}},
		{"push", "keep_file_only", repo.WebhookEvent{
			Type:         repo.WebhookEventPush,
			RepoSlug:     "grafana/git-ui-sync-demo",
			Branch:       "main",
			DeletedPaths: []string{"empty-folder/.keep"},
			TotalChanges: 1,
		}},
		{"push", "keep_file_with_others", repo.WebhookEvent{
			Type:         repo.WebhookEventPush,
			RepoSlug:     "grafana/git-ui-sync-demo",
			Branch:       "main",
			DeletedPaths: []string{"dashboards/.keep", "dashboards/dashboard1.json", "dashboards/dashboard2.json"},
			TotalChanges: 3,
		}},
		{"push", "multiple_keep_files", repo.WebhookEvent{
			Type:         repo.WebhookEventPush,
			RepoSlug:     "grafana/git-ui-sync-demo",
			Branch:       "main",
			DeletedPaths: []string{"empty-folder1/.keep", "dashboards-to-delete/.keep", "dashboards-to-delete/dashboard.json"},
			TotalChanges: 3,
		}},
		{"issue_comment", "created", repo.WebhookEvent{
			Type:    repo.WebhookEventUnsupported,
			Message: "unsupported messageType: issue_comment",
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
			Status: provisioning.RepositoryStatus{
				Webhook: &provisioning.WebhookStatus{},
			},
		},
		owner:  "grafana",
		repo:   "git-ui-sync-demo",
		secret: common.RawSecureValue("webhook-secret"),
	}

	for _, tt := range tests {
		name := fmt.Sprintf("webhook-%s-%s.json", tt.messageType, tt.name)
		t.Run(name, func(t *testing.T) {
			// nolint:gosec
			payload, err := os.ReadFile(path.Join("testdata", name))
			require.NoError(t, err)

			event, err := gh.ProcessRequest(t.Context(), signedWebhookRequest(t, tt.messageType, "webhook-secret", "", string(payload)))
			require.NoError(t, err)

			event.ReplayKey = "" // signature keying is covered by TestGitHubRepository_ProcessRequest_ReplayKey
			require.Equal(t, tt.expected, event)
		})
	}
}

func TestGitHubRepository_ProcessRequest_ReplayKey(t *testing.T) {
	pushPayload := `{
		"ref": "refs/heads/main",
		"repository": {
			"full_name": "grafana/grafana"
		}
	}`
	// A byte-different but still valid push payload — produces a different
	// HMAC signature, so it yields a different replay key.
	otherPayload := `{
		"ref": "refs/heads/main",
		"after": "deadbeef",
		"repository": {
			"full_name": "grafana/grafana"
		}
	}`

	newRepo := func(secret string) *githubWebhookRepository {
		return &githubWebhookRepository{
			config: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
				Spec: provisioning.RepositorySpec{
					GitHub: &provisioning.GitHubRepositoryConfig{Branch: "main"},
					Sync:   provisioning.SyncOptions{Enabled: true},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{},
				},
			},
			owner:  "grafana",
			repo:   "grafana",
			secret: common.RawSecureValue(secret),
		}
	}

	t.Run("replay key is the validated signature", func(t *testing.T) {
		gh := newRepo("webhook-secret")
		req := signedWebhookRequest(t, "push", "webhook-secret", "delivery-1", pushPayload)

		event, err := gh.ProcessRequest(t.Context(), req)
		require.NoError(t, err)
		require.NotEmpty(t, event.ReplayKey)
		require.Equal(t, req.Header.Get("X-Hub-Signature-256"), event.ReplayKey)
	})

	t.Run("distinct payloads yield distinct replay keys", func(t *testing.T) {
		gh := newRepo("webhook-secret")

		a, err := gh.ProcessRequest(t.Context(), signedWebhookRequest(t, "push", "webhook-secret", "delivery-A", pushPayload))
		require.NoError(t, err)
		b, err := gh.ProcessRequest(t.Context(), signedWebhookRequest(t, "push", "webhook-secret", "delivery-B", otherPayload))
		require.NoError(t, err)
		require.NotEqual(t, a.ReplayKey, b.ReplayKey)
	})

	t.Run("identical body under distinct secrets yields distinct replay keys", func(t *testing.T) {
		a, err := newRepo("secret-a").ProcessRequest(t.Context(), signedWebhookRequest(t, "push", "secret-a", "delivery-A", pushPayload))
		require.NoError(t, err)
		b, err := newRepo("secret-b").ProcessRequest(t.Context(), signedWebhookRequest(t, "push", "secret-b", "delivery-B", pushPayload))
		require.NoError(t, err)
		require.NotEqual(t, a.ReplayKey, b.ReplayKey)
	})
}

func TestGitHubRepository_Webhook(t *testing.T) {
	tests := []struct {
		name          string
		config        *provisioning.Repository
		setupRequest  func() *http.Request
		expected      repo.WebhookEvent
		expectedError error
	}{
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
			expected: repo.WebhookEvent{Type: repo.WebhookEventPing},
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
			expected: repo.WebhookEvent{
				Type:     repo.WebhookEventPush,
				RepoSlug: "grafana/grafana",
				Branch:   "main",
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
			expected: repo.WebhookEvent{
				Type:      repo.WebhookEventPullRequest,
				RepoSlug:  "grafana/grafana",
				Branch:    "main",
				Action:    repo.PullRequestActionOpened,
				PRNumber:  123,
				PRURL:     "https://github.com/grafana/grafana/pull/123",
				SourceRef: "feature-branch",
				Hash:      "abcdef1234567890",
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
			expected: repo.WebhookEvent{
				Type:      repo.WebhookEventPullRequest,
				RepoSlug:  "grafana/grafana",
				Branch:    "main",
				Action:    repo.PullRequestActionUpdated,
				PRNumber:  123,
				PRURL:     "https://github.com/grafana/grafana/pull/123",
				SourceRef: "feature-branch",
				Hash:      "abcdef1234567890",
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
			expected: repo.WebhookEvent{Type: repo.WebhookEventPing},
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
			expected: repo.WebhookEvent{
				Type:     repo.WebhookEventPush,
				RepoSlug: "grafana/grafana",
				Branch:   "main",
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
			expected: repo.WebhookEvent{
				Type:    repo.WebhookEventUnsupported,
				Message: "unsupported messageType: team",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a GitHub repository with the test config. A fresh cache
			// per subtest keeps replay state from leaking across cases.
			r := &githubWebhookRepository{
				config: tt.config,
				owner:  "grafana",
				repo:   "grafana",
				secret: common.RawSecureValue("webhook-secret"),
			}

			event, err := r.ProcessRequest(t.Context(), tt.setupRequest())

			// Check the error
			if tt.expectedError != nil {
				require.Error(t, err)
				if expected, ok := errors.AsType[*apierrors.StatusError](tt.expectedError); ok {
					actual, ok := errors.AsType[*apierrors.StatusError](err)
					require.True(t, ok, "Expected StatusError but got different error type: %T", err)
					require.Equal(t, expected.Status().Message, actual.Status().Message)
					require.Equal(t, expected.Status().Code, actual.Status().Code)
				} else {
					require.Equal(t, tt.expectedError.Error(), err.Error())
				}
			} else {
				require.NoError(t, err)
				event.ReplayKey = "" // signature keying is covered by TestGitHubRepository_ProcessRequest_ReplayKey
				require.Equal(t, tt.expected, event)
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
				m.On("CreatePullRequestComment", mock.Anything, 123, "Test comment").
					Return(nil)
			},
			prNumber:      123,
			comment:       "Test comment",
			expectedError: nil,
		},
		{
			name: "error commenting on pull request",
			setupMock: func(m *MockClient) {
				m.On("CreatePullRequestComment", mock.Anything, 456, "Error comment").
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
			err := repo.CommentPullRequest(t.Context(), tt.prNumber, tt.comment)

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
				m.On("CreateWebhook", mock.Anything, mock.MatchedBy(func(cfg WebhookConfig) bool {
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
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
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
				m.On("CreateWebhook", mock.Anything, mock.Anything).
					Return(WebhookConfig{}, fmt.Errorf("failed to create webhook"))
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
			},
			webhookURL:    "https://example.com/webhook",
			expectedHook:  nil,
			expectedError: fmt.Errorf("failed to create webhook"),
		},
		{
			name:      "no webhook when repository has no workflows",
			setupMock: func(_ *MockClient) {},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Workflows: []provisioning.Workflow{},
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
			},
			webhookURL:    "https://example.com/webhook",
			expectedHook:  nil,
			expectedError: nil,
		},
		{
			name:      "no webhook when webhookDisabled is true",
			setupMock: func(_ *MockClient) {},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
					Webhook: &provisioning.WebhookConfig{Disabled: true},
				},
			},
			webhookURL:    "https://example.com/webhook",
			expectedHook:  nil,
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

			// Call the OnCreate method
			hookOps, err := repo.OnCreate(t.Context())

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
		name            string
		setupMock       func(m *MockClient)
		config          *provisioning.Repository
		webhookURL      string
		expectedHook    *provisioning.WebhookStatus
		expectedCleanup bool
		expectedError   error
	}{
		{
			name: "successfully update webhook when webhook exists",
			setupMock: func(m *MockClient) {
				// Mock getting the existing webhook
				m.On("GetWebhook", mock.Anything, int64(123)).
					Return(WebhookConfig{
						ID:     123,
						URL:    "https://example.com/webhook",
						Events: []string{"push"},
					}, nil)

				// Mock editing the webhook
				m.On("EditWebhook", mock.Anything, mock.MatchedBy(func(hook WebhookConfig) bool {
					return hook.ID == 123 && hook.URL == "https://example.com/webhook-updated" &&
						slices.Equal(hook.Events, subscribedEvents)
				})).Return(nil)
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
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
				m.On("GetWebhook", mock.Anything, int64(123)).
					Return(WebhookConfig{}, repo.ErrFileNotFound)

				// Mock creating a new webhook
				m.On("CreateWebhook", mock.Anything, mock.MatchedBy(func(hook WebhookConfig) bool {
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
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
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
				m.On("GetWebhook", mock.Anything, int64(123)).
					Return(WebhookConfig{}, fmt.Errorf("failed to get webhook"))
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
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
				m.On("GetWebhook", mock.Anything, int64(123)).
					Return(WebhookConfig{
						ID:     123,
						URL:    "https://example.com/webhook",
						Events: []string{"push"},
					}, nil)

				// Mock editing the webhook with error
				m.On("EditWebhook", mock.Anything, mock.Anything).
					Return(fmt.Errorf("failed to edit webhook"))
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
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
				m.On("CreateWebhook", mock.Anything, mock.Anything).
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
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
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
				m.On("CreateWebhook", mock.Anything, mock.Anything).
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
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
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
				m.On("CreateWebhook", mock.Anything, mock.Anything).
					Return(WebhookConfig{}, fmt.Errorf("failed to create webhook"))
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
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
			name: "creates webhook when repo.ErrFileNotFound",
			setupMock: func(m *MockClient) {
				// Mock webhook not found
				m.On("GetWebhook", mock.Anything, int64(123)).
					Return(WebhookConfig{}, repo.ErrFileNotFound)

				// Mock creating a new webhook
				m.On("CreateWebhook", mock.Anything, mock.MatchedBy(func(hook WebhookConfig) bool {
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
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
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
				m.On("GetWebhook", mock.Anything, int64(123)).
					Return(WebhookConfig{}, repo.ErrFileNotFound)

				// Mock error when creating a new webhook
				m.On("CreateWebhook", mock.Anything, mock.MatchedBy(func(hook WebhookConfig) bool {
					return hook.URL == "https://example.com/webhook" &&
						hook.ContentType == "json" &&
						slices.Equal(hook.Events, subscribedEvents) &&
						hook.Active == true
				})).Return(WebhookConfig{}, fmt.Errorf("failed to create webhook"))
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
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
				m.On("GetWebhook", mock.Anything, int64(123)).
					Return(WebhookConfig{
						ID:     123,
						URL:    "https://example.com/webhook",
						Events: subscribedEvents,
					}, nil)
				// No EditWebhook call expected since no changes needed
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
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
		{
			name: "delete webhook when workflows are removed",
			setupMock: func(m *MockClient) {
				m.On("DeleteWebhook", mock.Anything, int64(123)).
					Return(nil)
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Workflows: []provisioning.Workflow{},
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
			webhookURL:      "https://example.com/webhook",
			expectedHook:    nil,
			expectedCleanup: true,
			expectedError:   nil,
		},
		{
			name:      "no-op when no workflows and no existing webhook",
			setupMock: func(_ *MockClient) {},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Workflows: []provisioning.Workflow{},
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: nil,
				},
			},
			webhookURL:    "https://example.com/webhook",
			expectedHook:  nil,
			expectedError: nil,
		},
		{
			name: "delete stale webhook when webhookDisabled is true",
			setupMock: func(m *MockClient) {
				m.On("DeleteWebhook", mock.Anything, int64(123)).
					Return(nil)
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
					Webhook: &provisioning.WebhookConfig{Disabled: true},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						ID:  123,
						URL: "https://example.com/webhook",
					},
				},
			},
			webhookURL:      "",
			expectedHook:    nil,
			expectedCleanup: true,
			expectedError:   nil,
		},
		{
			name:      "no-op when webhookDisabled is true and no existing webhook",
			setupMock: func(_ *MockClient) {},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
					Webhook: &provisioning.WebhookConfig{Disabled: true},
				},
				Status: provisioning.RepositoryStatus{
					Webhook: nil,
				},
			},
			webhookURL:    "",
			expectedHook:  nil,
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
			hookOps, err := repo.OnUpdate(t.Context())

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
				} else if tt.expectedCleanup {
					require.NotNil(t, hookOps)
					require.Len(t, hookOps, 1)
					require.Equal(t, "replace", hookOps[0]["op"])
					require.Equal(t, "/status/webhook", hookOps[0]["path"])
					require.Nil(t, hookOps[0]["value"])
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
				m.On("DeleteWebhook", mock.Anything, int64(123)).
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
			name: "webhook not found during deletion",
			setupMock: func(m *MockClient) {
				m.On("DeleteWebhook", mock.Anything, int64(123)).
					Return(repo.ErrFileNotFound)
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
			webhookURL: "https://example.com/webhook",
			// We don't return an error if the webhook is already gone
			expectedError: nil,
		},
		{
			name: "unauthorized to delete the webhook",
			setupMock: func(m *MockClient) {
				m.On("DeleteWebhook", mock.Anything, int64(123)).
					Return(repo.ErrUnauthorized)
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
			webhookURL: "https://example.com/webhook",
			// We don't return an error if access to the webhook is revoked
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
				m.On("DeleteWebhook", mock.Anything, int64(123)).
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
			err := repo.OnDelete(t.Context())

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

func TestGitHubRepository_RotateWebhookSecret(t *testing.T) {
	t.Run("successful rotation returns status and secure patch ops", func(t *testing.T) {
		mockGH := NewMockClient(t)
		mockGH.On("GetWebhook", mock.Anything, int64(123)).
			Return(WebhookConfig{ID: 123, URL: "https://example.com/hook", Events: []string{"push"}}, nil)
		mockGH.On("EditWebhook", mock.Anything, mock.MatchedBy(func(cfg WebhookConfig) bool {
			return cfg.ID == 123 && cfg.Secret != ""
		})).Return(nil)

		repo := &githubWebhookRepository{
			gh:    mockGH,
			owner: "grafana",
			repo:  "grafana",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{GitHub: &provisioning.GitHubRepositoryConfig{Branch: "main"}},
				Secure: provisioning.SecureValues{
					WebhookSecret: common.InlineSecureValue{Name: "existing-webhook-secret"},
				},
				Status: provisioning.RepositoryStatus{Webhook: &provisioning.WebhookStatus{ID: 123}},
			},
		}

		ops, err := repo.RotateWebhookSecret(t.Context())
		require.NoError(t, err)
		require.Len(t, ops, 2)
		require.Equal(t, "replace", ops[0]["op"])
		require.Equal(t, "/status/webhook", ops[0]["path"])
		require.Equal(t, "replace", ops[1]["op"])
		require.Equal(t, "/secure/webhookSecret", ops[1]["path"])

		webhookStatus := ops[0]["value"].(*provisioning.WebhookStatus)
		require.True(t, webhookStatus.LastRotated > 0)
	})

	t.Run("webhook not found on remote clears status and returns error", func(t *testing.T) {
		mockGH := NewMockClient(t)
		mockGH.On("GetWebhook", mock.Anything, int64(123)).
			Return(WebhookConfig{}, repo.ErrFileNotFound)

		r := &githubWebhookRepository{
			gh:    mockGH,
			owner: "grafana",
			repo:  "grafana",
			config: &provisioning.Repository{
				Spec:   provisioning.RepositorySpec{GitHub: &provisioning.GitHubRepositoryConfig{Branch: "main"}},
				Status: provisioning.RepositoryStatus{Webhook: &provisioning.WebhookStatus{ID: 123}},
			},
		}

		ops, err := r.RotateWebhookSecret(t.Context())
		require.Error(t, err)
		require.Contains(t, err.Error(), "not found on remote")
		require.Len(t, ops, 1)
		require.Equal(t, "replace", ops[0]["op"])
		require.Equal(t, "/status/webhook", ops[0]["path"])
		require.Nil(t, ops[0]["value"])
	})

	t.Run("get webhook error returns error", func(t *testing.T) {
		mockGH := NewMockClient(t)
		mockGH.On("GetWebhook", mock.Anything, int64(123)).
			Return(WebhookConfig{}, fmt.Errorf("api error"))

		repo := &githubWebhookRepository{
			gh:    mockGH,
			owner: "grafana",
			repo:  "grafana",
			config: &provisioning.Repository{
				Spec:   provisioning.RepositorySpec{GitHub: &provisioning.GitHubRepositoryConfig{Branch: "main"}},
				Status: provisioning.RepositoryStatus{Webhook: &provisioning.WebhookStatus{ID: 123}},
			},
		}

		ops, err := repo.RotateWebhookSecret(t.Context())
		require.Error(t, err)
		require.Contains(t, err.Error(), "get webhook for rotation")
		require.Nil(t, ops)
	})

	t.Run("edit webhook error returns error", func(t *testing.T) {
		mockGH := NewMockClient(t)
		mockGH.On("GetWebhook", mock.Anything, int64(123)).
			Return(WebhookConfig{ID: 123, URL: "https://example.com/hook"}, nil)
		mockGH.On("EditWebhook", mock.Anything, mock.Anything).
			Return(fmt.Errorf("edit failed"))

		repo := &githubWebhookRepository{
			gh:    mockGH,
			owner: "grafana",
			repo:  "grafana",
			config: &provisioning.Repository{
				Spec:   provisioning.RepositorySpec{GitHub: &provisioning.GitHubRepositoryConfig{Branch: "main"}},
				Status: provisioning.RepositoryStatus{Webhook: &provisioning.WebhookStatus{ID: 123}},
			},
		}

		ops, err := repo.RotateWebhookSecret(t.Context())
		require.Error(t, err)
		require.Contains(t, err.Error(), "edit webhook during rotation")
		require.Nil(t, ops)
	})

	t.Run("skips when no webhook exists", func(t *testing.T) {
		repo := &githubWebhookRepository{
			config: &provisioning.Repository{},
		}

		ops, err := repo.RotateWebhookSecret(t.Context())
		require.NoError(t, err)
		require.Nil(t, ops)
	})

	t.Run("skips when webhook ID is zero", func(t *testing.T) {
		repo := &githubWebhookRepository{
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{ID: 0},
				},
			},
		}

		ops, err := repo.RotateWebhookSecret(t.Context())
		require.NoError(t, err)
		require.Nil(t, ops)
	})
}

func signedWebhookRequest(t *testing.T, eventType, secret, deliveryID, payload string) *http.Request {
	t.Helper()
	req, err := http.NewRequest("POST", "/webhook", strings.NewReader(payload))
	require.NoError(t, err)
	req.Header.Set("X-GitHub-Event", eventType)
	req.Header.Set("Content-Type", "application/json")
	if deliveryID != "" {
		req.Header.Set("X-GitHub-Delivery", deliveryID)
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	req.Header.Set("X-Hub-Signature-256", "sha256="+hex.EncodeToString(mac.Sum(nil)))
	return req
}

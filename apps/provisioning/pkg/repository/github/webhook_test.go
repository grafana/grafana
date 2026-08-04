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
	"strings"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

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
			Sender:    "ryantxu",
			SenderID:  "705951",
		}},
		{"push", "different_branch", repo.WebhookEvent{
			Type:         repo.WebhookEventPush,
			RepoSlug:     "grafana/git-ui-sync-demo",
			Branch:       "not-main",
			TotalChanges: 1,
			Sender:       "ryantxu",
			SenderID:     "705951",
		}},
		{"push", "nothing_relevant", repo.WebhookEvent{
			Type:         repo.WebhookEventPush,
			RepoSlug:     "grafana/git-ui-sync-demo",
			Branch:       "main",
			TotalChanges: 1,
			Sender:       "ryantxu",
			SenderID:     "705951",
		}},
		{"push", "nested", repo.WebhookEvent{
			Type:         repo.WebhookEventPush,
			RepoSlug:     "grafana/git-ui-sync-demo",
			Branch:       "main",
			TotalChanges: 5,
			Sender:       "ryantxu",
			SenderID:     "705951",
		}},
		{"push", "keep_file_only", repo.WebhookEvent{
			Type:         repo.WebhookEventPush,
			RepoSlug:     "grafana/git-ui-sync-demo",
			Branch:       "main",
			DeletedPaths: []string{"empty-folder/.keep"},
			TotalChanges: 1,
			Sender:       "testuser",
			SenderID:     "123456",
		}},
		{"push", "keep_file_with_others", repo.WebhookEvent{
			Type:         repo.WebhookEventPush,
			RepoSlug:     "grafana/git-ui-sync-demo",
			Branch:       "main",
			DeletedPaths: []string{"dashboards/.keep", "dashboards/dashboard1.json", "dashboards/dashboard2.json"},
			TotalChanges: 3,
			Sender:       "testuser",
			SenderID:     "123456",
		}},
		{"push", "multiple_keep_files", repo.WebhookEvent{
			Type:         repo.WebhookEventPush,
			RepoSlug:     "grafana/git-ui-sync-demo",
			Branch:       "main",
			DeletedPaths: []string{"empty-folder1/.keep", "dashboards-to-delete/.keep", "dashboards-to-delete/dashboard.json"},
			TotalChanges: 3,
			Sender:       "testuser",
			SenderID:     "123456",
		}},
		{"issue_comment", "created", repo.WebhookEvent{
			Type:    repo.WebhookEventUnsupported,
			Message: "unsupported messageType: issue_comment",
		}},
	}

	gh := &githubWebhookRepository{
		secret: common.RawSecureValue("webhook-secret"),
	}

	for _, tt := range tests {
		name := fmt.Sprintf("webhook-%s-%s.json", tt.messageType, tt.name)
		t.Run(name, func(t *testing.T) {
			// nolint:gosec
			payload, err := os.ReadFile(path.Join("testdata", name))
			require.NoError(t, err)

			event, err := verifyAndProcess(t, gh, signedWebhookRequest(t, tt.messageType, "webhook-secret", "", string(payload)))
			require.NoError(t, err)

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
			secret: common.RawSecureValue(secret),
		}
	}

	t.Run("replay key is the validated signature", func(t *testing.T) {
		gh := newRepo("webhook-secret")
		req := signedWebhookRequest(t, "push", "webhook-secret", "delivery-1", pushPayload)

		verified, err := gh.VerifyRequest(req)
		require.NoError(t, err)
		require.NotEmpty(t, verified.ReplayKey)
		require.Equal(t, req.Header.Get("X-Hub-Signature-256"), verified.ReplayKey)
	})

	t.Run("distinct payloads yield distinct replay keys", func(t *testing.T) {
		gh := newRepo("webhook-secret")

		a, err := gh.VerifyRequest(signedWebhookRequest(t, "push", "webhook-secret", "delivery-A", pushPayload))
		require.NoError(t, err)
		b, err := gh.VerifyRequest(signedWebhookRequest(t, "push", "webhook-secret", "delivery-B", otherPayload))
		require.NoError(t, err)
		require.NotEqual(t, a.ReplayKey, b.ReplayKey)
	})

	t.Run("identical body under distinct secrets yields distinct replay keys", func(t *testing.T) {
		a, err := newRepo("secret-a").VerifyRequest(signedWebhookRequest(t, "push", "secret-a", "delivery-A", pushPayload))
		require.NoError(t, err)
		b, err := newRepo("secret-b").VerifyRequest(signedWebhookRequest(t, "push", "secret-b", "delivery-B", pushPayload))
		require.NoError(t, err)
		require.NotEqual(t, a.ReplayKey, b.ReplayKey)
	})
}

func TestGitHubRepository_Webhook(t *testing.T) {
	tests := []struct {
		name          string
		setupRequest  func() *http.Request
		expected      repo.WebhookEvent
		expectedError error
	}{
		{
			name: "invalid signature",
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
				secret: common.RawSecureValue("webhook-secret"),
			}

			event, err := verifyAndProcess(t, r, tt.setupRequest())

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

			mockRepo := NewMockGithubRepository(t)
			mockRepo.EXPECT().Client().Return(mockGH)

			// Create repository with mock
			repo := &githubWebhookRepository{
				GithubRepository: mockRepo,
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

func verifyAndProcess(t *testing.T, gh *githubWebhookRepository, req *http.Request) (repo.WebhookEvent, error) {
	t.Helper()
	verified, err := gh.VerifyRequest(req)
	if err != nil {
		return repo.WebhookEvent{}, err
	}
	return gh.ProcessRequest(t.Context(), verified)
}

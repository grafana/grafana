package repository

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

var subscribedEvents = []string{"pull_request", "push"}

func newTestWebhookManager(client WebhookClient, config *provisioning.Repository, webhookURL string) *WebhookManager {
	return NewWebhookManager(client, nil, nil, config, webhookURL, "", "", subscribedEvents, "", NewIncrementalSyncPolicy(false, 5))
}

func TestWebhookManager_OnCreate(t *testing.T) {
	tests := []struct {
		name          string
		setupMock     func(m *MockWebhookClient)
		config        *provisioning.Repository
		webhookURL    string
		expectedHook  *provisioning.WebhookStatus
		expectedError error
	}{
		{
			name: "successfully create webhook",
			setupMock: func(m *MockWebhookClient) {
				m.On("CreateWebhook", mock.Anything, mock.MatchedBy(func(cfg Webhook) bool {
					return cfg.URL == "https://example.com/webhook"
				})).Return(Webhook{
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
			setupMock: func(m *MockWebhookClient) {
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
			setupMock: func(m *MockWebhookClient) {
				m.On("CreateWebhook", mock.Anything, mock.Anything).
					Return(Webhook{}, fmt.Errorf("failed to create webhook"))
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
			setupMock: func(_ *MockWebhookClient) {},
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
			setupMock: func(_ *MockWebhookClient) {},
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
			mockClient := NewMockWebhookClient(t)
			tt.setupMock(mockClient)

			m := newTestWebhookManager(mockClient, tt.config, tt.webhookURL)

			hookOps, err := m.OnCreate(context.Background())

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

			mockClient.AssertExpectations(t)
		})
	}
}

func TestWebhookManager_OnUpdate(t *testing.T) {
	tests := []struct {
		name            string
		setupMock       func(m *MockWebhookClient)
		config          *provisioning.Repository
		webhookURL      string
		expectedHook    *provisioning.WebhookStatus
		expectedCleanup bool
		expectedError   error
	}{
		{
			name: "successfully update webhook when webhook exists",
			setupMock: func(m *MockWebhookClient) {
				m.On("GetWebhook", mock.Anything, int64(123)).
					Return(Webhook{
						ID:     123,
						URL:    "https://example.com/webhook",
						Events: []string{"push"},
					}, nil)

				m.On("EditWebhook", mock.Anything, mock.MatchedBy(func(hook Webhook) bool {
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
			setupMock: func(m *MockWebhookClient) {
				m.On("GetWebhook", mock.Anything, int64(123)).
					Return(Webhook{}, ErrFileNotFound)

				m.On("CreateWebhook", mock.Anything, mock.MatchedBy(func(hook Webhook) bool {
					return hook.URL == "https://example.com/webhook" &&
						slices.Equal(hook.Events, subscribedEvents)
				})).Return(Webhook{
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
			setupMock: func(m *MockWebhookClient) {
				// No mocks needed
			},
			config:        &provisioning.Repository{},
			webhookURL:    "",
			expectedHook:  nil,
			expectedError: nil,
		},
		{
			name: "error getting webhook",
			setupMock: func(m *MockWebhookClient) {
				m.On("GetWebhook", mock.Anything, int64(123)).
					Return(Webhook{}, fmt.Errorf("failed to get webhook"))
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
			setupMock: func(m *MockWebhookClient) {
				m.On("GetWebhook", mock.Anything, int64(123)).
					Return(Webhook{
						ID:     123,
						URL:    "https://example.com/webhook",
						Events: []string{"push"},
					}, nil)

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
			setupMock: func(m *MockWebhookClient) {
				m.On("CreateWebhook", mock.Anything, mock.Anything).
					Return(Webhook{
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
					Webhook: nil,
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
			setupMock: func(m *MockWebhookClient) {
				m.On("CreateWebhook", mock.Anything, mock.Anything).
					Return(Webhook{
						ID:     789,
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
						ID:  0,
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
			setupMock: func(m *MockWebhookClient) {
				m.On("CreateWebhook", mock.Anything, mock.Anything).
					Return(Webhook{}, fmt.Errorf("failed to create webhook"))
			},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
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
			expectedError: fmt.Errorf("failed to create webhook"),
		},
		{
			name: "creates webhook when ErrFileNotFound",
			setupMock: func(m *MockWebhookClient) {
				m.On("GetWebhook", mock.Anything, int64(123)).
					Return(Webhook{}, ErrFileNotFound)

				m.On("CreateWebhook", mock.Anything, mock.MatchedBy(func(hook Webhook) bool {
					return hook.URL == "https://example.com/webhook" &&
						slices.Equal(hook.Events, subscribedEvents)
				})).Return(Webhook{
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
			setupMock: func(m *MockWebhookClient) {
				m.On("GetWebhook", mock.Anything, int64(123)).
					Return(Webhook{}, ErrFileNotFound)

				m.On("CreateWebhook", mock.Anything, mock.MatchedBy(func(hook Webhook) bool {
					return hook.URL == "https://example.com/webhook" &&
						slices.Equal(hook.Events, subscribedEvents)
				})).Return(Webhook{}, fmt.Errorf("failed to create webhook"))
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
			setupMock: func(m *MockWebhookClient) {
				m.On("GetWebhook", mock.Anything, int64(123)).
					Return(Webhook{
						ID:     123,
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
			expectedHook:  nil,
			expectedError: nil,
		},
		{
			name: "delete webhook when workflows are removed",
			setupMock: func(m *MockWebhookClient) {
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
			setupMock: func(_ *MockWebhookClient) {},
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
			name:      "no webhook update when webhookDisabled is true",
			setupMock: func(_ *MockWebhookClient) {},
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
			webhookURL:    "https://example.com/webhook",
			expectedHook:  nil,
			expectedError: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := NewMockWebhookClient(t)
			tt.setupMock(mockClient)

			m := newTestWebhookManager(mockClient, tt.config, tt.webhookURL)

			hookOps, err := m.OnUpdate(context.Background())

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

			mockClient.AssertExpectations(t)
		})
	}
}

func TestWebhookManager_OnDelete(t *testing.T) {
	tests := []struct {
		name          string
		setupMock     func(m *MockWebhookClient)
		config        *provisioning.Repository
		webhookURL    string
		expectedError error
	}{
		{
			name: "successfully delete webhook",
			setupMock: func(m *MockWebhookClient) {
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
			setupMock: func(m *MockWebhookClient) {
				m.On("DeleteWebhook", mock.Anything, int64(123)).
					Return(ErrFileNotFound)
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
			name: "unauthorized to delete the webhook",
			setupMock: func(m *MockWebhookClient) {
				m.On("DeleteWebhook", mock.Anything, int64(123)).
					Return(ErrUnauthorized)
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
			setupMock: func(_ *MockWebhookClient) {},
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
			name:      "webhook not found in status",
			setupMock: func(_ *MockWebhookClient) {},
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
					Webhook: nil,
				},
			},
			webhookURL:    "https://example.com/webhook",
			expectedError: nil,
		},
		{
			name: "error deleting webhook",
			setupMock: func(m *MockWebhookClient) {
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
			mockClient := NewMockWebhookClient(t)
			tt.setupMock(mockClient)

			m := newTestWebhookManager(mockClient, tt.config, tt.webhookURL)

			err := m.OnDelete(context.Background())

			if tt.expectedError != nil {
				require.Error(t, err)
				require.Equal(t, tt.expectedError.Error(), err.Error())
			} else {
				require.NoError(t, err)
			}

			mockClient.AssertExpectations(t)
		})
	}
}

func TestWebhookManager_RotateWebhookSecret(t *testing.T) {
	t.Run("successful rotation returns status and secure patch ops", func(t *testing.T) {
		mockClient := NewMockWebhookClient(t)
		mockClient.On("GetWebhook", mock.Anything, int64(123)).
			Return(Webhook{ID: 123, URL: "https://example.com/hook", Events: []string{"push"}}, nil)
		mockClient.On("EditWebhook", mock.Anything, mock.MatchedBy(func(cfg Webhook) bool {
			return cfg.ID == 123 && cfg.Secret != ""
		})).Return(nil)

		config := &provisioning.Repository{
			Spec: provisioning.RepositorySpec{GitHub: &provisioning.GitHubRepositoryConfig{Branch: "main"}},
			Secure: provisioning.SecureValues{
				WebhookSecret: common.InlineSecureValue{Name: "existing-webhook-secret"},
			},
			Status: provisioning.RepositoryStatus{Webhook: &provisioning.WebhookStatus{ID: 123}},
		}

		m := newTestWebhookManager(mockClient, config, "https://example.com/hook")

		ops, err := m.RotateWebhookSecret(context.Background())
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
		mockClient := NewMockWebhookClient(t)
		mockClient.On("GetWebhook", mock.Anything, int64(123)).
			Return(Webhook{}, ErrFileNotFound)

		config := &provisioning.Repository{
			Spec:   provisioning.RepositorySpec{GitHub: &provisioning.GitHubRepositoryConfig{Branch: "main"}},
			Status: provisioning.RepositoryStatus{Webhook: &provisioning.WebhookStatus{ID: 123}},
		}

		m := newTestWebhookManager(mockClient, config, "https://example.com/hook")

		ops, err := m.RotateWebhookSecret(context.Background())
		require.Error(t, err)
		require.Contains(t, err.Error(), "not found on remote")
		require.Len(t, ops, 1)
		require.Equal(t, "replace", ops[0]["op"])
		require.Equal(t, "/status/webhook", ops[0]["path"])
		require.Nil(t, ops[0]["value"])
	})

	t.Run("get webhook error returns error", func(t *testing.T) {
		mockClient := NewMockWebhookClient(t)
		mockClient.On("GetWebhook", mock.Anything, int64(123)).
			Return(Webhook{}, fmt.Errorf("api error"))

		config := &provisioning.Repository{
			Spec:   provisioning.RepositorySpec{GitHub: &provisioning.GitHubRepositoryConfig{Branch: "main"}},
			Status: provisioning.RepositoryStatus{Webhook: &provisioning.WebhookStatus{ID: 123}},
		}

		m := newTestWebhookManager(mockClient, config, "https://example.com/hook")

		ops, err := m.RotateWebhookSecret(context.Background())
		require.Error(t, err)
		require.Contains(t, err.Error(), "get webhook for rotation")
		require.Nil(t, ops)
	})

	t.Run("edit webhook error returns error", func(t *testing.T) {
		mockClient := NewMockWebhookClient(t)
		mockClient.On("GetWebhook", mock.Anything, int64(123)).
			Return(Webhook{ID: 123, URL: "https://example.com/hook"}, nil)
		mockClient.On("EditWebhook", mock.Anything, mock.Anything).
			Return(fmt.Errorf("edit failed"))

		config := &provisioning.Repository{
			Spec:   provisioning.RepositorySpec{GitHub: &provisioning.GitHubRepositoryConfig{Branch: "main"}},
			Status: provisioning.RepositoryStatus{Webhook: &provisioning.WebhookStatus{ID: 123}},
		}

		m := newTestWebhookManager(mockClient, config, "https://example.com/hook")

		ops, err := m.RotateWebhookSecret(context.Background())
		require.Error(t, err)
		require.Contains(t, err.Error(), "edit webhook during rotation")
		require.Nil(t, ops)
	})

	t.Run("skips when no webhook exists", func(t *testing.T) {
		m := newTestWebhookManager(NewMockWebhookClient(t), &provisioning.Repository{}, "https://example.com/hook")

		ops, err := m.RotateWebhookSecret(context.Background())
		require.NoError(t, err)
		require.Nil(t, ops)
	})

	t.Run("skips when webhook ID is zero", func(t *testing.T) {
		config := &provisioning.Repository{
			Status: provisioning.RepositoryStatus{
				Webhook: &provisioning.WebhookStatus{ID: 0},
			},
		}

		m := newTestWebhookManager(NewMockWebhookClient(t), config, "https://example.com/hook")

		ops, err := m.RotateWebhookSecret(context.Background())
		require.NoError(t, err)
		require.Nil(t, ops)
	})
}

// stubParser is a WebhookParser whose authentication and normalization results
// are fully controlled by the test, so the manager's provider-agnostic dispatch
// can be exercised without any real provider payloads.
type stubParser struct {
	replayKey string
	verifyErr error
	event     WebhookEvent
	parseErr  error
}

func (s stubParser) Verify(*http.Request, common.RawSecureValue) ([]byte, string, error) {
	return nil, s.replayKey, s.verifyErr
}

func (s stubParser) Parse(*http.Request, []byte) (WebhookEvent, error) {
	return s.event, s.parseErr
}

func dispatchManager(parser WebhookParser, replay *ReplayCache, config *provisioning.Repository, secret common.RawSecureValue) *WebhookManager {
	return NewWebhookManager(nil, parser, replay, config, "", "grafana/grafana", "main", subscribedEvents, secret, NewIncrementalSyncPolicy(false, 5))
}

func dispatchConfig() *provisioning.Repository {
	return &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Name: "test-repo"},
		Spec: provisioning.RepositorySpec{
			Sync: provisioning.SyncOptions{Enabled: true},
		},
		Status: provisioning.RepositoryStatus{Webhook: &provisioning.WebhookStatus{}},
	}
}

func TestWebhookManager_Webhook(t *testing.T) {
	const secret = "webhook-secret"

	tests := []struct {
		name          string
		config        *provisioning.Repository
		secret        common.RawSecureValue
		parser        stubParser
		expected      *provisioning.WebhookResponse
		expectedError error
	}{
		{
			name:          "missing webhook status",
			config:        &provisioning.Repository{},
			secret:        secret,
			expectedError: fmt.Errorf("unexpected webhook request"),
		},
		{
			name:          "missing secret",
			config:        dispatchConfig(),
			secret:        "",
			expectedError: fmt.Errorf("missing webhook secret"),
		},
		{
			name:          "verification failure",
			config:        dispatchConfig(),
			secret:        secret,
			parser:        stubParser{verifyErr: fmt.Errorf("bad signature")},
			expectedError: apierrors.NewUnauthorized("invalid signature"),
		},
		{
			name:          "parse failure",
			config:        dispatchConfig(),
			secret:        secret,
			parser:        stubParser{parseErr: fmt.Errorf("invalid payload")},
			expectedError: fmt.Errorf("invalid payload"),
		},
		{
			name:          "push repository mismatch",
			config:        dispatchConfig(),
			secret:        secret,
			parser:        stubParser{event: WebhookEvent{Type: WebhookEventPush, RepoSlug: "other/repo", Branch: "main"}},
			expectedError: ErrRepositoryMismatch,
		},
		{
			name:     "push sync disabled",
			config:   &provisioning.Repository{Status: provisioning.RepositoryStatus{Webhook: &provisioning.WebhookStatus{}}},
			secret:   secret,
			parser:   stubParser{event: WebhookEvent{Type: WebhookEventPush, RepoSlug: "grafana/grafana", Branch: "main"}},
			expected: &provisioning.WebhookResponse{Code: http.StatusOK},
		},
		{
			name:     "push other branch",
			config:   dispatchConfig(),
			secret:   secret,
			parser:   stubParser{event: WebhookEvent{Type: WebhookEventPush, RepoSlug: "grafana/grafana", Branch: "feature"}},
			expected: &provisioning.WebhookResponse{Code: http.StatusOK},
		},
		{
			name:   "push accepted",
			config: dispatchConfig(),
			secret: secret,
			parser: stubParser{event: WebhookEvent{Type: WebhookEventPush, RepoSlug: "grafana/grafana", Branch: "main", TotalChanges: 1}},
			expected: &provisioning.WebhookResponse{
				Code: http.StatusAccepted,
				Job: &provisioning.JobSpec{
					Repository: "test-repo",
					Action:     provisioning.JobActionPull,
					Pull:       &provisioning.SyncJobOptions{Incremental: true},
				},
			},
		},
		{
			name:          "pull request repository mismatch",
			config:        dispatchConfig(),
			secret:        secret,
			parser:        stubParser{event: WebhookEvent{Type: WebhookEventPullRequest, RepoSlug: "other/repo", Branch: "main"}},
			expectedError: ErrRepositoryMismatch,
		},
		{
			name:   "pull request other branch",
			config: dispatchConfig(),
			secret: secret,
			parser: stubParser{event: WebhookEvent{Type: WebhookEventPullRequest, RepoSlug: "grafana/grafana", Branch: "develop"}},
			expected: &provisioning.WebhookResponse{
				Code:    http.StatusOK,
				Message: "ignoring pull request event as develop is not the configured branch",
			},
		},
		{
			name:   "pull request ignored action",
			config: dispatchConfig(),
			secret: secret,
			parser: stubParser{event: WebhookEvent{Type: WebhookEventPullRequest, RepoSlug: "grafana/grafana", Branch: "main", Action: "closed"}},
			expected: &provisioning.WebhookResponse{
				Code:    http.StatusOK,
				Message: "ignore pull request event: closed",
			},
		},
		{
			name:   "pull request accepted",
			config: dispatchConfig(),
			secret: secret,
			parser: stubParser{event: WebhookEvent{
				Type:      WebhookEventPullRequest,
				RepoSlug:  "grafana/grafana",
				Branch:    "main",
				Action:    pullRequestActionOpened,
				PRNumber:  123,
				PRURL:     "https://github.com/grafana/grafana/pull/123",
				SourceRef: "feature-branch",
				Hash:      "abcdef",
			}},
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
						Hash: "abcdef",
					},
				},
			},
		},
		{
			name:     "ping",
			config:   dispatchConfig(),
			secret:   secret,
			parser:   stubParser{event: WebhookEvent{Type: WebhookEventPing}},
			expected: &provisioning.WebhookResponse{Code: http.StatusOK, Message: "ping received"},
		},
		{
			name:     "unsupported",
			config:   dispatchConfig(),
			secret:   secret,
			parser:   stubParser{event: WebhookEvent{Type: WebhookEventUnsupported, Message: "unsupported messageType: team"}},
			expected: &provisioning.WebhookResponse{Code: http.StatusNotImplemented, Message: "unsupported messageType: team"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := dispatchManager(tt.parser, NewReplayCache(time.Hour), tt.config, tt.secret)

			rsp, err := m.Webhook(context.Background(), &http.Request{})

			if tt.expectedError != nil {
				require.Error(t, err)
				var statusErr *apierrors.StatusError
				if errors.As(tt.expectedError, &statusErr) {
					var actual *apierrors.StatusError
					require.True(t, errors.As(err, &actual), "expected StatusError, got %T", err)
					require.Equal(t, statusErr.Status().Message, actual.Status().Message)
					require.Equal(t, statusErr.Status().Code, actual.Status().Code)
				} else {
					require.Equal(t, tt.expectedError.Error(), err.Error())
				}
				return
			}

			require.NoError(t, err)
			require.Equal(t, tt.expected.Code, rsp.Code)
			require.Equal(t, tt.expected.Message, rsp.Message)
			require.Equal(t, tt.expected.Job, rsp.Job)
		})
	}
}

func TestWebhookManager_Webhook_ReplayProtection(t *testing.T) {
	const secret = "webhook-secret"
	pushEvent := WebhookEvent{Type: WebhookEventPush, RepoSlug: "grafana/grafana", Branch: "main", TotalChanges: 1}

	t.Run("replayed key is silently dropped", func(t *testing.T) {
		m := dispatchManager(stubParser{replayKey: "sig-1", event: pushEvent}, NewReplayCache(time.Hour), dispatchConfig(), secret)

		first, err := m.Webhook(context.Background(), &http.Request{})
		require.NoError(t, err)
		require.Equal(t, http.StatusAccepted, first.Code)

		dup, err := m.Webhook(context.Background(), &http.Request{})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, dup.Code)
		require.Equal(t, "ok", dup.Message)
		require.Nil(t, dup.Job)
	})

	t.Run("empty replay key is never deduplicated", func(t *testing.T) {
		m := dispatchManager(stubParser{replayKey: "", event: pushEvent}, NewReplayCache(time.Hour), dispatchConfig(), secret)

		first, err := m.Webhook(context.Background(), &http.Request{})
		require.NoError(t, err)
		require.Equal(t, http.StatusAccepted, first.Code)

		second, err := m.Webhook(context.Background(), &http.Request{})
		require.NoError(t, err)
		require.Equal(t, http.StatusAccepted, second.Code)
	})
}

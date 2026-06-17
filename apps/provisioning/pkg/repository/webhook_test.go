package repository

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

var subscribedEvents = []string{"pull_request", "push"}

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
				m.On("CreateWebhook", mock.Anything, "https://example.com/webhook", mock.Anything, mock.Anything).
					Return(&fakeWebhookConfig{id: 123, url: "https://example.com/webhook"}, nil)
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
				m.On("CreateWebhook", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
					Return(nil, fmt.Errorf("failed to create webhook"))
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
					Return(&fakeWebhookConfig{
						id:     123,
						url:    "https://example.com/webhook",
						events: []string{"push"},
					}, nil)

				m.On("EditWebhook", mock.Anything, mock.MatchedBy(func(hook WebhookConfig) bool {
					return hook.GetID() == 123 && hook.GetURL() == "https://example.com/webhook-updated" &&
						slices.Equal(hook.GetEvents(), subscribedEvents)
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
					Return(nil, ErrFileNotFound)

				m.On("CreateWebhook", mock.Anything, "https://example.com/webhook", mock.MatchedBy(func(events []string) bool {
					return slices.Equal(events, subscribedEvents)
				}), mock.Anything).Return(&fakeWebhookConfig{
					id:     456,
					url:    "https://example.com/webhook",
					events: subscribedEvents,
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
					Return(nil, fmt.Errorf("failed to get webhook"))
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
					Return(&fakeWebhookConfig{
						id:     123,
						url:    "https://example.com/webhook",
						events: []string{"push"},
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
				m.On("CreateWebhook", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
					Return(&fakeWebhookConfig{
						id:     456,
						url:    "https://example.com/webhook",
						events: subscribedEvents,
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
				m.On("CreateWebhook", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
					Return(&fakeWebhookConfig{
						id:     789,
						url:    "https://example.com/webhook",
						events: subscribedEvents,
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
				m.On("CreateWebhook", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
					Return(nil, fmt.Errorf("failed to create webhook"))
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
					Return(nil, ErrFileNotFound)

				m.On("CreateWebhook", mock.Anything, "https://example.com/webhook", mock.MatchedBy(func(events []string) bool {
					return slices.Equal(events, subscribedEvents)
				}), mock.Anything).Return(&fakeWebhookConfig{
					id:     456,
					url:    "https://example.com/webhook",
					events: subscribedEvents,
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
					Return(nil, ErrFileNotFound)

				m.On("CreateWebhook", mock.Anything, "https://example.com/webhook", mock.MatchedBy(func(events []string) bool {
					return slices.Equal(events, subscribedEvents)
				}), mock.Anything).Return(nil, fmt.Errorf("failed to create webhook"))
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
					Return(&fakeWebhookConfig{
						id:     123,
						url:    "https://example.com/webhook",
						events: subscribedEvents,
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
			name: "delete webhook when webhookDisabled is true",
			setupMock: func(m *MockWebhookClient) {
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
			webhookURL:      "https://example.com/webhook",
			expectedHook:    nil,
			expectedCleanup: true,
			expectedError:   nil,
		},
		{
			name:      "no-op when webhookDisabled is true and no existing webhook",
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
					Webhook: nil,
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
			name:      "webhook not found in status",
			setupMock: func(_ *MockWebhookClient) {},
			config: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
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
		})
	}
}

func TestWebhookManager_RotateWebhookSecret(t *testing.T) {
	t.Run("successful rotation returns status and secure patch ops", func(t *testing.T) {
		mockClient := NewMockWebhookClient(t)
		mockClient.On("GetWebhook", mock.Anything, int64(123)).
			Return(&fakeWebhookConfig{id: 123, url: "https://example.com/hook", events: []string{"push"}}, nil)
		mockClient.On("EditWebhook", mock.Anything, mock.MatchedBy(func(cfg WebhookConfig) bool {
			return cfg.GetID() == 123 && cfg.GetSecret() != ""
		})).Return(nil)

		config := &provisioning.Repository{
			Spec:   provisioning.RepositorySpec{GitHub: &provisioning.GitHubRepositoryConfig{Branch: "main"}},
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
			Return(nil, ErrFileNotFound)

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
			Return(nil, fmt.Errorf("api error"))

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
			Return(&fakeWebhookConfig{id: 123, url: "https://example.com/hook"}, nil)
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

func TestWebhookHandler_Webhook(t *testing.T) {
	tests := []struct {
		name          string
		noStatus      bool
		syncDisabled  bool
		event         WebhookEvent
		processErr    error
		expected      *provisioning.WebhookResponse
		expectedError error
	}{
		{
			name:          "missing webhook status",
			noStatus:      true,
			expectedError: fmt.Errorf("unexpected webhook request"),
		},
		{
			name:          "verification failure",
			processErr:    apierrors.NewUnauthorized("invalid signature"),
			expectedError: apierrors.NewUnauthorized("invalid signature"),
		},
		{
			name:          "parse failure",
			processErr:    fmt.Errorf("invalid payload"),
			expectedError: fmt.Errorf("invalid payload"),
		},
		{
			name:          "push repository mismatch",
			event:         WebhookEvent{Type: WebhookEventPush, RepoSlug: "other/repo", Branch: "main"},
			expectedError: ErrRepositoryMismatch,
		},
		{
			name:         "push sync disabled",
			syncDisabled: true,
			event:        WebhookEvent{Type: WebhookEventPush, RepoSlug: "grafana/grafana", Branch: "main"},
			expected:     &provisioning.WebhookResponse{Code: http.StatusOK},
		},
		{
			name:     "push other branch",
			event:    WebhookEvent{Type: WebhookEventPush, RepoSlug: "grafana/grafana", Branch: "feature"},
			expected: &provisioning.WebhookResponse{Code: http.StatusOK},
		},
		{
			name:  "push accepted",
			event: WebhookEvent{Type: WebhookEventPush, RepoSlug: "grafana/grafana", Branch: "main", TotalChanges: 1},
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
			name:  "push large diff forces full sync",
			event: WebhookEvent{Type: WebhookEventPush, RepoSlug: "grafana/grafana", Branch: "main", TotalChanges: 7},
			expected: &provisioning.WebhookResponse{
				Code: http.StatusAccepted,
				Job: &provisioning.JobSpec{
					Repository: "test-repo",
					Action:     provisioning.JobActionPull,
					Pull:       &provisioning.SyncJobOptions{Incremental: false},
				},
			},
		},
		{
			name:          "pull request repository mismatch",
			event:         WebhookEvent{Type: WebhookEventPullRequest, RepoSlug: "other/repo", Branch: "main"},
			expectedError: ErrRepositoryMismatch,
		},
		{
			name:  "pull request other branch",
			event: WebhookEvent{Type: WebhookEventPullRequest, RepoSlug: "grafana/grafana", Branch: "develop"},
			expected: &provisioning.WebhookResponse{
				Code:    http.StatusOK,
				Message: "ignoring pull request event as develop is not  the configured branch",
			},
		},
		{
			name:  "pull request ignored action",
			event: WebhookEvent{Type: WebhookEventPullRequest, RepoSlug: "grafana/grafana", Branch: "main", Action: "closed"},
			expected: &provisioning.WebhookResponse{
				Code:    http.StatusOK,
				Message: "ignore pull request event: closed",
			},
		},
		{
			name: "pull request accepted",
			event: WebhookEvent{
				Type:      WebhookEventPullRequest,
				RepoSlug:  "grafana/grafana",
				Branch:    "main",
				Action:    PullRequestActionOpened,
				PRNumber:  123,
				PRURL:     "https://github.com/grafana/grafana/pull/123",
				SourceRef: "feature-branch",
				Hash:      "abcdef",
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
						Hash: "abcdef",
					},
				},
			},
		},
		{
			name:     "ping",
			event:    WebhookEvent{Type: WebhookEventPing},
			expected: &provisioning.WebhookResponse{Code: http.StatusOK, Message: "ping received"},
		},
		{
			name:     "replay",
			event:    WebhookEvent{Type: WebhookEventReplay},
			expected: &provisioning.WebhookResponse{Code: http.StatusOK, Message: "ok"},
		},
		{
			name:     "unsupported",
			event:    WebhookEvent{Type: WebhookEventUnsupported, Message: "unsupported messageType: team"},
			expected: &provisioning.WebhookResponse{Code: http.StatusNotImplemented, Message: "unsupported messageType: team"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var status *provisioning.WebhookStatus
			processor := NewMockRequestProcessor(t)
			if !tt.noStatus {
				status = &provisioning.WebhookStatus{}
				processor.On("ProcessRequest", mock.Anything, mock.Anything).Return(tt.event, tt.processErr)
			}

			h := NewWebhookHandler(processor, status, "test-repo", "grafana/grafana", "main", !tt.syncDisabled, NewIncrementalSyncPolicy(false, 5))

			rsp, err := h.Webhook(context.Background(), &http.Request{})

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

func newTestWebhookManager(client WebhookClient, config *provisioning.Repository, webhookURL string) *WebhookManager {
	disabled := config.Spec.Webhook != nil && config.Spec.Webhook.Disabled
	return NewWebhookManager(client, config.Status.Webhook, webhookURL, subscribedEvents, disabled, config.Spec.Workflows)
}

// fakeWebhookConfig is a provider-agnostic WebhookConfig whose fields the
// manager reads and mutates through the interface, standing in for a real
// provider's webhook representation.
type fakeWebhookConfig struct {
	id     int64
	url    string
	events []string
	secret string
}

func (c *fakeWebhookConfig) GetID() int64              { return c.id }
func (c *fakeWebhookConfig) GetURL() string            { return c.url }
func (c *fakeWebhookConfig) GetEvents() []string       { return c.events }
func (c *fakeWebhookConfig) GetSecret() string         { return c.secret }
func (c *fakeWebhookConfig) SetURL(url string)         { c.url = url }
func (c *fakeWebhookConfig) SetEvents(events []string) { c.events = events }
func (c *fakeWebhookConfig) SetSecret(secret string)   { c.secret = secret }

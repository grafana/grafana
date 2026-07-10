package controller

import (
	"fmt"
	"slices"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

var subscribedEvents = []string{"pull_request", "push"} // same order as slices.Sort()

// fakeWebhookConfig is a stateful repository.WebhookConfig for exercising the
// provider-agnostic lifecycle, which mutates the config and reads it back.
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

func newMockWebhookRepository(t *testing.T, config *provisioning.Repository, webhookURL string, client *repository.MockWebhookClient) *repository.MockWebhookRepository {
	repo := repository.NewMockWebhookRepository(t)
	repo.EXPECT().Config().Return(config).Maybe()
	repo.EXPECT().WebhookURL().Return(webhookURL).Maybe()
	repo.EXPECT().SubscribedEvents().Return(subscribedEvents).Maybe()
	repo.EXPECT().WebhookClient().Return(client).Maybe()
	return repo
}

func TestWebhookOnCreate(t *testing.T) {
	tests := []struct {
		name          string
		setupMock     func(m *repository.MockWebhookClient)
		config        *provisioning.Repository
		webhookURL    string
		expectedHook  *provisioning.WebhookStatus
		expectedError error
	}{
		{
			name: "successfully create webhook",
			setupMock: func(m *repository.MockWebhookClient) {
				m.EXPECT().CreateWebhook(mock.Anything, "https://example.com/webhook", subscribedEvents, mock.Anything).
					Return(&fakeWebhookConfig{
						id:  123,
						url: "https://example.com/webhook",
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
			name:      "no webhook URL",
			setupMock: func(m *repository.MockWebhookClient) {},
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
			setupMock: func(m *repository.MockWebhookClient) {
				m.EXPECT().CreateWebhook(mock.Anything, mock.Anything, mock.Anything, mock.Anything).
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
			setupMock: func(_ *repository.MockWebhookClient) {},
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
			setupMock: func(_ *repository.MockWebhookClient) {},
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
			mockClient := repository.NewMockWebhookClient(t)
			tt.setupMock(mockClient)

			repo := newMockWebhookRepository(t, tt.config, tt.webhookURL, mockClient)

			hookOps, err := webhookOnCreate(t.Context(), repo)

			if tt.expectedError != nil {
				require.Error(t, err)
				require.Equal(t, tt.expectedError.Error(), err.Error())
				require.Nil(t, hookOps)
			} else {
				require.NoError(t, err)
				if tt.expectedHook != nil {
					requireCreateStatusPatches(t, hookOps, tt.expectedHook)
				} else {
					require.Nil(t, hookOps)
				}
			}
		})
	}
}

func TestWebhookOnUpdate(t *testing.T) {
	tests := []struct {
		name            string
		setupMock       func(m *repository.MockWebhookClient)
		config          *provisioning.Repository
		webhookURL      string
		expectedHook    *provisioning.WebhookStatus
		expectedCleanup bool
		expectedError   error
	}{
		{
			name: "successfully update webhook when webhook exists",
			setupMock: func(m *repository.MockWebhookClient) {
				m.EXPECT().GetWebhook(mock.Anything, int64(123)).
					Return(&fakeWebhookConfig{
						id:     123,
						url:    "https://example.com/webhook",
						events: []string{"push"},
					}, nil)

				m.EXPECT().EditWebhook(mock.Anything, mock.MatchedBy(func(hook repository.WebhookConfig) bool {
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
			setupMock: func(m *repository.MockWebhookClient) {
				m.EXPECT().GetWebhook(mock.Anything, int64(123)).
					Return(nil, repository.ErrFileNotFound)

				m.EXPECT().CreateWebhook(mock.Anything, "https://example.com/webhook", subscribedEvents, mock.Anything).
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
			name:          "no webhook URL provided",
			setupMock:     func(m *repository.MockWebhookClient) {},
			config:        &provisioning.Repository{},
			webhookURL:    "",
			expectedHook:  nil,
			expectedError: nil,
		},
		{
			name: "error getting webhook",
			setupMock: func(m *repository.MockWebhookClient) {
				m.EXPECT().GetWebhook(mock.Anything, int64(123)).
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
			setupMock: func(m *repository.MockWebhookClient) {
				m.EXPECT().GetWebhook(mock.Anything, int64(123)).
					Return(&fakeWebhookConfig{
						id:     123,
						url:    "https://example.com/webhook",
						events: []string{"push"},
					}, nil)

				m.EXPECT().EditWebhook(mock.Anything, mock.Anything).
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
			setupMock: func(m *repository.MockWebhookClient) {
				m.EXPECT().CreateWebhook(mock.Anything, mock.Anything, mock.Anything, mock.Anything).
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
			setupMock: func(m *repository.MockWebhookClient) {
				m.EXPECT().CreateWebhook(mock.Anything, mock.Anything, mock.Anything, mock.Anything).
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
			setupMock: func(m *repository.MockWebhookClient) {
				m.EXPECT().CreateWebhook(mock.Anything, mock.Anything, mock.Anything, mock.Anything).
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
					Webhook: nil, // Webhook status is nil
				},
			},
			webhookURL:    "https://example.com/webhook",
			expectedHook:  nil,
			expectedError: fmt.Errorf("failed to create webhook"),
		},
		{
			name: "creates webhook when repo.ErrFileNotFound",
			setupMock: func(m *repository.MockWebhookClient) {
				m.EXPECT().GetWebhook(mock.Anything, int64(123)).
					Return(nil, repository.ErrFileNotFound)

				m.EXPECT().CreateWebhook(mock.Anything, "https://example.com/webhook", subscribedEvents, mock.Anything).
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
			setupMock: func(m *repository.MockWebhookClient) {
				m.EXPECT().GetWebhook(mock.Anything, int64(123)).
					Return(nil, repository.ErrFileNotFound)

				m.EXPECT().CreateWebhook(mock.Anything, "https://example.com/webhook", subscribedEvents, mock.Anything).
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
			setupMock: func(m *repository.MockWebhookClient) {
				m.EXPECT().GetWebhook(mock.Anything, int64(123)).
					Return(&fakeWebhookConfig{
						id:     123,
						url:    "https://example.com/webhook",
						events: subscribedEvents,
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
			setupMock: func(m *repository.MockWebhookClient) {
				m.EXPECT().DeleteWebhook(mock.Anything, int64(123)).
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
			setupMock: func(_ *repository.MockWebhookClient) {},
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
			setupMock: func(m *repository.MockWebhookClient) {
				m.EXPECT().DeleteWebhook(mock.Anything, int64(123)).
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
			setupMock: func(_ *repository.MockWebhookClient) {},
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
			mockClient := repository.NewMockWebhookClient(t)
			tt.setupMock(mockClient)

			repo := newMockWebhookRepository(t, tt.config, tt.webhookURL, mockClient)

			hookOps, err := webhookOnUpdate(t.Context(), repo)

			if tt.expectedError != nil {
				require.Error(t, err)
				require.Equal(t, tt.expectedError.Error(), err.Error())
				require.Nil(t, hookOps)
			} else {
				require.NoError(t, err)
				if tt.expectedHook != nil {
					requireCreateStatusPatches(t, hookOps, tt.expectedHook)
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

func TestWebhookOnDelete(t *testing.T) {
	tests := []struct {
		name          string
		setupMock     func(m *repository.MockWebhookClient)
		config        *provisioning.Repository
		expectedError error
	}{
		{
			name: "successfully delete webhook",
			setupMock: func(m *repository.MockWebhookClient) {
				m.EXPECT().DeleteWebhook(mock.Anything, int64(123)).
					Return(nil)
			},
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						ID:  123,
						URL: "https://example.com/webhook",
					},
				},
			},
			expectedError: nil,
		},
		{
			name: "webhook not found during deletion",
			setupMock: func(m *repository.MockWebhookClient) {
				m.EXPECT().DeleteWebhook(mock.Anything, int64(123)).
					Return(repository.ErrFileNotFound)
			},
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						ID:  123,
						URL: "https://example.com/webhook",
					},
				},
			},
			// We don't return an error if the webhook is already gone
			expectedError: nil,
		},
		{
			name: "unauthorized to delete the webhook",
			setupMock: func(m *repository.MockWebhookClient) {
				m.EXPECT().DeleteWebhook(mock.Anything, int64(123)).
					Return(repository.ErrUnauthorized)
			},
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						ID:  123,
						URL: "https://example.com/webhook",
					},
				},
			},
			// We don't return an error if access to the webhook is revoked
			expectedError: nil,
		},
		{
			name:      "webhook not found in status",
			setupMock: func(_ *repository.MockWebhookClient) {},
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Webhook: nil, // Webhook status is nil
				},
			},
			expectedError: nil, // No error expected - returns early when webhook is nil
		},
		{
			name: "error deleting webhook",
			setupMock: func(m *repository.MockWebhookClient) {
				m.EXPECT().DeleteWebhook(mock.Anything, int64(123)).
					Return(fmt.Errorf("failed to delete webhook"))
			},
			config: &provisioning.Repository{
				Status: provisioning.RepositoryStatus{
					Webhook: &provisioning.WebhookStatus{
						ID:  123,
						URL: "https://example.com/webhook",
					},
				},
			},
			expectedError: fmt.Errorf("delete webhook: failed to delete webhook"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := repository.NewMockWebhookClient(t)
			tt.setupMock(mockClient)

			repo := newMockWebhookRepository(t, tt.config, "", mockClient)

			err := webhookOnDelete(t.Context(), repo)

			if tt.expectedError != nil {
				require.Error(t, err)
				require.Equal(t, tt.expectedError.Error(), err.Error())
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestRotateWebhookSecret(t *testing.T) {
	t.Run("successful rotation returns status and secure patch ops", func(t *testing.T) {
		mockClient := repository.NewMockWebhookClient(t)
		mockClient.EXPECT().GetWebhook(mock.Anything, int64(123)).
			Return(&fakeWebhookConfig{id: 123, url: "https://example.com/hook", events: []string{"push"}}, nil)
		mockClient.EXPECT().EditWebhook(mock.Anything, mock.MatchedBy(func(cfg repository.WebhookConfig) bool {
			return cfg.GetID() == 123 && cfg.GetSecret() != ""
		})).Return(nil)

		repo := newMockWebhookRepository(t, &provisioning.Repository{
			Status: provisioning.RepositoryStatus{Webhook: &provisioning.WebhookStatus{ID: 123}},
		}, "", mockClient)

		ops, err := rotateWebhookSecret(t.Context(), repo)
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
		mockClient := repository.NewMockWebhookClient(t)
		mockClient.EXPECT().GetWebhook(mock.Anything, int64(123)).
			Return(nil, repository.ErrFileNotFound)

		repo := newMockWebhookRepository(t, &provisioning.Repository{
			Status: provisioning.RepositoryStatus{Webhook: &provisioning.WebhookStatus{ID: 123}},
		}, "", mockClient)

		ops, err := rotateWebhookSecret(t.Context(), repo)
		require.Error(t, err)
		require.Contains(t, err.Error(), "not found on remote")
		require.Len(t, ops, 1)
		require.Equal(t, "replace", ops[0]["op"])
		require.Equal(t, "/status/webhook", ops[0]["path"])
		require.Nil(t, ops[0]["value"])
	})

	t.Run("get webhook error returns error", func(t *testing.T) {
		mockClient := repository.NewMockWebhookClient(t)
		mockClient.EXPECT().GetWebhook(mock.Anything, int64(123)).
			Return(nil, fmt.Errorf("api error"))

		repo := newMockWebhookRepository(t, &provisioning.Repository{
			Status: provisioning.RepositoryStatus{Webhook: &provisioning.WebhookStatus{ID: 123}},
		}, "", mockClient)

		ops, err := rotateWebhookSecret(t.Context(), repo)
		require.Error(t, err)
		require.Contains(t, err.Error(), "get webhook for rotation")
		require.Nil(t, ops)
	})

	t.Run("edit webhook error returns error", func(t *testing.T) {
		mockClient := repository.NewMockWebhookClient(t)
		mockClient.EXPECT().GetWebhook(mock.Anything, int64(123)).
			Return(&fakeWebhookConfig{id: 123, url: "https://example.com/hook"}, nil)
		mockClient.EXPECT().EditWebhook(mock.Anything, mock.Anything).
			Return(fmt.Errorf("edit failed"))

		repo := newMockWebhookRepository(t, &provisioning.Repository{
			Status: provisioning.RepositoryStatus{Webhook: &provisioning.WebhookStatus{ID: 123}},
		}, "", mockClient)

		ops, err := rotateWebhookSecret(t.Context(), repo)
		require.Error(t, err)
		require.Contains(t, err.Error(), "edit webhook during rotation")
		require.Nil(t, ops)
	})

	t.Run("skips when no webhook exists", func(t *testing.T) {
		repo := newMockWebhookRepository(t, &provisioning.Repository{}, "", repository.NewMockWebhookClient(t))

		ops, err := rotateWebhookSecret(t.Context(), repo)
		require.NoError(t, err)
		require.Nil(t, ops)
	})

	t.Run("skips when webhook ID is zero", func(t *testing.T) {
		repo := newMockWebhookRepository(t, &provisioning.Repository{
			Status: provisioning.RepositoryStatus{
				Webhook: &provisioning.WebhookStatus{ID: 0},
			},
		}, "", repository.NewMockWebhookClient(t))

		ops, err := rotateWebhookSecret(t.Context(), repo)
		require.NoError(t, err)
		require.Nil(t, ops)
	})
}

// requireCreateStatusPatches asserts the status and secret patch operations
// produced when a webhook is created or updated.
func requireCreateStatusPatches(t *testing.T, hookOps []map[string]any, expected *provisioning.WebhookStatus) {
	t.Helper()
	require.NotNil(t, hookOps)
	require.Len(t, hookOps, 2)
	require.Equal(t, "replace", hookOps[0]["op"])
	require.Equal(t, "/status/webhook", hookOps[0]["path"])
	require.Equal(t, expected.ID, hookOps[0]["value"].(*provisioning.WebhookStatus).ID)
	require.Equal(t, expected.URL, hookOps[0]["value"].(*provisioning.WebhookStatus).URL)
	require.ElementsMatch(t, expected.SubscribedEvents, hookOps[0]["value"].(*provisioning.WebhookStatus).SubscribedEvents)

	require.Equal(t, "replace", hookOps[1]["op"])
	require.Equal(t, "/secure/webhookSecret", hookOps[1]["path"])
	vals, ok := hookOps[1]["value"].(map[string]string)
	require.True(t, ok, "expected webhookSecret as map")
	require.Len(t, vals, 1, "with one property")
	require.NotEmpty(t, vals["create"], "secret should be created")

	_, err := uuid.Parse(vals["create"])
	require.NoError(t, err, "the secret is a valid UUID")
}

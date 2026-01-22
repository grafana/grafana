package controller

import (
	"context"
	"fmt"
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

func TestUpdateWebhookConfiguredCondition(t *testing.T) {
	t.Run("webhook not supported - repository doesn't implement interface", func(t *testing.T) {
		rc := &RepositoryController{}
		obj := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{
				Name:       "test-repo",
				Namespace:  "default",
				Generation: 1,
			},
		}

		// Mock a repository that doesn't support webhooks
		repo := repository.NewMockConfigRepository(t)

		ops := rc.reconcileWebhook(context.Background(), obj, repo)

		require.Len(t, ops, 1)
		conditions := ops[0]["value"].([]metav1.Condition)
		require.Len(t, conditions, 1)

		assert.Equal(t, provisioning.ConditionTypeWebhookConfigured, conditions[0].Type)
		assert.Equal(t, metav1.ConditionTrue, conditions[0].Status)
		assert.Equal(t, provisioning.ReasonNotRequired, conditions[0].Reason)
		assert.Equal(t, "Webhook is not required for this repository type", conditions[0].Message)
		assert.Equal(t, int64(1), conditions[0].ObservedGeneration)
	})

	t.Run("webhook URL not configured", func(t *testing.T) {
		rc := &RepositoryController{}
		obj := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{
				Name:       "test-repo",
				Namespace:  "default",
				Generation: 1,
			},
		}

		// Mock repository with webhook support but no URL
		mockRepo := &mockWebhookRepo{
			webhookURL: "", // No URL configured
		}

		ops := rc.reconcileWebhook(context.Background(), obj, mockRepo)

		require.Len(t, ops, 1)
		conditions := ops[0]["value"].([]metav1.Condition)
		require.Len(t, conditions, 1)

		assert.Equal(t, provisioning.ConditionTypeWebhookConfigured, conditions[0].Type)
		assert.Equal(t, metav1.ConditionTrue, conditions[0].Status)
		assert.Equal(t, provisioning.ReasonNotRequired, conditions[0].Reason)
		assert.Equal(t, "Webhook URL is not configured", conditions[0].Message)
	})

	t.Run("webhook secret not ready - no secret name", func(t *testing.T) {
		rc := &RepositoryController{}
		obj := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{
				Name:       "test-repo",
				Namespace:  "default",
				Generation: 1,
			},
			Secure: provisioning.SecureValues{
				// No webhook secret
			},
		}

		mockRepo := &mockWebhookRepo{
			webhookURL: "https://example.com/webhook",
		}

		ops := rc.reconcileWebhook(context.Background(), obj, mockRepo)

		require.Len(t, ops, 1)
		conditions := ops[0]["value"].([]metav1.Condition)
		require.Len(t, conditions, 1)

		assert.Equal(t, provisioning.ConditionTypeWebhookConfigured, conditions[0].Type)
		assert.Equal(t, metav1.ConditionFalse, conditions[0].Status)
		assert.Equal(t, provisioning.ReasonSecretNotReady, conditions[0].Reason)
		assert.Equal(t, "Waiting for webhook secret to be generated", conditions[0].Message)
	})

	t.Run("webhook setup success - creates webhook with new secret", func(t *testing.T) {
		rc := &RepositoryController{}
		obj := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{
				Name:       "test-repo",
				Namespace:  "default",
				Generation: 1,
			},
			Secure: provisioning.SecureValues{
				WebhookSecret: common.InlineSecureValue{
					Name: "test-secret",
				},
			},
		}

		// Webhook secret generated (uuid.NewRandom() is called in github/webhook.go:201)
		generatedSecret := "550e8400-e29b-41d4-a716-446655440000"

		mockRepo := &mockWebhookRepo{
			webhookURL: "https://example.com/webhook",
			setupResult: &repository.WebhookSetupResult{
				Status: &provisioning.WebhookStatus{
					ID:               123,
					URL:              "https://example.com/webhook",
					SubscribedEvents: []string{"push", "pull_request"},
				},
				SecretChanged: true,
				Secret:        generatedSecret,
			},
		}

		ops := rc.reconcileWebhook(context.Background(), obj, mockRepo)

		// Should have: condition + webhook status + webhook secret
		require.Len(t, ops, 3)

		// Check condition
		conditions := ops[0]["value"].([]metav1.Condition)
		assert.Equal(t, provisioning.ConditionTypeWebhookConfigured, conditions[0].Type)
		assert.Equal(t, metav1.ConditionTrue, conditions[0].Status)
		assert.Equal(t, provisioning.ReasonWebhookCreated, conditions[0].Reason)
		assert.Contains(t, conditions[0].Message, "https://example.com/webhook")

		// Check webhook status patch
		assert.Equal(t, "replace", ops[1]["op"])
		assert.Equal(t, "/status/webhook", ops[1]["path"])
		webhookStatus := ops[1]["value"].(*provisioning.WebhookStatus)
		assert.Equal(t, int64(123), webhookStatus.ID)
		assert.Equal(t, "https://example.com/webhook", webhookStatus.URL)
		assert.Equal(t, []string{"push", "pull_request"}, webhookStatus.SubscribedEvents)

		// Check webhook secret patch
		assert.Equal(t, "replace", ops[2]["op"])
		assert.Equal(t, "/secure/webhookSecret", ops[2]["path"])
		secretValue := ops[2]["value"].(map[string]string)
		assert.Equal(t, generatedSecret, secretValue["create"])
	})

	t.Run("webhook setup success - updates webhook without secret change", func(t *testing.T) {
		rc := &RepositoryController{}
		obj := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{
				Name:       "test-repo",
				Namespace:  "default",
				Generation: 2,
			},
			Secure: provisioning.SecureValues{
				WebhookSecret: common.InlineSecureValue{
					Name: "existing-secret",
				},
			},
			Status: provisioning.RepositoryStatus{
				ObservedGeneration: 1,
				Webhook: &provisioning.WebhookStatus{
					ID:               123,
					URL:              "https://old.example.com/webhook",
					SubscribedEvents: []string{"push"},
				},
			},
		}

		mockRepo := &mockWebhookRepo{
			webhookURL: "https://new.example.com/webhook",
			setupResult: &repository.WebhookSetupResult{
				Status: &provisioning.WebhookStatus{
					ID:               123,
					URL:              "https://new.example.com/webhook",
					SubscribedEvents: []string{"push", "pull_request"},
				},
				SecretChanged: false, // URL/events changed but no secret rotation
				Secret:        "",
			},
		}

		ops := rc.reconcileWebhook(context.Background(), obj, mockRepo)

		// Should have: condition + webhook status (no secret patch)
		require.Len(t, ops, 2)

		// Check condition
		conditions := ops[0]["value"].([]metav1.Condition)
		assert.Equal(t, metav1.ConditionTrue, conditions[0].Status)
		assert.Equal(t, provisioning.ReasonWebhookCreated, conditions[0].Reason)

		// Check webhook status was updated
		webhookStatus := ops[1]["value"].(*provisioning.WebhookStatus)
		assert.Equal(t, "https://new.example.com/webhook", webhookStatus.URL)
		assert.Equal(t, []string{"push", "pull_request"}, webhookStatus.SubscribedEvents)
	})

	t.Run("webhook setup success - rotates secret on webhook update", func(t *testing.T) {
		rc := &RepositoryController{}
		obj := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{
				Name:       "test-repo",
				Namespace:  "default",
				Generation: 2,
			},
			Secure: provisioning.SecureValues{
				WebhookSecret: common.InlineSecureValue{
					Name: "existing-secret",
				},
			},
			Status: provisioning.RepositoryStatus{
				ObservedGeneration: 1,
				Webhook: &provisioning.WebhookStatus{
					ID:               123,
					URL:              "https://example.com/webhook",
					SubscribedEvents: []string{"push"},
				},
			},
		}

		// When webhook is updated, secret is rotated (github/webhook.go:267-270)
		newSecret := "660e8400-e29b-41d4-a716-446655440111"

		mockRepo := &mockWebhookRepo{
			webhookURL: "https://example.com/webhook",
			setupResult: &repository.WebhookSetupResult{
				Status: &provisioning.WebhookStatus{
					ID:               123,
					URL:              "https://example.com/webhook",
					SubscribedEvents: []string{"push", "pull_request"}, // Events changed
				},
				SecretChanged: true, // Secret was rotated
				Secret:        newSecret,
			},
		}

		ops := rc.reconcileWebhook(context.Background(), obj, mockRepo)

		// Should have: condition + webhook status + rotated secret
		require.Len(t, ops, 3)

		// Check secret was rotated
		assert.Equal(t, "/secure/webhookSecret", ops[2]["path"])
		secretValue := ops[2]["value"].(map[string]string)
		assert.Equal(t, newSecret, secretValue["create"])
	})

	t.Run("webhook setup failure - GitHub API error", func(t *testing.T) {
		rc := &RepositoryController{}
		obj := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{
				Name:       "test-repo",
				Namespace:  "default",
				Generation: 1,
			},
			Secure: provisioning.SecureValues{
				WebhookSecret: common.InlineSecureValue{
					Name: "test-secret",
				},
			},
			Status: provisioning.RepositoryStatus{
				Webhook: &provisioning.WebhookStatus{
					ID:  456,
					URL: "https://old.example.com/webhook",
				},
			},
		}

		mockRepo := &mockWebhookRepo{
			webhookURL: "https://example.com/webhook",
			setupError: fmt.Errorf("GitHub API error: 403 rate limit exceeded"),
		}

		ops := rc.reconcileWebhook(context.Background(), obj, mockRepo)

		// Should preserve existing webhook status on failure
		require.Len(t, ops, 2)

		// Check condition shows failure
		conditions := ops[0]["value"].([]metav1.Condition)
		assert.Equal(t, provisioning.ConditionTypeWebhookConfigured, conditions[0].Type)
		assert.Equal(t, metav1.ConditionFalse, conditions[0].Status)
		assert.Equal(t, provisioning.ReasonWebhookFailed, conditions[0].Reason)
		assert.Contains(t, conditions[0].Message, "Failed to configure webhook")
		assert.Contains(t, conditions[0].Message, "rate limit exceeded")

		// Check existing webhook status is preserved
		assert.Equal(t, "/status/webhook", ops[1]["path"])
		webhookStatus := ops[1]["value"].(*provisioning.WebhookStatus)
		assert.Equal(t, int64(456), webhookStatus.ID)
		assert.Equal(t, "https://old.example.com/webhook", webhookStatus.URL)
	})

	t.Run("webhook setup failure - no existing webhook status", func(t *testing.T) {
		rc := &RepositoryController{}
		obj := &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{
				Name:       "test-repo",
				Namespace:  "default",
				Generation: 1,
			},
			Secure: provisioning.SecureValues{
				WebhookSecret: common.InlineSecureValue{
					Name: "test-secret",
				},
			},
			Status: provisioning.RepositoryStatus{
				Webhook: nil, // No existing webhook
			},
		}

		mockRepo := &mockWebhookRepo{
			webhookURL: "https://example.com/webhook",
			setupError: fmt.Errorf("could not generate secret: random failed"),
		}

		ops := rc.reconcileWebhook(context.Background(), obj, mockRepo)

		// Should only have condition (no webhook status to preserve)
		require.Len(t, ops, 1)

		conditions := ops[0]["value"].([]metav1.Condition)
		assert.Equal(t, metav1.ConditionFalse, conditions[0].Status)
		assert.Equal(t, provisioning.ReasonWebhookFailed, conditions[0].Reason)
	})
}

func TestIsWebhookSecretReady(t *testing.T) {
	rc := &RepositoryController{}

	tests := []struct {
		name     string
		obj      *provisioning.Repository
		expected bool
	}{
		{
			name: "secret ready - has name",
			obj: &provisioning.Repository{
				Secure: provisioning.SecureValues{
					WebhookSecret: common.InlineSecureValue{
						Name: "webhook-secret-abc123",
					},
				},
			},
			expected: true,
		},
		{
			name: "secret ready - has create value (just generated)",
			obj: &provisioning.Repository{
				Secure: provisioning.SecureValues{
					WebhookSecret: common.InlineSecureValue{
						Create: "550e8400-e29b-41d4-a716-446655440000",
					},
				},
			},
			expected: true,
		},
		{
			name: "secret ready - has both name and create",
			obj: &provisioning.Repository{
				Secure: provisioning.SecureValues{
					WebhookSecret: common.InlineSecureValue{
						Name:   "webhook-secret-abc123",
						Create: "550e8400-e29b-41d4-a716-446655440000",
					},
				},
			},
			expected: true,
		},
		{
			name: "secret not ready - empty values",
			obj: &provisioning.Repository{
				Secure: provisioning.SecureValues{
					WebhookSecret: common.InlineSecureValue{},
				},
			},
			expected: false,
		},
		{
			name: "secret not ready - no secure values",
			obj: &provisioning.Repository{
				Secure: provisioning.SecureValues{},
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := rc.isWebhookSecretReady(tt.obj)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestShouldSetupWebhook(t *testing.T) {
	rc := &RepositoryController{}

	tests := []struct {
		name     string
		obj      *provisioning.Repository
		expected bool
	}{
		{
			name: "should setup - generation changed",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Generation: 2,
				},
				Status: provisioning.RepositoryStatus{
					ObservedGeneration: 1,
					Webhook: &provisioning.WebhookStatus{
						ID: 123,
					},
				},
			},
			expected: true,
		},
		{
			name: "should setup - webhook never configured",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Generation: 1,
				},
				Status: provisioning.RepositoryStatus{
					ObservedGeneration: 1,
					Webhook:            nil, // Never configured
				},
			},
			expected: true,
		},
		{
			name: "should setup - webhook condition is False",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Generation: 1,
				},
				Status: provisioning.RepositoryStatus{
					ObservedGeneration: 1,
					Webhook: &provisioning.WebhookStatus{
						ID: 123,
					},
					Conditions: []metav1.Condition{
						{
							Type:   provisioning.ConditionTypeWebhookConfigured,
							Status: metav1.ConditionFalse,
							Reason: provisioning.ReasonWebhookFailed,
						},
					},
				},
			},
			expected: true,
		},
		{
			name: "should setup - webhook condition is Unknown",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Generation: 1,
				},
				Status: provisioning.RepositoryStatus{
					ObservedGeneration: 1,
					Webhook: &provisioning.WebhookStatus{
						ID: 123,
					},
					Conditions: []metav1.Condition{
						{
							Type:   provisioning.ConditionTypeWebhookConfigured,
							Status: metav1.ConditionUnknown,
							Reason: provisioning.ReasonReconciling,
						},
					},
				},
			},
			expected: true,
		},
		{
			name: "should setup - no condition exists",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Generation: 1,
				},
				Status: provisioning.RepositoryStatus{
					ObservedGeneration: 1,
					Webhook: &provisioning.WebhookStatus{
						ID: 123,
					},
					Conditions: []metav1.Condition{}, // No conditions
				},
			},
			expected: true,
		},
		{
			name: "should NOT setup - webhook condition is True",
			obj: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Generation: 1,
				},
				Status: provisioning.RepositoryStatus{
					ObservedGeneration: 1,
					Webhook: &provisioning.WebhookStatus{
						ID: 123,
					},
					Conditions: []metav1.Condition{
						{
							Type:   provisioning.ConditionTypeWebhookConfigured,
							Status: metav1.ConditionTrue,
							Reason: provisioning.ReasonWebhookCreated,
						},
					},
				},
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := rc.shouldSetupWebhook(tt.obj)
			assert.Equal(t, tt.expected, result, tt.name)
		})
	}
}

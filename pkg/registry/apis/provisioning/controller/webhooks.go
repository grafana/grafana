package controller

import (
	"context"
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

// WebhookSetup interface defines webhook operations that repositories can implement
type WebhookSetup interface {
	// SetupWebhook creates or updates the webhook with the provider
	// Returns the webhook status and secret (if changed)
	SetupWebhook(ctx context.Context) (*repository.WebhookSetupResult, error)

	// DeleteWebhook removes the webhook from the provider
	DeleteWebhook(ctx context.Context) error

	// WebhookURL returns the URL where webhooks should be sent
	WebhookURL() string
}

// reconcileWebhook handles webhook setup and condition tracking
// This consolidates all webhook logic into a single reconciliation step
func (rc *RepositoryController) reconcileWebhook(
	ctx context.Context,
	obj *provisioning.Repository,
	repo repository.Repository,
) []map[string]interface{} {
	var condition metav1.Condition
	var patchOps []map[string]interface{}

	// Check if repository supports webhooks
	webhookRepo, supportsWebhooks := repo.(WebhookSetup)
	if !supportsWebhooks {
		condition = metav1.Condition{
			Type:               provisioning.ConditionTypeWebhookConfigured,
			Status:             metav1.ConditionTrue,
			ObservedGeneration: obj.Generation,
			LastTransitionTime: metav1.NewTime(time.Now()),
			Reason:             provisioning.ReasonNotRequired,
			Message:            "Webhook is not required for this repository type",
		}
		return buildConditionPatchOps(obj, condition)
	}

	// Check if webhook URL is configured
	webhookURL := webhookRepo.WebhookURL()
	if webhookURL == "" {
		condition = metav1.Condition{
			Type:               provisioning.ConditionTypeWebhookConfigured,
			Status:             metav1.ConditionTrue,
			ObservedGeneration: obj.Generation,
			LastTransitionTime: metav1.NewTime(time.Now()),
			Reason:             provisioning.ReasonNotRequired,
			Message:            "Webhook URL is not configured",
		}
		return buildConditionPatchOps(obj, condition)
	}

	// Check if webhook secret is ready
	if !rc.isWebhookSecretReady(obj) {
		condition = metav1.Condition{
			Type:               provisioning.ConditionTypeWebhookConfigured,
			Status:             metav1.ConditionFalse,
			ObservedGeneration: obj.Generation,
			LastTransitionTime: metav1.NewTime(time.Now()),
			Reason:             provisioning.ReasonSecretNotReady,
			Message:            "Waiting for webhook secret to be generated",
		}
		return buildConditionPatchOps(obj, condition)
	}

	// Setup or update webhook with provider (GitHub, GitLab, etc.)
	result, err := webhookRepo.SetupWebhook(ctx)
	if err != nil {
		condition = metav1.Condition{
			Type:               provisioning.ConditionTypeWebhookConfigured,
			Status:             metav1.ConditionFalse,
			ObservedGeneration: obj.Generation,
			LastTransitionTime: metav1.NewTime(time.Now()),
			Reason:             provisioning.ReasonWebhookFailed,
			Message:            fmt.Sprintf("Failed to configure webhook: %v", err),
		}

		// Even on failure, preserve any existing webhook status data
		patchOps = append(patchOps, buildConditionPatchOps(obj, condition)...)
		if obj.Status.Webhook != nil {
			patchOps = append(patchOps, map[string]interface{}{
				"op":    "replace",
				"path":  "/status/webhook",
				"value": obj.Status.Webhook,
			})
		}
		return patchOps
	}

	// Success - webhook is configured
	condition = metav1.Condition{
		Type:               provisioning.ConditionTypeWebhookConfigured,
		Status:             metav1.ConditionTrue,
		ObservedGeneration: obj.Generation,
		LastTransitionTime: metav1.NewTime(time.Now()),
		Reason:             provisioning.ReasonWebhookCreated,
		Message:            fmt.Sprintf("Webhook configured at %s", result.Status.URL),
	}

	// Return condition, webhook status, and secret (if changed) updates
	patchOps = append(patchOps, buildConditionPatchOps(obj, condition)...)
	patchOps = append(patchOps, map[string]interface{}{
		"op":    "replace",
		"path":  "/status/webhook",
		"value": result.Status,
	})

	// If secret was changed (created or rotated), update it
	if result.SecretChanged && result.Secret != "" {
		patchOps = append(patchOps, map[string]interface{}{
			"op":   "replace",
			"path": "/secure/webhookSecret",
			"value": map[string]string{
				"create": result.Secret,
			},
		})
	}

	return patchOps
}

// isWebhookSecretReady checks if the webhook secret has been generated
// In the future, this could check the SecretsConfigured condition instead
func (rc *RepositoryController) isWebhookSecretReady(obj *provisioning.Repository) bool {
	// If webhook secret is set in secure values, it's ready
	if !obj.Secure.WebhookSecret.IsZero() {
		return true
	}

	// Otherwise not ready
	return false
}

// shouldSetupWebhook determines if webhook setup should run during this reconciliation
// Webhook setup should run when:
// - Generation changed (spec updated)
// - Webhook status is nil (never configured)
// - Webhook condition is False or Unknown (previous attempt failed or in progress)
func (rc *RepositoryController) shouldSetupWebhook(obj *provisioning.Repository) bool {
	// Check if spec changed
	if obj.Generation != obj.Status.ObservedGeneration {
		return true
	}

	// Check if webhook was never configured
	if obj.Status.Webhook == nil {
		return true
	}

	// Check WebhookConfigured condition
	for _, cond := range obj.Status.Conditions {
		if cond.Type == provisioning.ConditionTypeWebhookConfigured {
			// If condition is False or Unknown, try again
			if cond.Status != metav1.ConditionTrue {
				return true
			}
			// If condition is True, no need to setup again
			return false
		}
	}

	// If no condition exists, should setup
	return true
}

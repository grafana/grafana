package controller

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strconv"
	"time"

	"github.com/google/uuid"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

func webhookOnCreate(ctx context.Context, repo repository.WebhookRepository) ([]map[string]any, error) {
	if len(repo.WebhookURL()) == 0 {
		return nil, nil
	}

	cfg := repo.Config()

	// The repository may be webhook-capable while spec.webhook.disabled is true so
	// a stale webhook can be cleaned up, but OnCreate must never register a new one.
	if cfg.Spec.Webhook != nil && cfg.Spec.Webhook.Disabled {
		logging.FromContext(ctx).Warn("webhook hooks invoked while spec.webhook.disabled is true; skipping")
		return nil, nil
	}

	if len(cfg.Spec.Workflows) == 0 {
		return nil, nil
	}

	hook, err := createWebhook(ctx, repo)
	if err != nil {
		return nil, err
	}
	return statusPatches(hook.GetID(), hook.GetURL(), hook.GetEvents(), hook.GetSecret()), nil
}

func webhookOnUpdate(ctx context.Context, repo repository.WebhookRepository) ([]map[string]any, error) {
	cfg := repo.Config()
	status := cfg.Status.Webhook

	// When disabled, remove any webhook that was registered before this flag was set.
	if cfg.Spec.Webhook != nil && cfg.Spec.Webhook.Disabled {
		if status != nil {
			if err := deleteWebhook(ctx, repo); err != nil {
				return nil, err
			}
			return clearStatusPatch(), nil
		}
		return nil, nil
	}

	if len(repo.WebhookURL()) == 0 {
		return nil, nil
	}

	if len(cfg.Spec.Workflows) == 0 {
		if status != nil {
			if err := deleteWebhook(ctx, repo); err != nil {
				return nil, err
			}
			return clearStatusPatch(), nil
		}
		return nil, nil
	}

	hook, changed, err := updateWebhook(ctx, repo)
	if err != nil || !changed {
		return nil, err
	}

	return statusPatches(hook.GetID(), hook.GetURL(), hook.GetEvents(), hook.GetSecret()), nil
}

func webhookOnDelete(ctx context.Context, repo repository.WebhookRepository) error {
	if repo.Config().Status.Webhook == nil {
		return nil
	}

	return deleteWebhook(ctx, repo)
}

func createWebhook(ctx context.Context, repo repository.WebhookRepository) (repository.WebhookConfig, error) {
	secret, err := uuid.NewRandom()
	if err != nil {
		return nil, fmt.Errorf("could not generate secret: %w", err)
	}

	hook, err := repo.WebhookClient().CreateWebhook(ctx, repo.WebhookURL(), repo.SubscribedEvents(), secret.String())
	if err != nil {
		return nil, err
	}

	// The provider does not return the secret, so we set it manually.
	hook.SetSecret(secret.String())

	logging.FromContext(ctx).Info("webhook created", "url", hook.GetURL(), "id", hook.GetID())
	return hook, nil
}

// updateWebhook checks if the webhook needs to be updated and updates it if necessary.
// if the webhook does not exist, it will create it.
func updateWebhook(ctx context.Context, repo repository.WebhookRepository) (repository.WebhookConfig, bool, error) {
	status := repo.Config().Status.Webhook
	if repository.GetID(status).IsEmpty() {
		hook, err := createWebhook(ctx, repo)
		if err != nil {
			return nil, false, err
		}
		return hook, true, nil
	}

	client := repo.WebhookClient()
	hook, err := client.GetWebhook(ctx, repository.GetID(status))
	switch {
	case errors.Is(err, repository.ErrFileNotFound):
		hook, err := createWebhook(ctx, repo)
		if err != nil {
			return nil, false, err
		}
		return hook, true, nil
	case err != nil:
		return nil, false, fmt.Errorf("get webhook: %w", err)
	}

	var mustUpdate bool

	if hook.GetURL() != repo.WebhookURL() {
		mustUpdate = true
		hook.SetURL(repo.WebhookURL())
	}

	events := hook.GetEvents()
	slices.Sort(events) // consistent order for comparison
	if !slices.Equal(events, repo.SubscribedEvents()) {
		mustUpdate = true
		hook.SetEvents(repo.SubscribedEvents())
	}

	if !mustUpdate {
		return hook, false, nil
	}

	// Something has changed in the webhook. Let's rotate the secret as well, so as to ensure we end up with a 100% correct webhook.
	secret, err := uuid.NewRandom()
	if err != nil {
		return nil, false, fmt.Errorf("could not generate secret: %w", err)
	}
	hook.SetSecret(secret.String())
	if err := client.EditWebhook(ctx, hook); err != nil {
		return nil, false, fmt.Errorf("edit webhook: %w", err)
	}

	return hook, true, nil
}

func deleteWebhook(ctx context.Context, repo repository.WebhookRepository) error {
	logger := logging.FromContext(ctx)
	status := repo.Config().Status.Webhook
	if status == nil {
		return fmt.Errorf("webhook not found")
	}

	id := repository.GetID(status)

	err := repo.WebhookClient().DeleteWebhook(ctx, id)
	if err != nil && !errors.Is(err, repository.ErrFileNotFound) && !errors.Is(err, repository.ErrUnauthorized) {
		return fmt.Errorf("delete webhook: %w", err)
	}
	if errors.Is(err, repository.ErrFileNotFound) {
		logger.Warn("webhook no longer exists", "url", status.URL, "id", id)
		return nil
	}
	if errors.Is(err, repository.ErrUnauthorized) {
		logger.Warn("webhook deletion failed. no longer authorized to delete this webhook", "url", status.URL, "id", id)
		return nil
	}

	logger.Info("webhook deleted", "url", status.URL, "id", id)
	return nil
}

// rotateWebhookSecret generates a new secret for the repository's webhook and
// updates it via the provider. If the remote webhook no longer exists, the
// Status.Webhook entry is cleared so the next reconcile re-creates it, and an
// error is returned so the failure is surfaced in logs.
func rotateWebhookSecret(ctx context.Context, repo repository.WebhookRepository) ([]map[string]any, error) {
	status := repo.Config().Status.Webhook
	if repository.GetID(status).IsEmpty() {
		return nil, nil
	}

	logger := logging.FromContext(ctx)
	logger.Info("rotating webhook secret", "trigger", "rotation")

	client := repo.WebhookClient()
	hook, err := client.GetWebhook(ctx, repository.GetID(status))
	switch {
	case errors.Is(err, repository.ErrFileNotFound):
		return clearStatusPatch(), fmt.Errorf("webhook %s not found on remote during rotation: %w", repository.GetID(status), err)
	case err != nil:
		return nil, fmt.Errorf("get webhook for rotation: %w", err)
	}

	secret, err := uuid.NewRandom()
	if err != nil {
		return nil, fmt.Errorf("generate rotation secret: %w", err)
	}
	hook.SetSecret(secret.String())

	if err := client.EditWebhook(ctx, hook); err != nil {
		return nil, fmt.Errorf("edit webhook during rotation: %w", err)
	}

	logger.Info("webhook secret rotated successfully")
	return statusPatches(hook.GetID(), hook.GetURL(), hook.GetEvents(), hook.GetSecret()), nil
}

// statusPatches returns the JSON patch operations that persist a freshly
// created or rotated provider webhook: its status and secret.
func statusPatches(id string, url string, events []string, secret string) []map[string]any {
	status := &provisioning.WebhookStatus{
		URL:              url,
		SubscribedEvents: events,
		LastRotated:      time.Now().UnixMilli(),
	}
	if numericID, err := strconv.ParseInt(id, 10, 64); err == nil {
		status.ID = numericID
	} else {
		status.UUID = id
	}
	return []map[string]any{
		{
			"op":    "replace",
			"path":  "/status/webhook",
			"value": status,
		},
		{
			"op":   "replace",
			"path": "/secure/webhookSecret",
			"value": map[string]string{
				"create": secret,
			},
		},
	}
}

// clearStatusPatch returns the JSON patch operation that clears the
// webhook status, e.g. after the remote webhook has been deleted.
func clearStatusPatch() []map[string]any {
	return []map[string]any{{
		"op":    "replace",
		"path":  "/status/webhook",
		"value": nil,
	}}
}

package repository

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// WebhookConfig is the provider-agnostic representation of a git provider webhook.
type WebhookConfig struct {
	// The ID of the webhook. Can be 0 on creation.
	ID int64
	// The events which this webhook shall contact the URL for.
	Events []string
	// Is the webhook enabled?
	Active bool
	// The URL the provider should contact on events.
	URL string
	// The content type the provider should send deliveries as.
	ContentType string
	// The secret used to authenticate webhook deliveries.
	// Empty when fetched from the provider, as it is never returned.
	Secret string
}

// WebhookManager implements the provider-agnostic webhook lifecycle (registration,
// reconciliation, secret rotation and teardown) on top of a ProviderClient. It also
// holds the shared webhook state (config, secret, incremental sync policy) that the
// provider-specific inbound handlers read.
type WebhookManager struct {
	client            ProviderClient
	config            *provisioning.Repository
	webhookURL        string
	events            []string
	secret            common.RawSecureValue
	incrementalPolicy IncrementalSyncPolicy
}

func NewWebhookManager(client ProviderClient, config *provisioning.Repository, webhookURL string, events []string, secret common.RawSecureValue, incrementalPolicy IncrementalSyncPolicy) *WebhookManager {
	return &WebhookManager{
		client:            client,
		config:            config,
		webhookURL:        webhookURL,
		events:            events,
		secret:            secret,
		incrementalPolicy: incrementalPolicy,
	}
}

func (m *WebhookManager) disabled() bool {
	return m.config.Spec.Webhook != nil && m.config.Spec.Webhook.Disabled
}

// Secret returns the webhook secret used to authenticate inbound deliveries.
func (m *WebhookManager) Secret() common.RawSecureValue {
	return m.secret
}

// CanUseIncrementalSync reports whether a push with the given changes may use an
// incremental sync instead of a full one.
func (m *WebhookManager) CanUseIncrementalSync(deletedPaths []string, totalChanges int) bool {
	return m.incrementalPolicy.CanUseIncrementalSync(deletedPaths, totalChanges)
}

// CommentPullRequest posts a comment to the given pull request.
func (m *WebhookManager) CommentPullRequest(ctx context.Context, prNumber int, comment string) error {
	return m.client.CreatePullRequestComment(ctx, prNumber, comment)
}

func (m *WebhookManager) OnCreate(ctx context.Context) ([]map[string]any, error) {
	if len(m.webhookURL) == 0 {
		return nil, nil
	}

	if m.disabled() {
		logging.FromContext(ctx).Warn("webhook hooks invoked while webhook is disabled; skipping")
		return nil, nil
	}

	if len(m.config.Spec.Workflows) == 0 {
		return nil, nil
	}

	hook, err := m.createWebhook(ctx)
	if err != nil {
		return nil, err
	}
	return statusPatches(hook.ID, hook.URL, hook.Events, hook.Secret), nil
}

func (m *WebhookManager) OnUpdate(ctx context.Context) ([]map[string]any, error) {
	if len(m.webhookURL) == 0 {
		return nil, nil
	}

	if m.disabled() {
		return nil, nil
	}

	if len(m.config.Spec.Workflows) == 0 {
		if m.config.Status.Webhook != nil {
			if err := m.deleteWebhook(ctx); err != nil {
				return nil, err
			}
			return clearStatusPatch(), nil
		}
		return nil, nil
	}

	hook, changed, err := m.updateWebhook(ctx)
	if err != nil || !changed {
		return nil, err
	}

	return statusPatches(hook.ID, hook.URL, hook.Events, hook.Secret), nil
}

func (m *WebhookManager) OnDelete(ctx context.Context) error {
	if m.config.Status.Webhook == nil {
		return nil
	}

	return m.deleteWebhook(ctx)
}

func (m *WebhookManager) RotateWebhookSecret(ctx context.Context) ([]map[string]any, error) {
	if m.config.Status.Webhook == nil || m.config.Status.Webhook.ID == 0 {
		return nil, nil
	}

	logger := logging.FromContext(ctx)
	logger.Info("rotating webhook secret", "trigger", "rotation")

	hook, err := m.client.GetWebhook(ctx, m.config.Status.Webhook.ID)
	switch {
	case errors.Is(err, ErrFileNotFound):
		return clearStatusPatch(), fmt.Errorf("webhook %d not found on remote during rotation: %w", m.config.Status.Webhook.ID, err)
	case err != nil:
		return nil, fmt.Errorf("get webhook for rotation: %w", err)
	}

	secret, err := uuid.NewRandom()
	if err != nil {
		return nil, fmt.Errorf("generate rotation secret: %w", err)
	}
	hook.Secret = secret.String()

	if err := m.client.EditWebhook(ctx, hook); err != nil {
		return nil, fmt.Errorf("edit webhook during rotation: %w", err)
	}

	logger.Info("webhook secret rotated successfully")
	return statusPatches(hook.ID, hook.URL, hook.Events, hook.Secret), nil
}

func (m *WebhookManager) createWebhook(ctx context.Context) (WebhookConfig, error) {
	secret, err := uuid.NewRandom()
	if err != nil {
		return WebhookConfig{}, fmt.Errorf("could not generate secret: %w", err)
	}

	cfg := WebhookConfig{
		URL:         m.webhookURL,
		Secret:      secret.String(),
		ContentType: "json",
		Events:      m.events,
		Active:      true,
	}

	hook, err := m.client.CreateWebhook(ctx, cfg)
	if err != nil {
		return WebhookConfig{}, err
	}

	// The provider does not return the secret, so we set it manually.
	hook.Secret = cfg.Secret

	logging.FromContext(ctx).Info("webhook created", "url", cfg.URL, "id", hook.ID)
	return hook, nil
}

// updateWebhook checks if the webhook needs to be updated and updates it if necessary.
// if the webhook does not exist, it will create it.
func (m *WebhookManager) updateWebhook(ctx context.Context) (WebhookConfig, bool, error) {
	if m.config.Status.Webhook == nil || m.config.Status.Webhook.ID == 0 {
		hook, err := m.createWebhook(ctx)
		if err != nil {
			return WebhookConfig{}, false, err
		}
		return hook, true, nil
	}

	hook, err := m.client.GetWebhook(ctx, m.config.Status.Webhook.ID)
	switch {
	case errors.Is(err, ErrFileNotFound):
		hook, err := m.createWebhook(ctx)
		if err != nil {
			return WebhookConfig{}, false, err
		}
		return hook, true, nil
	case err != nil:
		return WebhookConfig{}, false, fmt.Errorf("get webhook: %w", err)
	}

	var mustUpdate bool

	if hook.URL != m.webhookURL {
		mustUpdate = true
		hook.URL = m.webhookURL
	}

	slices.Sort(hook.Events) // consistent order for comparison
	if !slices.Equal(hook.Events, m.events) {
		mustUpdate = true
		hook.Events = m.events
	}

	if !mustUpdate {
		return hook, false, nil
	}

	// Something has changed in the webhook. Let's rotate the secret as well, so as to ensure we end up with a 100% correct webhook.
	secret, err := uuid.NewRandom()
	if err != nil {
		return WebhookConfig{}, false, fmt.Errorf("could not generate secret: %w", err)
	}
	hook.Secret = secret.String()
	if err := m.client.EditWebhook(ctx, hook); err != nil {
		return WebhookConfig{}, false, fmt.Errorf("edit webhook: %w", err)
	}

	return hook, true, nil
}

func (m *WebhookManager) deleteWebhook(ctx context.Context) error {
	logger := logging.FromContext(ctx)
	if m.config.Status.Webhook == nil {
		return fmt.Errorf("webhook not found")
	}

	id := m.config.Status.Webhook.ID

	err := m.client.DeleteWebhook(ctx, id)
	if err != nil && !errors.Is(err, ErrFileNotFound) && !errors.Is(err, ErrUnauthorized) {
		return fmt.Errorf("delete webhook: %w", err)
	}
	if errors.Is(err, ErrFileNotFound) {
		logger.Warn("webhook no longer exists", "url", m.config.Status.Webhook.URL, "id", id)
		return nil
	}
	if errors.Is(err, ErrUnauthorized) {
		logger.Warn("webhook deletion failed. no longer authorized to delete this webhook", "url", m.config.Status.Webhook.URL, "id", id)
		return nil
	}

	logger.Info("webhook deleted", "url", m.config.Status.Webhook.URL, "id", id)
	return nil
}

// statusPatches returns the JSON patch operations that persist a freshly
// created or rotated provider webhook: its status and secret.
func statusPatches(id int64, url string, events []string, secret string) []map[string]any {
	return []map[string]any{
		{
			"op":   "replace",
			"path": "/status/webhook",
			"value": &provisioning.WebhookStatus{
				ID:               id,
				URL:              url,
				SubscribedEvents: events,
				LastRotated:      time.Now().UnixMilli(),
			},
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

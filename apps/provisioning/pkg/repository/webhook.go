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
)

// WebhookEventType classifies a normalized inbound webhook delivery.
type WebhookEventType int

const (
	WebhookEventUnsupported WebhookEventType = iota
	WebhookEventPing
	WebhookEventPush
	WebhookEventPullRequest
)

type PullRequestAction string

const (
	PullRequestActionOpened   PullRequestAction = "opened"
	PullRequestActionReopened PullRequestAction = "reopened"
	PullRequestActionUpdated  PullRequestAction = "updated"
)

// WebhookEvent is the provider-agnostic form of an inbound webhook delivery.
// A provider's ProcessRequest normalizes its native event into this shape.
type WebhookEvent struct {
	Type         WebhookEventType
	RepoSlug     string
	Branch       string
	DeletedPaths []string
	TotalChanges int
	Action       PullRequestAction
	PRNumber     int
	PRURL        string
	SourceRef    string
	Hash         string
	Message      string
	// ReplayKey deduplicates retried deliveries. The provider sets it to its
	// validated request signature; an empty key disables the replay check for
	// that event.
	ReplayKey string
}

// WebhookManager implements the provider-agnostic webhook lifecycle:
// registration, reconciliation, secret rotation and teardown on top of a
// WebhookClient.
type WebhookManager struct {
	client          WebhookClient
	status          *provisioning.WebhookStatus
	webhookURL      string
	events          []string
	webhookDisabled bool
	workflows       []provisioning.Workflow
}

func NewWebhookManager(client WebhookClient, status *provisioning.WebhookStatus, webhookURL string, events []string, webhookDisabled bool, workflows []provisioning.Workflow) *WebhookManager {
	return &WebhookManager{
		client:          client,
		status:          status,
		webhookURL:      webhookURL,
		events:          events,
		webhookDisabled: webhookDisabled,
		workflows:       workflows,
	}
}

func (m *WebhookManager) OnCreate(ctx context.Context) ([]map[string]any, error) {
	if len(m.webhookURL) == 0 {
		return nil, nil
	}

	// The manager may be constructed for a disabled repository when a stale
	// webhook needs to be cleaned up, but OnCreate must never register a new one.
	if m.webhookDisabled {
		logging.FromContext(ctx).Warn("webhook hooks invoked while spec.webhook.disabled is true; skipping")
		return nil, nil
	}

	if len(m.workflows) == 0 {
		return nil, nil
	}

	hook, err := m.createWebhook(ctx)
	if err != nil {
		return nil, err
	}
	return statusPatches(hook.GetID(), hook.GetURL(), hook.GetEvents(), hook.GetSecret()), nil
}

func (m *WebhookManager) OnUpdate(ctx context.Context) ([]map[string]any, error) {
	// When disabled, remove any webhook that was registered before this flag was set.
	if m.webhookDisabled {
		if m.status != nil {
			if err := m.deleteWebhook(ctx); err != nil {
				return nil, err
			}
			return clearStatusPatch(), nil
		}
		return nil, nil
	}

	if len(m.webhookURL) == 0 {
		return nil, nil
	}

	if len(m.workflows) == 0 {
		if m.status != nil {
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

	return statusPatches(hook.GetID(), hook.GetURL(), hook.GetEvents(), hook.GetSecret()), nil
}

func (m *WebhookManager) OnDelete(ctx context.Context) error {
	if m.status == nil {
		return nil
	}

	return m.deleteWebhook(ctx)
}

// RotateWebhookSecret generates a new secret for the repository's webhook and
// updates it via the provider. If the remote webhook no longer exists, the
// Status.Webhook entry is cleared so the next reconcile re-creates it, and an
// error is returned so the failure is surfaced in logs.
func (m *WebhookManager) RotateWebhookSecret(ctx context.Context) ([]map[string]any, error) {
	if m.status == nil || m.status.ID == 0 {
		return nil, nil
	}

	logger := logging.FromContext(ctx)
	logger.Info("rotating webhook secret", "trigger", "rotation")

	hook, err := m.client.GetWebhook(ctx, m.status.ID)
	switch {
	case errors.Is(err, ErrFileNotFound):
		return clearStatusPatch(), fmt.Errorf("webhook %d not found on remote during rotation: %w", m.status.ID, err)
	case err != nil:
		return nil, fmt.Errorf("get webhook for rotation: %w", err)
	}

	secret, err := uuid.NewRandom()
	if err != nil {
		return nil, fmt.Errorf("generate rotation secret: %w", err)
	}
	hook.SetSecret(secret.String())

	if err := m.client.EditWebhook(ctx, hook); err != nil {
		return nil, fmt.Errorf("edit webhook during rotation: %w", err)
	}

	logger.Info("webhook secret rotated successfully")
	return statusPatches(hook.GetID(), hook.GetURL(), hook.GetEvents(), hook.GetSecret()), nil
}

func (m *WebhookManager) createWebhook(ctx context.Context) (WebhookConfig, error) {
	secret, err := uuid.NewRandom()
	if err != nil {
		return nil, fmt.Errorf("could not generate secret: %w", err)
	}

	hook, err := m.client.CreateWebhook(ctx, m.webhookURL, m.events, secret.String())
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
func (m *WebhookManager) updateWebhook(ctx context.Context) (WebhookConfig, bool, error) {
	if m.status == nil || m.status.ID == 0 {
		hook, err := m.createWebhook(ctx)
		if err != nil {
			return nil, false, err
		}
		return hook, true, nil
	}

	hook, err := m.client.GetWebhook(ctx, m.status.ID)
	switch {
	case errors.Is(err, ErrFileNotFound):
		hook, err := m.createWebhook(ctx)
		if err != nil {
			return nil, false, err
		}
		return hook, true, nil
	case err != nil:
		return nil, false, fmt.Errorf("get webhook: %w", err)
	}

	var mustUpdate bool

	if hook.GetURL() != m.webhookURL {
		mustUpdate = true
		hook.SetURL(m.webhookURL)
	}

	events := hook.GetEvents()
	slices.Sort(events) // consistent order for comparison
	if !slices.Equal(events, m.events) {
		mustUpdate = true
		hook.SetEvents(m.events)
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
	if err := m.client.EditWebhook(ctx, hook); err != nil {
		return nil, false, fmt.Errorf("edit webhook: %w", err)
	}

	return hook, true, nil
}

func (m *WebhookManager) deleteWebhook(ctx context.Context) error {
	logger := logging.FromContext(ctx)
	if m.status == nil {
		return fmt.Errorf("webhook not found")
	}

	id := m.status.ID

	err := m.client.DeleteWebhook(ctx, id)
	if err != nil && !errors.Is(err, ErrFileNotFound) && !errors.Is(err, ErrUnauthorized) {
		return fmt.Errorf("delete webhook: %w", err)
	}
	if errors.Is(err, ErrFileNotFound) {
		logger.Warn("webhook no longer exists", "url", m.status.URL, "id", id)
		return nil
	}
	if errors.Is(err, ErrUnauthorized) {
		logger.Warn("webhook deletion failed. no longer authorized to delete this webhook", "url", m.status.URL, "id", id)
		return nil
	}

	logger.Info("webhook deleted", "url", m.status.URL, "id", id)
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

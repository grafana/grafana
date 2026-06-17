package repository

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"time"

	"github.com/google/uuid"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// WebhookEventType classifies a normalized inbound webhook delivery.
type WebhookEventType int

const (
	WebhookEventUnsupported WebhookEventType = iota
	WebhookEventPing
	WebhookEventPush
	WebhookEventPullRequest
)

const (
	pullRequestActionOpened   = "opened"
	pullRequestActionReopened = "reopened"
	pullRequestActionUpdated  = "updated"
)

// WebhookEvent is the provider-agnostic form of an inbound webhook delivery.
// A provider's WebhookParser normalizes its native event into this shape.
type WebhookEvent struct {
	Type WebhookEventType
	// RepoSlug identifies the repository the event came from, for the
	// mismatch check (e.g. "owner/repo" or a project path).
	RepoSlug string
	// Branch is the pushed branch, or a pull request's target branch.
	Branch string
	// Push fields.
	DeletedPaths []string
	TotalChanges int
	// Pull request fields. Action is normalized to one of the
	// pullRequestAction* values for watched actions.
	Action    string
	PRNumber  int
	PRURL     string
	SourceRef string
	Hash      string
	// Message carries a human-readable note for ping/unsupported events.
	Message string
}

func watchedPullRequestAction(action string) bool {
	switch action {
	case pullRequestActionOpened, pullRequestActionReopened, pullRequestActionUpdated:
		return true
	default:
		return false
	}
}

// WebhookParser authenticates and normalizes a provider's inbound webhook
// deliveries. It is the only provider-specific part of the inbound flow.
type WebhookParser interface {
	// Verify authenticates the request against the secret and returns the raw
	// payload plus a key for replay detection ("" disables replay).
	Verify(req *http.Request, secret common.RawSecureValue) (payload []byte, replayKey string, err error)
	// Parse normalizes a verified delivery into a provider-agnostic event.
	Parse(req *http.Request, payload []byte) (WebhookEvent, error)
}

// Webhook is the provider-agnostic representation of a git provider webhook.
type Webhook[E any] struct {
	// The ID of the webhook. Can be 0 on creation.
	ID int64
	// The events which this webhook shall contact the URL for.
	Events []string
	// The URL the provider should contact on events.
	URL string
	// The secret used to authenticate webhook deliveries.
	// Empty when fetched from the provider, as it is never returned.
	Secret string
	// Extra holds provider-specific webhook fields, passed through untouched
	// by the manager between the provider client's reads and writes.
	Extra E
}

// WebhookManager implements the provider-agnostic webhook lifecycle (registration,
// reconciliation, secret rotation and teardown) on top of a ProviderClient. It also
// holds the shared webhook state (config, secret, incremental sync policy) that the
// provider-specific inbound handlers read.
type WebhookManager[E any] struct {
	client            WebhookClient[E]
	parser            WebhookParser
	replay            *ReplayCache
	config            *provisioning.Repository
	webhookURL        string
	repoSlug          string
	branch            string
	events            []string
	secret            common.RawSecureValue
	incrementalPolicy IncrementalSyncPolicy
}

func NewWebhookManager[E any](client WebhookClient[E], parser WebhookParser, replay *ReplayCache, config *provisioning.Repository, webhookURL, repoSlug, branch string, events []string, secret common.RawSecureValue, incrementalPolicy IncrementalSyncPolicy) *WebhookManager[E] {
	return &WebhookManager[E]{
		client:            client,
		parser:            parser,
		replay:            replay,
		config:            config,
		webhookURL:        webhookURL,
		repoSlug:          repoSlug,
		branch:            branch,
		events:            events,
		secret:            secret,
		incrementalPolicy: incrementalPolicy,
	}
}

// Webhook authenticates, de-duplicates and dispatches an inbound webhook
// delivery, producing the sync/pull-request job response. Providers supply the
// authentication and event normalization via the WebhookParser.
func (m *WebhookManager[E]) Webhook(ctx context.Context, req *http.Request) (*provisioning.WebhookResponse, error) {
	if m.config.Status.Webhook == nil {
		return nil, fmt.Errorf("unexpected webhook request")
	}
	if m.secret.IsZero() {
		return nil, fmt.Errorf("missing webhook secret")
	}

	payload, replayKey, err := m.parser.Verify(req, m.secret)
	if err != nil {
		return nil, apierrors.NewUnauthorized("invalid signature")
	}

	// Silently drop a delivery whose replay key we have already processed
	// within the cache TTL — returning a generic 200 avoids confirming to a
	// replay attacker that the captured payload was previously processed.
	if m.replay.seenOrAdd(replayKey) {
		logging.FromContext(ctx).Debug("dropping replayed webhook delivery")
		return &provisioning.WebhookResponse{Code: http.StatusOK, Message: "ok"}, nil
	}

	event, err := m.parser.Parse(req, payload)
	if err != nil {
		return nil, err
	}

	switch event.Type {
	case WebhookEventPush:
		if event.RepoSlug != m.repoSlug {
			return nil, ErrRepositoryMismatch
		}
		if !m.config.Spec.Sync.Enabled {
			return &provisioning.WebhookResponse{Code: http.StatusOK}, nil
		}
		// Skip silently if the event is not for the configured branch, as the
		// webhook cannot be configured to only publish events for one branch.
		if event.Branch != m.branch {
			return &provisioning.WebhookResponse{Code: http.StatusOK}, nil
		}
		return m.PushSyncResponse(event.DeletedPaths, event.TotalChanges), nil
	case WebhookEventPullRequest:
		if event.RepoSlug != m.repoSlug {
			return nil, ErrRepositoryMismatch
		}
		if event.Branch != m.branch {
			return &provisioning.WebhookResponse{
				Code:    http.StatusOK,
				Message: fmt.Sprintf("ignoring pull request event as %s is not the configured branch", event.Branch),
			}, nil
		}
		if !watchedPullRequestAction(event.Action) {
			return &provisioning.WebhookResponse{
				Code:    http.StatusOK,
				Message: fmt.Sprintf("ignore pull request event: %s", event.Action),
			}, nil
		}
		return m.pullRequestResponse(event), nil
	case WebhookEventPing:
		return &provisioning.WebhookResponse{Code: http.StatusOK, Message: "ping received"}, nil
	default:
		return &provisioning.WebhookResponse{Code: http.StatusNotImplemented, Message: event.Message}, nil
	}
}

func (m *WebhookManager[E]) pullRequestResponse(event WebhookEvent) *provisioning.WebhookResponse {
	return &provisioning.WebhookResponse{
		Code:    http.StatusAccepted,
		Message: fmt.Sprintf("pull request: %s", event.Action),
		Job: &provisioning.JobSpec{
			Repository: m.config.GetName(),
			Action:     provisioning.JobActionPullRequest,
			PullRequest: &provisioning.PullRequestJobOptions{
				URL:  event.PRURL,
				PR:   event.PRNumber,
				Ref:  event.SourceRef,
				Hash: event.Hash,
			},
		},
	}
}

func (m *WebhookManager[E]) OnCreate(ctx context.Context) ([]map[string]any, error) {
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

func (m *WebhookManager[E]) OnUpdate(ctx context.Context) ([]map[string]any, error) {
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

func (m *WebhookManager[E]) OnDelete(ctx context.Context) error {
	if m.config.Status.Webhook == nil {
		return nil
	}

	return m.deleteWebhook(ctx)
}

func (m *WebhookManager[E]) RotateWebhookSecret(ctx context.Context) ([]map[string]any, error) {
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

// PushSyncResponse builds the webhook response that enqueues a sync job for a
// push, choosing an incremental or full sync from the given changes.
func (m *WebhookManager[E]) PushSyncResponse(deletedPaths []string, totalChanges int) *provisioning.WebhookResponse {
	return &provisioning.WebhookResponse{
		Code: http.StatusAccepted,
		Job: &provisioning.JobSpec{
			Repository: m.config.GetName(),
			Action:     provisioning.JobActionPull,
			Pull: &provisioning.SyncJobOptions{
				Incremental: m.incrementalPolicy.CanUseIncrementalSync(deletedPaths, totalChanges),
			},
		},
	}
}

func (m *WebhookManager[E]) createWebhook(ctx context.Context) (Webhook[E], error) {
	secret, err := uuid.NewRandom()
	if err != nil {
		return Webhook[E]{}, fmt.Errorf("could not generate secret: %w", err)
	}

	hook, err := m.client.CreateWebhook(ctx, Webhook[E]{
		URL:    m.webhookURL,
		Secret: secret.String(),
		Events: m.events,
	})
	if err != nil {
		return Webhook[E]{}, err
	}

	// The provider does not return the secret, so we set it manually.
	hook.Secret = secret.String()

	logging.FromContext(ctx).Info("webhook created", "url", hook.URL, "id", hook.ID)
	return hook, nil
}

// updateWebhook checks if the webhook needs to be updated and updates it if necessary.
// if the webhook does not exist, it will create it.
func (m *WebhookManager[E]) updateWebhook(ctx context.Context) (Webhook[E], bool, error) {
	if m.config.Status.Webhook == nil || m.config.Status.Webhook.ID == 0 {
		hook, err := m.createWebhook(ctx)
		if err != nil {
			return Webhook[E]{}, false, err
		}
		return hook, true, nil
	}

	hook, err := m.client.GetWebhook(ctx, m.config.Status.Webhook.ID)
	switch {
	case errors.Is(err, ErrFileNotFound):
		hook, err := m.createWebhook(ctx)
		if err != nil {
			return Webhook[E]{}, false, err
		}
		return hook, true, nil
	case err != nil:
		return Webhook[E]{}, false, fmt.Errorf("get webhook: %w", err)
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
		return Webhook[E]{}, false, fmt.Errorf("could not generate secret: %w", err)
	}
	hook.Secret = secret.String()
	if err := m.client.EditWebhook(ctx, hook); err != nil {
		return Webhook[E]{}, false, fmt.Errorf("edit webhook: %w", err)
	}

	return hook, true, nil
}

func (m *WebhookManager[E]) deleteWebhook(ctx context.Context) error {
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

func (m *WebhookManager[E]) disabled() bool {
	return m.config.Spec.Webhook != nil && m.config.Spec.Webhook.Disabled
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

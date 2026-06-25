package github

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/google/go-github/v82/github"
	"github.com/google/uuid"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

var subscribedEvents = []string{"pull_request", "push"} // same order as slices.Sort()

type GithubWebhookRepository interface {
	GithubRepository
	repository.Hooks
	repository.WebhookRepository
}

var _ repository.WebhookRepository = (*githubWebhookRepository)(nil)

type githubWebhookRepository struct {
	GithubRepository
	config     *provisioning.Repository
	owner      string
	repo       string
	gh         Client
	webhookURL string
	secret     common.RawSecureValue
}

func NewGithubWebhookRepository(
	basic GithubRepository,
	webhookURL string,
	secret common.RawSecureValue,
	incrementalPolicy repository.IncrementalSyncPolicy,
) GithubWebhookRepository {
	cfg := basic.Config()
	r := &githubWebhookRepository{
		GithubRepository: basic,
		config:           cfg,
		owner:            basic.Owner(),
		repo:             basic.Repo(),
		gh:               basic.Client(),
		webhookURL:       webhookURL,
		secret:           secret,
	}
	return r
}

func (r *githubWebhookRepository) Slug() string {
	return fmt.Sprintf("%s/%s", r.owner, r.repo)
}

func (r *githubWebhookRepository) Branch() string {
	return r.config.Spec.GitHub.Branch
}

func (r *githubWebhookRepository) ProcessRequest(ctx context.Context, req *http.Request) (repository.WebhookEvent, error) {
	if r.secret.IsZero() {
		return repository.WebhookEvent{}, fmt.Errorf("missing webhook secret")
	}

	payload, err := github.ValidatePayload(req, []byte(r.secret))
	if err != nil {
		return repository.WebhookEvent{}, apierrors.NewUnauthorized("invalid signature")
	}

	// Replay key: the validated signature, not the X-GitHub-Delivery header.
	// GitHub computes the HMAC over the request body only, so the delivery ID is
	// unauthenticated — an attacker replaying a captured (body, signature) could
	// pick a fresh delivery ID and slip past a delivery-ID cache. The signature,
	// by contrast, is bound to both the signed body and the repository's unique
	// secret. The dispatcher drops deliveries whose key it has already seen.
	signature := req.Header.Get(github.SHA256SignatureHeader)
	if signature == "" {
		signature = req.Header.Get(github.SHA1SignatureHeader)
	}

	event, err := github.ParseWebHook(github.WebHookType(req), payload)
	if err != nil {
		return repository.WebhookEvent{}, apierrors.NewBadRequest("invalid payload")
	}

	switch event := event.(type) {
	case *github.PushEvent:
		if event.GetRepo() == nil {
			return repository.WebhookEvent{}, fmt.Errorf("missing repository in push event")
		}
		var deletedPaths []string
		var totalChanges int
		for _, change := range event.GetCommits() {
			totalChanges += len(change.Added) + len(change.Modified) + len(change.Removed)
			deletedPaths = append(deletedPaths, change.Removed...)
		}
		return repository.WebhookEvent{
			Type:         repository.WebhookEventPush,
			ReplayKey:    signature,
			RepoSlug:     event.GetRepo().GetFullName(),
			Branch:       strings.TrimPrefix(event.GetRef(), "refs/heads/"),
			DeletedPaths: deletedPaths,
			TotalChanges: totalChanges,
		}, nil
	case *github.PullRequestEvent:
		if event.GetRepo() == nil {
			return repository.WebhookEvent{}, fmt.Errorf("missing repository in pull request event")
		}
		pr := event.GetPullRequest()
		if pr == nil {
			return repository.WebhookEvent{}, fmt.Errorf("expected PR in event")
		}
		return repository.WebhookEvent{
			Type:      repository.WebhookEventPullRequest,
			ReplayKey: signature,
			RepoSlug:  event.GetRepo().GetFullName(),
			Branch:    pr.GetBase().GetRef(),
			Action:    normalizeGitHubAction(event.GetAction()),
			PRNumber:  pr.GetNumber(),
			PRURL:     pr.GetHTMLURL(),
			SourceRef: pr.GetHead().GetRef(),
			Hash:      pr.GetHead().GetSHA(),
		}, nil
	case *github.PingEvent:
		return repository.WebhookEvent{Type: repository.WebhookEventPing, ReplayKey: signature}, nil
	default:
		return repository.WebhookEvent{
			Type:      repository.WebhookEventUnsupported,
			ReplayKey: signature,
			Message:   fmt.Sprintf("unsupported messageType: %s", github.WebHookType(req)),
		}, nil
	}
}

func normalizeGitHubAction(action string) repository.PullRequestAction {
	if action == "synchronize" {
		return repository.PullRequestActionUpdated
	}
	return repository.PullRequestAction(action)
}

// CommentPullRequest adds a comment to a pull request.
func (r *githubWebhookRepository) CommentPullRequest(ctx context.Context, prNumber int, comment string) error {
	ctx, _ = r.logger(ctx, "")
	return r.gh.CreatePullRequestComment(ctx, prNumber, comment)
}

func (r *githubWebhookRepository) createWebhook(ctx context.Context) (WebhookConfig, error) {
	secret, err := uuid.NewRandom()
	if err != nil {
		return WebhookConfig{}, fmt.Errorf("could not generate secret: %w", err)
	}

	cfg := WebhookConfig{
		URL:         r.webhookURL,
		Secret:      secret.String(),
		ContentType: "json",
		Events:      subscribedEvents,
		Active:      true,
	}

	hook, err := r.gh.CreateWebhook(ctx, cfg)
	if err != nil {
		return WebhookConfig{}, err
	}

	// HACK: GitHub does not return the secret, so we need to update it manually
	hook.Secret = cfg.Secret

	logging.FromContext(ctx).Info("webhook created", "url", cfg.URL, "id", hook.ID)
	return hook, nil
}

// updateWebhook checks if the webhook needs to be updated and updates it if necessary.
// if the webhook does not exist, it will create it.
func (r *githubWebhookRepository) updateWebhook(ctx context.Context) (WebhookConfig, bool, error) {
	if r.config.Status.Webhook == nil || r.config.Status.Webhook.ID == 0 {
		hook, err := r.createWebhook(ctx)
		if err != nil {
			return WebhookConfig{}, false, err
		}
		return hook, true, nil
	}

	hook, err := r.gh.GetWebhook(ctx, r.config.Status.Webhook.ID)
	switch {
	case errors.Is(err, repository.ErrFileNotFound):
		hook, err := r.createWebhook(ctx)
		if err != nil {
			return WebhookConfig{}, false, err
		}
		return hook, true, nil
	case err != nil:
		return WebhookConfig{}, false, fmt.Errorf("get webhook: %w", err)
	}

	var mustUpdate bool

	if hook.URL != r.webhookURL {
		mustUpdate = true
		hook.URL = r.webhookURL
	}

	slices.Sort(hook.Events) // consistent order for comparison
	if !slices.Equal(hook.Events, subscribedEvents) {
		mustUpdate = true
		hook.Events = subscribedEvents
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
	if err := r.gh.EditWebhook(ctx, hook); err != nil {
		return WebhookConfig{}, false, fmt.Errorf("edit webhook: %w", err)
	}

	return hook, true, nil
}

func (r *githubWebhookRepository) deleteWebhook(ctx context.Context) error {
	logger := logging.FromContext(ctx)
	if r.config.Status.Webhook == nil {
		return fmt.Errorf("webhook not found")
	}

	id := r.config.Status.Webhook.ID

	err := r.gh.DeleteWebhook(ctx, id)
	if err != nil && !errors.Is(err, repository.ErrFileNotFound) && !errors.Is(err, repository.ErrUnauthorized) {
		return fmt.Errorf("delete webhook: %w", err)
	}
	if errors.Is(err, repository.ErrFileNotFound) {
		logger.Warn("webhook no longer exists", "url", r.config.Status.Webhook.URL, "id", id)
		return nil
	}
	if errors.Is(err, repository.ErrUnauthorized) {
		logger.Warn("webhook deletion failed. no longer authorized to delete this webhook", "url", r.config.Status.Webhook.URL, "id", id)
		return nil
	}

	logger.Info("webhook deleted", "url", r.config.Status.Webhook.URL, "id", id)
	return nil
}

func (r *githubWebhookRepository) OnCreate(ctx context.Context) ([]map[string]interface{}, error) {
	if len(r.webhookURL) == 0 {
		return nil, nil
	}

	// extra.Build may wrap a disabled repository with GithubWebhookRepository when a stale
	// webhook needs to be cleaned up, but OnCreate should never register a new one.
	if r.config.Spec.Webhook != nil && r.config.Spec.Webhook.Disabled {
		logging.FromContext(ctx).Warn("webhook hooks invoked while spec.webhook.disabled is true; skipping")
		return nil, nil
	}

	if len(r.config.Spec.Workflows) == 0 {
		return nil, nil
	}

	ctx, _ = r.logger(ctx, "")
	hook, err := r.createWebhook(ctx)
	if err != nil {
		return nil, err
	}
	return []map[string]interface{}{
		{
			"op":   "replace",
			"path": "/status/webhook",
			"value": &provisioning.WebhookStatus{
				ID:               hook.ID,
				URL:              hook.URL,
				SubscribedEvents: hook.Events,
				LastRotated:      time.Now().UnixMilli(),
			},
		},
		{
			"op":   "replace",
			"path": "/secure/webhookSecret",
			"value": map[string]string{
				"create": hook.Secret,
			},
		},
	}, nil
}

func (r *githubWebhookRepository) OnUpdate(ctx context.Context) ([]map[string]interface{}, error) {
	// When disabled, remove any webhook that was registered before this flag was set.
	if r.config.Spec.Webhook != nil && r.config.Spec.Webhook.Disabled {
		if r.config.Status.Webhook != nil {
			ctx, _ = r.logger(ctx, "")
			if err := r.deleteWebhook(ctx); err != nil {
				return nil, err
			}
			return []map[string]any{{
				"op":    "replace",
				"path":  "/status/webhook",
				"value": nil,
			}}, nil
		}
		return nil, nil
	}

	if len(r.webhookURL) == 0 {
		return nil, nil
	}

	if len(r.config.Spec.Workflows) == 0 {
		if r.config.Status.Webhook != nil {
			ctx, _ = r.logger(ctx, "")
			if err := r.deleteWebhook(ctx); err != nil {
				return nil, err
			}
			return []map[string]any{{
				"op":    "replace",
				"path":  "/status/webhook",
				"value": nil,
			}}, nil
		}
		return nil, nil
	}

	ctx, _ = r.logger(ctx, "")
	hook, changed, err := r.updateWebhook(ctx)
	if err != nil || !changed {
		return nil, err
	}

	// update the webhook and secret
	return []map[string]any{{
		"op":   "replace",
		"path": "/status/webhook",
		"value": &provisioning.WebhookStatus{
			ID:               hook.ID,
			URL:              hook.URL,
			SubscribedEvents: hook.Events,
			LastRotated:      time.Now().UnixMilli(),
		},
	}, {
		"op":   "replace",
		"path": "/secure/webhookSecret",
		"value": map[string]string{
			"create": hook.Secret,
		},
	}}, nil
}

func (r *githubWebhookRepository) OnDelete(ctx context.Context) error {
	if r.config.Status.Webhook == nil {
		return nil
	}

	return r.deleteWebhook(ctx)
}

// RotateWebhookSecret generates a new HMAC secret for the repository's GitHub
// webhook and updates it via the API. If the remote webhook no longer exists
// (404), the Status.Webhook entry is cleared so the next reconcile re-creates
// it via processHooks, and an error is returned so the failure is surfaced in
// logs.
func (r *githubWebhookRepository) RotateWebhookSecret(ctx context.Context) ([]map[string]any, error) {
	if r.config.Status.Webhook == nil || r.config.Status.Webhook.ID == 0 {
		return nil, nil
	}

	ctx, logger := r.logger(ctx, "")
	logger.Info("rotating webhook secret", "trigger", "rotation")

	hook, err := r.gh.GetWebhook(ctx, r.config.Status.Webhook.ID)
	switch {
	case errors.Is(err, repository.ErrFileNotFound):
		return []map[string]any{{
			"op":    "replace",
			"path":  "/status/webhook",
			"value": nil,
		}}, fmt.Errorf("webhook %d not found on remote during rotation: %w", r.config.Status.Webhook.ID, err)
	case err != nil:
		return nil, fmt.Errorf("get webhook for rotation: %w", err)
	}

	secret, err := uuid.NewRandom()
	if err != nil {
		return nil, fmt.Errorf("generate rotation secret: %w", err)
	}
	hook.Secret = secret.String()

	if err := r.gh.EditWebhook(ctx, hook); err != nil {
		return nil, fmt.Errorf("edit webhook during rotation: %w", err)
	}

	logger.Info("webhook secret rotated successfully")
	return []map[string]any{
		{
			"op":   "replace",
			"path": "/status/webhook",
			"value": &provisioning.WebhookStatus{
				ID:               hook.ID,
				URL:              hook.URL,
				SubscribedEvents: hook.Events,
				LastRotated:      time.Now().UnixMilli(),
			},
		},
		{
			"op":   "replace",
			"path": "/secure/webhookSecret",
			"value": map[string]string{
				"create": hook.Secret,
			},
		},
	}, nil
}

func (r *githubWebhookRepository) logger(ctx context.Context, ref string) (context.Context, logging.Logger) {
	logger := logging.FromContext(ctx)

	type containsGh int
	var containsGhKey containsGh
	if ctx.Value(containsGhKey) != nil {
		return ctx, logging.FromContext(ctx)
	}

	if ref == "" {
		ref = r.config.Spec.GitHub.Branch
	}

	logger = logger.With(slog.Group("github_repository", "owner", r.owner, "name", r.repo, "ref", ref))
	ctx = logging.Context(ctx, logger)
	// We want to ensure we don't add multiple github_repository keys. With doesn't deduplicate the keys...
	ctx = context.WithValue(ctx, containsGhKey, true)
	return ctx, logger
}

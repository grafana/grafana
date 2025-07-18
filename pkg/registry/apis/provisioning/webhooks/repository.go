package webhooks

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"slices"

	"github.com/google/go-github/v70/github"
	"github.com/google/uuid"
	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	pgh "github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/github"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

var subscribedEvents = []string{"push", "pull_request"}

//nolint:gosec // This is a constant for a secret suffix
const webhookSecretSuffix = "-webhook-secret"

type WebhookRepository interface {
	Webhook(ctx context.Context, req *http.Request) (*provisioning.WebhookResponse, error)
}

type GithubWebhookRepository interface {
	pgh.GithubRepository
	repository.Hooks

	WebhookRepository
}

type githubWebhookRepository struct {
	pgh.GithubRepository
	config     *provisioning.Repository
	owner      string
	repo       string
	secrets    secrets.RepositorySecrets
	gh         pgh.Client
	webhookURL string
}

func NewGithubWebhookRepository(
	basic pgh.GithubRepository,
	webhookURL string,
	secrets secrets.RepositorySecrets,
) GithubWebhookRepository {
	return &githubWebhookRepository{
		GithubRepository: basic,
		config:           basic.Config(),
		owner:            basic.Owner(),
		repo:             basic.Repo(),
		gh:               basic.Client(),
		webhookURL:       webhookURL,
		secrets:          secrets,
	}
}

// Webhook implements Repository.
func (r *githubWebhookRepository) Webhook(ctx context.Context, req *http.Request) (*provisioning.WebhookResponse, error) {
	if r.config.Status.Webhook == nil {
		return nil, fmt.Errorf("unexpected webhook request")
	}

	secret, err := r.secrets.Decrypt(ctx, r.config, string(r.config.Status.Webhook.EncryptedSecret))
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt secret: %w", err)
	}

	payload, err := github.ValidatePayload(req, secret)
	if err != nil {
		return nil, apierrors.NewUnauthorized("invalid signature")
	}

	return r.parseWebhook(github.WebHookType(req), payload)
}

// This method does not include context because it does delegate any more requests
func (r *githubWebhookRepository) parseWebhook(messageType string, payload []byte) (*provisioning.WebhookResponse, error) {
	event, err := github.ParseWebHook(messageType, payload)
	if err != nil {
		return nil, apierrors.NewBadRequest("invalid payload")
	}

	switch event := event.(type) {
	case *github.PushEvent:
		return r.parsePushEvent(event)
	case *github.PullRequestEvent:
		return r.parsePullRequestEvent(event)
	case *github.PingEvent:
		return &provisioning.WebhookResponse{
			Code:    http.StatusOK,
			Message: "ping received",
		}, nil
	default:
		return &provisioning.WebhookResponse{
			Code:    http.StatusNotImplemented,
			Message: fmt.Sprintf("unsupported messageType: %s", messageType),
		}, nil
	}
}

func (r *githubWebhookRepository) parsePushEvent(event *github.PushEvent) (*provisioning.WebhookResponse, error) {
	if event.GetRepo() == nil {
		return nil, fmt.Errorf("missing repository in push event")
	}
	if event.GetRepo().GetFullName() != fmt.Sprintf("%s/%s", r.owner, r.repo) {
		return nil, fmt.Errorf("repository mismatch")
	}

	// No need to sync if not enabled
	if !r.config.Spec.Sync.Enabled {
		return &provisioning.WebhookResponse{Code: http.StatusOK}, nil
	}

	// Skip silently if the event is not for the main/master branch
	// as we cannot configure the webhook to only publish events for the main branch
	if event.GetRef() != fmt.Sprintf("refs/heads/%s", r.config.Spec.GitHub.Branch) {
		return &provisioning.WebhookResponse{Code: http.StatusOK}, nil
	}

	return &provisioning.WebhookResponse{
		Code: http.StatusAccepted,
		Job: &provisioning.JobSpec{
			Repository: r.config.GetName(),
			Action:     provisioning.JobActionPull,
			Pull: &provisioning.SyncJobOptions{
				Incremental: true,
			},
		},
	}, nil
}

func (r *githubWebhookRepository) parsePullRequestEvent(event *github.PullRequestEvent) (*provisioning.WebhookResponse, error) {
	if event.GetRepo() == nil {
		return nil, fmt.Errorf("missing repository in pull request event")
	}
	cfg := r.config.Spec.GitHub
	if cfg == nil {
		return nil, fmt.Errorf("missing GitHub config")
	}

	if event.GetRepo().GetFullName() != fmt.Sprintf("%s/%s", r.owner, r.repo) {
		return nil, fmt.Errorf("repository mismatch")
	}
	pr := event.GetPullRequest()
	if pr == nil {
		return nil, fmt.Errorf("expected PR in event")
	}

	if pr.GetBase().GetRef() != r.config.Spec.GitHub.Branch {
		return &provisioning.WebhookResponse{
			Code:    http.StatusOK,
			Message: fmt.Sprintf("ignoring pull request event as %s is not  the configured branch", pr.GetBase().GetRef()),
		}, nil
	}

	action := event.GetAction()
	if action != "opened" && action != "reopened" && action != "synchronize" {
		return &provisioning.WebhookResponse{
			Code:    http.StatusOK, // Nothing needed
			Message: fmt.Sprintf("ignore pull request event: %s", action),
		}, nil
	}

	// Queue an async job that will parse files
	return &provisioning.WebhookResponse{
		Code:    http.StatusAccepted, // Nothing needed
		Message: fmt.Sprintf("pull request: %s", action),
		Job: &provisioning.JobSpec{
			Repository: r.config.GetName(),
			Action:     provisioning.JobActionPullRequest,
			PullRequest: &provisioning.PullRequestJobOptions{
				URL:  pr.GetHTMLURL(),
				PR:   pr.GetNumber(),
				Ref:  pr.GetHead().GetRef(),
				Hash: pr.GetHead().GetSHA(),
			},
		},
	}, nil
}

// CommentPullRequest adds a comment to a pull request.
func (r *githubWebhookRepository) CommentPullRequest(ctx context.Context, prNumber int, comment string) error {
	ctx, _ = r.logger(ctx, "")
	return r.gh.CreatePullRequestComment(ctx, r.owner, r.repo, prNumber, comment)
}

func (r *githubWebhookRepository) createWebhook(ctx context.Context) (pgh.WebhookConfig, error) {
	secret, err := uuid.NewRandom()
	if err != nil {
		return pgh.WebhookConfig{}, fmt.Errorf("could not generate secret: %w", err)
	}

	cfg := pgh.WebhookConfig{
		URL:         r.webhookURL,
		Secret:      secret.String(),
		ContentType: "json",
		Events:      subscribedEvents,
		Active:      true,
	}

	hook, err := r.gh.CreateWebhook(ctx, r.owner, r.repo, cfg)
	if err != nil {
		return pgh.WebhookConfig{}, err
	}

	// HACK: GitHub does not return the secret, so we need to update it manually
	hook.Secret = cfg.Secret

	logging.FromContext(ctx).Info("webhook created", "url", cfg.URL, "id", hook.ID)
	return hook, nil
}

// updateWebhook checks if the webhook needs to be updated and updates it if necessary.
// if the webhook does not exist, it will create it.
func (r *githubWebhookRepository) updateWebhook(ctx context.Context) (pgh.WebhookConfig, bool, error) {
	if r.config.Status.Webhook == nil || r.config.Status.Webhook.ID == 0 {
		hook, err := r.createWebhook(ctx)
		if err != nil {
			return pgh.WebhookConfig{}, false, err
		}
		return hook, true, nil
	}

	hook, err := r.gh.GetWebhook(ctx, r.owner, r.repo, r.config.Status.Webhook.ID)
	switch {
	case errors.Is(err, pgh.ErrResourceNotFound):
		hook, err := r.createWebhook(ctx)
		if err != nil {
			return pgh.WebhookConfig{}, false, err
		}
		return hook, true, nil
	case err != nil:
		return pgh.WebhookConfig{}, false, fmt.Errorf("get webhook: %w", err)
	}

	hook.Secret = r.config.Status.Webhook.Secret // we always random gen this, so don't use it for mustUpdate below.

	var mustUpdate bool

	if hook.URL != r.webhookURL {
		mustUpdate = true
		hook.URL = r.webhookURL
	}

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
		return pgh.WebhookConfig{}, false, fmt.Errorf("could not generate secret: %w", err)
	}
	hook.Secret = secret.String()

	if err := r.gh.EditWebhook(ctx, r.owner, r.repo, hook); err != nil {
		return pgh.WebhookConfig{}, false, fmt.Errorf("edit webhook: %w", err)
	}

	return hook, true, nil
}

func (r *githubWebhookRepository) deleteWebhook(ctx context.Context) error {
	logger := logging.FromContext(ctx)
	if r.config.Status.Webhook == nil {
		return fmt.Errorf("webhook not found")
	}

	id := r.config.Status.Webhook.ID

	if err := r.gh.DeleteWebhook(ctx, r.owner, r.repo, id); err != nil {
		return fmt.Errorf("delete webhook: %w", err)
	}

	logger.Info("webhook deleted", "url", r.config.Status.Webhook.URL, "id", id)
	return nil
}

func (r *githubWebhookRepository) OnCreate(ctx context.Context) ([]map[string]interface{}, error) {
	if len(r.webhookURL) == 0 {
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
				Secret:           hook.Secret,
				SubscribedEvents: hook.Events,
			},
		},
	}, nil
}

func (r *githubWebhookRepository) OnUpdate(ctx context.Context) ([]map[string]interface{}, error) {
	if len(r.webhookURL) == 0 {
		return nil, nil
	}
	ctx, _ = r.logger(ctx, "")
	hook, _, err := r.updateWebhook(ctx)
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
				Secret:           hook.Secret,
				SubscribedEvents: hook.Events,
			},
		},
	}, nil
}

func (r *githubWebhookRepository) OnDelete(ctx context.Context) error {
	ctx, logger := r.logger(ctx, "")
	if err := r.GithubRepository.OnDelete(ctx); err != nil {
		return fmt.Errorf("on delete from basic github repository: %w", err)
	}

	if r.config.Status.Webhook == nil {
		return nil
	}

	secretName := r.config.Name + webhookSecretSuffix
	if err := r.secrets.Delete(ctx, r.config, secretName); err != nil {
		return fmt.Errorf("delete webhook secret: %w", err)
	}

	logger.Info("Deleted webhook secret", "secretName", secretName)

	return r.deleteWebhook(ctx)
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

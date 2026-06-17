package github

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/google/go-github/v82/github"
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
	*repository.WebhookManager
	owner       string
	repo        string
	replayCache *replayCache
}

func NewGithubWebhookRepository(
	basic GithubRepository,
	webhookURL string,
	secret common.RawSecureValue,
	incrementalPolicy repository.IncrementalSyncPolicy,
	replay *replayCache,
) GithubWebhookRepository {
	// Defensive: callers should pass the factory-owned cache, but never leave
	// Webhook with a nil cache to dereference.
	if replay == nil {
		replay = newReplayCache(defaultReplayCacheTTL)
	}
	cfg := basic.Config()
	return &githubWebhookRepository{
		GithubRepository: basic,
		WebhookManager:   repository.NewWebhookManager(basic.Client(), cfg, webhookURL, subscribedEvents, secret, incrementalPolicy),
		owner:            basic.Owner(),
		repo:             basic.Repo(),
		replayCache:      replay,
	}
}

// Webhook implements Repository.
func (r *githubWebhookRepository) Webhook(ctx context.Context, req *http.Request) (*provisioning.WebhookResponse, error) {
	if r.Config().Status.Webhook == nil {
		return nil, fmt.Errorf("unexpected webhook request")
	}

	if r.Secret().IsZero() {
		return nil, fmt.Errorf("missing webhook secret")
	}

	payload, err := github.ValidatePayload(req, []byte(r.Secret()))
	if err != nil {
		return nil, apierrors.NewUnauthorized("invalid signature")
	}

	// Replay protection: key on the validated signature, not the
	// X-GitHub-Delivery header. GitHub computes the HMAC over the request body
	// only, so the delivery ID is unauthenticated — an attacker replaying a
	// captured (body, signature) could simply pick a fresh delivery ID and
	// slip past a delivery-ID cache. The signature, by contrast, is bound to
	// both the signed body and the repository's unique secret, so it cannot be
	// forged or collided across repositories.
	//
	// Silently drop a request whose signature we have already processed within
	// the cache TTL — returning a generic 200 avoids confirming to a replay
	// attacker that the captured payload was a real previously-processed
	// delivery.
	signature := req.Header.Get(github.SHA256SignatureHeader)
	if signature == "" {
		signature = req.Header.Get(github.SHA1SignatureHeader)
	}
	if r.replayCache.seenOrAdd(signature) {
		logging.FromContext(ctx).Debug("dropping replayed webhook delivery", "delivery_id", github.DeliveryID(req))
		return &provisioning.WebhookResponse{Code: http.StatusOK, Message: "ok"}, nil
	}

	return r.parseWebhook(ctx, github.WebHookType(req), payload)
}

// This method does not include context because it does delegate any more requests
func (r *githubWebhookRepository) parseWebhook(ctx context.Context, messageType string, payload []byte) (*provisioning.WebhookResponse, error) {
	event, err := github.ParseWebHook(messageType, payload)
	if err != nil {
		return nil, apierrors.NewBadRequest("invalid payload")
	}

	switch event := event.(type) {
	case *github.PushEvent:
		return r.parsePushEvent(ctx, event)
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

func (r *githubWebhookRepository) parsePushEvent(ctx context.Context, event *github.PushEvent) (*provisioning.WebhookResponse, error) {
	_, logger := r.logger(ctx, "")

	if event.GetRepo() == nil {
		return nil, fmt.Errorf("missing repository in push event")
	}
	expected := fmt.Sprintf("%s/%s", r.owner, r.repo)
	if event.GetRepo().GetFullName() != expected {
		logger.Warn("webhook push event repository mismatch", "expected", expected, "got", event.GetRepo().GetFullName())
		return nil, repository.ErrRepositoryMismatch
	}

	// No need to sync if not enabled
	if !r.Config().Spec.Sync.Enabled {
		return &provisioning.WebhookResponse{Code: http.StatusOK}, nil
	}

	// Skip silently if the event is not for the main/master branch
	// as we cannot configure the webhook to only publish events for the main branch
	if event.GetRef() != fmt.Sprintf("refs/heads/%s", r.Config().Spec.GitHub.Branch) {
		return &provisioning.WebhookResponse{Code: http.StatusOK}, nil
	}

	var deletedPaths []string
	var totalChanges int
	for _, change := range event.GetCommits() {
		totalChanges += len(change.Added) + len(change.Modified) + len(change.Removed)
		deletedPaths = append(deletedPaths, change.Removed...)
	}

	return r.PushSyncResponse(deletedPaths, totalChanges), nil
}

func (r *githubWebhookRepository) parsePullRequestEvent(event *github.PullRequestEvent) (*provisioning.WebhookResponse, error) {
	if event.GetRepo() == nil {
		return nil, fmt.Errorf("missing repository in pull request event")
	}
	cfg := r.Config().Spec.GitHub
	if cfg == nil {
		return nil, fmt.Errorf("missing GitHub config")
	}

	expected := fmt.Sprintf("%s/%s", r.owner, r.repo)
	if event.GetRepo().GetFullName() != expected {
		slog.Warn("webhook pull request event repository mismatch", "expected", expected, "got", event.GetRepo().GetFullName())
		return nil, repository.ErrRepositoryMismatch
	}
	pr := event.GetPullRequest()
	if pr == nil {
		return nil, fmt.Errorf("expected PR in event")
	}

	if pr.GetBase().GetRef() != r.Config().Spec.GitHub.Branch {
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
			Repository: r.Config().GetName(),
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

func (r *githubWebhookRepository) logger(ctx context.Context, ref string) (context.Context, logging.Logger) {
	logger := logging.FromContext(ctx)

	type containsGh int
	var containsGhKey containsGh
	if ctx.Value(containsGhKey) != nil {
		return ctx, logging.FromContext(ctx)
	}

	if ref == "" {
		ref = r.Config().Spec.GitHub.Branch
	}

	logger = logger.With(slog.Group("github_repository", "owner", r.owner, "name", r.repo, "ref", ref))
	ctx = logging.Context(ctx, logger)
	// We want to ensure we don't add multiple github_repository keys. With doesn't deduplicate the keys...
	ctx = context.WithValue(ctx, containsGhKey, true)
	return ctx, logger
}

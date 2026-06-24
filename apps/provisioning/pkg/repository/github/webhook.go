package github

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/google/go-github/v82/github"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

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
	config *provisioning.Repository
	owner  string
	repo   string
	secret common.RawSecureValue
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
		secret:           secret,
	}
	r.WebhookManager = repository.NewWebhookManager(basic.Client(), cfg.Status.Webhook, webhookURL, subscribedEvents,
		cfg.Spec.Webhook != nil && cfg.Spec.Webhook.Disabled, cfg.Spec.Workflows)
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
	return r.Client().CreatePullRequestComment(ctx, prNumber, comment)
}

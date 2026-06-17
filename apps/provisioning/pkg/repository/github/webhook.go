package github

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/google/go-github/v82/github"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

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
	*repository.WebhookManager[githubWebhookFields]
}

func NewGithubWebhookRepository(
	basic GithubRepository,
	webhookURL string,
	secret common.RawSecureValue,
	incrementalPolicy repository.IncrementalSyncPolicy,
	replay *repository.ReplayCache,
) GithubWebhookRepository {
	// Defensive: callers should pass the factory-owned cache, but never leave
	// Webhook with a nil cache to dereference.
	if replay == nil {
		replay = repository.NewReplayCache(repository.DefaultReplayCacheTTL)
	}
	cfg := basic.Config()
	slug := fmt.Sprintf("%s/%s", basic.Owner(), basic.Repo())
	return &githubWebhookRepository{
		GithubRepository: basic,
		WebhookManager: repository.NewWebhookManager(
			basic, githubWebhookParser{}, replay, cfg, webhookURL,
			slug, cfg.Spec.GitHub.Branch, subscribedEvents, secret, incrementalPolicy),
	}
}

// githubWebhookParser authenticates and normalizes GitHub webhook deliveries.
type githubWebhookParser struct{}

func (githubWebhookParser) Verify(req *http.Request, secret common.RawSecureValue) ([]byte, string, error) {
	payload, err := github.ValidatePayload(req, []byte(secret))
	if err != nil {
		return nil, "", err
	}

	// Key replay protection on the validated signature, not the
	// X-GitHub-Delivery header. GitHub computes the HMAC over the request body
	// only, so the delivery ID is unauthenticated — an attacker replaying a
	// captured (body, signature) could pick a fresh delivery ID and slip past a
	// delivery-ID cache. The signature is bound to both the signed body and the
	// repository's unique secret, so it cannot be forged or collided.
	signature := req.Header.Get(github.SHA256SignatureHeader)
	if signature == "" {
		signature = req.Header.Get(github.SHA1SignatureHeader)
	}
	return payload, signature, nil
}

func (githubWebhookParser) Parse(req *http.Request, payload []byte) (repository.WebhookEvent, error) {
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
			RepoSlug:  event.GetRepo().GetFullName(),
			Branch:    pr.GetBase().GetRef(),
			Action:    normalizeGitHubAction(event.GetAction()),
			PRNumber:  pr.GetNumber(),
			PRURL:     pr.GetHTMLURL(),
			SourceRef: pr.GetHead().GetRef(),
			Hash:      pr.GetHead().GetSHA(),
		}, nil
	case *github.PingEvent:
		return repository.WebhookEvent{Type: repository.WebhookEventPing}, nil
	default:
		return repository.WebhookEvent{
			Type:    repository.WebhookEventUnsupported,
			Message: fmt.Sprintf("unsupported messageType: %s", github.WebHookType(req)),
		}, nil
	}
}

func normalizeGitHubAction(action string) string {
	if action == "synchronize" {
		return "updated"
	}
	return action
}

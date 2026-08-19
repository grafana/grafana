package github

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/google/go-github/v82/github"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

var subscribedEvents = []string{"pull_request", "push"} // same order as slices.Sort()

type GithubWebhookRepository interface {
	GithubRepository
	repository.WebhookRepository
}

// The webhook repository is the only type that reaches PullRequest job
// processing, so fail the build if it ever stops satisfying the full contract.
var _ repository.PullRequestRepo = (*githubWebhookRepository)(nil)

type githubWebhookRepository struct {
	GithubRepository
	webhookURL string
	secret     common.RawSecureValue
}

func NewGithubWebhookRepository(
	basic GithubRepository,
	webhookURL string,
	secret common.RawSecureValue,
) GithubWebhookRepository {
	return &githubWebhookRepository{
		GithubRepository: basic,
		webhookURL:       webhookURL,
		secret:           secret,
	}
}

func (r *githubWebhookRepository) VerifyRequest(req *http.Request) (*repository.VerifiedWebhookRequest, error) {
	if r.secret.IsZero() {
		return nil, fmt.Errorf("missing webhook secret")
	}

	payload, err := github.ValidatePayload(req, []byte(r.secret))
	if err != nil {
		return nil, apierrors.NewUnauthorized("invalid signature")
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

	return &repository.VerifiedWebhookRequest{
		Payload:   payload,
		Header:    req.Header,
		ReplayKey: signature,
	}, nil
}

func (r *githubWebhookRepository) ProcessRequest(ctx context.Context, req *repository.VerifiedWebhookRequest) (repository.WebhookEvent, error) {
	eventType := req.Header.Get(github.EventTypeHeader)
	event, err := github.ParseWebHook(eventType, req.Payload)
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
			Sender:       event.GetSender().GetLogin(),
			SenderID:     senderID(event.GetSender()),
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
			Sender:    event.GetSender().GetLogin(),
			SenderID:  senderID(event.GetSender()),
		}, nil
	case *github.PingEvent:
		return repository.WebhookEvent{Type: repository.WebhookEventPing}, nil
	default:
		return repository.WebhookEvent{
			Type:    repository.WebhookEventUnsupported,
			Message: fmt.Sprintf("unsupported messageType: %s", eventType),
		}, nil
	}
}

func (r *githubWebhookRepository) Slug() string {
	return fmt.Sprintf("%s/%s", r.Owner(), r.Repo())
}

func (r *githubWebhookRepository) WebhookClient() repository.WebhookClient {
	return r.Client()
}

func (r *githubWebhookRepository) WebhookURL() string {
	return r.webhookURL
}

func (r *githubWebhookRepository) SubscribedEvents() []string {
	return subscribedEvents
}

// CommentPullRequest adds a comment to a pull request.
func (r *githubWebhookRepository) CommentPullRequest(ctx context.Context, prNumber int, comment string) error {
	return r.Client().CreatePullRequestComment(ctx, prNumber, comment)
}

func (r *githubWebhookRepository) MergeBase(ctx context.Context, headRef string) (string, error) {
	return r.Client().MergeBase(ctx, r.Config().Branch(), headRef)
}

// senderID formats the sender's numeric ID, or returns an empty string when
// the payload carries no sender, so a missing identity is not recorded as "0".
func senderID(sender *github.User) string {
	if sender.GetID() == 0 {
		return ""
	}
	return strconv.FormatInt(sender.GetID(), 10)
}

func normalizeGitHubAction(action string) repository.PullRequestAction {
	if action == "synchronize" {
		return repository.PullRequestActionUpdated
	}
	return repository.PullRequestAction(action)
}

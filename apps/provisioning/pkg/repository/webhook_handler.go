package repository

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// WebhookEventType classifies a normalized inbound webhook delivery.
type WebhookEventType string

const (
	WebhookEventUnsupported WebhookEventType = "unsupported"
	WebhookEventPing        WebhookEventType = "ping"
	WebhookEventReplay      WebhookEventType = "replay"
	WebhookEventPush        WebhookEventType = "push"
	WebhookEventPullRequest WebhookEventType = "pull_request"
)

type PullRequestAction string

const (
	PullRequestActionOpened   PullRequestAction = "opened"
	PullRequestActionReopened PullRequestAction = "reopened"
	PullRequestActionUpdated  PullRequestAction = "updated"
)

// ProcessRequestFunc returns a provider-agnostic WebhookEvent for an inbound
// webhook request. It is the only provider-specific part of the inbound flow.
type ProcessRequestFunc func(ctx context.Context, req *http.Request) (WebhookEvent, error)

// WebhookHandler handles inbound webhook deliveries: it dispatches the
// provider-normalized event into sync/pull-request job responses.
type WebhookHandler struct {
	processReqFunc    ProcessRequestFunc
	status            *provisioning.WebhookStatus
	repoType          provisioning.RepositoryType
	repoName          string
	repoSlug          string
	branch            string
	syncEnabled       bool
	incrementalPolicy IncrementalSyncPolicy
}

// WebhookEvent is the provider-agnostic form of an inbound webhook delivery.
// A provider's processRequest normalizes its native event into this shape.
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
}

func NewWebhookHandler(processReqFunc ProcessRequestFunc, status *provisioning.WebhookStatus, repoType provisioning.RepositoryType, repoName, repoSlug, branch string, syncEnabled bool, incrementalPolicy IncrementalSyncPolicy) *WebhookHandler {
	return &WebhookHandler{
		processReqFunc:    processReqFunc,
		status:            status,
		repoType:          repoType,
		repoName:          repoName,
		repoSlug:          repoSlug,
		branch:            branch,
		syncEnabled:       syncEnabled,
		incrementalPolicy: incrementalPolicy,
	}
}

// Webhook dispatches an inbound webhook delivery into a sync/pull-request
// job response. The provider supplies the event via processReqFunc.
func (m *WebhookHandler) Webhook(ctx context.Context, req *http.Request) (*provisioning.WebhookResponse, error) {
	if m.status == nil {
		return nil, fmt.Errorf("unexpected webhook request")
	}

	ctx = logging.Context(ctx, logging.FromContext(ctx).With(slog.Group("repository", "slug", m.repoSlug, "ref", m.branch)))

	event, err := m.processReqFunc(ctx, req)
	if err != nil {
		return nil, err
	}

	ctx = logging.Context(ctx, logging.FromContext(ctx).With(
		"provider", m.repoType,
		"type", event.Type,
		"action", event.Action,
		"slug", event.RepoSlug,
		"branch", event.Branch,
		"pr", event.PRNumber,
		"changes", event.TotalChanges,
	))
	logging.FromContext(ctx).Debug("webhook event received")

	switch event.Type {
	case WebhookEventPush:
		if event.RepoSlug != m.repoSlug {
			logging.FromContext(ctx).Warn("webhook push event repository mismatch", "expected", m.repoSlug, "got", event.RepoSlug)
			return nil, ErrRepositoryMismatch
		}
		if !m.syncEnabled {
			return &provisioning.WebhookResponse{Code: http.StatusOK}, nil
		}
		// Skip silently if the event is not for the configured branch, as the
		// webhook cannot be configured to only publish events for one branch.
		if event.Branch != m.branch {
			return &provisioning.WebhookResponse{Code: http.StatusOK}, nil
		}
		return m.pushSyncResponse(event.DeletedPaths, event.TotalChanges), nil
	case WebhookEventPullRequest:
		if event.RepoSlug != m.repoSlug {
			logging.FromContext(ctx).Warn("webhook pull request event repository mismatch", "expected", m.repoSlug, "got", event.RepoSlug)
			return nil, ErrRepositoryMismatch
		}
		if event.Branch != m.branch {
			return &provisioning.WebhookResponse{
				Code:    http.StatusOK,
				Message: fmt.Sprintf("ignoring pull request event as %s is not  the configured branch", event.Branch),
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
	case WebhookEventReplay:
		return &provisioning.WebhookResponse{Code: http.StatusOK, Message: "ok"}, nil
	default:
		return &provisioning.WebhookResponse{Code: http.StatusNotImplemented, Message: event.Message}, nil
	}
}

func (m *WebhookHandler) pullRequestResponse(event WebhookEvent) *provisioning.WebhookResponse {
	return &provisioning.WebhookResponse{
		Code:    http.StatusAccepted,
		Message: fmt.Sprintf("pull request: %s", event.Action),
		Job: &provisioning.JobSpec{
			Repository: m.repoName,
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

func (m *WebhookHandler) pushSyncResponse(deletedPaths []string, totalChanges int) *provisioning.WebhookResponse {
	return &provisioning.WebhookResponse{
		Code: http.StatusAccepted,
		Job: &provisioning.JobSpec{
			Repository: m.repoName,
			Action:     provisioning.JobActionPull,
			Pull: &provisioning.SyncJobOptions{
				Incremental: m.incrementalPolicy.CanUseIncrementalSync(deletedPaths, totalChanges),
			},
		},
	}
}

func watchedPullRequestAction(action PullRequestAction) bool {
	switch action {
	case PullRequestActionOpened, PullRequestActionReopened, PullRequestActionUpdated:
		return true
	default:
		return false
	}
}

package repository

import (
	"fmt"
	"net/http"

	"github.com/google/go-github/v66/github"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

func (r *githubRepository) parseWebhook(messageType string, payload []byte) (*provisioning.WebhookResponse, error) {
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
	}

	return &provisioning.WebhookResponse{
		Code:    http.StatusNotImplemented,
		Message: fmt.Sprintf("unsupported messageType: %s", messageType),
	}, nil
}

func (r *githubRepository) parsePushEvent(event *github.PushEvent) (*provisioning.WebhookResponse, error) {
	if event.GetRepo() == nil {
		return nil, fmt.Errorf("missing repository in push event")
	}
	if event.GetRepo().GetFullName() != fmt.Sprintf("%s/%s", r.config.Spec.GitHub.Owner, r.config.Spec.GitHub.Repository) {
		return nil, fmt.Errorf("repository mismatch")
	}
	// Skip silently if the event is not for the main/master branch
	// as we cannot configure the webhook to only publish events for the main branch
	if event.GetRef() != fmt.Sprintf("refs/heads/%s", r.config.Spec.GitHub.Branch) {
		r.logger.Debug("ignoring push event as it is not for the configured branch")
		return &provisioning.WebhookResponse{Code: http.StatusOK}, nil
	}

	// pushed to "main" branch
	job := &provisioning.Job{
		Action: "push",
		Ref:    r.config.Spec.GitHub.Branch, // checked above!
	}
	count := 0
	for _, commit := range event.Commits {
		for _, file := range commit.Added {
			if r.ignore(file) {
				continue
			}
			job.Added = append(job.Added, file)
			count++
		}
		for _, file := range commit.Removed {
			if r.ignore(file) {
				continue
			}
			job.Removed = append(job.Removed, file)
			count++
		}
		for _, file := range commit.Modified {
			if r.ignore(file) {
				continue
			}
			job.Modified = append(job.Modified, file)
			count++
		}
	}
	if count == 0 {
		return &provisioning.WebhookResponse{
			Code:    http.StatusOK, // Nothing needed
			Message: "no files require updates",
		}, nil
	}

	return &provisioning.WebhookResponse{
		Code:    http.StatusAccepted,
		Message: fmt.Sprintf("%d files", count),
		Job:     job,
	}, nil
}

func (r *githubRepository) parsePullRequestEvent(event *github.PullRequestEvent) (*provisioning.WebhookResponse, error) {
	if event.GetRepo() == nil {
		return nil, fmt.Errorf("missing repository in pull request event")
	}
	cfg := r.config.Spec.GitHub
	if cfg == nil {
		return nil, fmt.Errorf("missing github config")
	}

	if !cfg.PullRequestLinter && !cfg.GenerateDashboardPreviews {
		return &provisioning.WebhookResponse{
			Code:    http.StatusOK, // Nothing needed
			Message: "no action required on pull request event",
		}, nil
	}

	if event.GetRepo().GetFullName() != fmt.Sprintf("%s/%s", cfg.Owner, cfg.Repository) {
		return nil, fmt.Errorf("repository mismatch")
	}
	pr := event.GetPullRequest()
	if pr == nil {
		return nil, fmt.Errorf("expected PR in event")
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
		Job: &provisioning.Job{
			Action: provisioning.JobActionPullRequest,
			URL:    pr.GetHTMLURL(),
			PR:     pr.GetNumber(),
			Ref:    pr.GetHead().GetRef(),
			Hash:   pr.GetHead().GetSHA(),
		},
	}, nil
}

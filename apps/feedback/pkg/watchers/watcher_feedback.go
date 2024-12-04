package watchers

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"go.opentelemetry.io/otel"

	feedback "github.com/grafana/grafana/apps/feedback/pkg/apis/feedback/v0alpha1"
	githubClient "github.com/grafana/grafana/apps/feedback/pkg/githubclient"
	"github.com/grafana/grafana/pkg/setting"
)

var _ operator.ResourceWatcher = &FeedbackWatcher{}

type FeedbackWatcher struct {
	feedbackStore *resource.TypedStore[*feedback.Feedback]
	cfg           *setting.Cfg
	gitClient     *githubClient.GitHubClient
}

func NewFeedbackWatcher(cfg *setting.Cfg, feedbackStore *resource.TypedStore[*feedback.Feedback]) (*FeedbackWatcher, error) {
	section := cfg.SectionWithEnvOverrides("feedback_button")
	token, owner, repo := section.Key("github_token").MustString(""), section.Key("github_owner").MustString(""), section.Key("github_repo").MustString("")
	gitClient := githubClient.NewGitHubClient(token, owner, repo)

	return &FeedbackWatcher{
		feedbackStore: feedbackStore,
		cfg:           cfg,
		gitClient:     gitClient,
	}, nil
}

// Add handles add events for feedback.Feedback resources.
func (s *FeedbackWatcher) Add(ctx context.Context, rObj resource.Object) error {
	ctx, span := otel.GetTracerProvider().Tracer("watcher").Start(ctx, "watcher-add")
	defer span.End()
	object, ok := rObj.(*feedback.Feedback)
	if !ok {
		return fmt.Errorf("provided object is not of type *feedback.Feedback (name=%s, namespace=%s, kind=%s)",
			rObj.GetStaticMetadata().Name, rObj.GetStaticMetadata().Namespace, rObj.GetStaticMetadata().Kind)
	}

	// Upload image to Github
	section := s.cfg.SectionWithEnvOverrides("feedback_button")
	if section.Key("upload_to_github").MustBool(false) &&
		object.Spec.ScreenshotUrl == "" { // So we don't spam when there are errors... obviously should figure out something better
		imageUuid := uuid.NewString()

		screenshotUrl, err := s.gitClient.UploadImage(imageUuid, object.Spec.Screenshot)
		if err != nil {
			return err
		}

		object.Spec.ScreenshotUrl = screenshotUrl

		if _, err := s.feedbackStore.Update(ctx, resource.Identifier{Namespace: rObj.GetNamespace(), Name: rObj.GetName()}, object); err != nil {
			return fmt.Errorf("updating screenshot url (name=%s, namespace=%s, kind=%s): %w",
				rObj.GetStaticMetadata().Name, rObj.GetStaticMetadata().Namespace, rObj.GetStaticMetadata().Kind, err)
		}
	}

	logging.FromContext(ctx).Debug("Added resource", "name", object.GetStaticMetadata().Identifier().Name)
	return nil
}

// Update handles update events for feedback.Feedback resources.
func (s *FeedbackWatcher) Update(ctx context.Context, rOld resource.Object, rNew resource.Object) error {
	ctx, span := otel.GetTracerProvider().Tracer("watcher").Start(ctx, "watcher-update")
	defer span.End()
	oldObject, ok := rOld.(*feedback.Feedback)
	if !ok {
		return fmt.Errorf("provided object is not of type *feedback.Feedback (name=%s, namespace=%s, kind=%s)",
			rOld.GetStaticMetadata().Name, rOld.GetStaticMetadata().Namespace, rOld.GetStaticMetadata().Kind)
	}

	object, ok := rNew.(*feedback.Feedback)
	if !ok {
		return fmt.Errorf("provided object is not of type *feedback.Feedback (name=%s, namespace=%s, kind=%s)",
			rNew.GetStaticMetadata().Name, rNew.GetStaticMetadata().Namespace, rNew.GetStaticMetadata().Kind)
	}

	// Create issue in Github
	issue := githubClient.Issue{
		Title:  fmt.Sprintf("[feedback] %s", object.Spec.Message),
		Body:   fmt.Sprintf("![Screenshot](%s?raw=true)", object.Spec.ScreenshotUrl),
		Labels: []string{"P2"}, // TODO: make configurable out of objec spec?
	}
	if err := s.gitClient.CreateIssue(issue); err != nil {
		return err
	}

	logging.FromContext(ctx).Debug("Updated resource", "name", oldObject.GetStaticMetadata().Identifier().Name)
	return nil
}

// Delete handles delete events for feedback.Feedback resources.
func (s *FeedbackWatcher) Delete(ctx context.Context, rObj resource.Object) error {
	ctx, span := otel.GetTracerProvider().Tracer("watcher").Start(ctx, "watcher-delete")
	defer span.End()
	object, ok := rObj.(*feedback.Feedback)
	if !ok {
		return fmt.Errorf("provided object is not of type *feedback.Feedback (name=%s, namespace=%s, kind=%s)",
			rObj.GetStaticMetadata().Name, rObj.GetStaticMetadata().Namespace, rObj.GetStaticMetadata().Kind)
	}

	// TODO
	logging.FromContext(ctx).Debug("Deleted resource", "name", object.GetStaticMetadata().Identifier().Name)
	return nil
}

// Sync is not a standard resource.Watcher function, but is used when wrapping this watcher in an operator.OpinionatedWatcher.
// It handles resources which MAY have been updated during an outage period where the watcher was not able to consume events.
func (s *FeedbackWatcher) Sync(ctx context.Context, rObj resource.Object) error {
	ctx, span := otel.GetTracerProvider().Tracer("watcher").Start(ctx, "watcher-sync")
	defer span.End()
	object, ok := rObj.(*feedback.Feedback)
	if !ok {
		return fmt.Errorf("provided object is not of type *feedback.Feedback (name=%s, namespace=%s, kind=%s)",
			rObj.GetStaticMetadata().Name, rObj.GetStaticMetadata().Namespace, rObj.GetStaticMetadata().Kind)
	}

	// TODO
	logging.FromContext(ctx).Debug("Possible resource update", "name", object.GetStaticMetadata().Identifier().Name)
	return nil
}

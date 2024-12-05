package watchers

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"go.opentelemetry.io/otel"
	"k8s.io/klog/v2"

	feedback "github.com/grafana/grafana/apps/feedback/pkg/apis/feedback/v0alpha1"
	githubClient "github.com/grafana/grafana/apps/feedback/pkg/githubclient"
	"github.com/grafana/grafana/apps/feedback/pkg/llmclient"
	"github.com/grafana/grafana/pkg/setting"
)

var _ operator.ResourceWatcher = &FeedbackWatcher{}

type FeedbackWatcher struct {
	feedbackStore *resource.TypedStore[*feedback.Feedback]
	cfg           *setting.Cfg
	gitClient     *githubClient.GitHubClient
	llmClient     *llmclient.LLMClient
}

func NewFeedbackWatcher(cfg *setting.Cfg, feedbackStore *resource.TypedStore[*feedback.Feedback]) (*FeedbackWatcher, error) {
	section := cfg.SectionWithEnvOverrides("feedback_button")
	token, owner, repo := section.Key("github_token").MustString(""), section.Key("github_owner").MustString(""), section.Key("github_repo").MustString("")
	gitClient := githubClient.NewGitHubClient(token, owner, repo)
	llmClient, err := llmclient.NewLLMClient(section.Key("llm_url").MustString(""), llmclient.ChatOptions{SelectedModel: section.Key("llm_model").MustString("llama3.1:8b"), Temperature: float32(section.Key("llm_temperature").MustFloat64(0.5))}, cfg)
	if err != nil {
		klog.ErrorS(err, "failed to initialize llm client in feedback watcher, automated feedback triage will not work")
	}

	return &FeedbackWatcher{
		feedbackStore: feedbackStore,
		cfg:           cfg,
		gitClient:     gitClient,
		llmClient:     llmClient,
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
	if section.Key("upload_to_github").MustBool(false) && object.Spec.ScreenshotUrl == nil && len(object.Spec.Screenshot) > 0 { // So we don't spam when there are errors... obviously should figure out something better
		imageUuid := uuid.NewString()

		imageType := object.Spec.ImageType
		if imageType == nil || *imageType == "" {
			defaultImageType := "png"
			imageType = &defaultImageType
		}

		screenshotUrl, err := s.gitClient.UploadImage(imageUuid, imageType, object.Spec.Screenshot)
		if err != nil {
			return err
		}
		object.Spec.ScreenshotUrl = &screenshotUrl

		// Clean it up, since we dont need it anymore
		object.Spec.Screenshot = nil
		object.Spec.ImageType = nil

		if _, err := s.feedbackStore.Update(ctx, resource.Identifier{Namespace: rObj.GetNamespace(), Name: rObj.GetName()}, object); err != nil {
			return fmt.Errorf("updating screenshot url (name=%s, namespace=%s, kind=%s): %w",
				rObj.GetStaticMetadata().Name, rObj.GetStaticMetadata().Namespace, rObj.GetStaticMetadata().Kind, err)
		}
	}

	// Create issue in Github

	// Building the body like this will all go away when Dana merges her template stuff, but wanted to test the end to end
	var sb strings.Builder
	sb.WriteString("**Description:**\n")
	sb.WriteString(object.Spec.Message)
	sb.WriteString("\n\n**Screenshot:**\n")
	if object.Spec.ScreenshotUrl != nil {
		sb.WriteString(fmt.Sprintf("![Screenshot](%s?raw=true)", *object.Spec.ScreenshotUrl))
	} else {
		sb.WriteString("no screenshot provided")
	}

	// defaults
	var labels = []string{"type/unknown"}
	var title = object.Spec.Message[:50] + "..." // truncate
	if section.Key("query_llm").MustBool(false) {
		llmLabels := s.llmClient.PromptForLabels(object.Spec.Message)
		if len(llmLabels) > 0 {
			labels = llmLabels
		}

		if t, err := s.llmClient.PromptForShortIssueTitle(object.Spec.Message); err != nil {
			klog.ErrorS(err, "error prompting the llm for a short issue title")
		} else {
			title = t
		}
	}

	issue := githubClient.Issue{
		Title:  fmt.Sprintf("[feedback] %s", title),
		Body:   sb.String(),
		Labels: labels,
	}
	if err := s.gitClient.CreateIssue(issue); err != nil {
		return err
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

	_, ok = rNew.(*feedback.Feedback)
	if !ok {
		return fmt.Errorf("provided object is not of type *feedback.Feedback (name=%s, namespace=%s, kind=%s)",
			rNew.GetStaticMetadata().Name, rNew.GetStaticMetadata().Namespace, rNew.GetStaticMetadata().Kind)
	}

	// // Create issue in Github
	// llmLabels := s.llmClient.PromptForLabels(object.Spec.Message)
	// if object.Spec.ScreenshotUrl != nil {
	// 	screenshotURL := *object.Spec.ScreenshotUrl
	// 	issue := githubClient.Issue{
	// 		Title:  fmt.Sprintf("[feedback] %s", object.Spec.Message),
	// 		Body:   fmt.Sprintf("![Screenshot](%s?raw=true)", screenshotURL),
	// 		Labels: llmLabels,
	// 	}
	// 	if err := s.gitClient.CreateIssue(issue); err != nil {
	// 		return err
	// 	}
	// }

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

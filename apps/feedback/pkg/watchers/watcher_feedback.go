package watchers

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"html/template"

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
	llmClient, err := llmclient.NewLLMClient(section.Key("llm_url").MustString(""), llmclient.ChatOptions{SelectedModel: section.Key("llm_model").MustString("llama3.1:8b"), Temperature: float32(section.Key("llm_temperature").MustFloat64(0.5))})
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
		return fmt.Errorf(
			"provided object is not of type *feedback.Feedback (name=%s, namespace=%s, kind=%s)",
			rObj.GetStaticMetadata().Name, rObj.GetStaticMetadata().Namespace, rObj.GetStaticMetadata().Kind,
		)
	}

	// Skip processing if there's a GitHub issue. The screenshot is optional to the report.
	if object.Spec.GithubIssueUrl != nil {
		return nil
	}

	// Upload image to Github and create issue if needed
	section := s.cfg.SectionWithEnvOverrides("feedback_button")
	if section.Key("upload_to_github").MustBool(false) {
		// Update the screenshot part if it is present.
		if object.Spec.ScreenshotUrl == nil && len(object.Spec.Screenshot) > 0 {
			imageUuid := uuid.NewString()

			imageType := object.Spec.ImageType
			if imageType == nil || *imageType == "" {
				defaultImageType := "png"
				imageType = &defaultImageType
			}

			screenshotUrl, err := s.gitClient.UploadImage(ctx, imageUuid, imageType, object.Spec.Screenshot)
			if err != nil {
				return err
			}
			object.Spec.ScreenshotUrl = &screenshotUrl

			// Clean it up, since we dont need it anymore
			object.Spec.Screenshot = nil
			object.Spec.ImageType = nil
		}

		// Create a GitHub issue if that is not done yet.
		if object.Spec.GithubIssueUrl == nil {
			issueUrl, err := s.createGithubIssue(ctx, object)
			if err != nil {
				return err
			}

			object.Spec.GithubIssueUrl = &issueUrl
		}

		if _, err := s.feedbackStore.Update(ctx, resource.Identifier{Namespace: rObj.GetNamespace(), Name: rObj.GetName()}, object); err != nil {
			return fmt.Errorf(
				"updating screenshot url (name=%s, namespace=%s, kind=%s): %w",
				rObj.GetStaticMetadata().Name, rObj.GetStaticMetadata().Namespace, rObj.GetStaticMetadata().Kind, err,
			)
		}
	}

	logging.FromContext(ctx).Debug("Added resource", "name", object.GetStaticMetadata().Identifier().Name)
	return nil
}

func (s *FeedbackWatcher) createGithubIssue(ctx context.Context, object *feedback.Feedback) (string, error) {
	// Create issue in Github

	issueBody, err := s.buildIssueBody(object)
	if err != nil {
		return "", fmt.Errorf("building issue body: %w", err)
	}

	// defaults
	labels := []string{"type/unknown"}
	title := object.Spec.Message
	if len(title) > 50 {
		title = object.Spec.Message[:50] + "..." // truncate
	}

	section := s.cfg.SectionWithEnvOverrides("feedback_button")
	if section.Key("query_llm").MustBool(false) {
		llmLabels, err := s.llmClient.PromptForLabels(ctx, object.Spec.Message)
		if err != nil {
			logging.FromContext(ctx).Error("LLM prompt for labels failed", "error", err.Error())
		}

		if len(llmLabels) > 0 {
			labels = llmLabels
		}

		if t, err := s.llmClient.PromptForShortIssueTitle(ctx, object.Spec.Message); err != nil {
			klog.ErrorS(err, "error prompting the llm for a short issue title")
		} else {
			title = t
		}
	}

	issue := githubClient.Issue{
		Title:  fmt.Sprintf("[feedback] %s", title),
		Body:   issueBody,
		Labels: labels,
	}

	issueUrl, err := s.gitClient.CreateIssue(ctx, issue)
	if err != nil {
		return "", err
	}

	return issueUrl, nil
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

func (s *FeedbackWatcher) buildIssueBody(object *feedback.Feedback) (string, error) {
	// Convert map[string]any to JSON
	jsonData, err := json.Marshal(object.Spec.DiagnosticData)
	if err != nil {
		return "", fmt.Errorf("unmarshaling diagnostic data: %w", err)
	}

	// Convert JSON to Diagnostic struct
	var diagnostic githubClient.Diagnostic
	err = json.Unmarshal(jsonData, &diagnostic)
	if err != nil {
		return "", fmt.Errorf("unmarshaling diagnostic data: %w", err)
	}

	var snapshotURL string
	if object.Spec.ScreenshotUrl != nil {
		snapshotURL = fmt.Sprintf("![Screenshot](%s?raw=true)", *object.Spec.ScreenshotUrl)
	} else {
		snapshotURL = "No screenshot provided"
	}
	configsList := githubClient.BuildConfigList(diagnostic.Instance)

	// Combine data into TemplateData struct
	slug := diagnostic.Instance.Slug
	if slug == nil {
		slug = new(string)
	}

	templateData := githubClient.TemplateData{
		Datasources:    diagnostic.Instance.Datasources,
		Plugins:        diagnostic.Instance.Plugins,
		FeatureToggles: diagnostic.Instance.FeatureToggles,
		Configs:        configsList,

		WhatHappenedQuestion:   object.Spec.Message,
		InstanceSlug:           *slug,
		InstanceVersion:        diagnostic.Instance.Edition,
		InstanceRunningVersion: diagnostic.Instance.Version,
		BrowserName:            diagnostic.Browser.UserAgent,
		SnapshotURL:            snapshotURL,
	}

	// Parse the embedded template
	tmpl, err := template.New("issueBody").Parse(githubClient.TemplateContent)
	if err != nil {
		return "", fmt.Errorf("parsing template: %w", err)
	}

	// Render the template with data
	var issueBody bytes.Buffer
	if err := tmpl.Execute(&issueBody, templateData); err != nil {
		return "", fmt.Errorf("executing template: %w", err)
	}

	return issueBody.String(), nil
}

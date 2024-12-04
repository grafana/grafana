package webhook

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"path"
	"text/template"

	"github.com/google/go-github/v66/github"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/lint"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/registry/rest"

	pgh "github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/github"
)

// PreviewRenderer is an interface for rendering a preview of a file
type PreviewRenderer interface {
	IsAvailable(ctx context.Context) bool
	RenderDashboardPreview(ctx context.Context, repo repository.Repository, path string, ref string) (string, error)
}

// FileReplicator is an interface for replicating files
type FileReplicator interface {
	Replicate(ctx context.Context, fileInfo *repository.FileInfo) error
	Delete(ctx context.Context, fileInfo *repository.FileInfo) error
}

type GithubWebhook struct {
	repository.Repository
	replicator    FileReplicator
	gh            pgh.Client
	baseURL       *url.URL
	linterFactory lint.LinterFactory
	parser        *resources.FileParser
	renderer      PreviewRenderer
}

func NewGithubWebhook(
	repo repository.Repository,
	replicator FileReplicator,
	gh pgh.Client,
	baseURL *url.URL,
	parser *resources.FileParser,
	linterFactory lint.LinterFactory,
	renderer PreviewRenderer,
) *GithubWebhook {
	return &GithubWebhook{
		Repository:    repo,
		replicator:    replicator,
		baseURL:       baseURL,
		parser:        parser,
		linterFactory: linterFactory,
		renderer:      renderer,
	}
}

// Webhook implements provisioning.Repository.
func (r *GithubWebhook) Handle(ctx context.Context, logger *slog.Logger, responder rest.Responder) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		// We don't want GitHub's request to cause a cancellation for us, but we also want the request context's data (primarily for logging).
		// This means we will just ignore when GH closes their connection to us. If we respond in time, fantastic. Otherwise, we'll still do the work.
		// The cancel we do here is mainly just to make sure that no goroutines can accidentally stay living forever.
		//
		// TODO: Should we have our own timeout here? Even if pretty crazy high (e.g. 30 min)?
		ctx, cancel := context.WithCancel(context.WithoutCancel(req.Context()))
		defer cancel()

		payload, err := github.ValidatePayload(req, []byte(r.Config().Spec.GitHub.WebhookSecret))
		if err != nil {
			responder.Error(apierrors.NewUnauthorized("invalid signature"))
			return
		}

		eventType := github.WebHookType(req)
		event, err := github.ParseWebHook(github.WebHookType(req), payload)
		if err != nil {
			responder.Error(apierrors.NewBadRequest("invalid payload"))
			return
		}

		switch event := event.(type) {
		case *github.PushEvent:
			if err := r.onPushEvent(ctx, logger, event); err != nil {
				responder.Error(err)
				return
			}

			responder.Object(200, &metav1.Status{
				Message: "push event processed",
				Code:    http.StatusOK,
			})
		case *github.PullRequestEvent:
			if err := r.onPullRequestEvent(ctx, logger, event); err != nil {
				responder.Error(err)
				return
			}
			responder.Object(200, &metav1.Status{
				Message: "pull request event processed",
				Code:    http.StatusOK,
			})
		case *github.PingEvent:
			responder.Object(200, &metav1.Status{
				Message: "ping received",
				Code:    http.StatusOK,
			})
		default:
			responder.Error(apierrors.NewBadRequest("unsupported event type: " + eventType))
		}
	}
}

func (r *GithubWebhook) onPushEvent(ctx context.Context, logger *slog.Logger, event *github.PushEvent) error {
	logger = logger.With("ref", event.GetRef())

	if event.GetRepo() == nil {
		return fmt.Errorf("missing repository in push event")
	}

	if event.GetRepo().GetFullName() != fmt.Sprintf("%s/%s", r.Config().Spec.GitHub.Owner, r.Config().Spec.GitHub.Repository) {
		return fmt.Errorf("repository mismatch")
	}

	// Skip silently if the event is not for the main/master branch
	// as we cannot configure the webhook to only publish events for the main branch
	if event.GetRef() != fmt.Sprintf("refs/heads/%s", r.Config().Spec.GitHub.Branch) {
		logger.DebugContext(ctx, "ignoring push event as it is not for the configured branch")
		return nil
	}

	beforeRef := event.GetBefore()

	for _, commit := range event.Commits {
		logger := logger.With("commit", commit.GetID(), "message", commit.GetMessage())
		logger.InfoContext(ctx, "process commit")

		for _, file := range commit.Added {
			logger := logger.With("file", file)

			fileInfo, err := r.Read(ctx, logger, file, commit.GetID())
			if err != nil {
				logger.ErrorContext(ctx, "failed to read added resource", "error", err)
				continue
			}

			if err := r.replicator.Replicate(ctx, fileInfo); err != nil {
				if errors.Is(err, resources.ErrUnableToReadResourceBytes) {
					logger.InfoContext(ctx, "added file does not contain a resource")
					continue
				}

				logger.ErrorContext(ctx, "failed to replicate added resource", "error", err)
				continue
			}

			logger.InfoContext(ctx, "added file", "path", file)
		}

		for _, file := range commit.Modified {
			logger := logger.With("file", file)
			fileInfo, err := r.Read(ctx, logger, file, commit.GetID())
			if err != nil {
				logger.ErrorContext(ctx, "failed to read modified resource", "error", err)
				continue
			}

			if err := r.replicator.Replicate(ctx, fileInfo); err != nil {
				if errors.Is(err, resources.ErrUnableToReadResourceBytes) {
					logger.InfoContext(ctx, "modified file does not contain a resource")
					continue
				}

				logger.ErrorContext(ctx, "failed to replicate modified resource", "error", err)
				continue
			}

			logger.InfoContext(ctx, "modified file")
		}

		for _, file := range commit.Removed {
			logger := logger.With("file", file)

			fileInfo, err := r.Read(ctx, logger, file, beforeRef)
			if err != nil {
				logger.ErrorContext(ctx, "failed to read removed resource", "error", err)
				continue
			}

			if err := r.replicator.Delete(ctx, fileInfo); err != nil {
				if errors.Is(err, resources.ErrUnableToReadResourceBytes) {
					logger.InfoContext(ctx, "deleted file does not contain a resource")
					continue
				}

				logger.ErrorContext(ctx, "failed to delete removed resource", "error", err)
				continue
			}

			logger.InfoContext(ctx, "removed file")
		}
	}

	return nil
}

// changedResource represents a resource that has changed in a pull request.
type changedResource struct {
	Filename             string
	Path                 string
	Ref                  string
	Action               string
	Type                 string
	OriginalURL          string
	CurrentURL           string
	PreviewURL           string
	PreviewScreenshotURL string
	Data                 []byte
}

// onPullRequestEvent is called when a pull request event is received
// If the pull request is opened, reponed or synchronize, we read the files changed.
func (r *GithubWebhook) onPullRequestEvent(ctx context.Context, logger *slog.Logger, event *github.PullRequestEvent) error {
	action := event.GetAction()
	logger = logger.With("pull_request", event.GetNumber(), "action", action, "nnumber", event.GetNumber())
	logger.InfoContext(
		ctx,
		"processing pull request event",
		"linter",
		r.Config().Spec.GitHub.PullRequestLinter,
		"previews",
		r.Config().Spec.GitHub.GenerateDashboardPreviews,
	)

	if !r.Config().Spec.GitHub.PullRequestLinter && !r.Config().Spec.GitHub.GenerateDashboardPreviews {
		logger.DebugContext(ctx, "no action required on pull request event")
		return nil
	}

	if event.GetRepo() == nil {
		return fmt.Errorf("missing repository in pull request event")
	}

	if event.GetRepo().GetFullName() != fmt.Sprintf("%s/%s", r.Config().Spec.GitHub.Owner, r.Config().Spec.GitHub.Repository) {
		return fmt.Errorf("repository mismatch")
	}

	if action != "opened" && action != "reopened" && action != "synchronize" {
		logger.InfoContext(ctx, "ignore pull request event", "action", event.GetAction())
		return nil
	}

	// Get the files changed in the pull request
	files, err := r.gh.ListPullRequestFiles(ctx, r.Config().Spec.GitHub.Owner, r.Config().Spec.GitHub.Repository, event.GetNumber())
	if err != nil {
		return fmt.Errorf("list pull request files: %w", err)
	}

	changedResources := make([]changedResource, 0)

	baseBranch := event.GetPullRequest().GetBase().GetRef()
	mainBranch := r.Config().Spec.GitHub.Branch

	prURL := event.GetPullRequest().GetHTMLURL()

	for _, file := range files {
		resource := changedResource{
			Filename: path.Base(file.GetFilename()),
			Path:     file.GetFilename(),
			Action:   file.GetStatus(),
			Type:     "dashboard", // TODO: get this from the resource
			Ref:      event.GetPullRequest().GetHead().GetRef(),
		}

		path := file.GetFilename()
		logger := logger.With("file", path, "status", file.GetStatus(), "sha", file.GetSHA())

		// reference: https://docs.github.com/en/rest/commits/commits?apiVersion=2022-11-28#get-a-commit
		switch file.GetStatus() {
		case "added":
			resource.PreviewURL = r.previewURL(resource.Ref, path, prURL)
		case "modified":
			resource.OriginalURL = r.previewURL(baseBranch, path, prURL)
			resource.CurrentURL = r.previewURL(mainBranch, path, prURL)
			resource.PreviewURL = r.previewURL(resource.Ref, path, prURL)
		case "removed":
			resource.OriginalURL = r.previewURL(baseBranch, path, prURL)
			resource.CurrentURL = r.previewURL(mainBranch, path, prURL)
			resource.Ref = baseBranch
		case "renamed":
			resource.OriginalURL = r.previewURL(baseBranch, file.GetPreviousFilename(), prURL)
			resource.CurrentURL = r.previewURL(mainBranch, file.GetPreviousFilename(), prURL)
			resource.PreviewURL = r.previewURL(resource.Ref, path, prURL)
		case "changed":
			resource.OriginalURL = r.previewURL(baseBranch, path, prURL)
			resource.CurrentURL = r.previewURL(mainBranch, path, prURL)
			resource.PreviewURL = r.previewURL(resource.Ref, path, prURL)
		case "unchanged":
			logger.InfoContext(ctx, "ignore unchanged file")
			continue
		default:
			logger.ErrorContext(ctx, "unhandled pull request file")
			continue
		}

		f, err := r.Read(ctx, logger, path, resource.Ref)
		if err != nil {
			logger.ErrorContext(ctx, "failed to read file", "error", err)
			continue
		}

		// TODO: check if that parse is enough
		// TODO: use parsed file
		_, err = r.parser.Parse(ctx, logger, f, true)
		if err != nil {
			if errors.Is(err, resources.ErrUnableToReadResourceBytes) {
				logger.InfoContext(ctx, "ignore files as it does not contain a resource")
				continue
			}

			logger.ErrorContext(ctx, "failed to parse file", "error", err)
			continue
		}

		resource.Data = f.Data
		logger.InfoContext(ctx, "resource changed")
		changedResources = append(changedResources, resource)
	}

	if err := r.previewPullRequest(ctx, logger, event.GetNumber(), changedResources); err != nil {
		logger.ErrorContext(ctx, "failed to comment previews", "error", err)
	}

	headSha := event.GetPullRequest().GetHead().GetSHA()
	if err := r.lintPullRequest(ctx, logger, event.GetNumber(), headSha, changedResources); err != nil {
		logger.ErrorContext(ctx, "failed to lint pull request resources", "error", err)
	}

	return nil
}

var lintDashboardIssuesTemplate = `Hey there! 👋
Grafana found some linting issues in this dashboard you may want to check:
{{ range .}}
{{ if eq .Severity "error" }}❌{{ else if eq .Severity "warning" }}⚠️ {{ end }} [dashboard-linter/{{ .Rule }}](https://github.com/grafana/dashboard-linter/blob/main/docs/rules/{{ .Rule }}.md): {{ .Message }}.
{{- end }}
`

// lintPullRequest lints the files changed in the pull request and comments the issues found.
// The linter is disabled if the configuration does not have PullRequestLinter enabled.
// The only supported type of file to lint is a dashboard.
func (r *GithubWebhook) lintPullRequest(ctx context.Context, logger *slog.Logger, prNumber int, ref string, resources []changedResource) error {
	if !r.Config().Spec.GitHub.PullRequestLinter {
		return nil
	}

	logger.InfoContext(ctx, "lint pull request")

	// Load linter config
	cfg, err := r.Read(ctx, logger, r.linterFactory.ConfigPath(), ref)
	switch {
	case err == nil:
		logger.InfoContext(ctx, "linter config found", "config", string(cfg.Data))
	case errors.Is(err, pgh.ErrResourceNotFound):
		logger.InfoContext(ctx, "no linter config found")
	default:
		return fmt.Errorf("read linter config: %w", err)
	}

	linter, err := r.linterFactory.NewFromConfig(cfg.Data)
	if err != nil {
		return fmt.Errorf("create linter: %w", err)
	}

	// Clear all previous comments because we don't know if the files have changed
	if err := r.gh.ClearAllPullRequestFileComments(ctx, r.Config().Spec.GitHub.Owner, r.Config().Spec.GitHub.Repository, prNumber); err != nil {
		return fmt.Errorf("clear pull request comments: %w", err)
	}

	for _, resource := range resources {
		if resource.Action == "removed" || resource.Type != "dashboard" {
			continue
		}

		logger := logger.With("file", resource.Path)
		if err := r.lintPullRequestFile(ctx, logger, prNumber, ref, resource, linter); err != nil {
			logger.ErrorContext(ctx, "failed to lint file", "error", err)
		}
	}

	return nil
}

// lintPullRequestFile lints a file and comments the issues found.
func (r *GithubWebhook) lintPullRequestFile(ctx context.Context, logger *slog.Logger, prNumber int, ref string, resource changedResource, linter lint.Linter) error {
	issues, err := linter.Lint(ctx, resource.Data)
	if err != nil {
		return fmt.Errorf("lint file: %w", err)
	}

	if len(issues) == 0 {
		return nil
	}

	// FIXME: we should not be compiling this all the time
	tmpl, err := template.New("comment").Parse(lintDashboardIssuesTemplate)
	if err != nil {
		return fmt.Errorf("parse lint comment template: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, issues); err != nil {
		return fmt.Errorf("execute lint comment template: %w", err)
	}

	comment := pgh.FileComment{
		Content:  buf.String(),
		Path:     resource.Path,
		Position: 1, // create a top-level comment
		Ref:      ref,
	}

	// FIXME: comment with Grafana Logo
	// FIXME: comment author should be written by Grafana and not the user
	if err := r.gh.CreatePullRequestFileComment(ctx, r.Config().Spec.GitHub.Owner, r.Config().Spec.GitHub.Repository, prNumber, comment); err != nil {
		return fmt.Errorf("create pull request comment: %w", err)
	}
	logger.InfoContext(ctx, "lint comment created", "issues", len(issues))

	return nil
}

const previewsCommentTemplate = `Hey there! 🎉
Grafana spotted some changes for your resources in this pull request:

## Summary
| File Name | Type | Path | Action | Links |
|-----------|------|------|--------|-------|
{{- range .}}
| {{.Filename}} | {{.Type}} | {{.Path}} | {{.Action}} | {{if .OriginalURL}}[Original]({{.OriginalURL}}){{end}}{{if .CurrentURL}}, [Current]({{.CurrentURL}}){{end}}{{if .PreviewURL}}, [Preview]({{.PreviewURL}}){{end}}|
{{- end}}

Click the preview links above to view how your changes will look and compare them with the original and current versions.

{{- range .}}
{{- if .PreviewScreenshotURL}}
### Preview of {{.Filename}}
![Preview]({{.PreviewScreenshotURL}})
{{- end}}
{{- end}}`

func (r *GithubWebhook) previewPullRequest(ctx context.Context, logger *slog.Logger, prNumber int, resources []changedResource) error {
	if !r.Config().Spec.GitHub.GenerateDashboardPreviews || len(resources) == 0 {
		return nil
	}

	// generate preview image for each dashboard if not removed
	for i, resource := range resources {
		if resource.Action == "removed" {
			continue
		}

		screenshotURL, err := r.renderer.RenderDashboardPreview(ctx, r, resource.Path, resource.Ref)
		if err != nil {
			return fmt.Errorf("render dashboard preview: %w", err)
		}

		resources[i].PreviewScreenshotURL = screenshotURL
		logger.InfoContext(ctx, "dashboard preview screenshot created", "file", resource.Path, "url", screenshotURL)
	}

	// FIXME: we should not be compiling this all the time
	tmpl, err := template.New("comment").Parse(previewsCommentTemplate)
	if err != nil {
		return fmt.Errorf("parse comment template: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, resources); err != nil {
		return fmt.Errorf("execute comment template: %w", err)
	}

	comment := buf.String()

	// FIXME: comment with Grafana Logo
	// FIXME: comment author should be written by Grafana and not the user
	if err := r.gh.CreatePullRequestComment(ctx, r.Config().Spec.GitHub.Owner, r.Config().Spec.GitHub.Repository, prNumber, comment); err != nil {
		return fmt.Errorf("create pull request comment: %w", err)
	}

	logger.InfoContext(ctx, "preview comment created", "resources", len(resources))

	return nil
}

// previewURL returns the URL to preview the file in Grafana
func (r *GithubWebhook) previewURL(ref, filePath, pullRequestURL string) string {
	// Copy the baseURL to modify path and query
	baseURL := *r.baseURL
	baseURL.Path = path.Join(baseURL.Path, "/admin/provisioning", r.Config().GetName(), "dashboard/preview", filePath)

	query := baseURL.Query()
	query.Set("ref", ref)
	query.Set("pull_request_url", url.QueryEscape(pullRequestURL))
	baseURL.RawQuery = query.Encode()

	return baseURL.String()
}

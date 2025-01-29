package jobs

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"html/template"
	"net/url"
	"os"
	"path"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

type PullRequestWorker interface {
	ProcessPullRequest(ctx context.Context,
		repo repository.Repository,
		options provisioning.PullRequestOptions,
		progress func(provisioning.JobStatus) error,
	) (*provisioning.JobStatus, error)
}

// resourcePreview represents a resource that has changed in a pull request.
type resourcePreview struct {
	Filename             string
	Path                 string
	Action               string
	Kind                 string
	OriginalURL          string
	PreviewURL           string
	PreviewScreenshotURL string
}

const (
	lintDashboardIssuesTemplate = `Hey there! 👋
Grafana found some linting issues in this dashboard you may want to check:
{{ range .}}
{{ if eq .Severity "error" }}❌{{ else if eq .Severity "warning" }}⚠️ {{ end }} [dashboard-linter/{{ .Rule }}](https://github.com/grafana/dashboard-linter/blob/main/docs/rules/{{ .Rule }}.md): {{ .Message }}.
{{- end }}`
	previewsCommentTemplate = `Hey there! 🎉
Grafana spotted some changes for your resources in this pull request:
## Summary
| File Name | Kind | Path | Action | Links |
|-----------|------|------|--------|-------|
{{- range .}}
| {{.Filename}} | {{.Kind}} | {{.Path}} | {{.Action}} | {{if .OriginalURL}}[Original]({{.OriginalURL}}){{end}}{{if .PreviewURL}}, [Preview]({{.PreviewURL}}){{end}}|
{{- end}}

Click the preview links above to view how your changes will look and compare them with the original and current versions.

{{- range .}}
{{- if .PreviewScreenshotURL}}
### Preview of {{.Filename}}
![Preview]({{.PreviewScreenshotURL}})
{{- end}}{{- end}}`
)

type PullRequestRepo interface {
	Config() *provisioning.Repository
	Read(ctx context.Context, path, ref string) (*repository.FileInfo, error)
	CompareFiles(ctx context.Context, base, ref string) ([]repository.FileChange, error)
	ClearAllPullRequestFileComments(ctx context.Context, pr int) error
	CommentPullRequestFile(ctx context.Context, pr int, path string, ref string, comment string) error
	CommentPullRequest(ctx context.Context, pr int, comment string) error
}

// PreviewRenderer is an interface for rendering a preview of a file
type PreviewRenderer interface {
	IsAvailable(ctx context.Context) bool
	RenderDashboardPreview(ctx context.Context, path string, ref string) (string, error)
}

type pullRequestCommenter struct {
	repo         PullRequestRepo
	parser       *resources.Parser
	lintTemplate *template.Template
	prevTemplate *template.Template
	baseURL      *url.URL
	renderer     PreviewRenderer
}

func NewPullRequestCommenter(
	repo PullRequestRepo,
	parser *resources.Parser,
	renderer PreviewRenderer,
	baseURL *url.URL,
) (PullRequestWorker, error) {
	lintTemplate, err := template.New("comment").Parse(lintDashboardIssuesTemplate)
	if err != nil {
		return nil, fmt.Errorf("parse lint comment template: %w", err)
	}
	prevTemplate, err := template.New("comment").Parse(previewsCommentTemplate)
	if err != nil {
		return nil, fmt.Errorf("parse previews comment template: %w", err)
	}

	return &pullRequestCommenter{
		repo:         repo,
		parser:       parser,
		lintTemplate: lintTemplate,
		prevTemplate: prevTemplate,
		renderer:     renderer,
		baseURL:      baseURL,
	}, nil
}

func (c *pullRequestCommenter) ProcessPullRequest(ctx context.Context,
	repo repository.Repository,
	options provisioning.PullRequestOptions,
	progress func(provisioning.JobStatus) error,
) (*provisioning.JobStatus, error) {
	cfg := c.repo.Config().Spec

	// TODO: Figure out how we want to determine this in practice.
	lintingVal, ok := os.LookupEnv("GRAFANA_LINTING")
	linting := ok && lintingVal == "true"

	// TODO: clean specification to have better options
	if !linting &&
		!cfg.GitHub.GenerateDashboardPreviews {
		return &provisioning.JobStatus{
			State:   provisioning.JobStateSuccess,
			Message: "linting and previews are not required",
		}, nil
	}

	logger := logging.FromContext(ctx).With("pr", options.PR)
	logger.Info("process pull request")
	defer logger.Info("pull request processed")

	base := cfg.GitHub.Branch
	ref := options.Hash

	// list pull requests changes files
	files, err := c.repo.CompareFiles(ctx, base, ref)
	if err != nil {
		return &provisioning.JobStatus{
			State:   provisioning.JobStateError,
			Message: fmt.Sprintf("failed to list pull request files: %s", err.Error()),
		}, nil
	}

	// clear all previous comments
	if err := c.repo.ClearAllPullRequestFileComments(ctx, options.PR); err != nil {
		return &provisioning.JobStatus{
			State:   provisioning.JobStateError,
			Message: fmt.Sprintf("failed to clear pull request comments: %+v", err),
		}, nil
	}

	if len(files) == 0 {
		return &provisioning.JobStatus{
			State:   provisioning.JobStateSuccess,
			Message: "no files to process",
		}, nil
	}

	previews := make([]resourcePreview, 0, len(files))

	for _, f := range files {
		if resources.ShouldIgnorePath(f.Path) {
			continue
		}

		logger := logger.With("file", f.Path)
		fileInfo, err := c.repo.Read(ctx, f.Path, ref)
		if err != nil {
			return &provisioning.JobStatus{
				State:   provisioning.JobStateError,
				Message: fmt.Sprintf("failed to read file %s: %+v", f.Path, err),
			}, nil
		}

		parsed, err := c.parser.Parse(ctx, fileInfo, true)
		if err != nil {
			if errors.Is(err, resources.ErrUnableToReadResourceBytes) {
				logger.Debug("file is not a resource", "path", f.Path)
			} else {
				logger.Error("failed to parse resource", "path", f.Path, "error", err)
			}
			continue
		}

		if linting && len(parsed.Lint) > 0 && f.Action != repository.FileActionDeleted {
			var buf bytes.Buffer
			if err := c.lintTemplate.Execute(&buf, parsed.Lint); err != nil {
				return nil, fmt.Errorf("execute lint comment template: %w", err)
			}

			if err := c.repo.CommentPullRequestFile(ctx, options.PR, f.Path, ref, buf.String()); err != nil {
				return nil, fmt.Errorf("comment pull request file %s: %w", f.Path, err)
			}

			logger.Info("lint comment added")
		}

		preview := resourcePreview{
			Filename: path.Base(f.Path),
			Path:     f.Path,
			Kind:     "dashboard", // TODO: add more kinds
			Action:   string(f.Action),
		}

		switch f.Action {
		case repository.FileActionCreated:
			preview.PreviewURL = c.previewURL(ref, f.Path, options.URL)
		case repository.FileActionUpdated:
			preview.OriginalURL = c.previewURL(base, f.Path, options.URL)
			preview.PreviewURL = c.previewURL(ref, f.Path, options.URL)
		case repository.FileActionRenamed:
			preview.OriginalURL = c.previewURL(base, f.PreviousPath, options.URL)
			preview.PreviewURL = c.previewURL(ref, f.Path, options.URL)
		case repository.FileActionDeleted:
			preview.OriginalURL = c.previewURL(base, f.Path, options.URL)
		default:
			return nil, fmt.Errorf("unknown file action: %s", f.Action)
		}

		if cfg.GitHub.GenerateDashboardPreviews && f.Action != repository.FileActionDeleted {
			screenshotURL, err := c.renderer.RenderDashboardPreview(ctx, f.Path, ref)
			if err != nil {
				return nil, fmt.Errorf("render dashboard preview: %w", err)
			}
			preview.PreviewScreenshotURL = screenshotURL

			logger.Info("dashboard preview added", "screenshotURL", screenshotURL)
		}

		previews = append(previews, preview)
	}

	if len(previews) > 0 && cfg.GitHub.GenerateDashboardPreviews {
		var buf bytes.Buffer
		if err := c.prevTemplate.Execute(&buf, previews); err != nil {
			return nil, fmt.Errorf("execute previews comment template: %w", err)
		}

		if err := c.repo.CommentPullRequest(ctx, options.PR, buf.String()); err != nil {
			return nil, fmt.Errorf("comment pull request: %w", err)
		}

		logger.Info("previews comment added", "number", len(previews))
	}

	return &provisioning.JobStatus{
		State:   provisioning.JobStateSuccess,
		Message: "finished", // can update with useful feedback
	}, nil
}

// previewURL returns the URL to preview the file in Grafana
func (c *pullRequestCommenter) previewURL(ref, filePath, pullRequestURL string) string {
	// Copy the baseURL to modify path and query
	baseURL := *c.baseURL
	baseURL = *baseURL.JoinPath("/admin/provisioning", c.repo.Config().GetName(), "dashboard/preview", filePath)

	query := baseURL.Query()
	if ref != "" {
		query.Set("ref", ref)
	}
	if pullRequestURL != "" {
		query.Set("pull_request_url", url.QueryEscape(pullRequestURL))
	}
	baseURL.RawQuery = query.Encode()

	return baseURL.String()
}

package jobs

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"html/template"
	"log/slog"
	"net/url"
	"path"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// resourcePreview represents a resource that has changed in a pull request.
type resourcePreview struct {
	Filename             string
	Path                 string
	Action               string
	Type                 string
	OriginalURL          string
	PreviewURL           string
	PreviewScreenshotURL string
}

const (
	lintDashboardIssuesTemplate = `Hey there! 👋
	Grafana found some linting issues in this dashboard you may want to check:
	{{ range .}}
	{{ if eq .Severity "error" }}❌{{ else if eq .Severity "warning" }}⚠️ {{ end }} [dashboard-linter/{{ .Rule }}](https://github.com/grafana/dashboard-linter/blob/main/docs/rules/{{ .Rule }}.md): {{ .Message }}.
	{{- end }}
	`
	previewsCommentTemplate = `Hey there! 🎉
	Grafana spotted some changes for your resources in this pull request:

## Summary
	| File Name | Type | Path | Action | Links |
	|-----------|------|------|--------|-------|
	{{- range .}}
	| {{.Filename}} | {{.Type}} | {{.Path}} | {{.Action}} | {{if .OriginalURL}}[Original]({{.OriginalURL}}){{end}}{{if .PreviewURL}}, [Preview]({{.PreviewURL}}){{end}}|
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
	Read(ctx context.Context, logger *slog.Logger, path, ref string) (*repository.FileInfo, error)
	CompareFiles(ctx context.Context, logger *slog.Logger, base, ref string) ([]repository.FileChange, error)
	ClearAllPullRequestComments(ctx context.Context, pr int) error
	CommentPullRequestFile(ctx context.Context, pr int, path string, ref string, comment string) error
	CommentPullRequest(ctx context.Context, pr int, comment string) error
}

// PreviewRenderer is an interface for rendering a preview of a file
type PreviewRenderer interface {
	IsAvailable(ctx context.Context) bool
	RenderDashboardPreview(ctx context.Context, path string, ref string) (string, error)
}

type PullRequestCommenter struct {
	repo         PullRequestRepo
	parser       *resources.Parser
	logger       *slog.Logger
	lintTemplate *template.Template
	prevTemplate *template.Template
	baseURL      *url.URL
	renderer     PreviewRenderer
}

func NewPullRequestCommenter(
	repo PullRequestRepo,
	parser *resources.Parser,
	logger *slog.Logger,
	renderer PreviewRenderer,
	baseURL *url.URL,
) (*PullRequestCommenter, error) {
	lintTemplate, err := template.New("comment").Parse(lintDashboardIssuesTemplate)
	if err != nil {
		return nil, fmt.Errorf("parse lint comment template: %w", err)
	}
	prevTemplate, err := template.New("comment").Parse(previewsCommentTemplate)
	if err != nil {
		return nil, fmt.Errorf("parse previews comment template: %w", err)
	}

	return &PullRequestCommenter{
		repo:         repo,
		parser:       parser,
		logger:       logger,
		lintTemplate: lintTemplate,
		prevTemplate: prevTemplate,
		renderer:     renderer,
		baseURL:      baseURL,
	}, nil
}

func (c *PullRequestCommenter) Process(ctx context.Context, job provisioning.Job) error {
	if job.Spec.Action != provisioning.JobActionPullRequest {
		return errors.New("job is not a pull request")
	}

	// TODO: clean specification to have better options
	if (c.repo.Config().Spec.Linting && c.repo.Config().Spec.GitHub.PullRequestLinter) ||
		c.repo.Config().Spec.GitHub.GenerateDashboardPreviews {
		return nil
	}

	logger := c.logger
	spec := job.Spec
	base := c.repo.Config().Spec.GitHub.Branch

	// list pull requests changes files
	files, err := c.repo.CompareFiles(ctx, logger, base, spec.Hash)
	if err != nil {
		return fmt.Errorf("failed to list pull request files: %w", err)
	}

	// clear all previous comments
	if err := c.repo.ClearAllPullRequestComments(ctx, spec.PR); err != nil {
		return fmt.Errorf("failed to clear pull request comments: %w", err)
	}

	previews := make([]resourcePreview, 0, len(files))

	for _, f := range files {
		// TODO: ignore files?

		fileInfo, err := c.repo.Read(ctx, logger, f.Path, f.Ref)
		if err != nil {
			return fmt.Errorf("failed to read file %s: %w", f.Path, err)
		}

		parsed, err := c.parser.Parse(ctx, logger, fileInfo, true)
		if err != nil {
			if errors.Is(err, resources.ErrUnableToReadResourceBytes) {
				logger.DebugContext(ctx, "file is not a resource", "path", f.Path)
			} else {
				logger.ErrorContext(ctx, "failed to parse resource", "path", f.Path, "error", err)
			}
			continue
		}

		if true && len(parsed.Lint) > 0 && f.Action != repository.FileActionDeleted {
			var buf bytes.Buffer
			if err := c.lintTemplate.Execute(&buf, parsed.Lint); err != nil {
				return fmt.Errorf("execute lint comment template: %w", err)
			}

			// TODO: use job.Hash?
			if err := c.repo.CommentPullRequestFile(ctx, spec.PR, f.Path, f.Ref, buf.String()); err != nil {
				return fmt.Errorf("comment pull request file %s: %w", f.Path, err)
			}
		}
		preview := resourcePreview{
			Filename: path.Base(f.Path),
			Path:     f.Path,
			Type:     "dashboard", // TODO: add more types
			Action:   string(f.Action),
		}

		switch f.Action {
		case repository.FileActionCreated:
			preview.PreviewURL = c.previewURL(spec.Hash, f.Path, spec.URL)
		case repository.FileActionUpdated:
			preview.OriginalURL = c.previewURL(base, f.Path, spec.URL)
			preview.PreviewURL = c.previewURL(spec.Hash, f.Path, spec.URL)
		case repository.FileActionRenamed:
			preview.OriginalURL = c.previewURL(base, f.PreviousPath, spec.URL)
			preview.PreviewURL = c.previewURL(spec.Hash, f.Path, spec.URL)
		case repository.FileActionDeleted:
			preview.OriginalURL = c.previewURL(base, f.Path, spec.URL)
		default:
			return fmt.Errorf("unknown file action: %s", f.Action)
		}

		if c.repo.Config().Spec.GitHub.GenerateDashboardPreviews || f.Action != repository.FileActionDeleted {
			screenshotURL, err := c.renderer.RenderDashboardPreview(ctx, f.Path, f.Ref)
			if err != nil {
				return fmt.Errorf("render dashboard preview: %w", err)
			}
			preview.PreviewScreenshotURL = screenshotURL
		}

		previews = append(previews, preview)
	}

	if len(previews) > 0 && c.repo.Config().Spec.GitHub.GenerateDashboardPreviews {
		var buf bytes.Buffer
		if err := c.prevTemplate.Execute(&buf, previews); err != nil {
			return fmt.Errorf("execute previews comment template: %w", err)
		}

		if err := c.repo.CommentPullRequest(ctx, spec.PR, buf.String()); err != nil {
			return fmt.Errorf("comment pull request: %w", err)
		}
	}

	return nil
}

// previewURL returns the URL to preview the file in Grafana
func (c *PullRequestCommenter) previewURL(ref, filePath, pullRequestURL string) string {
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

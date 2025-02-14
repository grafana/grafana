package pullrequest

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"html/template"
	"net/url"
	"os"
	"path"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

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
	CompareFiles(ctx context.Context, base, ref string) ([]repository.VersionedFileChange, error)
	ClearAllPullRequestFileComments(ctx context.Context, pr int) error
	CommentPullRequestFile(ctx context.Context, pr int, path string, ref string, comment string) error
	CommentPullRequest(ctx context.Context, pr int, comment string) error
}

// PreviewRenderer is an interface for rendering a preview of a file
type PreviewRenderer interface {
	IsAvailable(ctx context.Context) bool
	RenderDashboardPreview(ctx context.Context, namespace, repoName, path, ref string) (string, error)
}

type PullRequestWorker struct {
	parsers      *resources.ParserFactory
	lintTemplate *template.Template
	prevTemplate *template.Template
	urlProvider  func(namespace string) string
	renderer     PreviewRenderer
}

func NewPullRequestWorker(
	parsers *resources.ParserFactory,
	renderer PreviewRenderer,
	urlProvider func(namespace string) string,
) (*PullRequestWorker, error) {
	lintTemplate, err := template.New("comment").Parse(lintDashboardIssuesTemplate)
	if err != nil {
		return nil, fmt.Errorf("parse lint comment template: %w", err)
	}
	prevTemplate, err := template.New("comment").Parse(previewsCommentTemplate)
	if err != nil {
		return nil, fmt.Errorf("parse previews comment template: %w", err)
	}

	return &PullRequestWorker{
		parsers:      parsers,
		lintTemplate: lintTemplate,
		prevTemplate: prevTemplate,
		renderer:     renderer,
		urlProvider:  urlProvider,
	}, nil
}

func (c *PullRequestWorker) IsSupported(ctx context.Context, job provisioning.Job) bool {
	return job.Spec.Action == provisioning.JobActionPullRequest
}

//nolint:gocyclo
func (c *PullRequestWorker) Process(ctx context.Context,
	repo repository.Repository,
	job provisioning.Job,
	progress *jobs.JobProgressRecorder,
) (*provisioning.JobStatus, error) {
	cfg := repo.Config().Spec

	options := job.Spec.PullRequest
	if options == nil {
		return nil, apierrors.NewBadRequest("missing spec.pr")
	}

	prRepo, ok := repo.(PullRequestRepo)
	if !ok {
		return nil, fmt.Errorf("repository is not a github repository")
	}

	baseURL, err := url.Parse(c.urlProvider(job.Namespace))
	if err != nil {
		return nil, fmt.Errorf("error parsing base url: %w", err)
	}

	parser, err := c.parsers.GetParser(ctx, repo)
	if err != nil {
		return nil, fmt.Errorf("failed to get parser for %s: %w", repo.Config().Name, err)
	}

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
	files, err := prRepo.CompareFiles(ctx, base, ref)
	if err != nil {
		return &provisioning.JobStatus{
			State:   provisioning.JobStateError,
			Message: fmt.Sprintf("failed to list pull request files: %s", err.Error()),
		}, nil
	}

	// clear all previous comments
	if err := prRepo.ClearAllPullRequestFileComments(ctx, options.PR); err != nil {
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
		fileInfo, err := prRepo.Read(ctx, f.Path, ref)
		if err != nil {
			return &provisioning.JobStatus{
				State:   provisioning.JobStateError,
				Message: fmt.Sprintf("failed to read file %s: %+v", f.Path, err),
			}, nil
		}

		parsed, err := parser.Parse(ctx, fileInfo, true)
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

			if err := prRepo.CommentPullRequestFile(ctx, options.PR, f.Path, ref, buf.String()); err != nil {
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
			preview.PreviewURL = c.previewURL(baseURL, repo.Config().GetName(), ref, f.Path, options.URL)
		case repository.FileActionUpdated:
			preview.OriginalURL = c.previewURL(baseURL, repo.Config().GetName(), ref, f.Path, options.URL)
			preview.PreviewURL = c.previewURL(baseURL, repo.Config().GetName(), ref, f.Path, options.URL)
		case repository.FileActionRenamed:
			preview.OriginalURL = c.previewURL(baseURL, repo.Config().GetName(), base, f.PreviousPath, options.URL)
			preview.PreviewURL = c.previewURL(baseURL, repo.Config().GetName(), ref, f.Path, options.URL)
		case repository.FileActionDeleted:
			preview.OriginalURL = c.previewURL(baseURL, repo.Config().GetName(), base, f.Path, options.URL)
		default:
			return nil, fmt.Errorf("unknown file action: %s", f.Action)
		}

		if cfg.GitHub.GenerateDashboardPreviews && f.Action != repository.FileActionDeleted {
			screenshotURL, err := c.renderer.RenderDashboardPreview(ctx, repo.Config().GetNamespace(), repo.Config().GetName(), f.Path, ref)
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

		if err := prRepo.CommentPullRequest(ctx, options.PR, buf.String()); err != nil {
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
func (c *PullRequestWorker) previewURL(u *url.URL, repoName, ref, filePath, pullRequestURL string) string {
	// Copy the baseURL to modify path and query
	baseURL := *u
	baseURL = *baseURL.JoinPath("/admin/provisioning", repoName, "dashboard/preview", filePath)

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

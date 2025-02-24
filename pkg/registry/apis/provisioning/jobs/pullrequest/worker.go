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

// generatePreviewComment creates a formatted comment for dashboard previews
func (c *PullRequestWorker) generatePreviewComment(previews []resourcePreview) (string, error) {
	var buf bytes.Buffer
	if err := c.prevTemplate.Execute(&buf, previews); err != nil {
		return "", fmt.Errorf("execute previews comment template: %w", err)
	}
	return buf.String(), nil
}

func (c *PullRequestWorker) lintFile(
	ctx context.Context,
	prRepo PullRequestRepo,
	options *provisioning.PullRequestJobOptions,
	path string,
	ref string,
	lintResults []provisioning.LintIssue,
) error {
	if len(lintResults) == 0 {
		return nil
	}
	var buf bytes.Buffer
	if err := c.lintTemplate.Execute(&buf, lintResults); err != nil {
		return fmt.Errorf("execute lint comment template: %w", err)
	}

	if err := prRepo.CommentPullRequestFile(ctx, options.PR, path, ref, buf.String()); err != nil {
		return fmt.Errorf("comment pull request file %s: %w", path, err)
	}

	logging.FromContext(ctx).Info("lint comment added", "path", path)
	return nil
}

// processFile handles the parsing, linting, and preview generation for a single file
func (c *PullRequestWorker) processFile(
	ctx context.Context,
	f repository.VersionedFileChange,
	prRepo PullRequestRepo,
	parser *resources.Parser,
	options *provisioning.PullRequestJobOptions,
	baseURL *url.URL,
	ref string,
	linting bool,
) (*resourcePreview, error) {
	if resources.ShouldIgnorePath(f.Path) {
		return nil, nil
	}

	cfg := prRepo.Config().Spec
	logger := logging.FromContext(ctx).With("file", f.Path)
	fileInfo, err := prRepo.Read(ctx, f.Path, ref)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	parsed, err := parser.Parse(ctx, fileInfo, true)
	if err != nil {
		if errors.Is(err, resources.ErrUnableToReadResourceBytes) {
			logger.Debug("file is not a resource", "path", f.Path)
		} else {
			logger.Error("failed to parse resource", "error", err)
		}
		return nil, nil
	}

	if linting && f.Action != repository.FileActionDeleted {
		if err := c.lintFile(ctx, prRepo, options, f.Path, ref, parsed.Lint); err != nil {
			return nil, fmt.Errorf("failed to lint file: %w", err)
		}
	}

	repoName := prRepo.Config().GetName()
	preview := &resourcePreview{
		Filename:    path.Base(f.Path),
		Path:        f.Path,
		Kind:        "dashboard", // TODO: add more kinds
		Action:      string(f.Action),
		PreviewURL:  c.getPreviewURL(f, baseURL, repoName, ref, options.URL),
		OriginalURL: c.getOriginalURL(f, baseURL, repoName, cfg.GitHub.Branch, options.URL),
	}

	if cfg.GitHub.GenerateDashboardPreviews && f.Action != repository.FileActionDeleted {
		screenshotURL, err := c.renderer.RenderDashboardPreview(ctx, prRepo.Config().GetNamespace(), prRepo.Config().GetName(), f.Path, ref)
		if err != nil {
			return nil, fmt.Errorf("render dashboard preview: %w", err)
		}
		preview.PreviewScreenshotURL = screenshotURL
		logger.Info("dashboard preview added", "screenshotURL", screenshotURL)
	}

	return preview, nil
}

// getOriginalURL returns the URL for the original version of the file based on the action
func (c *PullRequestWorker) getOriginalURL(f repository.VersionedFileChange, baseURL *url.URL, repoName, base, pullRequestURL string) string {
	if f.Action == repository.FileActionCreated {
		return "" // No original URL for new files
	}

	path := f.Path
	if f.Action == repository.FileActionRenamed {
		path = f.PreviousPath
	}

	return c.previewURL(baseURL, repoName, base, path, pullRequestURL)
}

// getPreviewURL returns the URL for the preview version of the file based on the action
func (c *PullRequestWorker) getPreviewURL(f repository.VersionedFileChange, baseURL *url.URL, repoName, ref, pullRequestURL string) string {
	if f.Action == repository.FileActionDeleted {
		return ""
	}

	return c.previewURL(baseURL, repoName, ref, f.Path, pullRequestURL)
}

//nolint:gocyclo
func (c *PullRequestWorker) Process(ctx context.Context,
	repo repository.Repository,
	job provisioning.Job,
	progress jobs.JobProgressRecorder,
) error {
	cfg := repo.Config().Spec
	options := job.Spec.PullRequest
	if options == nil {
		return apierrors.NewBadRequest("missing spec.pr")
	}

	prRepo, ok := repo.(PullRequestRepo)
	if !ok {
		return fmt.Errorf("repository is not a github repository")
	}

	baseURL, err := url.Parse(c.urlProvider(job.Namespace))
	if err != nil {
		return fmt.Errorf("error parsing base url: %w", err)
	}

	reader, ok := repo.(repository.Reader)
	if !ok {
		return errors.New("pull request job submitted targeting repository that is not a Reader")
	}

	parser, err := c.parsers.GetParser(ctx, reader)
	if err != nil {
		return fmt.Errorf("failed to get parser for %s: %w", repo.Config().Name, err)
	}

	// TODO: Figure out how we want to determine this in practice.
	lintingVal, ok := os.LookupEnv("GRAFANA_LINTING")
	linting := ok && lintingVal == "true"

	// TODO: clean specification to have better options
	if !linting &&
		!cfg.GitHub.GenerateDashboardPreviews {
		progress.SetMessage("linting and previews are not required")
		return nil
	}

	logger := logging.FromContext(ctx).With("pr", options.PR)
	logger.Info("process pull request")
	defer logger.Info("pull request processed")

	// list pull requests changes files
	base := cfg.GitHub.Branch
	ref := options.Hash
	files, err := prRepo.CompareFiles(ctx, base, ref)
	if err != nil {
		return fmt.Errorf("failed to list pull request files: %s", err.Error())
	}

	// clear all previous comments
	if err := prRepo.ClearAllPullRequestFileComments(ctx, options.PR); err != nil {
		return fmt.Errorf("failed to clear pull request comments: %+v", err)
	}

	if len(files) == 0 {
		progress.SetMessage("no files to process")
		return nil
	}

	previews := make([]resourcePreview, 0, len(files))
	for _, f := range files {
		preview, err := c.processFile(ctx, f, prRepo, parser, options, baseURL, ref, linting)
		if err != nil {
			return fmt.Errorf("failed to process file %s: %w", f.Path, err)
		}
		if preview != nil {
			previews = append(previews, *preview)
		}
	}

	if len(previews) == 0 || !cfg.GitHub.GenerateDashboardPreviews {
		progress.SetMessage("no previews to add")
		return nil
	}

	comment, err := c.generatePreviewComment(previews)
	if err != nil {
		return err
	}

	if err := prRepo.CommentPullRequest(ctx, options.PR, comment); err != nil {
		return fmt.Errorf("comment pull request: %w", err)
	}

	logger.Info("previews comment added", "number", len(previews))
	return nil
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

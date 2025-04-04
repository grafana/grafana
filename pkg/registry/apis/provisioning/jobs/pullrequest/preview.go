package pullrequest

import (
	"bytes"
	"context"
	"fmt"
	"html/template"
	"net/url"
	"path"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

// resourcePreview represents a resource that has changed in a pull request.
type resourcePreview struct {
	Filename              string
	Path                  string
	Action                string
	Kind                  string
	OriginalURL           string
	OriginalScreenshotURL string
	PreviewURL            string
	PreviewScreenshotURL  string
}

const previewsCommentTemplate = `Hey there! 🎉
Grafana spotted some changes in your dashboard.

{{- if and .OriginalScreenshotURL .PreviewScreenshotURL}}
### Side by Side Comparison of {{.Filename}}
| Original | Preview |
|----------|---------|
| ![Original]({{.OriginalScreenshotURL}}) | ![Preview]({{.PreviewScreenshotURL}}) |
{{- else if .OriginalScreenshotURL}}
### Original of {{.Filename}}
![Original]({{.OriginalScreenshotURL}})
{{- else if .PreviewScreenshotURL}}
### Preview of {{.Filename}}
![Preview]({{.PreviewScreenshotURL}})
{{ end}}

{{ if and .OriginalURL .PreviewURL}}
See the [original]({{.OriginalURL}}) and [preview]({{.PreviewURL}}) of {{.Filename}}.
{{- else if .OriginalURL}}
See the [original]({{.OriginalURL}}) of {{.Filename}}.
{{- else if .PreviewURL}}
See the [preview]({{.PreviewURL}}) of {{.Filename}}.
{{- end}}`

// PreviewRenderer is an interface for rendering a preview of a file
type PreviewRenderer interface {
	IsAvailable(ctx context.Context) bool
	RenderDashboardPreview(ctx context.Context, namespace, repoName, path, ref string) (string, error)
}

type Previewer struct {
	template    *template.Template
	urlProvider func(namespace string) string
	renderer    PreviewRenderer
}

func NewPreviewer(renderer PreviewRenderer, urlProvider func(namespace string) string) *Previewer {
	return &Previewer{
		template:    template.Must(template.New("comment").Parse(previewsCommentTemplate)),
		urlProvider: urlProvider,
		renderer:    renderer,
	}
}

// GenerateComment creates a formatted comment for dashboard previews
func (p *Previewer) GenerateComment(preview resourcePreview) (string, error) {
	var buf bytes.Buffer
	if err := p.template.Execute(&buf, preview); err != nil {
		return "", fmt.Errorf("execute previews comment template: %w", err)
	}
	return buf.String(), nil
}

// getOriginalURL returns the URL for the original version of the file based on the action
func (p *Previewer) getOriginalURL(ctx context.Context, f repository.VersionedFileChange, baseURL *url.URL, repoName, base, pullRequestURL string) string {
	switch f.Action {
	case repository.FileActionCreated:
		return "" // No original URL for new files
	case repository.FileActionUpdated:
		return p.previewURL(baseURL, repoName, base, f.Path, pullRequestURL)
	case repository.FileActionRenamed:
		return p.previewURL(baseURL, repoName, base, f.PreviousPath, pullRequestURL)
	case repository.FileActionDeleted:
		return p.previewURL(baseURL, repoName, base, f.Path, pullRequestURL)
	default:
		logging.FromContext(ctx).Error("unknown file action for original URL", "action", f.Action)
		return ""
	}
}

// getPreviewURL returns the URL for the preview version of the file based on the action
func (p *Previewer) getPreviewURL(ctx context.Context, f repository.VersionedFileChange, baseURL *url.URL, repoName, ref, pullRequestURL string) string {
	switch f.Action {
	case repository.FileActionCreated, repository.FileActionUpdated, repository.FileActionRenamed:
		return p.previewURL(baseURL, repoName, ref, f.Path, pullRequestURL)
	case repository.FileActionDeleted:
		return "" // No preview URL for deleted files
	default:
		logging.FromContext(ctx).Error("unknown file action for preview URL", "action", f.Action)
		return ""
	}
}

// previewURL returns the URL to preview the file in Grafana
func (p *Previewer) previewURL(u *url.URL, repoName, ref, filePath, pullRequestURL string) string {
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

// Preview creates a preview for a single file change
func (p *Previewer) Preview(
	ctx context.Context,
	f repository.VersionedFileChange,
	namespace string,
	repoName string,
	base string,
	ref string,
	pullRequestURL string,
	generatePreview bool,
) (resourcePreview, error) {
	baseURL, err := url.Parse(p.urlProvider(namespace))
	if err != nil {
		return resourcePreview{}, fmt.Errorf("error parsing base url: %w", err)
	}

	preview := resourcePreview{
		Filename:    path.Base(f.Path),
		Path:        f.Path,
		Kind:        "dashboard", // TODO: add more kinds
		Action:      string(f.Action),
		OriginalURL: p.getOriginalURL(ctx, f, baseURL, repoName, base, pullRequestURL),
		PreviewURL:  p.getPreviewURL(ctx, f, baseURL, repoName, ref, pullRequestURL),
	}

	if !generatePreview {
		logger.Info("skipping dashboard preview generation", "path", f.Path)
		return preview, nil
	}

	if preview.PreviewURL != "" {
		screenshotURL, err := p.renderer.RenderDashboardPreview(ctx, namespace, repoName, f.Path, ref)
		if err != nil {
			return resourcePreview{}, fmt.Errorf("render dashboard preview: %w", err)
		}
		preview.PreviewScreenshotURL = screenshotURL
		logger.Info("dashboard preview screenshot generated", "screenshotURL", screenshotURL)
	}

	if preview.OriginalURL != "" {
		originalPath := f.PreviousPath
		if originalPath == "" {
			originalPath = f.Path
		}

		screenshotURL, err := p.renderer.RenderDashboardPreview(ctx, namespace, repoName, originalPath, base)
		if err != nil {
			return resourcePreview{}, fmt.Errorf("render dashboard preview: %w", err)
		}
		preview.OriginalScreenshotURL = screenshotURL
		logger.Info("original dashboard screenshot generated", "screenshotURL", screenshotURL)
	}

	return preview, nil
}

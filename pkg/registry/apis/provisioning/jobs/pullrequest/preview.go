package pullrequest

import (
	"bytes"
	"context"
	"fmt"
	"html/template"
	"net/url"
	"path"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// resourcePreview represents a resource that has changed in a pull request.
type resourcePreview struct {
	Filename             string
	Path                 string
	Action               string
	Kind                 string
	TargetURL            string
	TargetScreenshotURL  string
	PreviewURL           string
	PreviewScreenshotURL string
}

const previewsCommentTemplate = `Hey there! 🎉
Grafana spotted some changes in your dashboard.

{{- if and .TargetScreenshotURL .PreviewScreenshotURL}}
### Side by Side Comparison of {{.Filename}}
| Before | After |
|----------|---------|
| ![Before]({{.TargetScreenshotURL}}) | ![Preview]({{.PreviewScreenshotURL}}) |
{{- else if .TargetScreenshotURL}}
### Original of {{.Filename}}
![Original]({{.TargetScreenshotURL}})
{{- else if .PreviewScreenshotURL}}
### Preview of {{.Filename}}
![Preview]({{.PreviewScreenshotURL}})
{{ end}}

{{ if and .TargetURL .PreviewURL}}
See the [original]({{.TargetURL}}) and [preview]({{.PreviewURL}}) of {{.Filename}}.
{{- else if .TargetURL}}
See the [original]({{.TargetURL}}) of {{.Filename}}.
{{- else if .PreviewURL}}
See the [preview]({{.PreviewURL}}) of {{.Filename}}.
{{- end}}`

// PreviewRenderer is an interface for rendering a preview of a file
//
//go:generate mockery --name PreviewRenderer --structname MockPreviewRenderer --inpackage --filename preview_renderer_mock.go --with-expecter
type PreviewRenderer interface {
	IsAvailable(ctx context.Context) bool
	RenderScreenshot(ctx context.Context, namespace, repoName, url string) (string, error)
}

// Previewer is a service for previewing dashboard changes in a pull request
//
//go:generate mockery --name Previewer --structname MockPreviewer --inpackage --filename previewer_mock.go --with-expecter
type Previewer interface {
	Preview(ctx context.Context, f *resources.ParsedResource, pullRequestURL string, generatePreview bool) (resourcePreview, error)
	GenerateComment(preview resourcePreview) (string, error)
}

type previewer struct {
	template    *template.Template
	urlProvider func(namespace string) string
	renderer    PreviewRenderer
}

func NewPreviewer(renderer PreviewRenderer, urlProvider func(namespace string) string) *previewer {
	return &previewer{
		template:    template.Must(template.New("comment").Parse(previewsCommentTemplate)),
		urlProvider: urlProvider,
		renderer:    renderer,
	}
}

// GenerateComment creates a formatted comment for dashboard previews
func (p *previewer) GenerateComment(preview resourcePreview) (string, error) {
	var buf bytes.Buffer
	if err := p.template.Execute(&buf, preview); err != nil {
		return "", fmt.Errorf("execute previews comment template: %w", err)
	}
	return buf.String(), nil
}

// previewURL returns the URL to preview the file in Grafana
func (p *previewer) previewURL(u *url.URL, repoName, ref, filePath, pullRequestURL string) string {
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
func (p *previewer) Preview(
	ctx context.Context,
	f *resources.ParsedResource,
	pullRequestURL string,
	generatePreview bool,
) (resourcePreview, error) {
	namespace := f.Obj.GetNamespace()
	baseURL, err := url.Parse(p.urlProvider(namespace))
	if err != nil {
		return resourcePreview{}, fmt.Errorf("error parsing base url: %w", err)
	}

	if f.GVK.Kind != "Dashboard" {
		return resourcePreview{}, fmt.Errorf("only dashboards are supported")
	}

	err = f.DryRun(ctx)
	if err != nil {
		return resourcePreview{}, fmt.Errorf("error running dry run: %w", err)
	}

	preview := resourcePreview{
		Filename:  path.Base(f.Info.Path),
		Path:      f.Info.Path,
		Kind:      f.GVK.Kind,
		Action:    string(f.Action),
		TargetURL: fmt.Sprintf("%sd/%s/%s", baseURL.String(), f.Obj.GetName(), f.Meta.FindTitle("")),
	}

	if f.Action != provisioning.ResourceActionDelete {
		preview.PreviewURL = p.previewURL(baseURL, f.Repo.Name, f.Info.Ref, f.Info.Path, pullRequestURL)
	}

	if !generatePreview {
		logger.Info("skipping dashboard preview generation", "path", f.Info.Path)
		return preview, nil
	}

	// Render the *before* image
	if preview.TargetURL != "" && f.Action == provisioning.ResourceActionUpdate {
		screenshotURL, err := p.renderer.RenderScreenshot(ctx, namespace, f.Repo.Name, preview.TargetURL)
		if err != nil {
			return resourcePreview{}, fmt.Errorf("render dashboard preview: %w", err)
		}
		preview.TargetScreenshotURL = screenshotURL
		logger.Info("target dashboard screenshot generated", "screenshotURL", screenshotURL)
	}

	if preview.PreviewURL != "" {
		screenshotURL, err := p.renderer.RenderScreenshot(ctx, namespace, f.Repo.Name, preview.PreviewURL)
		if err != nil {
			return resourcePreview{}, fmt.Errorf("render dashboard preview: %w", err)
		}
		preview.PreviewScreenshotURL = screenshotURL
		logger.Info("dashboard preview screenshot generated", "screenshotURL", screenshotURL)
	}

	return preview, nil
}

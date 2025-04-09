package pullrequest

import (
	"context"
	"html/template"

	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
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
	TargetURL            string
	TargetScreenshotURL  string
	PreviewURL           string
	PreviewScreenshotURL string
}

var dashboardKind = dashboard.DashboardResourceInfo.GroupVersionKind().Kind

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

type CommentOptions struct {
	PullRequest     provisioning.PullRequestJobOptions
	Changes         []repository.VersionedFileChange
	Parser          resources.Parser
	Reader          repository.Reader
	Progress        jobs.JobProgressRecorder
	GeneratePreview bool
}

// CommentGenerator is a service for previewing dashboard changes in a pull request
//
//go:generate mockery --name CommentGenerator --structname MockCommentGenerator --inpackage --filename generator_mock.go --with-expecter
type CommentGenerator interface {
	PrepareChanges(ctx context.Context, opts CommentOptions) (changeInfo, error)
	GenerateComment(ctx context.Context, info changeInfo) (string, error)
}

type generator struct {
	template    *template.Template
	urlProvider func(namespace string) string
	renderer    ScreenshotRenderer
}

func NewCommentGenerator(renderer ScreenshotRenderer, urlProvider func(namespace string) string) *generator {
	return &generator{
		template:    template.Must(template.New("comment").Parse(previewsCommentTemplate)),
		urlProvider: urlProvider,
		renderer:    renderer,
	}
}

// // GenerateComment creates a formatted comment for dashboard previews
// func (c *commenter) xenerateComment(preview resourcePreview) (string, error) {
// 	var buf bytes.Buffer
// 	if err := x.template.Execute(&buf, preview); err != nil {
// 		return "", fmt.Errorf("execute previews comment template: %w", err)
// 	}
// 	return buf.String(), nil
// }

// // previewURL returns the URL to preview the file in Grafana
// func (p *previewer) previewURL(u *url.URL, repoName, ref, filePath, pullRequestURL string) string {
// 	baseURL := *u
// 	baseURL = *baseURL.JoinPath(

// 	query := baseURL.Query()
// 	if ref != "" {
// 		query.Set("ref", ref)
// 	}
// 	if pullRequestURL != "" {
// 		query.Set("pull_request_url", url.QueryEscape(pullRequestURL))
// 	}
// 	baseURL.RawQuery = query.Encode()

// 	return baseURL.String()
// }

// // Preview creates a preview for a single file change
// func (p *previewer) Preview(
// 	ctx context.Context,
// 	f *resources.ParsedResource,
// 	pullRequestURL string,
// 	generatePreview bool,
// ) (resourcePreview, error) {
// 	namespace := f.Obj.GetNamespace()
// 	baseURL, err := url.Parse(p.urlProvider(namespace))
// 	if err != nil {
// 		return resourcePreview{}, fmt.Errorf("error parsing base url: %w", err)
// 	}

// 	if f.GVK.Kind != dashboard.DashboardResourceInfo.GroupVersionKind().Kind {
// 		return resourcePreview{}, fmt.Errorf("only dashboards are supported")
// 	}

// 	err = f.DryRun(ctx)
// 	if err != nil {
// 		return resourcePreview{}, fmt.Errorf("error running dry run: %w", err)
// 	}

// 	preview := resourcePreview{
// 		Filename:  path.Base(f.Info.Path),
// 		Path:      f.Info.Path,
// 		Kind:      f.GVK.Kind,
// 		Action:    string(f.Action),
// 		TargetURL: fmt.Sprintf("%sd/%s/%s", baseURL.String(), f.Obj.GetName(), f.Meta.FindTitle("")),
// 	}

// 	if f.Action != provisioning.ResourceActionDelete {
// 		preview.PreviewURL = p.previewURL(baseURL, f.Repo.Name, f.Info.Ref, f.Info.Path, pullRequestURL)
// 	}

// 	if !generatePreview {
// 		logger.Info("skipping dashboard preview generation", "path", f.Info.Path)
// 		return preview, nil
// 	}

// 	// Render the *before* image
// 	if preview.TargetURL != "" && f.Existing != nil {
// 		path, query, err := getURLWithKiosk(preview.TargetURL)
// 		if err != nil {
// 			return resourcePreview{}, fmt.Errorf("invalid url: %w", err)
// 		}
// 		screenshotURL, err := p.renderer.RenderScreenshot(ctx, f.Repo, path, query)
// 		if err != nil {
// 			return resourcePreview{}, fmt.Errorf("render dashboard preview: %w", err)
// 		}
// 		preview.TargetScreenshotURL = screenshotURL
// 		logger.Info("target dashboard screenshot generated", "screenshotURL", screenshotURL)
// 	}

// 	if preview.PreviewURL != "" {
// 		path, query, err := getURLWithKiosk(preview.PreviewURL)
// 		if err != nil {
// 			return resourcePreview{}, fmt.Errorf("invalid url: %w", err)
// 		}
// 		screenshotURL, err := p.renderer.RenderScreenshot(ctx, f.Repo, path, query)
// 		if err != nil {
// 			return resourcePreview{}, fmt.Errorf("render dashboard preview: %w", err)
// 		}
// 		preview.PreviewScreenshotURL = screenshotURL
// 		logger.Info("dashboard preview screenshot generated", "screenshotURL", screenshotURL)
// 	}

// 	return preview, nil
// }

// func getURLWithKiosk(v string) (string, url.Values, error) {
// 	u, err := url.Parse(v)
// 	if err != nil {
// 		return "", nil, err
// 	}
// 	query := u.Query()
// 	query["kiosk"] = []string{}
// 	return u.Path, query, nil
// }

package pullrequest

import (
	"bytes"
	"context"
	"fmt"
	"html/template"
	"path/filepath"
	"strings"
)

type commenter struct {
	templateDashboard  *template.Template
	templateTable      *template.Template
	templateRenderInfo *template.Template
}

func NewCommenter() Commenter {
	return &commenter{
		templateDashboard:  template.Must(template.New("dashboard").Parse(commentTemplateSingleDashboard)),
		templateTable:      template.Must(template.New("table").Parse(commentTemplateTable)),
		templateRenderInfo: template.Must(template.New("setup").Parse(commentTemplateMissingImageRenderer)),
	}
}

func (c *commenter) Comment(ctx context.Context, prRepo PullRequestRepo, pr int, info changeInfo) error {
	comment, err := c.generateComment(ctx, info)
	if err != nil {
		return fmt.Errorf("unable to generate comment text: %w", err)
	}

	if err := prRepo.CommentPullRequest(ctx, pr, comment); err != nil {
		return fmt.Errorf("comment pull request: %w", err)
	}

	return nil
}

func (c *commenter) generateComment(_ context.Context, info changeInfo) (string, error) {
	if len(info.Changes) == 0 {
		return "no changes found", nil
	}

	var buf bytes.Buffer
	if len(info.Changes) == 1 && info.Changes[0].Parsed.GVK.Kind == dashboardKind {
		if err := c.templateDashboard.Execute(&buf, info.Changes[0]); err != nil {
			return "", fmt.Errorf("unable to execute template: %w", err)
		}
	} else {
		if err := c.templateTable.Execute(&buf, info); err != nil {
			return "", fmt.Errorf("unable to execute template: %w", err)
		}
	}

	if info.MissingImageRenderer {
		if err := c.templateRenderInfo.Execute(&buf, info); err != nil {
			return "", fmt.Errorf("unable to execute template: %w", err)
		}
	}

	return strings.TrimSpace(buf.String()), nil
}

const commentTemplateSingleDashboard = `Hey there! 🎉
Grafana spotted some changes to your dashboard.

{{- if and .GrafanaScreenshotURL .PreviewScreenshotURL}}
### Side by Side Comparison of {{.Parsed.Info.Path}}
| Before | After |
|----------|---------|
| ![Before]({{.GrafanaScreenshotURL}}) | ![Preview]({{.PreviewScreenshotURL}}) |
{{- else if .GrafanaScreenshotURL}}
### Original of {{.Title}}
![Original]({{.GrafanaScreenshotURL}})
{{- else if .PreviewScreenshotURL}}
### Preview of {{.Parsed.Info.Path}}
![Preview]({{.PreviewScreenshotURL}})
{{ end}}

{{ if and .GrafanaURL .PreviewURL}}
See the [original]({{.GrafanaURL}}) and [preview]({{.PreviewURL}}) of {{.Parsed.Info.Path}}.
{{- else if .GrafanaURL}}
See the [original]({{.GrafanaURL}}) of {{.Title}}.
{{- else if .PreviewURL}}
See the [preview]({{.PreviewURL}}) of {{.Parsed.Info.Path}}.
{{- end}}
`

const commentTemplateTable = `Hey there! 🎉
Grafana spotted some changes.

| Action | Kind | Resource | Preview |
|--------|------|----------|---------|
{{- range .Changes}}
| {{.Parsed.Action}} | {{.Kind}} | {{.ExistingLink}} | {{ if .PreviewURL}}[preview]({{.PreviewURL}}){{ end }} |
{{- end}}

{{ if .SkippedFiles }}
and {{ .SkippedFiles }} more files.
{{ end}}
`

// TODO: this should expand and show links to setup docs
const commentTemplateMissingImageRenderer = `
NOTE: The image renderer is not configured
`

func (f *fileChangeInfo) Kind() string {
	if f.Parsed == nil {
		return filepath.Ext(f.Change.Path)
	}
	v := f.Parsed.GVK.Kind
	if v == "" {
		return filepath.Ext(f.Parsed.Info.Path)
	}
	return f.Parsed.GVK.Kind
}

func (f *fileChangeInfo) ExistingLink() string {
	if f.GrafanaURL != "" {
		return fmt.Sprintf("[%s](%s)", f.Title, f.GrafanaURL)
	}
	return f.Title
}

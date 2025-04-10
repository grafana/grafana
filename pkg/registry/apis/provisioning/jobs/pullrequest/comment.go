package pullrequest

import (
	"bytes"
	"context"
	"fmt"
	"html/template"
)

type commentBuilder struct {
	templateDashboard  *template.Template
	templateTable      *template.Template
	templateRenderInfo *template.Template
}

func newCommentBuilder() *commentBuilder {
	return &commentBuilder{
		templateDashboard:  template.Must(template.New("dashboard").Parse(commentTemplateSingleDashboard)),
		templateTable:      template.Must(template.New("table").Parse(commentTemplateTable)),
		templateRenderInfo: template.Must(template.New("setup").Parse(commentTemplateMissingImageRenderer)),
	}
}

func (g *commentBuilder) generateComment(_ context.Context, info changeInfo) (string, error) {
	if len(info.Changes) == 0 {
		return "no changes found", nil
	}

	var buf bytes.Buffer

	if len(info.Changes) == 1 && info.Changes[0].Parsed.GVK.Kind == dashboardKind {
		if err := g.templateDashboard.Execute(&buf, info.Changes[0]); err != nil {
			return "", fmt.Errorf("unable to execute template: %w", err)
		}
	} else {
		if err := g.templateTable.Execute(&buf, info); err != nil {
			return "", fmt.Errorf("unable to execute template: %w", err)
		}
	}

	if info.MissingImageRenderer {
		if err := g.templateRenderInfo.Execute(&buf, info); err != nil {
			return "", fmt.Errorf("unable to execute template: %w", err)
		}
	}

	return buf.String(), nil
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

| Action | Resource | Preview |
|----------|---------|-------|
{{- range .Changes}}
| {{.Parsed.Action}} | {{.Title}} | {{ if .PreviewURL}}[preview]({{.PreviewURL}}){{ end }} |
{{- end}}

{{ if .SkippedFiles }}
and {{ .SkippedFiles }} more files.
{{ end}}
`

// TODO: this should expand and show links to setup docs
const commentTemplateMissingImageRenderer = `
NOTE: The image renderer is not configured
`

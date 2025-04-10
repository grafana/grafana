package pullrequest

import (
	"bytes"
	"context"
	"fmt"
	"html/template"
)

const previewsCommentTemplate = `Hey there! 🎉
Grafana spotted some changes in your dashboard.

{{range .Changes}}
 
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

{{end}}

{{ if .MissingImageRenderer }}
NOTE: The image renderer is not configured
{{end}}
`

type commentBuilder struct {
	template *template.Template
}

func newCommentBuilder() *commentBuilder {
	return &commentBuilder{
		template: template.Must(template.New("comment").Parse(previewsCommentTemplate)),
	}
}

func (g *commentBuilder) generateComment(ctx context.Context, info changeInfo) (string, error) {
	// NOTE: this is a simple function now, but we will likely pick differnet templates
	// based on the values in changeInfo

	var buf bytes.Buffer
	if err := g.template.Execute(&buf, info); err != nil {
		return "", fmt.Errorf("unable to execute template: %w", err)
	}
	return buf.String(), nil
}

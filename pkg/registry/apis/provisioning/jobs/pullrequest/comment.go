package pullrequest

import (
	"bytes"
	"context"
	"fmt"
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

func (g *generator) GenerateComment(ctx context.Context, info changeInfo) (string, error) {
	var buf bytes.Buffer
	if err := g.template.Execute(&buf, info); err != nil {
		return "", fmt.Errorf("unable to execute template: %w", err)
	}
	return buf.String(), nil
}

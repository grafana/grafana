package pullrequest

import (
	"bytes"
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"text/template"
)

const maxErrorLength = 256

type commenter struct {
	templateDashboard        *template.Template
	templateTable            *template.Template
	templateRenderInfo       *template.Template
	templateFooter           *template.Template
	templateValidationErrors *template.Template
	templateMetadataNotice   *template.Template
	showImageRendererNote    bool
}

func NewCommenter(showImageRendererNote bool) Commenter {
	return &commenter{
		templateDashboard:        template.Must(template.New("dashboard").Parse(commentTemplateSingleDashboard)),
		templateTable:            template.Must(template.New("table").Parse(commentTemplateTable)),
		templateRenderInfo:       template.Must(template.New("setup").Parse(commentTemplateMissingImageRenderer)),
		templateFooter:           template.Must(template.New("footer").Parse(commentTemplateFooter)),
		templateValidationErrors: template.Must(template.New("errors").Parse(commentTemplateValidationErrors)),
		templateMetadataNotice:   template.Must(template.New("metadata").Parse(commentTemplateMetadataNotice)),
		showImageRendererNote:    showImageRendererNote,
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
	var buf bytes.Buffer

	// TODO: should we comment even if there are no changes?
	if len(info.Changes) == 0 {
		buf.WriteString("Grafana didn't find any changes in this pull request.")
	} else if len(info.Changes) == 1 && info.Changes[0].Parsed != nil && info.Changes[0].Parsed.GVK.Kind == dashboardKind {
		if err := c.templateDashboard.Execute(&buf, &info.Changes[0]); err != nil {
			return "", fmt.Errorf("unable to execute template: %w", err)
		}
	} else {
		if err := c.templateTable.Execute(&buf, &info); err != nil {
			return "", fmt.Errorf("unable to execute template: %w", err)
		}
		if info.HasErrors() {
			if err := c.templateValidationErrors.Execute(&buf, &info); err != nil {
				return "", fmt.Errorf("unable to execute validation errors template: %w", err)
			}
		}
	}

	if info.HasRemovedMetadataChanges() {
		if err := c.templateMetadataNotice.Execute(&buf, &info); err != nil {
			return "", fmt.Errorf("unable to execute metadata notice template: %w", err)
		}
	}

	if info.MissingImageRenderer && c.showImageRendererNote {
		if err := c.templateRenderInfo.Execute(&buf, info); err != nil {
			return "", fmt.Errorf("unable to execute template: %w", err)
		}
	}

	if err := c.templateFooter.Execute(&buf, info); err != nil {
		return "", fmt.Errorf("unable to execute footer template: %w", err)
	}

	result := strings.TrimSpace(buf.String())
	for strings.Contains(result, "\n\n\n") {
		result = strings.ReplaceAll(result, "\n\n\n", "\n\n")
	}
	return result, nil
}

const commentTemplateSingleDashboard = `Hey there! 👋
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
{{- end -}}
{{- if and .GrafanaURL .PreviewURL}}

See the [original]({{.GrafanaURL}}) and [preview]({{.PreviewURL}}) of {{.Parsed.Info.Path}}.
{{- else if .GrafanaURL}}

See the [original]({{.GrafanaURL}}) of {{.Title}}.
{{- else if .PreviewURL}}

See the [preview]({{.PreviewURL}}) of {{.Parsed.Info.Path}}.
{{- end}}{{ if .Error}}

> ⚠️ **Validation failed:** {{.TruncatedError}}
{{- end}}
`

const commentTemplateTable = `Hey there! 👋
{{- if .HasErrors}}
Grafana spotted {{.TotalChanges}} changes ({{.ErrorCount}} with issues).
{{- else}}
Grafana spotted {{.TotalChanges}} changes.
{{- end}}

| Action | Kind | Resource | Preview | Status |
|--------|------|----------|---------|--------|
{{- range .Changes}}
| {{.Action}} | {{.Kind}} | {{.ExistingLink}} | {{ if .PreviewURL}}[preview]({{.PreviewURL}}){{ end }} | {{.StatusIcon}} |
{{- end -}}
{{- if .SkippedFiles}}

and {{ .SkippedFiles }} more files.
{{- end}}
{{- if not .HasErrors}}

All resources passed validation. ✅
{{- end}}`

const commentTemplateValidationErrors = `

### ⚠️ Validation Issues

| File | Error |
|------|-------|
{{- range .Changes}}{{ if .Error}}
| ` + "`{{.Change.Path}}`" + ` | {{.TruncatedError}} |
{{- end}}{{ end}}
`

// TODO(ferruvich): let's discuss this text with the team
const commentTemplateMetadataNotice = `

> **Note:** Some metadata fields (such as ` + "`namespace`" + `, ` + "`labels`" + `, or ` + "`annotations`" + `) were removed from the resource files. Git Sync normalizes resources to a minimal format. This is expected behavior and does not affect your dashboards in Grafana.`

const commentTemplateMissingImageRenderer = `

NOTE: To enable dashboard previews in pull requests, refer to the [image rendering setup documentation](https://grafana.com/docs/grafana/latest/observability-as-code/provision-resources/git-sync-setup/#configure-webhooks-and-image-rendering).`

const commentTemplateFooter = `

---
_Posted by [{{.GrafanaHost}}]({{.GrafanaBaseURL}}){{- if .RepositoryTitle}} · Repository: **{{.RepositoryTitle}}** (` + "`" + `{{.RepositoryName}}` + "`" + `){{- end}}_`

func (f *fileChangeInfo) Action() string {
	if f.Parsed != nil {
		return string(f.Parsed.Action)
	}
	return string(f.Change.Action)
}

// TODO: does this have some value?
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

// TODO: does this have some value?
func (f *fileChangeInfo) ExistingLink() string {
	if f.GrafanaURL != "" {
		return fmt.Sprintf("[%s](%s)", f.Title, f.GrafanaURL)
	}
	return f.Title
}

func (f *fileChangeInfo) StatusIcon() string {
	if f.Error != "" {
		return "⚠️"
	}
	return "✅"
}

// TruncatedError returns a sanitized, length-limited error suitable for a
// pullrequest comment.
func (f *fileChangeInfo) TruncatedError() string {
	msg := strings.ReplaceAll(f.Error, "\n", " ")
	msg = strings.ReplaceAll(msg, "\r", "")
	msg = strings.ReplaceAll(msg, "|", "\\|")
	if len(msg) > maxErrorLength {
		return msg[:maxErrorLength] + "…"
	}
	return msg
}

func (c *changeInfo) HasErrors() bool {
	for i := range c.Changes {
		if c.Changes[i].Error != "" {
			return true
		}
	}
	return false
}

func (c *changeInfo) HasRemovedMetadataChanges() bool {
	for i := range c.Changes {
		if c.Changes[i].HasRemovedMetadata {
			return true
		}
	}
	return false
}

func (c *changeInfo) TotalChanges() int {
	return len(c.Changes)
}

func (c *changeInfo) ErrorCount() int {
	n := 0
	for i := range c.Changes {
		if c.Changes[i].Error != "" {
			n++
		}
	}
	return n
}

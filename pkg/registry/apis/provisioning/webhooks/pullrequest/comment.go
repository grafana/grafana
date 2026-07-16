package pullrequest

import (
	"bytes"
	"context"
	"fmt"
	"strings"
	"text/template"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
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

func (c *commenter) Comment(ctx context.Context, prRepo repository.PullRequestRepo, pr int, info changeInfo) error {
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

const commentTemplateSingleDashboard = `{{define "title"}}{{if .SourceURL}}[**{{.SafeTitle}}**]({{.SourceURL}}){{else}}**{{.SafeTitle}}**{{end}}{{end -}}
📊 Grafana detected dashboard changes in this pull request.
{{- if and .GrafanaScreenshotURL .PreviewScreenshotURL}}

### Side by Side Comparison of {{.Parsed.Info.Path}}
| Before | After |
|----------|---------|
| ![Before]({{.GrafanaScreenshotURL}}) | ![Preview]({{.PreviewScreenshotURL}}) |
{{- else if .GrafanaScreenshotURL}}

### Original of {{.SafeTitle}}
![Original]({{.GrafanaScreenshotURL}})
{{- else if .PreviewScreenshotURL}}

### Preview of {{.Parsed.Info.Path}}
![Preview]({{.PreviewScreenshotURL}})
{{- end -}}
{{- if and .GrafanaURL .PreviewURL}}

{{template "title" .}} — [view current]({{.GrafanaURL}}) · [preview changes]({{.PreviewURL}})
{{- else if .GrafanaURL}}

{{template "title" .}} — [view current]({{.GrafanaURL}})
{{- else if .PreviewURL}}

{{template "title" .}} — [preview changes]({{.PreviewURL}})
{{- end}}{{ if .Error}}

> ⚠️ **Validation failed:** {{.TruncatedError}}
{{- end}}
`

const commentTemplateTable = `📋 Grafana detected **{{.TotalChanges}}** resource change{{if ne .TotalChanges 1}}s{{end}} in this pull request{{- if .HasErrors}} — ⚠️ {{.ErrorCount}} need{{if eq .ErrorCount 1}}s{{end}} attention{{- end}}.

| Action | Kind | Resource | File | Preview | Status |
|--------|------|----------|------|---------|--------|
{{- range .Changes}}
| {{.ActionLabel}} | {{.Kind}} | {{.ExistingLink}} | {{ if .SourceURL}}[source]({{.SourceURL}}){{ else }}{{.SafeFilePath}}{{ end }} | {{ if .PreviewURL}}[preview]({{.PreviewURL}}){{ end }} | {{.StatusIcon}} |
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

> ℹ️ **Note:** Some metadata fields (such as ` + "`namespace`" + `, ` + "`labels`" + `, or ` + "`annotations`" + `) were removed from the resource files. Git Sync normalizes resources to a minimal format. This is expected behavior and does not affect your dashboards in Grafana.`

const commentTemplateMissingImageRenderer = `

💡 **Tip:** To enable dashboard previews in pull requests, refer to the [image rendering setup documentation](https://grafana.com/docs/grafana/latest/observability-as-code/provision-resources/git-sync-setup/#configure-webhooks-and-image-rendering).`

const commentTemplateFooter = `

---
_{{if .RepositoryTitle}}🔄 Synced from {{if .RepositoryAdminURL}}[**{{.SafeRepositoryTitle}}**]({{.RepositoryAdminURL}}){{else}}**{{.SafeRepositoryTitle}}**{{end}} · {{end}}Posted by [{{.GrafanaHost}}]({{.GrafanaBaseURL}})_`

func (f *fileChangeInfo) Action() string {
	if f.Parsed != nil {
		return string(f.Parsed.Action)
	}
	return string(f.Change.Action)
}

// ActionLabel returns a normalized, human-friendly label for the change action.
// It reconciles the two action vocabularies used in the codebase: the parsed
// ResourceAction ("create") and the raw FileAction ("created"), so the table
// never mixes tenses.
func (f *fileChangeInfo) ActionLabel() string {
	switch f.Action() {
	case "create", "created":
		return "➕ Added"
	case "update", "updated":
		return "✏️ Updated"
	case "delete", "deleted":
		return "🗑️ Deleted"
	case "move":
		return "➡️ Moved"
	case "renamed":
		return "📝 Renamed"
	case "ignored":
		return "🚫 Ignored"
	default:
		action := f.Action()
		if action == "" {
			return action
		}
		return strings.ToUpper(action[:1]) + action[1:]
	}
}

func (f *fileChangeInfo) Kind() string {
	if f.Parsed == nil || f.Parsed.GVK.Kind == "" {
		return "File"
	}
	return f.Parsed.GVK.Kind
}

// TODO: does this have some value?
func (f *fileChangeInfo) ExistingLink() string {
	title := escapeMarkdown(f.Title)
	if f.GrafanaURL != "" {
		return fmt.Sprintf("[%s](%s)", title, f.GrafanaURL)
	}
	return title
}

// SafeTitle returns the resource title escaped for use in Markdown link text and
// table cells.
func (f *fileChangeInfo) SafeTitle() string {
	return escapeMarkdown(f.Title)
}

// SafeFilePath returns the change's file path escaped for a Markdown table cell.
// It is used as the File column fallback when no source URL is available (e.g.
// non-GitHub backends) so reviewers can still identify the file.
func (f *fileChangeInfo) SafeFilePath() string {
	path := f.Change.Path
	if path == "" && f.Parsed != nil && f.Parsed.Info != nil {
		path = f.Parsed.Info.Path
	}
	return escapeMarkdown(path)
}

// escapeMarkdown neutralizes characters that would break a Markdown table cell
// or link text (pipes and brackets) and flattens newlines, so titles coming
// from resource files render verbatim in the PR comment.
func escapeMarkdown(s string) string {
	return markdownEscaper.Replace(s)
}

var markdownEscaper = strings.NewReplacer(
	"\r", "",
	"\n", " ",
	"|", "\\|",
	"[", "\\[",
	"]", "\\]",
)

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

// SafeRepositoryTitle returns the repository title escaped for use in Markdown
// link text. It uses a value receiver because the footer template is executed
// with a changeInfo value (see GrafanaHost).
func (c changeInfo) SafeRepositoryTitle() string {
	return escapeMarkdown(c.RepositoryTitle)
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

package pullrequest

import (
	"bytes"
	"context"
	"fmt"
	"html/template"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
)

type Linter struct {
	lintTemplate *template.Template
	available    bool
}

func NewLinter(available bool) *Linter {
	return &Linter{
		lintTemplate: template.Must(template.New("lint").Parse(lintDashboardIssuesTemplate)),
		available:    available,
	}
}

func (l *Linter) IsAvailable() bool {
	return l.available
}

const lintDashboardIssuesTemplate = `Hey there! 👋
Grafana found some linting issues in this dashboard you may want to check:
{{ range .}}
{{ if eq .Severity "error" }}❌{{ else if eq .Severity "warning" }}⚠️ {{ end }} [dashboard-linter/{{ .Rule }}](https://github.com/grafana/dashboard-linter/blob/main/docs/rules/{{ .Rule }}.md): {{ .Message }}.
{{- end }}`

func (l *Linter) Lint(
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
	if err := l.lintTemplate.Execute(&buf, lintResults); err != nil {
		return fmt.Errorf("execute lint comment template: %w", err)
	}

	if err := prRepo.CommentPullRequestFile(ctx, options.PR, path, ref, buf.String()); err != nil {
		return fmt.Errorf("comment pull request file %s: %w", path, err)
	}

	logging.FromContext(ctx).Info("lint comment added", "path", path)
	return nil
}

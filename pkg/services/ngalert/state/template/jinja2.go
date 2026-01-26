package template

import (
	"strings"

	"github.com/flosch/pongo2/v6"
)

func init() {
	// Disable auto-escaping globally for pongo2.
	// Auto-escaping is disabled because summary templates are used for plain text output,
	// not HTML rendering, so we want raw string values without HTML entity encoding.
	pongo2.SetAutoescape(false)
}

type SummaryContext struct {
	MonitorName string
	Severity    string
	Labels      map[string]string
	Fingerprint string
	Value       float64
	Threshold   float64
	State       string
	Query       string
	Creator     string
}

// ExpandJinja2Summary expands a Jinja2-style summary template with the given context.
// Supports variable interpolation using {{ variable }} syntax.
// Available variables: monitor_name, severity, labels, fingerprint, value, threshold, state, query, creator
// To support legacy monitors, we also inject all the labels as alert.labels, monitor_name as alert.alertname and fingerprint as alert.fingerprint.
func ExpandJinja2Summary(tmpl string, ctx SummaryContext) (string, error) {
	if !strings.Contains(tmpl, "{{") {
		return tmpl, nil
	}

	pongoCtx := pongo2.Context{
		"monitor_name": ctx.MonitorName,
		"severity":     ctx.Severity,
		"labels":       ctx.Labels,
		"value":        ctx.Value,
		"threshold":    ctx.Threshold,
		"state":        ctx.State,
		"query":        ctx.Query,
		"creator":      ctx.Creator,
		"fingerprint":  ctx.Fingerprint,
		// Legacy support for alert. prefix (Keep workflows)
		"alert": map[string]any{
			"labels":      ctx.Labels,
			"fingerprint": ctx.Fingerprint,
			"alertname":   ctx.MonitorName,
		},
	}

	tpl, err := pongo2.FromString(tmpl)
	if err != nil {
		return "", ExpandError{Tmpl: tmpl, Err: err}
	}

	result, err := tpl.Execute(pongoCtx)
	if err != nil {
		return "", ExpandError{Tmpl: tmpl, Err: err}
	}

	return result, nil
}

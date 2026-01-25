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

// SummaryContext holds all the context fields available for summary template expansion.
type SummaryContext struct {
	MonitorName string
	Severity    string
	Labels      map[string]string
	Value       float64
	Threshold   float64
	State       string
	Query       string
	Creator     string
}

// ExpandJinja2Summary expands a Jinja2-style summary template with the given context.
// Supports variable interpolation using {{ variable }} syntax.
// Available variables: monitor_name, severity, labels, value, threshold, state, query, creator
// This should only be used when _gc_template_language annotation is set to "jinja2".
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

// LegacySummaryContext holds the context fields available for legacy summary template expansion.
type LegacySummaryContext struct {
	Labels map[string]string
}

// ExpandLegacySummary expands a summary template using the legacy context format.
// Supports {{ alert.labels.X }} syntax for variable interpolation.
// This is the default when _gc_template_language annotation is not set to "jinja2".
func ExpandLegacySummary(tmpl string, ctx LegacySummaryContext) (string, error) {
	if !strings.Contains(tmpl, "{{") {
		return tmpl, nil
	}

	pongoCtx := pongo2.Context{
		"alert": map[string]interface{}{
			"labels": ctx.Labels,
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

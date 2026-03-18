package template

import (
	"fmt"
	"sort"
	"strings"

	"github.com/flosch/pongo2/v6"
)

// NestedLabels is a map[string]interface{} that supports both bracket notation
// (flat key lookup) and dot notation (nested traversal) for keys containing dots.
// It preserves the original Labels.String() formatting for direct {{ labels }} interpolation.
type NestedLabels map[string]interface{}

func (l NestedLabels) String() string {
	if len(l) == 0 {
		return ""
	}

	// Collect only leaf string values (original flat keys), skip nested map entries.
	keys := make([]string, 0, len(l))
	for k, v := range l {
		if _, isMap := v.(map[string]interface{}); !isMap {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)

	pairs := make([]string, 0, len(keys))
	for _, k := range keys {
		pairs = append(pairs, fmt.Sprintf("%s=%s", k, l[k]))
	}
	return strings.Join(pairs, ", ")
}

// BuildNestedLabels converts a flat Labels map into a NestedLabels that
// supports both bracket notation and dot notation for keys containing dots.
//
// For a flat map like {"http.route": "/api", "env": "prod"}, the result is:
//
//	{
//	  "http.route": "/api",          // flat key preserved for labels["http.route"]
//	  "http": {"route": "/api"},     // nested entry for labels.http.route
//	  "env": "prod",                 // simple key, works both ways
//	}
func BuildNestedLabels(labels Labels) NestedLabels {
	if len(labels) == 0 {
		return nil
	}

	result := make(NestedLabels, len(labels)*2)

	// First pass: add all original flat keys (preserves bracket notation).
	for k, v := range labels {
		result[k] = v
	}

	// Second pass: build nested structure for dotted keys (enables dot notation).
	// If an intermediate segment conflicts with an existing flat leaf value,
	// we skip building the nested path for that key to preserve backward compatibility.
	//
	// Keys are sorted by segment count (fewer segments first) to ensure deterministic
	// behavior when keys overlap (e.g., "a.b" and "a.b.c"). Shorter keys are processed
	// first so they claim their leaf position, and deeper keys correctly detect the conflict.
	type dottedKey struct {
		key   string
		parts []string
	}
	var dottedKeys []dottedKey
	for k := range labels {
		parts := strings.Split(k, ".")
		if len(parts) > 1 {
			dottedKeys = append(dottedKeys, dottedKey{key: k, parts: parts})
		}
	}
	sort.Slice(dottedKeys, func(i, j int) bool {
		if len(dottedKeys[i].parts) != len(dottedKeys[j].parts) {
			return len(dottedKeys[i].parts) < len(dottedKeys[j].parts)
		}
		return dottedKeys[i].key < dottedKeys[j].key
	})

	for _, dk := range dottedKeys {
		current := map[string]interface{}(result)
		conflict := false
		for _, part := range dk.parts[:len(dk.parts)-1] {
			if existing, ok := current[part]; ok {
				if nestedMap, ok := existing.(map[string]interface{}); ok {
					current = nestedMap
				} else {
					// Intermediate part exists as a flat leaf value (e.g., "github" is a simple label).
					// Skip building nested path to avoid overwriting the leaf.
					conflict = true
					break
				}
			} else {
				nested := make(map[string]interface{})
				current[part] = nested
				current = nested
			}
		}
		if !conflict {
			current[dk.parts[len(dk.parts)-1]] = labels[dk.key]
		}
	}

	return result
}

func init() {
	// Disable auto-escaping globally for pongo2.
	// Auto-escaping is disabled because summary templates are used for plain text output,
	// not HTML rendering, so we want raw string values without HTML entity encoding.
	pongo2.SetAutoescape(false)
}

type SummaryContext struct {
	MonitorName string
	Severity    string
	Labels      Labels
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

	nestedLabels := BuildNestedLabels(ctx.Labels)

	pongoCtx := pongo2.Context{
		"monitor_name": ctx.MonitorName,
		"severity":     ctx.Severity,
		"labels":       nestedLabels,
		"value":        ctx.Value,
		"threshold":    ctx.Threshold,
		"state":        ctx.State,
		"query":        ctx.Query,
		"creator":      ctx.Creator,
		"fingerprint":  ctx.Fingerprint,
		// Legacy support for alert. prefix (Keep workflows)
		"alert": map[string]any{
			"labels":      nestedLabels,
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

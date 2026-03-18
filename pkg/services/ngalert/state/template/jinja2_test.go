package template

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestExpandJinja2Summary_BasicVariables(t *testing.T) {
	ctx := SummaryContext{
		Labels: Labels{
			"pod":       "web-1",
			"namespace": "prod",
		},
	}

	result, err := ExpandJinja2Summary("Pod {{ labels.pod }} in {{ labels.namespace }}", ctx)

	require.NoError(t, err)
	require.Equal(t, "Pod web-1 in prod", result)
}

func TestExpandJinja2Summary_NoTemplateMarkers(t *testing.T) {
	ctx := SummaryContext{
		Labels: Labels{"pod": "web-1"},
	}

	result, err := ExpandJinja2Summary("Plain text without markers", ctx)

	require.NoError(t, err)
	require.Equal(t, "Plain text without markers", result)
}

func TestExpandJinja2Summary_InvalidSyntax(t *testing.T) {
	ctx := SummaryContext{
		Labels: Labels{"pod": "web-1"},
	}

	_, err := ExpandJinja2Summary("{{ invalid syntax {% ", ctx)

	require.Error(t, err)
	var expandErr ExpandError
	require.ErrorAs(t, err, &expandErr)
}

func TestExpandJinja2Summary_MissingLabel(t *testing.T) {
	ctx := SummaryContext{
		Labels: Labels{"pod": "web-1"},
	}

	result, err := ExpandJinja2Summary("{{ labels.nonexistent }}{{ alert.labels.nonexistent }}", ctx)

	require.NoError(t, err)
	require.Equal(t, "", result)
}

func TestExpandJinja2Summary_EmptyLabels(t *testing.T) {
	ctx := SummaryContext{
		Labels: Labels{},
	}

	result, err := ExpandJinja2Summary("{{ labels.pod }}{{ alert.labels.pod }}", ctx)

	require.NoError(t, err)
	require.Equal(t, "", result)
}

func TestExpandJinja2Summary_NilLabels(t *testing.T) {
	ctx := SummaryContext{}

	result, err := ExpandJinja2Summary("{{ labels.pod }}{{ alert.labels.pod }}", ctx)

	require.NoError(t, err)
	require.Equal(t, "", result)
}

func TestExpandJinja2Summary_SpecialCharactersInLabels(t *testing.T) {
	ctx := SummaryContext{
		Labels: Labels{
			"pod": "web-1 <test> & \"special\"",
		},
	}

	result, err := ExpandJinja2Summary("Pod: {{ labels.pod }} {{ alert.labels.pod }}", ctx)

	require.NoError(t, err)
	require.Equal(t, "Pod: web-1 <test> & \"special\" web-1 <test> & \"special\"", result)
}

func TestExpandJinja2Summary_MultiplePlaceholders(t *testing.T) {
	ctx := SummaryContext{
		Labels: Labels{
			"pod":       "web-1",
			"namespace": "prod",
			"service":   "api",
			"cluster":   "us-east-1",
		},
	}

	tmpl := "[{{ labels.cluster }}] {{ labels.namespace }}/{{ labels.service }}: {{ labels.pod }}"
	result, err := ExpandJinja2Summary(tmpl, ctx)

	require.NoError(t, err)
	require.Equal(t, "[us-east-1] prod/api: web-1", result)
}

func TestExpandJinja2Summary_EmptyTemplate(t *testing.T) {
	ctx := SummaryContext{
		Labels: Labels{"pod": "web-1"},
	}

	result, err := ExpandJinja2Summary("", ctx)

	require.NoError(t, err)
	require.Equal(t, "", result)
}

func TestExpandJinja2Summary_MonitorName(t *testing.T) {
	ctx := SummaryContext{
		MonitorName: "CPU High Alert",
	}

	result, err := ExpandJinja2Summary("Alert: {{ monitor_name }}", ctx)

	require.NoError(t, err)
	require.Equal(t, "Alert: CPU High Alert", result)
}

func TestExpandJinja2Summary_Severity(t *testing.T) {
	ctx := SummaryContext{
		Severity: "critical",
	}

	result, err := ExpandJinja2Summary("Severity: {{ severity }}", ctx)

	require.NoError(t, err)
	require.Equal(t, "Severity: critical", result)
}

func TestExpandJinja2Summary_ValueAndThreshold(t *testing.T) {
	ctx := SummaryContext{
		Value:     95.5,
		Threshold: 90.0,
	}

	result, err := ExpandJinja2Summary("Value {{ value }} exceeded threshold {{ threshold }}", ctx)

	require.NoError(t, err)
	require.Equal(t, "Value 95.500000 exceeded threshold 90.000000", result)
}

func TestExpandJinja2Summary_State(t *testing.T) {
	ctx := SummaryContext{
		State: "Alerting",
	}

	result, err := ExpandJinja2Summary("Current state: {{ state }}", ctx)

	require.NoError(t, err)
	require.Equal(t, "Current state: Alerting", result)
}

func TestExpandJinja2Summary_Query(t *testing.T) {
	ctx := SummaryContext{
		Query: "avg(cpu_usage) > 90",
	}

	result, err := ExpandJinja2Summary("Query: {{ query }}", ctx)

	require.NoError(t, err)
	require.Equal(t, "Query: avg(cpu_usage) > 90", result)
}

func TestExpandJinja2Summary_Creator(t *testing.T) {
	ctx := SummaryContext{
		Creator: "admin@example.com",
	}

	result, err := ExpandJinja2Summary("Created by: {{ creator }}", ctx)

	require.NoError(t, err)
	require.Equal(t, "Created by: admin@example.com", result)
}

func TestExpandJinja2Summary_AlertAlertname(t *testing.T) {
	ctx := SummaryContext{
		MonitorName: "CPU High Alert",
	}

	result, err := ExpandJinja2Summary("Alert: {{ alert.alertname }}", ctx)

	require.NoError(t, err)
	require.Equal(t, "Alert: CPU High Alert", result)
}

func TestExpandJinja2Summary_Fingerprint(t *testing.T) {
	ctx := SummaryContext{
		Fingerprint: "abc123def456",
	}

	result, err := ExpandJinja2Summary("Fingerprint: {{ fingerprint }}", ctx)

	require.NoError(t, err)
	require.Equal(t, "Fingerprint: abc123def456", result)
}

func TestExpandJinja2Summary_AlertFingerprint(t *testing.T) {
	ctx := SummaryContext{
		Fingerprint: "abc123def456",
	}

	result, err := ExpandJinja2Summary("Fingerprint: {{ alert.fingerprint }}({{ fingerprint }})", ctx)

	require.NoError(t, err)
	require.Equal(t, "Fingerprint: abc123def456(abc123def456)", result)
}

func TestExpandJinja2Summary_AllFields(t *testing.T) {
	ctx := SummaryContext{
		MonitorName: "High CPU",
		Severity:    "warning",
		Labels: Labels{
			"pod":       "web-1",
			"namespace": "prod",
		},
		Fingerprint: "abc123",
		Value:       85.5,
		Threshold:   80.0,
		State:       "Alerting",
		Query:       "cpu > 80",
		Creator:     "ops-team",
	}

	tmpl := "[{{ severity }}] {{ monitor_name }}({{ alert.alertname }}): {{ labels.pod }}({{ alert.labels.pod }}) in {{ labels.namespace }}({{ alert.labels.namespace }}) - {{ state }} ({{ value }}/{{ threshold }}) query={{ query }} by={{ creator }} fingerprint={{ fingerprint }}({{ alert.fingerprint }})"
	result, err := ExpandJinja2Summary(tmpl, ctx)

	require.NoError(t, err)
	require.Equal(t, "[warning] High CPU(High CPU): web-1(web-1) in prod(prod) - Alerting (85.500000/80.000000) query=cpu > 80 by=ops-team fingerprint=abc123(abc123)", result)
}

func TestExpandJinja2Summary_LabelsString(t *testing.T) {
	ctx := SummaryContext{
		Labels: Labels{
			"namespace": "prod",
			"pod":       "web-1",
			"service":   "api",
		},
	}

	result, err := ExpandJinja2Summary("Labels: {{ labels }}", ctx)

	require.NoError(t, err)
	require.Equal(t, "Labels: namespace=prod, pod=web-1, service=api", result)

	result, err = ExpandJinja2Summary("Labels: {{ alert.labels }}", ctx)

	require.NoError(t, err)
	require.Equal(t, "Labels: namespace=prod, pod=web-1, service=api", result)
}

func TestExpandJinja2Summary_DotNotationLabels(t *testing.T) {
	ctx := SummaryContext{
		Labels: Labels{
			"http.route": "/api/v1/users",
		},
	}

	result, err := ExpandJinja2Summary("Route: {{ labels.http.route }}", ctx)

	require.NoError(t, err)
	require.Equal(t, "Route: /api/v1/users", result)
}

func TestExpandJinja2Summary_DeepDotNotation(t *testing.T) {
	ctx := SummaryContext{
		Labels: Labels{
			"user.properties.tenantUUID": "abc-123",
		},
	}

	result, err := ExpandJinja2Summary("Tenant: {{ labels.user.properties.tenantUUID }}", ctx)

	require.NoError(t, err)
	require.Equal(t, "Tenant: abc-123", result)
}

func TestExpandJinja2Summary_BracketNotationPreserved(t *testing.T) {
	ctx := SummaryContext{
		Labels: Labels{
			"http.route": "/api/v1/users",
		},
	}

	result, err := ExpandJinja2Summary(`Route: {{ labels["http.route"] }}`, ctx)

	require.NoError(t, err)
	require.Equal(t, "Route: /api/v1/users", result)
}

func TestExpandJinja2Summary_DotNotationConflict(t *testing.T) {
	ctx := SummaryContext{
		Labels: Labels{
			"github":          "myorg",
			"github.workflow": "CI",
		},
	}

	// Flat leaf value wins — dot notation resolves to the simple label.
	result, err := ExpandJinja2Summary("Org: {{ labels.github }}", ctx)
	require.NoError(t, err)
	require.Equal(t, "Org: myorg", result)

	// Dot notation for the conflicted key errors (pongo2 can't traverse a string).
	_, err = ExpandJinja2Summary("Workflow: {{ labels.github.workflow }}", ctx)
	require.Error(t, err)

	// Bracket notation still works as the fallback for conflicted dotted keys.
	result, err = ExpandJinja2Summary(`Workflow: {{ labels["github.workflow"] }}`, ctx)
	require.NoError(t, err)
	require.Equal(t, "Workflow: CI", result)
}

func TestExpandJinja2Summary_MixedSimpleAndDottedKeys(t *testing.T) {
	ctx := SummaryContext{
		Labels: Labels{
			"env":        "prod",
			"http.route": "/api",
		},
	}

	result, err := ExpandJinja2Summary("{{ labels.env }} {{ labels.http.route }}", ctx)

	require.NoError(t, err)
	require.Equal(t, "prod /api", result)
}

func TestBuildNestedLabels(t *testing.T) {
	t.Run("nil for empty labels", func(t *testing.T) {
		result := BuildNestedLabels(Labels{})
		require.Nil(t, result)
	})

	t.Run("simple keys preserved", func(t *testing.T) {
		result := BuildNestedLabels(Labels{"env": "prod", "pod": "web-1"})
		require.Equal(t, "prod", result["env"])
		require.Equal(t, "web-1", result["pod"])
	})

	t.Run("dotted key creates flat and nested entries", func(t *testing.T) {
		result := BuildNestedLabels(Labels{"http.route": "/api"})
		require.Equal(t, "/api", result["http.route"])
		httpMap, ok := result["http"].(map[string]interface{})
		require.True(t, ok)
		require.Equal(t, "/api", httpMap["route"])
	})

	t.Run("deep nesting", func(t *testing.T) {
		result := BuildNestedLabels(Labels{"a.b.c": "val"})
		require.Equal(t, "val", result["a.b.c"])
		aMap := result["a"].(map[string]interface{})
		bMap := aMap["b"].(map[string]interface{})
		require.Equal(t, "val", bMap["c"])
	})

	t.Run("conflict preserves flat leaf", func(t *testing.T) {
		result := BuildNestedLabels(Labels{
			"github":          "myorg",
			"github.workflow": "CI",
		})
		require.Equal(t, "myorg", result["github"])
		require.Equal(t, "CI", result["github.workflow"])
	})

	t.Run("overlapping dotted keys are deterministic", func(t *testing.T) {
		// "a.b" (2 segments) is always processed before "a.b.c" (3 segments),
		// so "a.b" claims the leaf and "a.b.c" nesting is skipped.
		for i := 0; i < 100; i++ {
			result := BuildNestedLabels(Labels{
				"a.b":   "1",
				"a.b.c": "2",
			})
			aMap, ok := result["a"].(map[string]interface{})
			require.True(t, ok, "iteration %d: result[\"a\"] should be a map", i)
			require.Equal(t, "1", aMap["b"], "iteration %d: shorter key a.b must always win", i)
			require.Equal(t, "1", result["a.b"])
			require.Equal(t, "2", result["a.b.c"])
		}
	})

	t.Run("String skips nested map entries", func(t *testing.T) {
		result := BuildNestedLabels(Labels{"env": "prod", "http.route": "/api"})
		s := result.String()
		require.Contains(t, s, "env=prod")
		require.Contains(t, s, "http.route=/api")
		require.NotContains(t, s, "http=map")
	})
}

func TestExpandJinja2Summary_LabelsForLoop(t *testing.T) {
	ctx := SummaryContext{
		Labels: Labels{
			"pod":       "web-1",
			"namespace": "prod",
		},
	}

	tmpl := `{% for label in labels %}{{ label }}={{ labels[label] }} {% endfor %}`
	result, err := ExpandJinja2Summary(tmpl, ctx)

	require.NoError(t, err)
	require.Contains(t, result, "namespace=prod")
	require.Contains(t, result, "pod=web-1")

	tmpl = `{% for key, val in alert.labels %}{{ key }}={{ val }} {% endfor %}`
	result, err = ExpandJinja2Summary(tmpl, ctx)

	require.NoError(t, err)
	require.Contains(t, result, "namespace=prod")
	require.Contains(t, result, "pod=web-1")
}

func TestExpandJinja2Summary_LabelsForLoopWithDottedKeys(t *testing.T) {
	ctx := SummaryContext{
		Labels: Labels{
			"env":        "prod",
			"http.route": "/api",
		},
	}

	// {{ labels }} stringification filters out synthetic nested map entries.
	result, err := ExpandJinja2Summary("{{ labels }}", ctx)
	require.NoError(t, err)
	require.Equal(t, "env=prod, http.route=/api", result)

	// For-loop iteration sees synthetic keys (e.g., "http") alongside original flat keys.
	// This is a known tradeoff: dot notation (labels.http.route) requires the nested
	// structure to live in the same map. Use {{ labels }} for clean output.
	tmpl := `{% for key, val in labels %}{{ key }},{% endfor %}`
	result, err = ExpandJinja2Summary(tmpl, ctx)
	require.NoError(t, err)
	require.Contains(t, result, "env,")
	require.Contains(t, result, "http.route,")
	require.Contains(t, result, "http,")
}

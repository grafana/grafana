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

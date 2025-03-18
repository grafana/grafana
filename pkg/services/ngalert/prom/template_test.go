package prom

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestConvertTemplates(t *testing.T) {
	testCases := []struct {
		name       string
		templates  map[string]string
		expected   map[string]string
		shouldFail bool
	}{
		{
			name: "simple template with $value",
			templates: map[string]string{
				"template": "Value is {{$value}}",
			},
			expected: map[string]string{
				"template": "{{- _prometheusMode -}}Value is {{$value}}",
			},
			shouldFail: false,
		},
		{
			name: "simple template with .Value",
			templates: map[string]string{
				"template": "Value is {{.Value}}",
			},
			expected: map[string]string{
				"template": "{{- _prometheusMode -}}Value is {{.Value}}",
			},
			shouldFail: false,
		},
		{
			name: "template with $.Value",
			templates: map[string]string{
				"template": `
					{{- range .Items}}
					Value: {{.Value}}
					Global Value: {{$.Value}}
					{{- end}}
				`,
			},
			expected: map[string]string{
				"template": `{{- _prometheusMode -}}
					{{- range .Items}}
					Value: {{.Value}}
					Global Value: {{$.Value}}
					{{- end}}
				`,
			},
			shouldFail: false,
		},
		{
			name: "complex template with $value in if statement",
			templates: map[string]string{
				"template": "{{if gt $value 100.0}}Too high{{else}}Good{{end}}",
			},
			expected: map[string]string{
				"template": "{{- _prometheusMode -}}{{if gt $value 100.0}}Too high{{else}}Good{{end}}",
			},
			shouldFail: false,
		},
		{
			name: "complex template with .Value in if statement",
			templates: map[string]string{
				"template": "{{if gt .Value 100.0}}Too high{{else}}Good{{end}}",
			},
			expected: map[string]string{
				"template": "{{- _prometheusMode -}}{{if gt .Value 100.0}}Too high{{else}}Good{{end}}",
			},
			shouldFail: false,
		},
		{
			name: "template with $value in nested structures",
			templates: map[string]string{
				"template": "{{range .Values}}{{if eq . $value}}Match{{end}}{{end}}",
			},
			expected: map[string]string{
				"template": "{{- _prometheusMode -}}{{range .Values}}{{if eq . $value}}Match{{end}}{{end}}",
			},
			shouldFail: false,
		},
		{
			name: "template without $value or .Value",
			templates: map[string]string{
				"template": "This template does not use the values",
			},
			expected: map[string]string{
				"template": "This template does not use the values",
			},
			shouldFail: false,
		},
		{
			name: "template with $labels",
			templates: map[string]string{
				"template": "Instance: {{ $labels.instance }}",
			},
			expected: map[string]string{
				"template": "Instance: {{ $labels.instance }}",
			},
			shouldFail: false,
		},
		{
			name: "template with both $value and $labels",
			templates: map[string]string{
				"template": "{{ $labels.instance }} has value {{ $value }}",
			},
			expected: map[string]string{
				"template": "{{- _prometheusMode -}}{{ $labels.instance }} has value {{ $value }}",
			},
			shouldFail: false,
		},
		{
			name: "template with multiple $value occurrences",
			templates: map[string]string{
				"template": "First: {{ $value }}, Second: {{ $value }}",
			},
			expected: map[string]string{
				"template": "{{- _prometheusMode -}}First: {{ $value }}, Second: {{ $value }}",
			},
			shouldFail: false,
		},
		{
			name: "multiple templates with mixed patterns",
			templates: map[string]string{
				"summary":     "Instance {{ $labels.instance }} has high CPU usage",
				"description": "{{ $labels.instance }} has value {{ $value }}",
			},
			expected: map[string]string{
				"summary":     "Instance {{ $labels.instance }} has high CPU usage",
				"description": "{{- _prometheusMode -}}{{ $labels.instance }} has value {{ $value }}",
			},
			shouldFail: false,
		},
		{
			name: "all templates with values",
			templates: map[string]string{
				"summary":     "Value is {{ $value }}",
				"description": "Detailed value is {{ .Value }}",
			},
			expected: map[string]string{
				"summary":     "{{- _prometheusMode -}}Value is {{ $value }}",
				"description": "{{- _prometheusMode -}}Detailed value is {{ .Value }}",
			},
			shouldFail: false,
		},
		{
			name: "no templates with values",
			templates: map[string]string{
				"summary":     "Instance {{ $labels.instance }} is down",
				"description": "Instance {{ $labels.instance }} has been down for more than 5 minutes",
			},
			expected: map[string]string{
				"summary":     "Instance {{ $labels.instance }} is down",
				"description": "Instance {{ $labels.instance }} has been down for more than 5 minutes",
			},
			shouldFail: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			input := make(map[string]string)
			for k, v := range tc.templates {
				input[k] = v
			}

			err := convertTemplates(input)
			if tc.shouldFail {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.Equal(t, tc.expected, input)
			}
		})
	}
}

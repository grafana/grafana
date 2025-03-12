package prom

import (
	"maps"
	"strings"
	"testing"
	"text/template"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTemplateEquivalenceWithTreeString(t *testing.T) {
	// This test verifies that the VariableReplacer accurately preserves
	// the template structure during variable replacement, ensuring that
	// the replaced template is equivalent to the original.
	tests := []struct {
		name         string
		template     string
		replVars     map[string]string
		data         any
		replacedData any
	}{
		{
			name:     "simple variable replacement",
			template: "Hello {{ .Name }} and {{ .Value }}!",
			replVars: map[string]string{
				".Name":  ".ReplacedName",
				".Value": ".ReplacedValue",
			},
			data: map[string]string{
				"Name":  "World",
				"Value": "42",
			},
			replacedData: map[string]string{
				"ReplacedName":  "World",
				"ReplacedValue": "42",
			},
		},
		{
			name: "complex nested template",
			template: `{{ if and (gt .Value 10) (lt .Value 100) }}
				{{ range .Items }}
					{{ if eq $.Value .Threshold }}Critical: {{ .Name }}{{ else }}Warning: {{ .Name }}{{ end }}
				{{ end }}
			{{ else }}
				{{ .Fallback }}
			{{ end }}`,
			replVars: map[string]string{
				".Value":    ".Values.query.Value",
				".Items":    ".Values.query.Items",
				".Fallback": ".Values.query.Fallback",
			},
			data: map[string]any{
				"Value": 50,
				"Items": []map[string]any{
					{"Name": "Item1", "Threshold": 50},
					{"Name": "Item2", "Threshold": 75},
				},
				"Fallback": "No items in range",
			},
			replacedData: map[string]any{
				"Value": 50,
				"Values": map[string]any{
					"query": map[string]any{
						"Value":    50,
						"Fallback": "No items in range",
						"Items": []map[string]any{
							{"Name": "Item1", "Threshold": 50},
							{"Name": "Item2", "Threshold": 75},
						},
					},
				},
			},
		},
		{
			name:     "with pipe functions",
			template: `{{ .Value | printf "%.2f" }} is the formatted value`,
			replVars: map[string]string{
				".Value": ".Values.query.Value",
			},
			data: map[string]float64{
				"Value": 42.1234,
			},
			replacedData: map[string]any{
				"Values": map[string]any{
					"query": map[string]any{
						"Value": 42.1234,
					},
				},
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Create template maps
			originalTemplateMap := map[string]string{"template": tc.template}
			replacedTemplateMap := map[string]string{"template": tc.template}

			// Replace variables in one template
			replacer := NewVariableReplacer(tc.replVars)
			err := replacer.Replace(replacedTemplateMap)
			require.NoError(t, err)
			require.NotEqual(t, originalTemplateMap["template"], replacedTemplateMap["template"])

			// Parse both templates
			originalTmpl, err := template.New("original").Parse(originalTemplateMap["template"])
			require.NoError(t, err)
			replacedTmpl, err := template.New("replaced").Parse(replacedTemplateMap["template"])
			require.NoError(t, err)

			// Render both templates
			var originalBuf, replacedBuf strings.Builder
			err = originalTmpl.Execute(&originalBuf, tc.data)
			require.NoError(t, err)
			err = replacedTmpl.Execute(&replacedBuf, tc.replacedData)
			require.NoError(t, err)

			// Compare rendered output
			require.Equal(t, originalBuf.String(), replacedBuf.String(),
				"Original template: %s\nReplaced template: %s",
				originalTemplateMap["template"], replacedTemplateMap["template"],
			)
		})
	}
}

func TestReplaceVariablesInMap(t *testing.T) {
	tests := []struct {
		name        string
		inputMap    map[string]string
		replaceMap  map[string]string
		expectedMap map[string]string
		expectError bool
	}{
		{
			name:        "nil map",
			inputMap:    nil,
			replaceMap:  map[string]string{".Value": ".Values.query.Value"},
			expectedMap: nil,
			expectError: false,
		},
		{
			name:        "empty map",
			inputMap:    map[string]string{},
			replaceMap:  map[string]string{".Value": ".Values.query.Value"},
			expectedMap: map[string]string{},
			expectError: false,
		},
		{
			name: "no template delimiters at all",
			inputMap: map[string]string{
				"key1": "Just some plain text with no template expressions and string .Value",
			},
			replaceMap: map[string]string{
				".Value": ".Values.query.Value",
			},
			expectedMap: map[string]string{
				"key1": "Just some plain text with no template expressions and string .Value",
			},
			expectError: false,
		},
		{
			name: "empty template",
			inputMap: map[string]string{
				"key1": "",
			},
			replaceMap: map[string]string{
				".Value": ".Values.query.Value",
			},
			expectedMap: map[string]string{
				"key1": "",
			},
			expectError: false,
		},
		{
			name: "simple replacement",
			inputMap: map[string]string{
				"key1": `Hello
						 {{- $labels -}}
						 {{ .Value }} 🎄 🦌`,
				"key2": "Hello ⛄ {{ .Long.Value.With.Dots.And.Fields }}! This is a test when the replacement is shorter.",
			},
			replaceMap: map[string]string{
				".Value":                           ".Values.query.Value",
				".Long.Value.With.Dots.And.Fields": ".NewVal",
			},
			expectedMap: map[string]string{
				"key1": "Hello{{$labels}}{{.Values.query.Value}} 🎄 🦌",
				"key2": "Hello ⛄ {{.NewVal}}! This is a test when the replacement is shorter.",
			},
			expectError: false,
		},
		{
			name: "multiline template",
			inputMap: map[string]string{
				"key1": `Line1: {{ .Value }}
                         // add some comments
                         Line2: {{ .Name }}`,
			},
			replaceMap: map[string]string{
				".Value": ".Values.query.Value",
				".Name":  ".Values.query.Name",
			},
			expectedMap: map[string]string{
				"key1": `Line1: {{.Values.query.Value}}
                         // add some comments
                         Line2: {{.Values.query.Name}}`,
			},
			expectError: false,
		},
		{
			name: "nested function calls in the template",
			inputMap: map[string]string{
				"key1": `{{ printf "%s" (trimSpace .Name) }}`,
			},
			replaceMap: map[string]string{
				".Name": ".Values.query.Name",
			},
			expectedMap: map[string]string{
				"key1": `{{printf "%s" (trimSpace .Values.query.Name)}}`,
			},
			expectError: false,
		},
		{
			name: "nested fields .Foo.Bar",
			inputMap: map[string]string{
				"key1": "Hello {{ .Foo.Bar }}",
			},
			replaceMap: map[string]string{
				".Foo.Bar": ".Values.foo.bar",
			},
			expectedMap: map[string]string{
				"key1": "Hello {{.Values.foo.bar}}",
			},
			expectError: false,
		},
		{
			name: "braces that are not template delimeters",
			inputMap: map[string]string{
				"key1": "String with braces \\{\\{ notATemplate \\}\\}, so no replacement",
			},
			replaceMap: map[string]string{
				".Value": ".Values.query.Value",
			},
			expectedMap: map[string]string{
				"key1": "String with braces \\{\\{ notATemplate \\}\\}, so no replacement",
			},
			expectError: false,
		},
		{
			name: "template with range usage",
			inputMap: map[string]string{
				"key1": `{{ range .Items }}Item: {{ . }}{{ end }}`,
			},
			replaceMap: map[string]string{
				".Items": ".Values.itemList",
			},
			expectedMap: map[string]string{
				"key1": `{{range .Values.itemList}}Item: {{.}}{{end}}`,
			},
			expectError: false,
		},
		{
			name: "template with nested pipeline and multiple arguments",
			inputMap: map[string]string{
				"key1": `{{ if (eq (printf "%s" .Value) "hello") }}Yes{{ else }}No{{ end }}`,
			},
			replaceMap: map[string]string{
				".Value": ".Values.query.Value",
			},
			expectedMap: map[string]string{
				"key1": `{{if (eq (printf "%s" .Values.query.Value) "hello")}}Yes{{else}}No{{end}}`,
			},
			expectError: false,
		},
		{
			name: "single map variable replacement",
			inputMap: map[string]string{
				"key1": "Hello {{ .Value }}",
			},
			replaceMap: map[string]string{
				".Value": ".Values.query.Value",
			},
			expectedMap: map[string]string{
				"key1": "Hello {{.Values.query.Value}}",
			},
			expectError: false,
		},
		{
			name: "variable replacement",
			inputMap: map[string]string{
				"key1": "Hello {{ $value }}",
				"key2": "Hi {{ $value.and.some.field }}",
			},
			replaceMap: map[string]string{
				"$value": ".Values.query.Value",
			},
			expectedMap: map[string]string{
				"key1": "Hello {{.Values.query.Value}}",
				"key2": "Hi {{ $value.and.some.field }}",
			},
			expectError: false,
		},
		{
			name: "multiple occurrences of same variable",
			inputMap: map[string]string{
				"key1": "{{ .Value }} and {{ .Value }} again",
			},
			replaceMap: map[string]string{
				".Value": ".Values.query.Value",
			},
			expectedMap: map[string]string{
				"key1": "{{.Values.query.Value}} and {{.Values.query.Value}} again",
			},
			expectError: false,
		},
		{
			name: "no replacement needed",
			inputMap: map[string]string{
				"key1": "Hello {{ .OtherValue }}",
			},
			replaceMap: map[string]string{
				".Value": ".Values.query.Value",
			},
			expectedMap: map[string]string{
				"key1": "Hello {{ .OtherValue }}",
			},
			expectError: false,
		},
		{
			name: "invalid template syntax",
			inputMap: map[string]string{
				"key1": "Hello {{ .Value",
			},
			replaceMap: map[string]string{
				".Value": ".Values.query.Value",
			},
			expectedMap: nil,
			expectError: true,
		},
		{
			name: "multiple different variables",
			inputMap: map[string]string{
				"key1": "Hello {{ .Name }} and {{ .Value }}",
			},
			replaceMap: map[string]string{
				".Name":  ".Values.query.Name",
				".Value": ".Values.query.Value",
			},
			expectedMap: map[string]string{
				"key1": "Hello {{.Values.query.Name}} and {{.Values.query.Value}}",
			},
			expectError: false,
		},
		{
			name: "complex template with control structures",
			inputMap: map[string]string{
				"key1": "{{ if eq .Value 10 }}{{ .Name }}{{ else }}{{ .Fallback }}{{ end }}",
			},
			replaceMap: map[string]string{
				".Name":     ".Values.query.Name",
				".Value":    ".Values.query.Value",
				".Fallback": ".Values.query.Fallback",
			},
			expectedMap: map[string]string{
				"key1": "{{if eq .Values.query.Value 10}}{{.Values.query.Name}}{{else}}{{.Values.query.Fallback}}{{end}}",
			},
			expectError: false,
		},
		{
			name: "mixed template types with pipes",
			inputMap: map[string]string{
				"key1": "{{ .Item | printf \"%.2f\" }}",
				"key2": "{{ .Count }} items",
			},
			replaceMap: map[string]string{
				".Item":  ".Values.query.Item",
				".Count": ".Values.query.Count",
			},
			expectedMap: map[string]string{
				"key1": "{{.Values.query.Item | printf \"%.2f\"}}",
				"key2": "{{.Values.query.Count}} items",
			},
			expectError: false,
		},
		{
			name: "multiple entries with mixed templates",
			inputMap: map[string]string{
				"key1": "Hello {{ .Value }}",
				"key2": "World {{ .Value }}",
				"key3": "{{ .Name }} says hi",
			},
			replaceMap: map[string]string{
				".Value": ".Values.query.Value",
				".Name":  ".Values.query.Name",
			},
			expectedMap: map[string]string{
				"key1": "Hello {{.Values.query.Value}}",
				"key2": "World {{.Values.query.Value}}",
				"key3": "{{.Values.query.Name}} says hi",
			},
			expectError: false,
		},
		{
			name: "multistage pipeline with complex variable usage and comments",
			inputMap: map[string]string{
				"key1": `{{ $result := .Value | printf "%.2f" | trimSpace }}
						{{ if eq $result "100.00" -}}
						Maximum value reached: {{ $result }}%
						{{- else -}}
						Current value: {{ $result }}%
						{{- end }}

						{{ .Labels.instance | printf "Instance: %s" }}
						{{ .Labels.job | printf "Job: %s" }}

						{{- /* A comment here about the calculation */ -}}
						{{ $threshold := sub 100 .Value | printf "%.1f" }}
						{{ $threshold }} % remaining capacity`,
			},
			replaceMap: map[string]string{
				".Value": ".Values.query.Value",
			},
			expectedMap: map[string]string{
				"key1": `{{$result := .Values.query.Value | printf "%.2f" | trimSpace}}
						{{if eq $result "100.00"}}Maximum value reached: {{$result}}%{{else}}Current value: {{$result}}%{{end}}

						{{.Labels.instance | printf "Instance: %s"}}
						{{.Labels.job | printf "Job: %s"}}{{/* A comment here about the calculation */}}{{$threshold := sub 100 .Values.query.Value | printf "%.1f"}}
						{{$threshold}} % remaining capacity`,
			},
			expectError: false,
		},
		{
			name: "complex Prometheus alerting template with conditional formatting",
			inputMap: map[string]string{
				"summary": `{{ if gt .Value 0.90 }}🔴{{ else if gt .Value 0.75 }}🟠{{ else }}🟢{{ end }} {{ .Name }} alert: {{ if eq $labels.severity "critical" }}CRITICAL{{ else }}WARNING{{ end }}`,
				"description": `{{ $value := .Value }}
				{{ range $i, $entry := .Values.entries }}
				{{- if eq $i 0 }}
				# Issue detected in {{ $entry.service }}
				{{- else }}
				Also affected: {{ $entry.service }}
				{{- end }}
				* Value: {{ $value | printf "%.3f" }}
				* Threshold: {{ $entry.threshold }}
				{{ end }}

				{{ if gt .Value 0.95 -}}
				**This is an emergency situation!**
				{{- else -}}
				This requires attention but is not critical.
				{{- end }}`,
			},
			replaceMap: map[string]string{
				".Value": ".Values.query.Value",
				".Name":  ".Values.query.Name",
			},
			expectedMap: map[string]string{
				"summary": `{{if gt .Values.query.Value 0.90}}🔴{{else}}{{if gt .Values.query.Value 0.75}}🟠{{else}}🟢{{end}}{{end}} {{.Values.query.Name}} alert: {{if eq $labels.severity "critical"}}CRITICAL{{else}}WARNING{{end}}`,
				"description": `{{$value := .Values.query.Value}}
				{{range $i, $entry := .Values.entries}}{{if eq $i 0}}
				# Issue detected in {{$entry.service}}{{else}}
				Also affected: {{$entry.service}}{{end}}
				* Value: {{$value | printf "%.3f"}}
				* Threshold: {{$entry.threshold}}
				{{end}}

				{{if gt .Values.query.Value 0.95}}**This is an emergency situation!**{{else}}This requires attention but is not critical.{{end}}`,
			},
			expectError: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var testMap map[string]string
			if tc.inputMap != nil {
				testMap = make(map[string]string)
				maps.Copy(testMap, tc.inputMap)
			}

			r := NewVariableReplacer(tc.replaceMap)
			err := r.Replace(testMap)

			if tc.expectError {
				assert.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tc.expectedMap, testMap)
			}
		})
	}
}

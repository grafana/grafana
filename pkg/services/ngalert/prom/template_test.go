package prom

import (
	"maps"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

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
				"key1": "Hello {{- $labels -}} {{ .Value }}",
				// "key2": "Hello {{ .Long.Value.With.Dots.And.Fields }}! This is a test when the replacement is shorter.",
			},
			replaceMap: map[string]string{
				".Value":                           ".Values.query.Value",
				".Long.Value.With.Dots.And.Fields": ".NewVal",
			},
			expectedMap: map[string]string{
				"key1": "Hello {{- $labels -}} {{ .Values.query.Value }}",
				// "key2": "Hello {{ .NewVal }}! This is a test when the replacement is shorter.",
			},
			expectError: false,
		},
		{
			name: "multiline template",
			inputMap: map[string]string{
				"key1": `Line1: {{ .Value }}
                         Line2: {{ .Name }}`,
			},
			replaceMap: map[string]string{
				".Value": ".Values.query.Value",
				".Name":  ".Values.query.Name",
			},
			expectedMap: map[string]string{
				"key1": `Line1: {{ .Values.query.Value }}
                         Line2: {{ .Values.query.Name }}`,
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
				"key1": `{{ printf "%s" (trimSpace .Values.query.Name) }}`,
			},
			expectError: false,
		},
		// {
		// 	name: "nested fields .Foo.Bar",
		// 	inputMap: map[string]string{
		// 		"key1": "Hello {{ .Foo.Bar }}",
		// 	},
		// 	replaceMap: map[string]string{
		// 		".Foo.Bar": ".Values.foo.bar",
		// 	},
		// 	expectedMap: map[string]string{
		// 		"key1": "Hello {{ .Values.foo.bar }}",
		// 	},
		// 	expectError: false,
		// },
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
				"key1": `{{ range .Values.itemList }}Item: {{ . }}{{ end }}`,
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
				"key1": `{{ if (eq (printf "%s" .Values.query.Value) "hello") }}Yes{{ else }}No{{ end }}`,
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
				"key1": "Hello {{ .Values.query.Value }}",
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
				"key1": "Hello {{ .Values.query.Value }}",
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
				"key1": "{{ .Values.query.Value }} and {{ .Values.query.Value }} again",
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
			expectedMap: nil, // We don't care about the state after error
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
				"key1": "Hello {{ .Values.query.Name }} and {{ .Values.query.Value }}",
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
				"key1": "{{ if eq .Values.query.Value 10 }}{{ .Values.query.Name }}{{ else }}{{ .Values.query.Fallback }}{{ end }}",
			},
			expectError: false,
		},
		{
			name: ",ixed template types with pipes",
			inputMap: map[string]string{
				"key1": "{{ .Item | printf \"%.2f\" }}",
				"key2": "{{ .Count }} items",
			},
			replaceMap: map[string]string{
				".Item":  ".Values.query.Item",
				".Count": ".Values.query.Count",
			},
			expectedMap: map[string]string{
				"key1": "{{ .Values.query.Item | printf \"%.2f\" }}",
				"key2": "{{ .Values.query.Count }} items",
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
				"key1": "Hello {{ .Values.query.Value }}",
				"key2": "World {{ .Values.query.Value }}",
				"key3": "{{ .Values.query.Name }} says hi",
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

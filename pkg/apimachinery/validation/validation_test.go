package validation_test

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	k8sValidation "k8s.io/apimachinery/pkg/util/validation"

	"github.com/grafana/grafana/pkg/apimachinery/validation"
)

func TestValidation(t *testing.T) {
	// We are not using the out-of-the-box "isQualifiedName" because it allows slashes
	rsp := k8sValidation.IsQualifiedName("hello/world")
	require.Nil(t, rsp, "standard qualified name allows a slash")

	t.Run("name", func(t *testing.T) {
		tests := []struct {
			name   string
			input  []string // variations that produce the same output
			expect []string
		}{{
			name:   "empty",
			input:  []string{""},
			expect: []string{"name may not be empty"},
		}, {
			name:   "too long",
			input:  []string{strings.Repeat("0", 254)},
			expect: []string{"name is too long"},
		}, {
			name: "ok",
			input: []string{
				"hello",
				strings.Repeat("0", 253), // very long starts with number
				"hello-world",
				"hello.world",
				"hello_world",
				"hello:world",
				"123456",  // starts with numbers
				"aBCDEFG", // with capitals
			},
		}, {
			name: "bad input",
			expect: []string{
				"name must consist of alphanumeric characters, '-', '_', ':' or '.' (e.g. 'MyName',  or 'my.name',  or 'abc-123', regex used for validation is '^[a-zA-Z0-9:\\-\\_\\.]*$')",
			},
			input: []string{
				"hello world",
				"hello!",
				"hello~",
				"hello ",
				"hello*",
				"hello+",
				"hello=",
				"hello%",
				"hello/world",
			},
		}}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				for _, input := range tt.input {
					output := validation.IsValidGrafanaName(input)
					require.Equal(t, tt.expect, output, "input: %s", input)
				}
			})
		}
	})

	t.Run("namespace", func(t *testing.T) {
		tests := []struct {
			name   string
			input  []string // variations that produce the same output
			expect []string
		}{{
			name:  "empty is OK",
			input: []string{""},
		}, {
			name:   "too long",
			input:  []string{strings.Repeat("0", 41)},
			expect: []string{"namespace is too long"},
		}, {
			name:   "too short",
			expect: []string{"namespace is too short"},
			input:  []string{"a", "1", "aa"},
		}, {
			name: "ok",
			input: []string{
				"hello",
				strings.Repeat("a", 40), // long... alpha
				"hello-world",
				"hello.world",
				"hello_world",
				"default",
				"stacks-123456", // ends with a number
				"org-3",         // ends with a number
				"1234",          // just a numbers
				"aaa",
			},
		}, {
			name: "bad input",
			expect: []string{
				"namespace must consist of alphanumeric characters, '-', '_' or '.', and must start and end with an alphanumeric character (e.g. 'MyName',  or 'my.name',  or 'abc-123', regex used for validation is '^([A-Za-z0-9][-A-Za-z0-9_.]*)?[A-Za-z0-9]$')",
			},
			input: []string{
				"_bad_input", // starts with non-alpha
				"hello world",
				"hello!",
				"hello~",
				"hello ",
				"hello*",
				"hello+",
				"hello=",
				"hello%",
				"hello/world",
			},
		}}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				for _, input := range tt.input {
					output := validation.IsValidNamespace(input)
					require.Equal(t, tt.expect, output, "input: %s", input)
				}
			})
		}
	})

	t.Run("group", func(t *testing.T) {
		tests := []struct {
			name   string
			input  []string // variations that produce the same output
			expect []string
		}{{
			name:   "too long",
			expect: []string{"group is too long"},
			input:  []string{strings.Repeat("0", 61)},
		}, {
			name:   "too short",
			expect: []string{"group is too short"},
			input:  []string{"a", "1", "aa"},
		}, {
			name: "ok",
			input: []string{
				"hello",
				strings.Repeat("a", 60), // long... alpha
				"dashboards.grafana.app",
				"prometheus-datasource",
				"1234", // just a numbers
				"aaa",
			},
		}, {
			name: "bad input",
			expect: []string{
				"group must consist of alphanumeric characters, '-', '_' or '.', and must start and end with an alphanumeric character (e.g. 'dashboards.grafana.app',  or 'grafana-loki-datasource', regex used for validation is '^([A-Za-z0-9][-A-Za-z0-9_.]*)?[A-Za-z0-9]$')",
			},
			input: []string{
				"_bad_input", // starts with non-alpha
				"hello world",
				"hello!",
				"hello~",
				"hello ",
				"hello*",
				"hello+",
				"hello=",
				"hello%",
				"hello/world",
			},
		}}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				for _, input := range tt.input {
					output := validation.IsValidGroup(input)
					require.Equal(t, tt.expect, output, "input: %s", input)
				}
			})
		}
	})

	t.Run("resource", func(t *testing.T) {
		tests := []struct {
			name   string
			input  []string // variations that produce the same output
			expect []string
		}{{
			name:   "too long",
			expect: []string{"resource is too long"},
			input:  []string{strings.Repeat("0", 41)},
		}, {
			name:   "too short",
			expect: []string{"resource is too short"},
			input:  []string{"a", "1", "aa"},
		}, {
			name: "ok",
			input: []string{
				"hello",
				strings.Repeat("a", 40), // long... alpha
				"dashboards",
				"folders",
				"folders123",
				"aaa",
				"hello-world",
				"hello-world-",
			},
		}, {
			name: "bad input",
			expect: []string{
				"resource must consist of alphanumeric characters and dashes, and must start with an alphabetic character (e.g. 'dashboards',  or 'folders', regex used for validation is '^[A-Za-z][A-Za-z0-9-]*$')",
			},
			input: []string{
				"_bad_input",
				"hello world",
				"hello!",
				"hello~",
				"hello ",
				"hello*",
				"hello+",
				"hello=",
				"hello%",
				"hello/world",
			},
		}}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				for _, input := range tt.input {
					output := validation.IsValidResource(input)
					require.Equal(t, tt.expect, output, "input: %s", input)
				}
			})
		}
	})
}

package ualert

import (
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/assert"
)

func TestTokenString(t *testing.T) {
	t1 := Token{Literal: "this is a literal"}
	assert.Equal(t, "this is a literal", t1.String())
	t2 := Token{Variable: "this is a variable"}
	assert.Equal(t, "this is a variable", t2.String())
}

func TestTokenizeVariable(t *testing.T) {
	tests := []struct {
		name   string
		text   string
		token  Token
		offset int
		err    string
	}{{
		name:   "variable with no trailing text",
		text:   "${instance}",
		token:  Token{Variable: "instance"},
		offset: 11,
	}, {
		name:   "variable with trailing text",
		text:   "${instance} is down",
		token:  Token{Variable: "instance"},
		offset: 11,
	}, {
		name:   "varaiable with numbers",
		text:   "${instance1} is down",
		token:  Token{Variable: "instance1"},
		offset: 12,
	}, {
		name:   "variable with underscores",
		text:   "${instance_with_underscores} is down",
		token:  Token{Variable: "instance_with_underscores"},
		offset: 28,
	}, {
		name:   "variable with spaces",
		text:   "${instance with spaces} is down",
		token:  Token{Variable: "instance with spaces"},
		offset: 23,
	}, {
		name:   "variable with non-reserved special character",
		text:   "${@instance1} is down",
		token:  Token{Variable: "@instance1"},
		offset: 13,
	}, {
		name:   "two variables without spaces",
		text:   "${variable1}${variable2}",
		token:  Token{Variable: "variable1"},
		offset: 12,
	}, {
		name:   "variable with two closing braces stops at first brace",
		text:   "${instance}} is down",
		token:  Token{Variable: "instance"},
		offset: 11,
	}, {
		name:   "variable with newline",
		text:   "${instance\n} is down",
		offset: 10,
		err:    "unexpected whitespace",
	}, {
		name:   "variable with ambiguous delimiter returns error",
		text:   "${${instance}",
		offset: 2,
		err:    "ambiguous delimiter",
	}, {
		name:   "variable without closing brace returns error",
		text:   "${instance is down",
		offset: 18,
		err:    "expected '}', got 'n'",
	}}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			token, offset, err := tokenizeVariable([]rune(test.text))
			if test.err != "" {
				assert.EqualError(t, err, test.err)
			}
			assert.Equal(t, test.offset, offset)
			assert.Equal(t, test.token, token)
		})
	}
}

func TestTokenizeTmpl(t *testing.T) {
	tests := []struct {
		name   string
		tmpl   string
		tokens []Token
	}{{
		name:   "simple template can be tokenized",
		tmpl:   "${instance} is down",
		tokens: []Token{{Variable: "instance"}, {Literal: " is down"}},
	}, {
		name: "complex template can be tokenized",
		tmpl: "More than ${value} ${status_code} in the last 5 minutes",
		tokens: []Token{
			{Literal: "More than "},
			{Variable: "value"},
			{Literal: " "},
			{Variable: "status_code"},
			{Literal: " in the last 5 minutes"},
		},
	}, {
		name:   "variables without spaces between can be tokenized",
		tmpl:   "${value}${status_code}",
		tokens: []Token{{Variable: "value"}, {Variable: "status_code"}},
	}, {
		name:   "variables without spaces between then literal can be tokenized",
		tmpl:   "${value}${status_code} in the last 5 minutes",
		tokens: []Token{{Variable: "value"}, {Variable: "status_code"}, {Literal: " in the last 5 minutes"}},
	}, {
		name: "variables with reserved characters can be tokenized",
		tmpl: "More than ${$value} ${{status_code} in the last 5 minutes",
		tokens: []Token{
			{Literal: "More than "},
			{Variable: "$value"},
			{Literal: " "},
			{Variable: "{status_code"},
			{Literal: " in the last 5 minutes"},
		},
	}, {
		name:   "ambiguous delimiters are tokenized as literals",
		tmpl:   "Instance ${instance and ${instance} is down",
		tokens: []Token{{Literal: "Instance ${instance and "}, {Variable: "instance"}, {Literal: " is down"}},
	}, {
		name:   "all '$' runes preceding a variable are included in literal",
		tmpl:   "Instance $${instance} is down",
		tokens: []Token{{Literal: "Instance $"}, {Variable: "instance"}, {Literal: " is down"}},
	}, {
		name:   "sole '$' rune is included in literal",
		tmpl:   "Instance $instance and ${instance} is down",
		tokens: []Token{{Literal: "Instance $instance and "}, {Variable: "instance"}, {Literal: " is down"}},
	}, {
		name:   "extra closing brace is included in literal",
		tmpl:   "Instance ${instance}} and ${instance} is down",
		tokens: []Token{{Literal: "Instance "}, {Variable: "instance"}, {Literal: "} and "}, {Variable: "instance"}, {Literal: " is down"}},
	}, {
		name:   "variable with newline tokenized as literal",
		tmpl:   "${value}${status_code\n}${value} in the last 5 minutes",
		tokens: []Token{{Variable: "value"}, {Literal: "${status_code\n}"}, {Variable: "value"}, {Literal: " in the last 5 minutes"}},
	}, {
		name:   "extra closing brace between variables is included in literal",
		tmpl:   "${value}${status_code}}${value} in the last 5 minutes",
		tokens: []Token{{Variable: "value"}, {Variable: "status_code"}, {Literal: "}"}, {Variable: "value"}, {Literal: " in the last 5 minutes"}},
	}}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			tokens := tokenizeTmpl(log.NewNopLogger(), test.tmpl)
			assert.Equal(t, test.tokens, tokens)
		})
	}
}

func TestTokensToTmpl(t *testing.T) {
	tokens := []Token{{Variable: "instance"}, {Literal: " is down"}}
	assert.Equal(t, "{{instance}} is down", tokensToTmpl(tokens))
}

func TestTokensToTmplNewlines(t *testing.T) {
	tokens := []Token{{Variable: "instance"}, {Literal: " is down\n"}, {Variable: "job"}, {Literal: " is down"}}
	assert.Equal(t, "{{instance}} is down\n{{job}} is down", tokensToTmpl(tokens))
}

func TestMapLookupString(t *testing.T) {
	cases := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "when there are no spaces",
			input:    "instance",
			expected: "$labels.instance",
		},
		{
			name:     "when there are spaces",
			input:    "instance with spaces",
			expected: `index $labels "instance with spaces"`,
		},
		{
			name:     "when there are quotes",
			input:    `instance with "quotes"`,
			expected: `index $labels "instance with \"quotes\""`,
		},
		{
			name:     "when there are backslashes",
			input:    `instance with \backslashes\`,
			expected: `index $labels "instance with \\backslashes\\"`,
		},
		{
			name:     "when there are legacy delimiter characters",
			input:    `instance{ with $delim} characters`,
			expected: `index $labels "instance{ with $delim} characters"`,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, mapLookupString(tc.input, "labels"))
		})
	}
}

func TestVariablesToMapLookups(t *testing.T) {
	tokens := []Token{{Variable: "instance"}, {Literal: " is down"}}
	expected := []Token{{Variable: "$labels.instance"}, {Literal: " is down"}}
	assert.Equal(t, expected, variablesToMapLookups(tokens, "labels"))
}

func TestVariablesToMapLookupsSpace(t *testing.T) {
	tokens := []Token{{Variable: "instance with spaces"}, {Literal: " is down"}}
	expected := []Token{{Variable: "index $labels \"instance with spaces\""}, {Literal: " is down"}}
	assert.Equal(t, expected, variablesToMapLookups(tokens, "labels"))
}

func TestEscapeLiterals(t *testing.T) {
	cases := []struct {
		name     string
		input    []Token
		expected []Token
	}{
		{
			name:     "when there are no literals",
			input:    []Token{{Variable: "instance"}},
			expected: []Token{{Variable: "instance"}},
		},
		{
			name:     "literal with double braces: {{",
			input:    []Token{{Literal: "instance {{"}},
			expected: []Token{{Literal: "{{`instance {{`}}"}},
		},
		{
			name:     "literal that ends with closing brace: {",
			input:    []Token{{Literal: "instance {"}},
			expected: []Token{{Literal: "{{`instance {`}}"}},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, escapeLiterals(tc.input))
		})
	}
}

func TestMigrateTmpl(t *testing.T) {
	cases := []struct {
		name     string
		input    string
		expected string
		vars     bool
	}{
		{
			name:     "template does not contain variables",
			input:    "instance is down",
			expected: "instance is down",
			vars:     false,
		},
		{
			name:     "template contains variable",
			input:    "${instance} is down",
			expected: withDeduplicateMap("{{$mergedLabels.instance}} is down"),
			vars:     true,
		},
		{
			name:     "template contains double braces",
			input:    "{{CRITICAL}} instance is down",
			expected: "{{`{{CRITICAL}} instance is down`}}",
			vars:     false,
		},
		{
			name:     "template contains opening brace before variable",
			input:    `${${instance} is down`,
			expected: withDeduplicateMap("{{`${`}}{{$mergedLabels.instance}} is down"),
			vars:     true,
		},
		{
			name:     "template contains newline",
			input:    "CRITICAL\n${instance} is down",
			expected: withDeduplicateMap("CRITICAL\n{{$mergedLabels.instance}} is down"),
			vars:     true,
		},
		{
			name:     "partial migration, no variables",
			input:    "${instance is down",
			expected: "${instance is down",
		},
		{
			name:     "partial migration, with variables",
			input:    "${instance} is down ${${nestedVar}}",
			expected: withDeduplicateMap("{{$mergedLabels.instance}}{{` is down ${`}}{{$mergedLabels.nestedVar}}}"),
			vars:     true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			tmpl := MigrateTmpl(log.NewNopLogger(), tc.input)

			assert.Equal(t, tc.expected, tmpl)
		})
	}
}

func withDeduplicateMap(input string) string {
	// hardcode function name to fail tests if it changes
	funcName := "mergeLabelValues"

	return fmt.Sprintf("{{- $mergedLabels := %s $values -}}\n", funcName) + input
}

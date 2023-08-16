package ualert

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTokenString(t *testing.T) {
	t1 := Token{Literal: "this is a literal"}
	assert.Equal(t, "this is a literal", t1.String())
	t2 := Token{Variable: "this is a variable"}
	assert.Equal(t, "this is a variable", t2.String())
}

func TestTokenizeLiteral(t *testing.T) {
	tests := []struct {
		name  string
		text  string
		token Token
		pos   int
		err   string
	}{{
		name:  "no characters",
		text:  "",
		token: Token{},
		pos:   0,
	}, {
		name:  "string is valid literal",
		text:  "Instance is down",
		token: Token{Literal: "Instance is down"},
		pos:   16,
	}, {
		name:  "string with numbers is a valid literal",
		text:  "Instance 1 is down",
		token: Token{Literal: "Instance 1 is down"},
		pos:   18,
	}, {
		name:  "all spaces",
		text:  "    ",
		token: Token{Literal: "    "},
		pos:   4,
	}, {
		name:  "leading space is preserved",
		text:  " Instance 1 is down",
		token: Token{Literal: " Instance 1 is down"},
		pos:   19,
	}, {
		name:  "leading spaces are preserved",
		text:  "  Instance 1 is down",
		token: Token{Literal: "  Instance 1 is down"},
		pos:   20,
	}, {
		name:  "trailing space is preserved",
		text:  "Instance 1 is down ",
		token: Token{Literal: "Instance 1 is down "},
		pos:   19,
	}, {
		name:  "trailing spaces are preserved",
		text:  "Instance 1 is down  ",
		token: Token{Literal: "Instance 1 is down  "},
		pos:   20,
	}, {
		name:  "string is terminated at $",
		text:  "Instance ${instance} is down",
		token: Token{Literal: "Instance "},
		pos:   9,
	}}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			token, pos, err := tokenizeLiteral([]rune(test.text))
			if test.err != "" {
				assert.EqualError(t, err, test.err)
			}
			assert.Equal(t, test.pos, pos)
			assert.Equal(t, test.token, token)
		})
	}
}

func TestTokenizeVariable(t *testing.T) {
	tests := []struct {
		name  string
		text  string
		token Token
		pos   int
		err   string
	}{{
		name:  "variable with no trailing text",
		text:  "${instance}",
		token: Token{Variable: "instance"},
		pos:   11,
	}, {
		name:  "variable with trailing text",
		text:  "${instance} is down",
		token: Token{Variable: "instance"},
		pos:   11,
	}, {
		name:  "varaiable with numbers",
		text:  "${instance1} is down",
		token: Token{Variable: "instance1"},
		pos:   12,
	}, {
		name:  "variable with underscores",
		text:  "${instance_with_underscores} is down",
		token: Token{Variable: "instance_with_underscores"},
		pos:   28,
	}, {
		name:  "variable with spaces",
		text:  "${instance with spaces} is down",
		token: Token{Variable: "instance with spaces"},
		pos:   23,
	}, {
		name:  "variable with non-reserved special character",
		text:  "${@instance1} is down",
		token: Token{Variable: "@instance1"},
		pos:   13,
	}, {
		name:  "two variables without spaces",
		text:  "${variable1}${variable2}",
		token: Token{Variable: "variable1"},
		pos:   12,
	}, {
		name: "variable with newline",
		text: "${instance\n} is down",
		pos:  10,
		err:  "unexpected whitespace",
	}, {
		name: "all '$' returns error",
		text: "$$",
		pos:  1,
		err:  "expected '{', got '$'",
	}, {
		name: "two '$' before variable returns error",
		text: "$${instance} is down",
		pos:  1,
		err:  "expected '{', got '$'",
	}, {
		name: "variable without braces returns error",
		text: "$instance is down",
		pos:  1,
		err:  "expected '{', got 'i'",
	}, {
		name: "variable with two opening braces returns error",
		text: "${{instance}",
		pos:  2,
		err:  "unexpected '{'",
	}, {
		name: "variable without closing brace returns error",
		text: "${instance",
		pos:  10,
		err:  "expected '}', got 'e'",
	}, {
		name: "variable without closing and literal brace returns error",
		text: "${instance is down",
		pos:  18,
		err:  "expected '}', got 'n'",
	}, {
		name: "variable with two closing braces returns error",
		text: "${instance}} is down",
		pos:  11,
		err:  "unexpected '}'",
	}, {
		name: "variable with nested braces returns error",
		text: "${instance{}} is down",
		pos:  10,
		err:  "unexpected '{'",
	}, {
		name: "variable with nested '$' returns error",
		text: "${instance$} is down",
		pos:  10,
		err:  "unexpected '$'",
	}, {
		name: "variable with extra '}' returns error",
		text: "${instance}} is down",
		pos:  11,
		err:  "unexpected '}'",
	}}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			token, pos, err := tokenizeVariable([]rune(test.text))
			if test.err != "" {
				assert.EqualError(t, err, test.err)
			}
			assert.Equal(t, test.pos, pos)
			assert.Equal(t, test.token, token)
		})
	}
}

func TestTokenizeTmpl(t *testing.T) {
	tests := []struct {
		name   string
		tmpl   string
		tokens []Token
		err    string
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
	}}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			tokens, err := tokenizeTmpl(test.tmpl)
			if test.err != "" {
				assert.EqualError(t, err, test.err)
			}
			assert.Equal(t, test.tokens, tokens)
		})
	}
}

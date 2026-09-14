package regex

import (
	"regexp"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseMatching(t *testing.T) {
	for _, tc := range []regexMatchCase{
		{
			name:       "whole-value alternation",
			expression: "firing|pending",
			matches:    []string{"firing", "pending"},
			rejects:    []string{"not-firing", "FIRING"},
		},
		{
			name:       "prefix with newline",
			expression: "prod-.*",
			matches:    []string{"prod-eu", "prod-\neu"},
			rejects:    []string{"dev-eu"},
		},
		{
			name:       "substring",
			expression: ".*crit.*",
			matches:    []string{"critical", "very-critical"},
			rejects:    []string{"warning"},
		},
		{
			name:       "zero or more characters",
			expression: ".*",
			matches:    []string{"", "\n", "account"},
		},
		{
			name:       "one or more characters",
			expression: ".+",
			matches:    []string{"\n", "account"},
			rejects:    []string{""},
		},
		{
			name:            "case-insensitive alternatives",
			expression:      "(?i)critical|warning",
			matches:         []string{"CRITICAL", "Warning"},
			rejects:         []string{"precritical"},
			caseInsensitive: true,
		},
		{
			name:       "outer anchors",
			expression: "^critical$",
			matches:    []string{"critical"},
			rejects:    []string{"critical\n"},
		},
		{
			name:       "bounded character range",
			expression: "[a-z]{2,8}",
			matches:    []string{"ab", "abcdefgh"},
			rejects:    []string{"a", "abcdefghi"},
		},
		{
			name:       "grouped alternatives",
			expression: "(prod|staging)-(eu|us)",
			matches:    []string{"prod-eu", "staging-us"},
			rejects:    []string{"prod-ap"},
		},
		{
			name:       "optional and repeated characters",
			expression: "ab?c+",
			matches:    []string{"ac", "abcc"},
			rejects:    []string{"ab"},
		},
		{
			name:       "exact repetition",
			expression: "a{2}",
			matches:    []string{"aa"},
			rejects:    []string{"a", "aaa"},
		},
		{
			name:       "zero to maximum repetition",
			expression: "a{0,2}",
			matches:    []string{"", "a", "aa"},
			rejects:    []string{"aaa"},
		},
		{
			name:       "minimum repetition",
			expression: "a{2,}",
			matches:    []string{"aa", "aaa"},
			rejects:    []string{"a"},
		},
		{
			name:       "control character escapes",
			expression: `\n\r\t`,
			matches:    []string{"\n\r\t"},
		},
		{
			name:       "negated character class",
			expression: `[^\n]+`,
			matches:    []string{"critical"},
			rejects:    []string{"\n"},
		},
		{
			name:            "case-insensitive Unicode range",
			expression:      "(?i)[é-ê]+",
			matches:         []string{"é", "ÉÊ"},
			rejects:         []string{"e"},
			caseInsensitive: true,
		},
		{
			name:            "case-insensitive Unicode literal",
			expression:      "(?i)日本é",
			matches:         []string{"日本É"},
			rejects:         []string{"日本e"},
			caseInsensitive: true,
		},
		{
			name:       "ASCII digits",
			expression: `\d+`,
			matches:    []string{"0123"},
			rejects:    []string{"é", "１２"},
		},
		{
			name:       "non-ASCII digits and other characters",
			expression: `\D+`,
			matches:    []string{"é", "１２"},
			rejects:    []string{"0123"},
		},
		{
			name:       "ASCII word characters",
			expression: `\w+`,
			matches:    []string{"aB_09"},
			rejects:    []string{"é", "-"},
		},
		{
			name:       "non-word characters",
			expression: `\W+`,
			matches:    []string{"é", "-"},
			rejects:    []string{"aB_09"},
		},
		{
			name:            "case-insensitive outer anchors",
			expression:      "(?i)^CRITICAL$",
			caseInsensitive: true,
			matches:         []string{"critical", "CRITICAL"},
			rejects:         []string{"critical\n"},
		},
		{
			name:       "empty expression",
			expression: "",
			matches:    []string{""},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			assertRegexMatches(t, tc)
		})
	}
}

func TestRegexCanonicalCharacterClasses(t *testing.T) {
	for _, tc := range []struct{ shorthand, canonical string }{
		{`\d`, `[0-9]`},
		{`\D`, `[^0-9]`},
		{`\w`, `[0-9A-Za-z_]`},
		{`\W`, `[^0-9A-Za-z_]`},
	} {
		t.Run(tc.shorthand, func(t *testing.T) {
			shorthand, err := Parse(tc.shorthand)
			require.NoError(t, err)
			canonical, err := Parse(tc.canonical)
			require.NoError(t, err)
			assert.True(t, shorthand.Expression.Equal(canonical.Expression))
		})
	}
}

func TestParseRejectsUnsupportedSyntax(t *testing.T) {
	for _, tc := range []struct {
		name       string
		expression string
	}{
		{name: "leading zero in repetition", expression: "a{01}"},
		{name: "leading zero in repetition maximum", expression: "a{1,02}"},
		{name: "unclosed repetition", expression: "a{"},
		{name: "unescaped closing brace", expression: "a}?"},
		{name: "malformed lazy repetition", expression: "a{01}?"},
		{name: "unclosed group", expression: "foo("},

		{name: "dotall flag", expression: "(?s)foo"},
		{name: "multiline flag", expression: "(?m)foo"},
		{name: "combined flags", expression: "(?im)foo"},
		{name: "case-disable flag", expression: "(?-i)foo"},
		{name: "trailing case flag", expression: "123(?i)"},
		{name: "embedded case flag", expression: "foo(?i)bar"},
		{name: "repeated leading flag", expression: "(?i)(?i)foo"},
		{name: "case disabling after leading flag", expression: "(?i)(?-i)foo"},
		{name: "case disabling on digits", expression: "(?i)(?-i)123"},
		{name: "case disabling on class", expression: "(?i)(?-i)[a-z]"},

		{name: "noncapturing group", expression: "(?:foo)"},
		{name: "named capture", expression: "(?P<name>foo)"},
		{name: "scoped case folding", expression: "(?i:foo)"},
		{name: "scoped case disabling", expression: "(?i)foo(?-i:bar)"},
		{name: "case folding on invariant class", expression: "(?i:[0-9]{3})a"},
		{name: "scoped dotall", expression: "(?s:.)"},
		{name: "flag in zero repetition", expression: "(?s:.){0}"},

		{name: "lazy star", expression: "a*?"},
		{name: "lazy plus", expression: "a+?"},
		{name: "lazy optional", expression: "a??"},
		{name: "lazy zero repetition", expression: "a{0}?"},
		{name: "lazy bounded repetition", expression: "a{2,4}?"},

		{name: "hex escape", expression: `\x61`},
		{name: "whitespace shorthand", expression: `\s`},
		{name: "negated whitespace shorthand", expression: `\S`},
		{name: "POSIX class", expression: "[[:alpha:]?]+"},
		{name: "case-insensitive POSIX class", expression: "(?i)[[:alpha:]]"},
		{name: "Unicode property", expression: `\p{L}`},
		{name: "negated Unicode property in zero repetition", expression: `\P{L}{0}`},
		{name: "quoted property escape", expression: `\Q(?i)\p{L}\E`},
		{name: "quoted case-disable text", expression: `(?i)\Q(?-i)\E`},
		{name: "unterminated quoted literal", expression: `\Qfoo$`},

		{name: "text anchor escapes", expression: `\Afoo\z`},
		{name: "word boundary", expression: `\bfoo`},
		{name: "boundary in zero repetition", expression: `\b{0}foo`},
		{name: "multiline anchors", expression: "(?m)^foo$"},
		{name: "scoped multiline anchor", expression: "foo(?m:^bar)"},
		{name: "lookahead", expression: "(?=foo)"},
		{name: "backreference", expression: `(foo)\1`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := Parse(tc.expression)
			require.Error(t, err)
		})
	}
}

// Escapes and class contents must not be mistaken for flags or repetition syntax.
func TestParseLiteralSyntax(t *testing.T) {
	for _, tc := range []regexMatchCase{
		{
			name:       "escaped repetition punctuation",
			expression: `a\{01\}\?`,
			matches:    []string{"a{01}?"},
		},
		{
			name:       "escaped bracket inside class",
			expression: `[\](?i)]+`,
			matches:    []string{"](?i)"},
			rejects:    []string{"x"},
		},
		{
			name:       "leading bracket in negated class",
			expression: `[^](?i)]+`,
			matches:    []string{"x"},
			rejects:    []string{"]", "i"},
		},
		{
			name:       "leading bracket inside class",
			expression: "[](?i)]",
			matches:    []string{"]", "?", "i"},
			rejects:    []string{"x"},
		},
		{
			name:       "escaped flag-like text",
			expression: `\(\?i\)`,
			matches:    []string{"(?i)"},
		},
		{
			name:            "escaped case-disable text with case folding",
			expression:      `(?i)\(\?-i\)`,
			matches:         []string{"(?-I)"},
			caseInsensitive: true,
		},
		{
			name:       "escaped anchors",
			expression: `\^critical\$`,
			matches:    []string{"^critical$"},
			rejects:    []string{"critical"},
		},
		{
			name:       "escaped question mark",
			expression: `foo\?`,
			matches:    []string{"foo?"},
			rejects:    []string{"foo"},
		},
		{
			name:       "escaped dollar",
			expression: `foo\$`,
			matches:    []string{"foo$"},
			rejects:    []string{"foo"},
		},
		{
			name:       "escaped backslash before anchor",
			expression: `foo\\$`,
			matches:    []string{`foo\`},
			rejects:    []string{`foo\$`},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			assertRegexMatches(t, tc)
		})
	}
}

type regexMatchCase struct {
	name            string
	expression      string
	matches         []string
	rejects         []string
	caseInsensitive bool
}

func assertRegexMatches(t *testing.T, tc regexMatchCase) {
	t.Helper()
	matcher, err := Parse(tc.expression)
	require.NoError(t, err)
	assert.Equal(t, tc.caseInsensitive, matcher.CaseInsensitive)
	pattern := matcher.Expression.String()
	if matcher.CaseInsensitive {
		pattern = "(?i:" + pattern + ")"
	}
	compiled, err := regexp.Compile("^(?:" + pattern + ")$")
	require.NoError(t, err)
	for _, value := range tc.matches {
		assert.True(t, compiled.MatchString(value), "should match %q", value)
	}
	for _, value := range tc.rejects {
		assert.False(t, compiled.MatchString(value), "should not match %q", value)
	}
}

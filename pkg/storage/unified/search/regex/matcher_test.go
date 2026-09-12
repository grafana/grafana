package regex

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParse(t *testing.T) {
	for _, tc := range []struct {
		expression      string
		matches         []string
		rejects         []string
		caseInsensitive bool
		invalid         bool
	}{
		{expression: "firing|pending", matches: []string{"firing", "pending"}, rejects: []string{"not-firing", "FIRING"}},
		{expression: "prod-.*", matches: []string{"prod-eu", "prod-\neu"}, rejects: []string{"dev-eu"}},
		{expression: ".*crit.*", matches: []string{"critical", "very-critical"}, rejects: []string{"warning"}},
		{expression: ".*", matches: []string{"", "\n", "account"}},
		{expression: ".+", matches: []string{"\n", "account"}, rejects: []string{""}},
		{expression: "(?i)critical|warning", matches: []string{"CRITICAL", "Warning"}, rejects: []string{"precritical"}, caseInsensitive: true},
		{expression: "^critical$", matches: []string{"critical"}, rejects: []string{"critical\n"}},
		{expression: "[a-z]{2,8}", matches: []string{"ab", "abcdefgh"}, rejects: []string{"a", "abcdefghi"}},
		{expression: `[^\n]+`, matches: []string{"critical"}, rejects: []string{"\n"}},
		{expression: "(?i)[é-ê]+", matches: []string{"é", "ÉÊ"}, rejects: []string{"e"}, caseInsensitive: true},
		{expression: "(?i)日本é", matches: []string{"日本É"}, rejects: []string{"日本e"}, caseInsensitive: true},
		{expression: "[](?i)]", matches: []string{"]", "?", "i"}, rejects: []string{"x"}},
		{expression: "[[:alpha:]?]+", matches: []string{"abc?"}, rejects: []string{"123"}},
		{expression: `\Q(?i)\p{L}\E`, matches: []string{`(?i)\p{L}`}},
		{expression: `\(\?i\)`, matches: []string{"(?i)"}},
		{expression: "a}?", matches: []string{"a", "a}"}},
		{expression: "a{01}?", matches: []string{"a{01", "a{01}"}},
		{expression: `\d+`, matches: []string{"0123"}, rejects: []string{"é", "１２"}},
		{expression: `\D+`, matches: []string{"é", "１２"}, rejects: []string{"0123"}},
		{expression: `\w+`, matches: []string{"aB_09"}, rejects: []string{"é", "-"}},
		{expression: `\W+`, matches: []string{"é", "-"}, rejects: []string{"aB_09"}},
		{expression: `\s`, matches: []string{"\t", "\n", "\f", "\r", " "}, rejects: []string{"\v", "x"}},
		{expression: "123(?i)", matches: []string{"123"}, rejects: []string{"1234"}},
		{expression: "(?:foo)", matches: []string{"foo"}, rejects: []string{"FOO"}},
		{expression: `\Afoo\z`, matches: []string{"foo"}, rejects: []string{"foo\n"}},
		{expression: "(?s)foo", matches: []string{"foo"}},
		{expression: "(?m)foo", matches: []string{"foo"}},
		{expression: "(?im)foo", invalid: true},
		{expression: "(?-i)foo", matches: []string{"foo"}, rejects: []string{"FOO"}},
		{expression: "(?i)(?i)foo", invalid: true},
		{expression: "(?i)(?-i)foo", invalid: true},
		{expression: "(?i)foo(?-i:bar)", invalid: true},
		{expression: "(?i)(?-i)[a-z]", invalid: true},
		{expression: `(?i)\Q(?-i)\E`, matches: []string{"(?-I)"}, caseInsensitive: true},
		{expression: `(?i)\(\?-i\)`, matches: []string{"(?-I)"}, caseInsensitive: true},
		{expression: "foo(?i)bar", invalid: true},
		{expression: "(?i:foo)", invalid: true},
		{expression: "(?s:.){0}", matches: []string{""}, rejects: []string{"x"}},
		{expression: "a*?", invalid: true},
		{expression: "a+?", invalid: true},
		{expression: "a??", invalid: true},
		{expression: "a{0}?", invalid: true},
		{expression: `\bfoo`, invalid: true},
		{expression: `\b{0}foo`, invalid: true},
		{expression: "(?=foo)", invalid: true},
		{expression: `(foo)\1`, invalid: true},
		{expression: "(?P<name>foo)", invalid: true},
		{expression: `\p{L}`, invalid: true},
		{expression: `\P{L}{0}`, invalid: true},
		{expression: "foo(", invalid: true},
		{expression: "(?m)^foo$", invalid: true},
		{expression: "foo(?m:^bar)", invalid: true},
		{expression: "(?i)^CRITICAL$", caseInsensitive: true, matches: []string{"critical", "CRITICAL"}, rejects: []string{"critical\n"}},
		{expression: "a{2,4}?", invalid: true},
		{expression: "(?i:[0-9]{3})a", invalid: true},
		{expression: `\^critical\$`, matches: []string{"^critical$"}, rejects: []string{"critical"}},
		{expression: `foo\?`, matches: []string{"foo?"}, rejects: []string{"foo"}},
		{expression: `foo\$`, matches: []string{"foo$"}, rejects: []string{"foo"}},
		{expression: `foo\\$`, matches: []string{`foo\`}, rejects: []string{`foo\$`}},
		{expression: `\Qfoo$`, matches: []string{"foo$"}, rejects: []string{"foo"}},
		{expression: "", matches: []string{""}},
		{expression: "(?s:.)", matches: []string{"\n"}, rejects: []string{""}},
	} {
		t.Run(tc.expression, func(t *testing.T) {
			matcher, err := Parse(tc.expression)
			if tc.invalid {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.caseInsensitive, matcher.CaseInsensitive)
			compiled, err := matcher.Compile("")
			require.NoError(t, err)
			for _, value := range tc.matches {
				assert.True(t, compiled.MatchString(value), "should match %q", value)
			}
			for _, value := range tc.rejects {
				assert.False(t, compiled.MatchString(value), "should not match %q", value)
			}
		})
	}
}

func TestRegexCanonicalCharacterClasses(t *testing.T) {
	for _, tc := range []struct{ shorthand, canonical string }{
		{`\d`, `[0-9]`},
		{`\D`, `[^0-9]`},
		{`\w`, `[0-9A-Za-z_]`},
		{`\W`, `[^0-9A-Za-z_]`},
		{`\s`, `[\t\n\f\r ]`},
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

func TestLabelMatcher(t *testing.T) {
	for _, tc := range []struct {
		expression string
		term       string
		otherTerm  string
		empty      bool
	}{
		{"service.name=(?i)api|worker", "service.name=API", "serviceXname=API", false},
		{"service[name]=a=b", "service[name]=a=b", "servicen=a=b", false},
		{"severity=a*", "severity=", "severity=critical", true},
	} {
		t.Run(tc.expression, func(t *testing.T) {
			filter, err := ParseFilter("labels", tc.expression, true)
			require.NoError(t, err)
			compiled, _, _, err := filter.Compile()
			require.NoError(t, err)
			assert.True(t, compiled.MatchString(tc.term))
			assert.False(t, compiled.MatchString(tc.otherTerm))
			assert.Equal(t, tc.empty, filter.MatchMissing)
			exists, prefix, _, err := filter.Existence().Compile()
			require.NoError(t, err)
			assert.Equal(t, filter.LabelPrefix, prefix)
			assert.True(t, exists.MatchString(filter.LabelPrefix+"\n"))
			assert.False(t, exists.MatchString("other="))
		})
	}
	for _, expression := range []string{"severity", "=critical"} {
		_, err := ParseFilter("labels", expression, true)
		assert.EqualError(t, err, "flattened label regex requires a literal key=value expression")
	}
}

func TestMatchAll(t *testing.T) {
	matcher := MatchAll()
	empty, err := matcher.MatchesEmpty()
	require.NoError(t, err)
	assert.True(t, empty)
	compiled, err := matcher.Compile("severity=")
	require.NoError(t, err)
	assert.True(t, compiled.MatchString("severity=\n"))
	assert.False(t, compiled.MatchString("Severity=\n"))
}

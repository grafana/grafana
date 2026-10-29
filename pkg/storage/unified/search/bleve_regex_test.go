package search

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/search/regex"
)

func TestFilterDictionaryPrefix(t *testing.T) {
	for _, tc := range []struct {
		expression string
		label      bool
		prefix     string
		complete   bool
	}{
		{"severity=critical.*", true, "severity=critical", false},
		{"severity=(?i)critical.*", true, "severity=", false},
		{"severity=critical", true, "severity=critical", true},
		{"prod-.*", false, "prod-", false},
		{"(?i)prod-.*", false, "", false},
	} {
		t.Run(tc.expression, func(t *testing.T) {
			filter, err := parseRegexFilter("field", tc.expression, tc.label)
			require.NoError(t, err)
			_, prefix, complete, err := filter.Compile()
			require.NoError(t, err)
			assert.Equal(t, tc.prefix, prefix)
			assert.Equal(t, tc.complete, complete)
		})
	}
	_, err := parseRegexFilter("labels", "severity=(?i)(?-i)foo", true)
	assert.ErrorContains(t, err, "invalid regex for field labels: invalid regular expression:")
}

func TestRegexFilterRejectsSuccessiveQuantifiers(t *testing.T) {
	for _, flattened := range []bool{false, true} {
		_, err := parseRegexFilter("field", "severity=a+?", flattened)
		require.ErrorContains(t, err, "unsupported successive quantifiers")
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
			filter, err := parseRegexFilter("labels", tc.expression, true)
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
		_, err := parseRegexFilter("labels", expression, true)
		assert.EqualError(t, err, "flattened label regex requires a literal key=value expression")
	}
}

func TestMatchAll(t *testing.T) {
	matcher := regex.MatchAll()
	value, err := compileRegex(matcher, "")
	require.NoError(t, err)
	assert.True(t, value.MatchString(""))
	compiled, err := compileRegex(matcher, "severity=")
	require.NoError(t, err)
	assert.True(t, compiled.MatchString("severity=\n"))
	assert.False(t, compiled.MatchString("Severity=\n"))
}

func TestRegexExpansionBudget(t *testing.T) {
	for _, tc := range []struct {
		name         string
		initialMatch bool
		nextMatch    bool
		kind         regexLimitKind
		message      string
	}{
		{"scan limit", false, false, regexDictionaryLimit, `regular expression on field "labels" exceeds the 10000-term dictionary scan limit`},
		{"matching term exceeds scan limit", false, true, regexDictionaryLimit, `regular expression on field "labels" exceeds the 10000-term dictionary scan limit`},
		{"expansion takes precedence", true, true, regexExpansionLimit, `regular expression on field "labels" exceeds the 10000-term expansion limit`},
		{"nonmatching term after full expansion", true, false, regexDictionaryLimit, `regular expression on field "labels" exceeds the 10000-term dictionary scan limit`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			budget := regexExpansionBudget{Field: "labels"}
			for range 10_000 {
				require.NoError(t, budget.Observe(tc.initialMatch))
			}
			err := budget.Observe(tc.nextMatch)
			var limitErr *regexLimitError
			require.ErrorAs(t, err, &limitErr)
			assert.Equal(t, tc.kind, limitErr.Kind)
			assert.EqualError(t, err, tc.message)
		})
	}
}

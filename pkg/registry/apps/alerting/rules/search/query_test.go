package search

import (
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestParseParams(t *testing.T) {
	v, err := url.ParseQuery("q=cpu&folders=f1&folders=f2&groups=g1&paused=true&limit=10&sort=-group&type=alertrule&labels=team%3Da&labels=!__grafana_origin&datasourceUIDs=ds1&panelID=7")
	require.NoError(t, err)

	p := parseParams(v)

	assert.Equal(t, "cpu", strVal(p.Q))
	assert.Equal(t, []string{"f1", "f2"}, p.Folders)
	assert.Equal(t, []string{"g1"}, p.Groups)
	require.NotNil(t, p.Paused)
	assert.True(t, *p.Paused)
	assert.Equal(t, int64(10), limit(p))
	assert.Equal(t, "alertrule", strVal(p.Type))
	assert.Equal(t, []string{"ds1"}, p.DatasourceUIDs)
	assert.Equal(t, "7", panelID(p))

	field, desc := sortSpec(p.Sort)
	assert.Equal(t, "group", field)
	assert.True(t, desc)
}

func TestParseLabelMatcher(t *testing.T) {
	tests := map[string]labelMatcher{
		"team=a":            {key: "team", value: "a", op: matchEquals},
		"team!=a":           {key: "team", value: "a", op: matchNotEquals},
		"__grafana_origin":  {key: "__grafana_origin", op: matchExists},
		"!__grafana_origin": {key: "__grafana_origin", op: matchNotExists},
	}
	for in, want := range tests {
		assert.Equal(t, want, parseLabelMatcher(in), in)
	}
}

func TestMatchLabels(t *testing.T) {
	rule := &ngmodels.AlertRule{Labels: map[string]string{"team": "a", "__grafana_origin": "plugin/x"}}

	assert.True(t, matchLabels(rule, parseLabelMatchers([]string{"team=a"})))
	assert.False(t, matchLabels(rule, parseLabelMatchers([]string{"team=b"})))
	assert.True(t, matchLabels(rule, parseLabelMatchers([]string{"team!=b"})))
	// plugin-owned via existence check
	assert.True(t, matchLabels(rule, parseLabelMatchers([]string{"__grafana_origin"})))
	assert.False(t, matchLabels(rule, parseLabelMatchers([]string{"!__grafana_origin"})))
	// all matchers must hold (AND)
	assert.False(t, matchLabels(rule, parseLabelMatchers([]string{"team=a", "missing"})))
}

func TestMatchDatasources(t *testing.T) {
	rule := &ngmodels.AlertRule{Data: []ngmodels.AlertQuery{
		{DatasourceUID: "ds1"},
		{DatasourceUID: expr.DatasourceUID},
	}}

	assert.True(t, matchDatasources(rule, nil))
	assert.True(t, matchDatasources(rule, []string{"ds1"}))
	assert.True(t, matchDatasources(rule, []string{"other", "ds1"}))
	assert.False(t, matchDatasources(rule, []string{"other"}))
	// the server-side expression datasource is never matchable
	assert.False(t, matchDatasources(rule, []string{expr.DatasourceUID}))
}

func TestSortRules(t *testing.T) {
	rules := []*ngmodels.AlertRule{
		{Title: "b", NamespaceUID: "f1", RuleGroup: "g1", RuleGroupIndex: 2},
		{Title: "a", NamespaceUID: "f1", RuleGroup: "g1", RuleGroupIndex: 1},
		{Title: "c", NamespaceUID: "f1", RuleGroup: "g0", RuleGroupIndex: 1},
	}

	sortRules(rules, "group", false)
	// g0 sorts before g1; within g1 the group index is preserved.
	assert.Equal(t, []string{"c", "a", "b"}, titles(rules))

	sortRules(rules, "title", false)
	assert.Equal(t, []string{"a", "b", "c"}, titles(rules))

	sortRules(rules, "title", true)
	assert.Equal(t, []string{"c", "b", "a"}, titles(rules))
}

func TestPaginate(t *testing.T) {
	rules := make([]*ngmodels.AlertRule, 5)
	for i := range rules {
		rules[i] = &ngmodels.AlertRule{UID: string(rune('a' + i))}
	}

	page, token := paginate(rules, "", 2)
	assert.Len(t, page, 2)
	assert.Equal(t, "2", token)

	page, token = paginate(rules, token, 2)
	assert.Equal(t, []string{"c", "d"}, uids(page))
	assert.Equal(t, "4", token)

	page, token = paginate(rules, token, 2)
	assert.Equal(t, []string{"e"}, uids(page))
	assert.Empty(t, token, "last page has no continue token")

	page, token = paginate(rules, "", 0)
	assert.Len(t, page, 5, "limit 0 returns everything")
	assert.Empty(t, token)
}

func titles(rules []*ngmodels.AlertRule) []string {
	out := make([]string, len(rules))
	for i, r := range rules {
		out[i] = r.Title
	}
	return out
}

func uids(rules []*ngmodels.AlertRule) []string {
	out := make([]string, len(rules))
	for i, r := range rules {
		out[i] = r.UID
	}
	return out
}

package search

import (
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestParseLabelMatcher(t *testing.T) {
	tests := map[string]labelMatcher{
		"team=a":            {key: "team", value: "a", op: matchEquals},
		"team!=a":           {key: "team", value: "a", op: matchNotEquals},
		"__grafana_origin":  {key: "__grafana_origin", op: matchExists},
		"!__grafana_origin": {key: "__grafana_origin", op: matchNotExists},
	}
	for in, want := range tests {
		assert.Equal(t, want, parseLabelMatcher(in), in)
		// matchers must survive the round trip through a request requirement.
		assert.Equal(t, want, requirementToMatcher(matcherToRequirement(want)), in)
	}
}

func TestMatchLabels(t *testing.T) {
	rule := &ngmodels.AlertRule{Labels: map[string]string{"team": "a", "__grafana_origin": "plugin/x"}}

	assert.True(t, matchLabels(rule, []labelMatcher{parseLabelMatcher("team=a")}))
	assert.False(t, matchLabels(rule, []labelMatcher{parseLabelMatcher("team=b")}))
	assert.True(t, matchLabels(rule, []labelMatcher{parseLabelMatcher("team!=b")}))
	assert.True(t, matchLabels(rule, []labelMatcher{parseLabelMatcher("__grafana_origin")}))
	assert.False(t, matchLabels(rule, []labelMatcher{parseLabelMatcher("!__grafana_origin")}))
	// all matchers must hold (AND)
	assert.False(t, matchLabels(rule, []labelMatcher{parseLabelMatcher("team=a"), parseLabelMatcher("missing")}))
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
	assert.False(t, matchDatasources(rule, []string{expr.DatasourceUID}))
}

func TestSortRules(t *testing.T) {
	rules := []*ngmodels.AlertRule{
		{Title: "b", NamespaceUID: "f1", RuleGroup: "g1", RuleGroupIndex: 2},
		{Title: "a", NamespaceUID: "f1", RuleGroup: "g1", RuleGroupIndex: 1},
		{Title: "c", NamespaceUID: "f1", RuleGroup: "g0", RuleGroupIndex: 1},
	}

	sortRules(rules, fieldGroup, false)
	assert.Equal(t, []string{"c", "a", "b"}, titles(rules))

	sortRules(rules, fieldTitle, false)
	assert.Equal(t, []string{"a", "b", "c"}, titles(rules))

	sortRules(rules, fieldTitle, true)
	assert.Equal(t, []string{"c", "b", "a"}, titles(rules))
}

// TestBuildSearchRequestExtractRoundTrip verifies the handler-built request can
// be decoded back into the same filters by the legacy backend.
func TestBuildSearchRequestExtractRoundTrip(t *testing.T) {
	q := url.Values{
		"q":              {"cpu"},
		"folders":        {"f1", "f2"},
		"groups":         {"g1"},
		"paused":         {"true"},
		"datasourceUIDs": {"ds1", "ds2"},
		"labels":         {"team=a", "!__grafana_origin"},
		"sort":           {"-group"},
		"receiver":       {"slack"},
	}
	req, offset, err := buildSearchRequest(q, "default", alertrule.ResourceInfo.GroupResource(), nil)
	require.NoError(t, err)
	assert.Zero(t, offset)

	f := extractFilters(req)
	assert.Equal(t, "cpu", f.text)
	assert.Equal(t, []string{"f1", "f2"}, f.folders)
	assert.Equal(t, []string{"g1"}, f.groups)
	assert.Equal(t, []string{"ds1", "ds2"}, f.datasourceUIDs)
	assert.Equal(t, "slack", f.receiver)
	require.NotNil(t, f.paused)
	assert.True(t, *f.paused)
	assert.Equal(t, fieldGroup, f.sortField)
	assert.True(t, f.sortDesc)
	assert.ElementsMatch(t, []labelMatcher{
		{key: "team", value: "a", op: matchEquals},
		{key: "__grafana_origin", op: matchNotExists},
	}, f.labels)
}

// TestCellsParseRoundTrip verifies a rule encoded into table cells decodes back
// into the expected hit.
func TestCellsParseRoundTrip(t *testing.T) {
	rule := &ngmodels.AlertRule{
		UID:          "uid1",
		Title:        "cpu high",
		NamespaceUID: "folder1",
		RuleGroup:    "group1",
		IsPaused:     true,
		Labels:       map[string]string{"team": "a"},
		Data:         []ngmodels.AlertQuery{{DatasourceUID: "ds1"}, {DatasourceUID: expr.DatasourceUID}},
	}

	resp := &resourcepb.ResourceSearchResponse{
		TotalHits: 1,
		Results: &resourcepb.ResourceTable{
			Columns: resultColumnDefinitions(),
			Rows:    []*resourcepb.ResourceTableRow{{Key: ruleKey("default", rule), Cells: ruleCells(rule)}},
		},
	}
	hits := parseResults(resp)
	require.Len(t, hits, 1)
	h := hits[0]
	assert.Equal(t, "uid1", h.Name)
	assert.EqualValues(t, "alertrule", h.Type)
	assert.Equal(t, "cpu high", h.Title)
	assert.Equal(t, "folder1", h.Folder)
	require.NotNil(t, h.Group)
	assert.Equal(t, "group1", *h.Group)
	require.NotNil(t, h.Paused)
	assert.True(t, *h.Paused)
	assert.Equal(t, map[string]string{"team": "a"}, h.Labels)
	assert.Equal(t, []string{"ds1"}, h.DatasourceUIDs)
}

func titles(rules []*ngmodels.AlertRule) []string {
	out := make([]string, len(rules))
	for i, r := range rules {
		out[i] = r.Title
	}
	return out
}

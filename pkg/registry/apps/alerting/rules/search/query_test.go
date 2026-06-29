package search

import (
	"net/url"
	"strconv"
	"testing"
	"time"

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
		// matchers must survive the round trip through the labels-field requirement.
		got := requirementToLabelMatchers(labelMatcherRequirement(want))
		require.Equal(t, []labelMatcher{want}, got, in)
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
		UID:             "uid1",
		Title:           "cpu high",
		NamespaceUID:    "folder1",
		RuleGroup:       "group1",
		IntervalSeconds: 60,
		For:             5 * time.Minute,
		IsPaused:        true,
		Labels:          map[string]string{"team": "a"},
		Annotations:     map[string]string{"summary": "cpu is high"},
		Data:            []ngmodels.AlertQuery{{DatasourceUID: "ds1"}, {DatasourceUID: expr.DatasourceUID}},
		NotificationSettings: &ngmodels.NotificationSettings{
			ContactPointRouting: &ngmodels.ContactPointRouting{Receiver: "slack"},
		},
	}

	resp := &resourcepb.ResourceSearchResponse{
		TotalHits: 1,
		Results: &resourcepb.ResourceTable{
			Columns: resultColumnDefinitions(),
			Rows:    []*resourcepb.ResourceTableRow{{Key: ruleKey("default", rule), Cells: ruleCells(rule)}},
		},
	}
	hits := NewHandler(nil, nil).parseAlertRuleHits(resp)
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
	require.NotNil(t, h.Interval)
	assert.Equal(t, "1m", *h.Interval)
	require.NotNil(t, h.For)
	assert.Equal(t, "5m", *h.For)
	assert.Equal(t, map[string]string{"summary": "cpu is high"}, h.Annotations)
	require.NotNil(t, h.Receiver)
	assert.Equal(t, "slack", *h.Receiver)
	require.NotNil(t, h.NotificationType)
	assert.Equal(t, "SimplifiedRouting", *h.NotificationType)
}

// TestBuildSearchRequestPagination covers limit/continueToken validation and
// clamping: malformed or out-of-range input must be rejected, and the page size
// must be capped so a single request cannot materialize an entire tenant's rules.
func TestBuildSearchRequestPagination(t *testing.T) {
	gr := alertrule.ResourceInfo.GroupResource()

	t.Run("rejects non-numeric limit", func(t *testing.T) {
		_, _, err := buildSearchRequest(url.Values{"limit": {"abc"}}, "default", gr, nil)
		require.Error(t, err)
	})
	t.Run("rejects non-positive limit", func(t *testing.T) {
		for _, v := range []string{"0", "-5"} {
			_, _, err := buildSearchRequest(url.Values{"limit": {v}}, "default", gr, nil)
			require.Error(t, err, "limit=%s", v)
		}
	})
	t.Run("clamps limit to maxLimit", func(t *testing.T) {
		req, _, err := buildSearchRequest(url.Values{"limit": {strconv.FormatInt(maxLimit+1, 10)}}, "default", gr, nil)
		require.NoError(t, err)
		assert.Equal(t, int64(maxLimit), req.Limit)
	})
	t.Run("defaults limit when unset", func(t *testing.T) {
		req, _, err := buildSearchRequest(url.Values{}, "default", gr, nil)
		require.NoError(t, err)
		assert.Equal(t, int64(defaultLimit), req.Limit)
	})
	t.Run("rejects invalid continueToken", func(t *testing.T) {
		for _, v := range []string{"notanumber", "-1"} {
			_, _, err := buildSearchRequest(url.Values{"continueToken": {v}}, "default", gr, nil)
			require.Error(t, err, "continueToken=%s", v)
		}
	})
	t.Run("accepts valid continueToken as offset", func(t *testing.T) {
		req, offset, err := buildSearchRequest(url.Values{"continueToken": {"40"}}, "default", gr, nil)
		require.NoError(t, err)
		assert.Equal(t, int64(40), offset)
		assert.Equal(t, int64(40), req.Offset)
	})
}

// TestNonEmptyDoesNotMutateInput guards against the aliasing regression where
// nonEmpty compacted into the caller's slice, corrupting the shared url.Values
// backing array.
func TestNonEmptyDoesNotMutateInput(t *testing.T) {
	in := []string{"a", "", "b"}
	out := nonEmpty(in)
	assert.Equal(t, []string{"a", "b"}, out)
	assert.Equal(t, []string{"a", "", "b"}, in)
}

func titles(rules []*ngmodels.AlertRule) []string {
	out := make([]string, len(rules))
	for i, r := range rules {
		out[i] = r.Title
	}
	return out
}

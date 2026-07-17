package search

import (
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
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
		{Title: "b", UID: "u2"},
		{Title: "a", UID: "u1"},
		{Title: "c", UID: "u3"},
	}

	sortRules(rules, fieldTitle, false)
	assert.Equal(t, []string{"a", "b", "c"}, titles(rules))

	sortRules(rules, fieldTitle, true)
	assert.Equal(t, []string{"c", "b", "a"}, titles(rules))
}

// filterLeaf and textLeaf build where nodes for the tests.
func filterLeaf(field string, op model.CreateSearchRulesRequestSearchFilterLeafOperator, values ...string) model.CreateSearchRulesRequestSearchWhereNode {
	return model.CreateSearchRulesRequestSearchWhereNode{
		Filter: &model.CreateSearchRulesRequestSearchFilterLeaf{Field: field, Operator: op, Values: values},
	}
}

func textLeaf(value string) model.CreateSearchRulesRequestSearchWhereNode {
	return model.CreateSearchRulesRequestSearchWhereNode{
		Text: &model.CreateSearchRulesRequestSearchTextLeaf{Value: value},
	}
}

func andNode(children ...model.CreateSearchRulesRequestSearchWhereNode) *model.CreateSearchRulesRequestSearchWhereNode {
	return &model.CreateSearchRulesRequestSearchWhereNode{And: children}
}

const opIn = model.CreateSearchRulesRequestSearchFilterLeafOperatorIn

// TestBuildSearchRequestExtractRoundTrip verifies the request built from a
// SearchQuery body can be decoded back into the same filters by the legacy
// backend.
func TestBuildSearchRequestExtractRoundTrip(t *testing.T) {
	labelSelector := "team=a"
	body := model.CreateSearchRulesRequestBody{
		Where: andNode(
			textLeaf("cpu"),
			filterLeaf(fieldFolder, opIn, "f1", "f2"),
			filterLeaf(fieldPaused, opIn, "true"),
			filterLeaf(fieldDatasourceUIDs, opIn, "ds1", "ds2"),
			filterLeaf(fieldReceiver, opIn, "slack"),
			filterLeaf(fieldLabels, model.CreateSearchRulesRequestSearchFilterLeafOperatorNotIn, "__grafana_origin"),
		),
		LabelSelector: &labelSelector,
		Sort:          []model.CreateSearchRulesRequestSearchSortField{"-title"},
	}
	req, offset, err := buildSearchRequest(body, "default", alertrule.ResourceInfo.GroupResource(), nil)
	require.NoError(t, err)
	assert.Zero(t, offset)

	f := extractFilters(req)
	assert.Equal(t, "cpu", f.text)
	assert.Equal(t, []string{"f1", "f2"}, f.folders)
	assert.Equal(t, []string{"ds1", "ds2"}, f.datasourceUIDs)
	assert.Equal(t, "slack", f.receiver)
	require.NotNil(t, f.paused)
	assert.True(t, *f.paused)
	assert.Equal(t, fieldTitle, f.sortField)
	assert.True(t, f.sortDesc)
	// labelSelector "team=a" and the labels NotIn "!__grafana_origin" both flow
	// into the indexed labels field.
	assert.ElementsMatch(t, []labelMatcher{
		{key: "team", value: "a", op: matchEquals},
		// NotIn of an existence matcher negates to a not-exists matcher.
		{key: "__grafana_origin", op: matchNotExists},
	}, f.labels)
}

func TestBuildSearchRequest_rejectsUnknownFilterField(t *testing.T) {
	body := model.CreateSearchRulesRequestBody{
		Where: &model.CreateSearchRulesRequestSearchWhereNode{
			Filter: &model.CreateSearchRulesRequestSearchFilterLeaf{Field: "bogus", Operator: opIn, Values: []string{"x"}},
		},
	}
	_, _, err := buildSearchRequest(body, "default", alertrule.ResourceInfo.GroupResource(), nil)
	require.Error(t, err)
}

func TestBuildSearchRequest_rejectsNegatedLabelFilterValue(t *testing.T) {
	// The In/NotIn operator carries negation, so a "!"-prefixed labels value is
	// double-negation and must be rejected rather than silently resolved.
	body := model.CreateSearchRulesRequestBody{
		Where: &model.CreateSearchRulesRequestSearchWhereNode{
			Filter: &model.CreateSearchRulesRequestSearchFilterLeaf{Field: fieldLabels, Operator: opIn, Values: []string{"!team"}},
		},
	}
	_, _, err := buildSearchRequest(body, "default", alertrule.ResourceInfo.GroupResource(), nil)
	require.Error(t, err)
}

func TestBuildSearchRequest_rejectsUnsupportedBodyFields(t *testing.T) {
	gr := alertrule.ResourceInfo.GroupResource()
	t.Run("field projection", func(t *testing.T) {
		_, _, err := buildSearchRequest(model.CreateSearchRulesRequestBody{Fields: []string{"title"}}, "default", gr, nil)
		require.Error(t, err)
	})
	t.Run("facets", func(t *testing.T) {
		_, _, err := buildSearchRequest(model.CreateSearchRulesRequestBody{Facets: []string{"type"}}, "default", gr, nil)
		require.Error(t, err)
	})
}

func TestBuildSearchRequest_filterLeafValidation(t *testing.T) {
	gr := alertrule.ResourceInfo.GroupResource()
	build := func(node model.CreateSearchRulesRequestSearchWhereNode) error {
		body := model.CreateSearchRulesRequestBody{Where: &node}
		_, _, err := buildSearchRequest(body, "default", gr, nil)
		return err
	}

	t.Run("scalar field rejects multiple values", func(t *testing.T) {
		require.Error(t, build(filterLeaf(fieldPanelID, opIn, "1", "2")))
	})
	t.Run("scalar field accepts single value", func(t *testing.T) {
		require.NoError(t, build(filterLeaf(fieldPanelID, opIn, "1")))
	})
	t.Run("paused rejects non-boolean", func(t *testing.T) {
		require.Error(t, build(filterLeaf(fieldPaused, opIn, "yes")))
	})
	t.Run("paused accepts boolean", func(t *testing.T) {
		require.NoError(t, build(filterLeaf(fieldPaused, opIn, "true")))
	})
	t.Run("type rejects NotIn", func(t *testing.T) {
		require.Error(t, build(filterLeaf(fieldType, model.CreateSearchRulesRequestSearchFilterLeafOperatorNotIn, "alertrule")))
	})
	t.Run("type rejects multiple values", func(t *testing.T) {
		require.Error(t, build(filterLeaf(fieldType, opIn, "alertrule", "recordingrule")))
	})
	t.Run("type rejects invalid value", func(t *testing.T) {
		require.Error(t, build(filterLeaf(fieldType, opIn, "bogus")))
	})
	t.Run("type accepts valid kind", func(t *testing.T) {
		require.NoError(t, build(filterLeaf(fieldType, opIn, "recordingrule")))
	})

	// Fields declared in searchFields but not applied by the legacy in-memory
	// filter pass must be rejected, not silently dropped on the SQL backend.
	t.Run("rejects filter on legacy-unsupported fields", func(t *testing.T) {
		for _, field := range []string{fieldTitle, fieldInterval, fieldFor, fieldKeepFiringFor, fieldAnnotations} {
			require.Error(t, build(filterLeaf(field, opIn, "x")), "field %q", field)
		}
	})

	// NotIn only round-trips negation on the labels field; on any other field
	// the legacy backend ignores the operator and would invert the result.
	t.Run("rejects NotIn on non-labels fields", func(t *testing.T) {
		notIn := model.CreateSearchRulesRequestSearchFilterLeafOperatorNotIn
		for _, field := range []string{fieldName, fieldFolder, fieldDatasourceUIDs, fieldReceiver, fieldMetric} {
			require.Error(t, build(filterLeaf(field, notIn, "x")), "field %q", field)
		}
	})
	t.Run("accepts NotIn on labels", func(t *testing.T) {
		notIn := model.CreateSearchRulesRequestSearchFilterLeafOperatorNotIn
		require.NoError(t, build(filterLeaf(fieldLabels, notIn, "team=a")))
	})
}

// TestResultColumnsMatchCells guards the positional lockstep between the column
// definitions and the cell encoder: a mismatch would misalign every result
// field. It must fail if a column is added to one without the other.
func TestResultColumnsMatchCells(t *testing.T) {
	rule := &ngmodels.AlertRule{Title: "x", UID: "u", Record: &ngmodels.Record{Metric: "m", TargetDatasourceUID: "d"}}
	require.Equal(t, len(resultColumns), len(ruleCells(rule)),
		"resultColumns and ruleCells must stay in positional lockstep")
}

func TestBuildSearchRequest_rejectsUnsortableField(t *testing.T) {
	body := model.CreateSearchRulesRequestBody{
		Sort: []model.CreateSearchRulesRequestSearchSortField{"folder"},
	}
	_, _, err := buildSearchRequest(body, "default", alertrule.ResourceInfo.GroupResource(), nil)
	require.Error(t, err)
}

func TestBuildSearchRequest_rejectsNestedAnd(t *testing.T) {
	body := model.CreateSearchRulesRequestBody{
		Where: andNode(*andNode(textLeaf("x"))),
	}
	_, _, err := buildSearchRequest(body, "default", alertrule.ResourceInfo.GroupResource(), nil)
	require.Error(t, err)
}

// TestCellsParseRoundTrip verifies a rule encoded into table cells decodes back
// into the expected hit fields.
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
	hits := NewHandler(nil, nil).parseHits(resp)
	require.Len(t, hits, 1)
	h := hits[0]

	assert.Equal(t, "uid1", h.Resource.Name)
	assert.Equal(t, alertrule.ResourceInfo.GroupVersionKind().Kind, h.Resource.Kind)
	assert.Equal(t, alertrule.ResourceInfo.GroupResource().Resource, h.Resource.Resource)

	fields := h.Fields
	require.NotNil(t, fields.Type)
	assert.Equal(t, "alertrule", *fields.Type)
	require.NotNil(t, fields.Title)
	assert.Equal(t, "cpu high", *fields.Title)
	require.NotNil(t, fields.Folder)
	assert.Equal(t, "folder1", *fields.Folder)
	require.NotNil(t, fields.Paused)
	assert.True(t, *fields.Paused)
	assert.Equal(t, map[string]string{"team": "a"}, fields.Labels)
	assert.Equal(t, []string{"ds1"}, fields.DatasourceUIDs)
	require.NotNil(t, fields.Interval)
	assert.Equal(t, "1m", *fields.Interval)
	require.NotNil(t, fields.For)
	assert.Equal(t, "5m", *fields.For)
	assert.Equal(t, map[string]string{"summary": "cpu is high"}, fields.Annotations)
	require.NotNil(t, fields.Receiver)
	assert.Equal(t, "slack", *fields.Receiver)
	require.NotNil(t, fields.NotificationType)
	assert.Equal(t, "SimplifiedRouting", *fields.NotificationType)
}

// TestParseHits_recordingRuleKind verifies a recording-rule row is discriminated
// by its type column into the recording-rule identity and field set.
func TestParseHits_recordingRuleKind(t *testing.T) {
	rule := &ngmodels.AlertRule{
		UID:             "rec1",
		Title:           "cpu recording",
		NamespaceUID:    "folder1",
		IntervalSeconds: 60,
		Record:          &ngmodels.Record{Metric: "cpu_total", TargetDatasourceUID: "ds-target"},
		Data:            []ngmodels.AlertQuery{{DatasourceUID: "ds1"}},
	}
	resp := &resourcepb.ResourceSearchResponse{
		TotalHits: 1,
		Results: &resourcepb.ResourceTable{
			Columns: resultColumnDefinitions(),
			Rows:    []*resourcepb.ResourceTableRow{{Key: ruleKey("default", rule), Cells: ruleCells(rule)}},
		},
	}
	hits := NewHandler(nil, nil).parseHits(resp)
	require.Len(t, hits, 1)
	h := hits[0]

	assert.Equal(t, recordingrule.ResourceInfo.GroupVersionKind().Kind, h.Resource.Kind)
	require.NotNil(t, h.Fields.Type)
	assert.Equal(t, "recordingrule", *h.Fields.Type)
	require.NotNil(t, h.Fields.Metric)
	assert.Equal(t, "cpu_total", *h.Fields.Metric)
	require.NotNil(t, h.Fields.TargetDatasourceUID)
	assert.Equal(t, "ds-target", *h.Fields.TargetDatasourceUID)
	// Alert-only fields stay nil on a recording-rule hit.
	assert.Nil(t, h.Fields.Receiver)
	assert.Nil(t, h.Fields.Annotations)
}

// TestBuildSearchRequestPagination covers limit/continue validation and
// clamping: malformed or out-of-range input must be rejected, and the page size
// must be capped so a single request cannot materialize an entire tenant's rules.
func TestBuildSearchRequestPagination(t *testing.T) {
	gr := alertrule.ResourceInfo.GroupResource()

	limitBody := func(n int64) model.CreateSearchRulesRequestBody {
		return model.CreateSearchRulesRequestBody{Limit: &n}
	}
	continueBody := func(s string) model.CreateSearchRulesRequestBody {
		return model.CreateSearchRulesRequestBody{Continue: &s}
	}

	t.Run("rejects non-positive limit", func(t *testing.T) {
		for _, v := range []int64{0, -5} {
			_, _, err := buildSearchRequest(limitBody(v), "default", gr, nil)
			require.Error(t, err, "limit=%d", v)
		}
	})
	t.Run("clamps limit to maxLimit", func(t *testing.T) {
		req, _, err := buildSearchRequest(limitBody(maxLimit+1), "default", gr, nil)
		require.NoError(t, err)
		assert.Equal(t, int64(maxLimit), req.Limit)
	})
	t.Run("defaults limit when unset", func(t *testing.T) {
		req, _, err := buildSearchRequest(model.CreateSearchRulesRequestBody{}, "default", gr, nil)
		require.NoError(t, err)
		assert.Equal(t, int64(defaultLimit), req.Limit)
	})
	t.Run("rejects invalid continue token", func(t *testing.T) {
		for _, v := range []string{"notanumber", "-1"} {
			_, _, err := buildSearchRequest(continueBody(v), "default", gr, nil)
			require.Error(t, err, "continue=%s", v)
		}
	})
	t.Run("accepts valid continue token as offset", func(t *testing.T) {
		req, offset, err := buildSearchRequest(continueBody(strconv.Itoa(40)), "default", gr, nil)
		require.NoError(t, err)
		assert.Equal(t, int64(40), offset)
		assert.Equal(t, int64(40), req.Offset)
	})
}

func titles(rules []*ngmodels.AlertRule) []string {
	out := make([]string, len(rules))
	for i, r := range rules {
		out[i] = r.Title
	}
	return out
}

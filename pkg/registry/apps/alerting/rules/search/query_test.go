package search

import (
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-app-sdk/app"
	"k8s.io/apimachinery/pkg/runtime/schema"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	rulesmanifest "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/manifestdata"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
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

	// one matcher per group: the group is satisfied by its only matcher
	group := func(vals ...string) [][]labelMatcher {
		out := make([][]labelMatcher, 0, len(vals))
		for _, v := range vals {
			out = append(out, []labelMatcher{parseLabelMatcher(v)})
		}
		return out
	}
	assert.True(t, matchLabels(rule, group("team=a")))
	assert.False(t, matchLabels(rule, group("team=b")))
	assert.True(t, matchLabels(rule, group("team!=b")))
	assert.True(t, matchLabels(rule, group("__grafana_origin")))
	assert.False(t, matchLabels(rule, group("!__grafana_origin")))

	// separate groups conjoin: every group must be satisfied
	assert.False(t, matchLabels(rule, group("team=a", "missing")))
	assert.True(t, matchLabels(rule, group("team=a", "__grafana_origin")))

	// one group disjoins: any matcher in it is enough. This is what a
	// Kubernetes "in (a, b)" selector compiles to.
	oneGroup := [][]labelMatcher{{parseLabelMatcher("team=a"), parseLabelMatcher("team=b")}}
	assert.True(t, matchLabels(rule, oneGroup))
	assert.False(t, matchLabels(rule, [][]labelMatcher{{parseLabelMatcher("team=x"), parseLabelMatcher("team=y")}}))

	// an empty group constrains nothing
	assert.True(t, matchLabels(rule, [][]labelMatcher{{}}))
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
	// labelSelector selects on resource metadata labels, so it targets the
	// controlled group key, not the rules' spec labels.
	labelSelector := model.GroupLabelKey + "=g1"
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
	assert.Equal(t, "cpu", f.title)
	assert.Equal(t, []string{"f1", "f2"}, f.folders)
	assert.Equal(t, []string{"ds1", "ds2"}, f.datasourceUIDs)
	assert.Equal(t, "slack", f.receiver)
	require.NotNil(t, f.paused)
	assert.True(t, *f.paused)
	assert.Equal(t, fieldTitle, f.sortField)
	assert.True(t, f.sortDesc)
	// The labels filter leaf flows into the indexed spec-labels field.
	assert.ElementsMatch(t, [][]labelMatcher{
		// NotIn of an existence matcher negates to a not-exists matcher.
		{{key: "__grafana_origin", op: matchNotExists}},
	}, f.labelGroups)
	// The labelSelector on the group metadata label becomes a group filter.
	assert.Equal(t, []string{"g1"}, f.groupsInclude)
	assert.Empty(t, f.groupsExclude)
}

// TestBuildSearchRequest_labelSelector covers the labelSelector lowering onto
// metadata label requirements: it targets metadata.labels (not the rules' spec
// labels), only controlled keys are selectable, and a Kubernetes "in (a, b)" is
// set membership so its values must stay in one multi-value requirement.
func TestBuildSearchRequest_labelSelector(t *testing.T) {
	gr := alertrule.ResourceInfo.GroupResource()
	build := func(t *testing.T, selector string) *resourcepb.ResourceSearchRequest {
		t.Helper()
		sel := selector
		req, _, err := buildSearchRequest(
			model.CreateSearchRulesRequestBody{LabelSelector: &sel}, "default", gr, nil)
		require.NoError(t, err)
		return req
	}
	buildErr := func(selector string) error {
		sel := selector
		_, _, err := buildSearchRequest(
			model.CreateSearchRulesRequestBody{LabelSelector: &sel}, "default", gr, nil)
		return err
	}

	t.Run("selects on metadata labels, not spec labels", func(t *testing.T) {
		req := build(t, model.GroupLabelKey+"=g1")
		require.Len(t, req.Options.Labels, 1)
		assert.Empty(t, req.Options.Fields, "must not touch the indexed spec-labels field")
		assert.Equal(t, model.GroupLabelKey, req.Options.Labels[0].Key)
		assert.Equal(t, "in", req.Options.Labels[0].Operator)
		assert.Equal(t, []string{"g1"}, req.Options.Labels[0].Values)
	})

	t.Run("multi-value In stays one requirement so values OR", func(t *testing.T) {
		req := build(t, model.GroupLabelKey+" in (g1,g2)")
		require.Len(t, req.Options.Labels, 1, "values must stay in one requirement to OR")
		assert.Equal(t, "in", req.Options.Labels[0].Operator)
		assert.ElementsMatch(t, []string{"g1", "g2"}, req.Options.Labels[0].Values)

		// the legacy side reads both values into the group include filter
		f := extractFilters(req)
		assert.ElementsMatch(t, []string{"g1", "g2"}, f.groupsInclude)
	})

	t.Run("NotIn becomes a group exclusion", func(t *testing.T) {
		req := build(t, model.GroupLabelKey+" notin (g1,g2)")
		require.Len(t, req.Options.Labels, 1)
		assert.Equal(t, "notin", req.Options.Labels[0].Operator)

		f := extractFilters(req)
		assert.ElementsMatch(t, []string{"g1", "g2"}, f.groupsExclude)
		assert.Empty(t, f.groupsInclude)
	})

	t.Run("rejects keys that are not selectable", func(t *testing.T) {
		// A rule spec label is not a metadata label: selecting on it would match
		// nothing rather than filter by rule label, so it must be rejected.
		require.Error(t, buildErr("team=a"))
	})

	t.Run("rejects existence operators", func(t *testing.T) {
		for _, sel := range []string{model.GroupLabelKey, "!" + model.GroupLabelKey} {
			require.Error(t, buildErr(sel), "selector %q", sel)
		}
	})

	t.Run("rejects a malformed selector", func(t *testing.T) {
		require.Error(t, buildErr("=="))
	})
}

// TestBuildSearchRequest_labelsFilterLeaf covers the labels filter leaf, whose
// operator has to mean what it means in a labelSelector: the values in one leaf
// are a set, so In disjoins them. NotIn is that set's complement, and
// NOT(a OR b) is NOT a AND NOT b — so its values conjoin instead, which is why
// they cannot share a requirement.
func TestBuildSearchRequest_labelsFilterLeaf(t *testing.T) {
	const notIn = model.CreateSearchRulesRequestSearchFilterLeafOperatorNotIn
	gr := alertrule.ResourceInfo.GroupResource()
	build := func(op model.CreateSearchRulesRequestSearchFilterLeafOperator, vals ...string) *resourcepb.ResourceSearchRequest {
		req, _, err := buildSearchRequest(model.CreateSearchRulesRequestBody{
			Where: &model.CreateSearchRulesRequestSearchWhereNode{
				Filter: &model.CreateSearchRulesRequestSearchFilterLeaf{Field: fieldLabels, Operator: op, Values: vals},
			},
		}, "default", gr, nil)
		require.NoError(t, err)
		return req
	}

	teamA := &ngmodels.AlertRule{Labels: map[string]string{"team": "a"}}
	teamB := &ngmodels.AlertRule{Labels: map[string]string{"team": "b"}}
	other := &ngmodels.AlertRule{Labels: map[string]string{"other": "x"}}

	t.Run("In disjoins its values", func(t *testing.T) {
		req := build(opIn, "team=a", "team=b")
		require.Len(t, req.Options.Fields, 1, "values must share one requirement to disjoin")
		assert.Equal(t, "in", req.Options.Fields[0].Operator)
		assert.ElementsMatch(t, []string{"team=a", "team=b"}, req.Options.Fields[0].Values)

		groups := extractFilters(req).labelGroups
		assert.True(t, matchLabels(teamA, groups))
		assert.True(t, matchLabels(teamB, groups))
		assert.False(t, matchLabels(other, groups))
	})

	t.Run("an existence value keeps its bare term", func(t *testing.T) {
		req := build(opIn, "team", "other=x")
		require.Len(t, req.Options.Fields, 1)
		// "team=" would mean team equals the empty string, not team exists.
		assert.ElementsMatch(t, []string{"team", "other=x"}, req.Options.Fields[0].Values)

		groups := extractFilters(req).labelGroups
		assert.True(t, matchLabels(teamA, groups), "team exists")
		assert.True(t, matchLabels(other, groups), "other=x matches")
	})

	t.Run("NotIn conjoins, one requirement per value", func(t *testing.T) {
		req := build(notIn, "team=a", "team=b")
		require.Len(t, req.Options.Fields, 2, "negated values must not share a requirement")
		for _, r := range req.Options.Fields {
			assert.Equal(t, "notin", r.Operator, "batching these as one \"in\" inverts the filter")
		}

		groups := extractFilters(req).labelGroups
		assert.False(t, matchLabels(teamA, groups))
		assert.False(t, matchLabels(teamB, groups), "both values must be excluded")
		assert.True(t, matchLabels(other, groups))
	})

	t.Run("NotIn on existence values", func(t *testing.T) {
		req := build(notIn, "team", "other")
		require.Len(t, req.Options.Fields, 2)
		assert.ElementsMatch(t, []string{"team"}, req.Options.Fields[0].Values)
		assert.ElementsMatch(t, []string{"other"}, req.Options.Fields[1].Values)

		groups := extractFilters(req).labelGroups
		assert.False(t, matchLabels(teamA, groups), "team must not exist")
		assert.False(t, matchLabels(other, groups), "other must not exist")
	})

	t.Run("single values are unchanged", func(t *testing.T) {
		for _, tc := range []struct {
			op       model.CreateSearchRulesRequestSearchFilterLeafOperator
			value    string
			operator string
			term     string
		}{
			{opIn, "team=a", "in", "team=a"},
			{opIn, "team", "in", "team"},
			{notIn, "team=a", "notin", "team=a"},
			{notIn, "team", "notin", "team"},
		} {
			req := build(tc.op, tc.value)
			require.Len(t, req.Options.Fields, 1, "%s %q", tc.op, tc.value)
			assert.Equal(t, tc.operator, req.Options.Fields[0].Operator, "%s %q", tc.op, tc.value)
			assert.Equal(t, []string{tc.term}, req.Options.Fields[0].Values, "%s %q", tc.op, tc.value)
		}
	})
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
	// Synthetic expression UIDs are never indexed as query datasources, so they
	// are dropped from the filter rather than rejected — matching what the
	// in-memory pass used to do when it built the rule's datasource set.
	t.Run("datasourceUIDs drops synthetic expression UIDs", func(t *testing.T) {
		gr := alertrule.ResourceInfo.GroupResource()
		reqFor := func(vals ...string) *resourcepb.ResourceSearchRequest {
			body := model.CreateSearchRulesRequestBody{Where: &model.CreateSearchRulesRequestSearchWhereNode{
				Filter: &model.CreateSearchRulesRequestSearchFilterLeaf{Field: fieldDatasourceUIDs, Operator: opIn, Values: vals},
			}}
			req, _, err := buildSearchRequest(body, "default", gr, nil)
			require.NoError(t, err)
			return req
		}

		t.Run("mixed with a real UID keeps only the real one", func(t *testing.T) {
			req := reqFor("ds1", expr.DatasourceUID, expr.OldDatasourceUID, expr.MLDatasourceUID)
			require.Len(t, req.Options.Fields, 1)
			assert.Equal(t, []string{"ds1"}, req.Options.Fields[0].Values)
			assert.Equal(t, []string{"ds1"}, extractFilters(req).datasourceUIDs)
		})

		// An empty requirement reads as "match anything" on both backends, so the
		// leaf has to be dropped instead of sent with no values.
		t.Run("all synthetic drops the requirement", func(t *testing.T) {
			req := reqFor(expr.DatasourceUID)
			assert.Empty(t, req.Options.Fields)
			assert.Empty(t, extractFilters(req).datasourceUIDs)
		})

		t.Run("real UIDs pass through untouched", func(t *testing.T) {
			req := reqFor("ds1", "ds2")
			require.Len(t, req.Options.Fields, 1)
			assert.Equal(t, []string{"ds1", "ds2"}, req.Options.Fields[0].Values)
		})
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

// legacyResponse builds the search response the legacy backend would return for
// a single rule.
func legacyResponse(t *testing.T, rule *ngmodels.AlertRule) *resourcepb.ResourceSearchResponse {
	t.Helper()
	cells, err := ruleCells(rule)
	require.NoError(t, err)
	return &resourcepb.ResourceSearchResponse{
		TotalHits: 1,
		Results: &resourcepb.ResourceTable{
			Columns: resultColumnDefinitions(),
			Rows:    []*resourcepb.ResourceTableRow{{Key: ruleKey("default", rule), Cells: cells}},
		},
	}
}

// TestResultColumnsCoverSearchFields asserts the result table carries exactly
// the fields the kinds declare, plus the two standard fields the document
// builder supplies. A field added to the CUE but not here would be indexed and
// filterable on the unified backend yet missing from every hit, and a name here
// that no kind declares has no column definition to encode against.
func TestResultColumnsCoverSearchFields(t *testing.T) {
	want := map[string]struct{}{fieldTitle: {}, fieldFolder: {}}
	provider := resource.NewManifestBackedProvider([]app.Manifest{rulesmanifest.LocalManifest()})
	for _, gr := range []schema.GroupResource{
		alertrule.ResourceInfo.GroupResource(),
		recordingrule.ResourceInfo.GroupResource(),
	} {
		for _, sfd := range provider.Fields(schema.GroupVersionResource{Group: gr.Group, Resource: gr.Resource}) {
			want[sfd.Name] = struct{}{}
		}
	}

	names := make([]string, 0, len(want))
	for name := range want {
		names = append(names, name)
	}
	assert.ElementsMatch(t, names, resultColumns)
}

// TestSearchFieldsAgreeAcrossKinds guards the fields both rule kinds declare.
// validateCrossVersionConsistency enforces this across versions of one kind,
// but nothing enforces it across the two kinds, and buildSearchColumns resolves
// a conflict by taking the first declaration. A divergence would therefore give
// one kind's rows the other kind's column type: the legacy encoder would reject
// the value at request time, and a unified hit would decode against a type it
// was not encoded with.
func TestSearchFieldsAgreeAcrossKinds(t *testing.T) {
	provider := resource.NewManifestBackedProvider([]app.Manifest{rulesmanifest.LocalManifest()})
	fieldsFor := func(gr schema.GroupResource) map[string]resource.SearchFieldDefinition {
		out := map[string]resource.SearchFieldDefinition{}
		for _, sfd := range provider.Fields(schema.GroupVersionResource{Group: gr.Group, Resource: gr.Resource}) {
			out[sfd.Name] = sfd
		}
		return out
	}

	alert := fieldsFor(alertrule.ResourceInfo.GroupResource())
	recording := fieldsFor(recordingrule.ResourceInfo.GroupResource())

	shared := 0
	for name, a := range alert {
		r, ok := recording[name]
		if !ok {
			continue
		}
		shared++
		assert.Equal(t, a.Type, r.Type, "field %q has a different type on each kind", name)
		assert.Equal(t, a.Array, r.Array, "field %q is an array on only one kind", name)
		assert.ElementsMatch(t, a.Capabilities, r.Capabilities, "field %q has different capabilities on each kind", name)
	}
	// Guard the guard: if the kinds stop sharing fields entirely this test would
	// pass vacuously.
	require.NotZero(t, shared, "expected the rule kinds to share search fields")
}

// TestResultTableBuiltCleanly asserts the result table assembled without
// dropping columns. Construction degrades rather than panicking, so a
// declaration gap would otherwise only show up as a missing field at runtime.
func TestResultTableBuiltCleanly(t *testing.T) {
	require.NoError(t, results.err)
	require.Empty(t, results.skipped)
	require.Len(t, results.defs, len(resultColumns))
	require.Len(t, results.encoders, len(resultColumns))
}

// TestResultColumnsAreTyped pins that the legacy table declares the same column
// types the unified index does. Declaring everything as a string would still
// round-trip through this package's own reader, but a hit from the unified
// backend would then decode against different types.
func TestResultColumnsAreTyped(t *testing.T) {
	byName := map[string]*resourcepb.ResourceTableColumnDefinition{}
	for _, col := range resultColumnDefinitions() {
		byName[col.Name] = col
	}

	require.Equal(t, resourcepb.ResourceTableColumnDefinition_BOOLEAN, byName[fieldPaused].Type)
	require.Equal(t, resourcepb.ResourceTableColumnDefinition_INT64, byName[fieldPanelID].Type)
	require.True(t, byName[fieldLabels].IsArray, "labels is indexed as flattened terms")
	require.True(t, byName[fieldDatasourceUIDs].IsArray)
	require.False(t, byName[fieldAnnotations].IsArray, "annotations is a whole JSON object")
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

// TestBuildSearchRequest_repeatedFilterFields covers a field filtered twice.
// Neither backend can honor it and they disagree: legacy keeps the last leaf,
// unified ANDs both into an unsatisfiable conjunction and returns nothing.
func TestBuildSearchRequest_repeatedFilterFields(t *testing.T) {
	gr := alertrule.ResourceInfo.GroupResource()
	build := func(node *model.CreateSearchRulesRequestSearchWhereNode) error {
		_, _, err := buildSearchRequest(model.CreateSearchRulesRequestBody{Where: node}, "default", gr, nil)
		return err
	}

	t.Run("rejects a repeated field", func(t *testing.T) {
		require.Error(t, build(andNode(
			filterLeaf(fieldFolder, opIn, "folder-a"),
			filterLeaf(fieldFolder, opIn, "folder-b"),
		)))
	})

	// type never becomes a requirement — kindSelection reads it off the body and
	// applyFilter drops the leaf — so a second, differing type leaf would
	// otherwise be silently ignored in favour of the first.
	t.Run("rejects repeated type", func(t *testing.T) {
		require.Error(t, build(andNode(
			filterLeaf(fieldType, opIn, "alertrule"),
			filterLeaf(fieldType, opIn, "recordingrule"),
		)))
	})

	// labels is the exception: repeating it is how a caller ANDs matchers, and
	// extractFilters accumulates those rather than overwriting.
	t.Run("allows repeated labels", func(t *testing.T) {
		require.NoError(t, build(andNode(
			filterLeaf(fieldLabels, opIn, "team=a"),
			filterLeaf(fieldLabels, opIn, "env=prod"),
		)))
	})

	t.Run("still allows one filter per field", func(t *testing.T) {
		require.NoError(t, build(andNode(
			filterLeaf(fieldFolder, opIn, "folder-a", "folder-b"),
			filterLeaf(fieldReceiver, opIn, "slack"),
		)))
	})
}

// TestCellsParseRoundTrip verifies a rule encoded into table cells decodes back
// into the expected hit fields.
func TestCellsParseRoundTrip(t *testing.T) {
	dashboardUID := "dash1"
	// Eight digits is exactly the width of the int64 fast path in
	// resourceTableColumn.Decode, so a panel ID written as a decimal string
	// would decode to an unrelated number instead of failing.
	panelID := int64(12345678)
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
		DashboardUID:    &dashboardUID,
		PanelID:         &panelID,
		NotificationSettings: &ngmodels.NotificationSettings{
			ContactPointRouting: &ngmodels.ContactPointRouting{Receiver: "slack"},
		},
	}

	resp := legacyResponse(t, rule)
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
	require.NotNil(t, fields.DashboardUID)
	assert.Equal(t, "dash1", *fields.DashboardUID)
	require.NotNil(t, fields.PanelID)
	assert.Equal(t, int64(12345678), *fields.PanelID)
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
	resp := legacyResponse(t, rule)
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

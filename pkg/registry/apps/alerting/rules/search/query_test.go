package search

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/app"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	rulesmanifest "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/manifestdata"
	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// translate validates and lowers a query for the alert rule kind, failing the
// test if validation rejects it. Translation assumes a valid query, so a test
// that means to exercise it must not smuggle in an invalid one.
func translate(t *testing.T, q *searchv0.SearchQuery) translated {
	t.Helper()
	return translateFor(t, alertRuleKind(t), q)
}

func translateFor(t *testing.T, k kind, q *searchv0.SearchQuery) translated {
	t.Helper()
	leaves, errs := validateQuery(q, k)
	require.Empty(t, errs, "query must be valid to be translated")
	return translateQuery(q, leaves, "default", k)
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
		// matchers must survive the round trip through the labels-field requirement.
		got := requirementToLabelMatcher(labelMatcherRequirement(want))
		require.Equal(t, want, got, in)
	}
}

func TestMatchLabels(t *testing.T) {
	rule := &ngmodels.AlertRule{Labels: map[string]string{"team": "a", "__grafana_origin": "plugin/x"}}

	matchers := func(vals ...string) []labelMatcher {
		out := make([]labelMatcher, 0, len(vals))
		for _, v := range vals {
			out = append(out, parseLabelMatcher(v))
		}
		return out
	}
	assert.True(t, matchLabels(rule, matchers("team=a")))
	assert.False(t, matchLabels(rule, matchers("team=b")))
	assert.True(t, matchLabels(rule, matchers("team!=b")))
	assert.True(t, matchLabels(rule, matchers("__grafana_origin")))
	assert.False(t, matchLabels(rule, matchers("!__grafana_origin")))

	// matchers conjoin: every one must be satisfied
	assert.False(t, matchLabels(rule, matchers("team=a", "missing")))
	assert.True(t, matchLabels(rule, matchers("team=a", "__grafana_origin")))
	assert.False(t, matchLabels(rule, matchers("team=a", "team=b")))

	// no matchers constrains nothing
	assert.True(t, matchLabels(rule, nil))
}

func TestSortRules(t *testing.T) {
	rules := []*ngmodels.AlertRule{
		{Title: "Banana", UID: "u2"},
		{Title: "apple", UID: "u1"},
		{Title: "banana", UID: "u0"},
	}

	sortRules(rules, fieldTitle, false)
	assert.Equal(t, []string{"apple", "banana", "Banana"}, titles(rules))
	assert.Equal(t, []string{"u1", "u0", "u2"}, []string{rules[0].UID, rules[1].UID, rules[2].UID})

	sortRules(rules, fieldTitle, true)
	assert.Equal(t, []string{"banana", "Banana", "apple"}, titles(rules))
	assert.Equal(t, []string{"u0", "u2", "u1"}, []string{rules[0].UID, rules[1].UID, rules[2].UID})
}

// TestTranslateQuery_targetsTheEndpointsKind asserts each endpoint searches only
// its own kind. Federation is gone: the kind comes from the path, so a search
// never reaches across to the other one.
func TestTranslateQuery_targetsTheEndpointsKind(t *testing.T) {
	for name, k := range map[string]kind{
		"alert rules":     alertRuleKind(t),
		"recording rules": recordingRuleKind(t),
	} {
		t.Run(name, func(t *testing.T) {
			req := translateFor(t, k, query()).req
			assert.Equal(t, k.groupResource().Group, req.Options.Key.Group)
			assert.Equal(t, k.groupResource().Resource, req.Options.Key.Resource)
			assert.Equal(t, "default", req.Options.Key.Namespace)
			assert.Empty(t, req.Federated, "each endpoint searches one kind")
		})
	}
}

// TestTranslateQuery_extractRoundTrip verifies the request built from a
// SearchQuery can be decoded back into the same filters by the legacy backend.
func TestTranslateQuery_extractRoundTrip(t *testing.T) {
	q := query()
	q.Where = andNode(
		textLeaf("cpu"),
		filterLeaf(fieldFolder, filterOperatorIn, "f1", "f2"),
		filterLeaf(fieldPaused, filterOperatorIn, "true"),
		filterLeaf(fieldDatasourceUIDs, filterOperatorIn, "ds1", "ds2"),
		filterLeaf(fieldReceiver, filterOperatorIn, "slack"),
		filterLeaf(fieldLabels, filterOperatorNotIn, "__grafana_origin"),
	)
	// labelSelector selects on resource metadata labels, so it targets the
	// controlled group key, not the rules' spec labels.
	q.LabelSelector = &metav1.LabelSelector{MatchLabels: map[string]string{model.GroupLabelKey: "g1"}}
	q.Sort = []searchv0.SortField{{Field: fieldTitle, Direction: sortDescending}}

	tr := translate(t, q)
	assert.Zero(t, tr.offset)

	f := extractFilters(tr.req)
	assert.Equal(t, "cpu", f.title)
	assert.Equal(t, []string{"f1", "f2"}, f.folders)
	assert.Equal(t, []string{"ds1", "ds2"}, f.datasourceUIDs)
	assert.Equal(t, "slack", f.receiver)
	require.NotNil(t, f.paused)
	assert.True(t, *f.paused)
	assert.Equal(t, fieldTitle, f.sortField)
	assert.True(t, f.sortDesc)
	// The labels filter leaf flows into the indexed spec-labels field.
	assert.ElementsMatch(t, []labelMatcher{
		// NotIn of an existence matcher negates to a not-exists matcher.
		{key: "__grafana_origin", op: matchNotExists},
	}, f.labelMatchers)
	// The labelSelector on the group metadata label becomes a group filter.
	assert.Equal(t, []string{"g1"}, f.groupsInclude)
	assert.Empty(t, f.groupsExclude)
}

// TestTranslateQuery_typeFilter covers the "type" filter now that the endpoint
// already fixes the kind. It stays a real requirement so the two backends agree:
// unified filters on the indexed field, and the legacy backend answers with an
// empty page when the filter contradicts the kind it is searching.
func TestTranslateQuery_typeFilter(t *testing.T) {
	typeQuery := func(value string) *searchv0.SearchQuery {
		q := query()
		q.Where = &searchv0.WhereNode{
			Filter: &searchv0.FilterPredicate{Field: fieldType, Operator: filterOperatorIn, Values: []string{value}},
		}
		return q
	}

	t.Run("becomes a field requirement", func(t *testing.T) {
		req := translate(t, typeQuery(ruleTypeAlerting)).req
		require.Len(t, req.Options.Fields, 1)
		assert.Equal(t, fieldType, req.Options.Fields[0].Key)
		assert.Equal(t, "in", req.Options.Fields[0].Operator)
		assert.Equal(t, []string{ruleTypeAlerting}, req.Options.Fields[0].Values)
		assert.Equal(t, ruleTypeAlerting, extractFilters(req).ruleType)
	})

	t.Run("the legacy backend matches it against the kind it searches", func(t *testing.T) {
		matching := translate(t, typeQuery(ruleTypeAlerting)).req
		assert.Equal(t, ruleTypeAlerting, ruleTypeForResource(matching))
		assert.Equal(t, ngmodels.RuleTypeFilterAlerting, ruleTypeForRequest(matching))

		contradicting := translate(t, typeQuery(ruleTypeRecording)).req
		assert.NotEqual(t, extractFilters(contradicting).ruleType, ruleTypeForResource(contradicting),
			"a contradicted type filter must not be silently ignored")

		recording := translateFor(t, recordingRuleKind(t), typeQuery(ruleTypeRecording)).req
		assert.Equal(t, ruleTypeRecording, ruleTypeForResource(recording))
		assert.Equal(t, ngmodels.RuleTypeFilterRecording, ruleTypeForRequest(recording))
	})
}

// TestTranslateQuery_labelSelector covers the labelSelector lowering onto
// metadata label requirements: it targets metadata.labels (not the rules' spec
// labels), and a Kubernetes "in (a, b)" is set membership so its values must stay
// in one multi-value requirement.
func TestTranslateQuery_labelSelector(t *testing.T) {
	build := func(t *testing.T, sel *metav1.LabelSelector) *resourcepb.ResourceSearchRequest {
		t.Helper()
		q := query()
		q.LabelSelector = sel
		return translate(t, q).req
	}

	t.Run("selects on metadata labels, not spec labels", func(t *testing.T) {
		req := build(t, &metav1.LabelSelector{MatchLabels: map[string]string{model.GroupLabelKey: "g1"}})
		require.Len(t, req.Options.Labels, 1)
		assert.Empty(t, req.Options.Fields, "must not touch the indexed spec-labels field")
		assert.Equal(t, model.GroupLabelKey, req.Options.Labels[0].Key)
		assert.Equal(t, "in", req.Options.Labels[0].Operator)
		assert.Equal(t, []string{"g1"}, req.Options.Labels[0].Values)
	})

	t.Run("multi-value In stays one requirement so values OR", func(t *testing.T) {
		req := build(t, &metav1.LabelSelector{MatchExpressions: []metav1.LabelSelectorRequirement{{
			Key: model.GroupLabelKey, Operator: metav1.LabelSelectorOpIn, Values: []string{"g1", "g2"},
		}}})
		require.Len(t, req.Options.Labels, 1, "values must stay in one requirement to OR")
		assert.Equal(t, "in", req.Options.Labels[0].Operator)
		assert.ElementsMatch(t, []string{"g1", "g2"}, req.Options.Labels[0].Values)

		// the legacy side reads both values into the group include filter
		assert.ElementsMatch(t, []string{"g1", "g2"}, extractFilters(req).groupsInclude)
	})

	t.Run("NotIn becomes a group exclusion", func(t *testing.T) {
		req := build(t, &metav1.LabelSelector{MatchExpressions: []metav1.LabelSelectorRequirement{{
			Key: model.GroupLabelKey, Operator: metav1.LabelSelectorOpNotIn, Values: []string{"g1", "g2"},
		}}})
		require.Len(t, req.Options.Labels, 1)
		assert.Equal(t, "notin", req.Options.Labels[0].Operator)

		f := extractFilters(req)
		assert.ElementsMatch(t, []string{"g1", "g2"}, f.groupsExclude)
		assert.Empty(t, f.groupsInclude)
	})
}

// TestTranslateQuery_labelsFilterLeaf covers the labels filter leaf. A leaf
// carries exactly one matcher (see scalarFilterFields): a requirement holds a
// single operator for all its values, so matchers sharing a leaf could not each
// keep their own polarity. In keeps the positive matcher, NotIn complements it,
// and repeating the leaf conjoins matchers. Negated values are rejected before
// translation so the operator is the only source of polarity.
func TestTranslateQuery_labelsFilterLeaf(t *testing.T) {
	leaf := func(op string, vals ...string) searchv0.WhereNode {
		return filterLeaf(fieldLabels, op, vals...)
	}
	build := func(t *testing.T, nodes ...searchv0.WhereNode) *resourcepb.ResourceSearchRequest {
		t.Helper()
		q := query()
		q.Where = andNode(nodes...)
		return translate(t, q).req
	}

	t.Run("encodes one matcher per leaf", func(t *testing.T) {
		for _, tc := range []struct {
			op       string
			value    string
			operator string
			// The term stays positive whatever the polarity: negation rides on the
			// requirement's operator, so both forms share an indexed term.
			term string
		}{
			{filterOperatorIn, "team=a", "in", "team=a"},
			// "team=" would mean team equals the empty string, not team exists.
			{filterOperatorIn, "team", "in", "team"},
			{filterOperatorNotIn, "team=a", "notin", "team=a"},
			{filterOperatorNotIn, "team", "notin", "team"},
		} {
			req := build(t, leaf(tc.op, tc.value))
			require.Len(t, req.Options.Fields, 1, "%s %q", tc.op, tc.value)
			assert.Equal(t, tc.operator, req.Options.Fields[0].Operator, "%s %q", tc.op, tc.value)
			assert.Equal(t, []string{tc.term}, req.Options.Fields[0].Values, "%s %q", tc.op, tc.value)
		}
	})

	t.Run("repeated leaves conjoin", func(t *testing.T) {
		req := build(t, leaf(filterOperatorIn, "team=a"), leaf(filterOperatorNotIn, "env=prod"))
		require.Len(t, req.Options.Fields, 2, "each leaf gets its own requirement")
		assert.Equal(t, "in", req.Options.Fields[0].Operator)
		assert.Equal(t, "notin", req.Options.Fields[1].Operator)

		// The legacy backend rebuilds the matchers from those requirements, so a
		// rule has to satisfy both.
		matchers := extractFilters(req).labelMatchers
		assert.True(t, matchLabels(&ngmodels.AlertRule{Labels: map[string]string{"team": "a"}}, matchers))
		assert.False(t, matchLabels(&ngmodels.AlertRule{Labels: map[string]string{"team": "a", "env": "prod"}}, matchers))
		assert.False(t, matchLabels(&ngmodels.AlertRule{Labels: map[string]string{"other": "x"}}, matchers))
	})
}

// TestTranslateQuery_sort covers the sort lowering. An absent sort becomes title
// ascending so free-text order does not change with the storage mode.
func TestTranslateQuery_sort(t *testing.T) {
	t.Run("defaults to title ascending", func(t *testing.T) {
		sorts := translate(t, query()).req.SortBy
		require.Len(t, sorts, 1)
		assert.Equal(t, fieldTitle, sorts[0].Field)
		assert.False(t, sorts[0].Desc)
	})

	for _, tc := range []struct {
		direction string
		desc      bool
	}{
		{"", false},
		{sortAscending, false},
		{sortDescending, true},
	} {
		t.Run("direction "+tc.direction, func(t *testing.T) {
			q := query()
			q.Sort = []searchv0.SortField{{Field: fieldTitle, Direction: tc.direction}}
			req := translate(t, q).req
			require.Len(t, req.SortBy, 1)
			assert.Equal(t, fieldTitle, req.SortBy[0].Field)
			assert.Equal(t, tc.desc, req.SortBy[0].Desc)
		})
	}
}

// TestTranslateQuery_returnFields covers the projection. It defaults to what the
// generic search API returns, so the projection does not change when that
// endpoint takes over.
func TestTranslateQuery_returnFields(t *testing.T) {
	t.Run("defaults to title and folder", func(t *testing.T) {
		assert.Equal(t, []string{fieldTitle, fieldFolder}, translate(t, query()).fields)
	})

	t.Run("honours an explicit projection", func(t *testing.T) {
		q := query()
		q.Fields = []string{fieldPaused, fieldLabels}
		assert.Equal(t, []string{fieldPaused, fieldLabels}, translate(t, q).fields)
	})

	// The backend is asked for every column whatever the projection, because
	// bleve does not populate them all for a free-text query. Narrowing happens
	// when the response is built.
	t.Run("still asks the backend for every column", func(t *testing.T) {
		q := query()
		q.Fields = []string{fieldTitle}
		assert.ElementsMatch(t, resultColumns, translate(t, q).req.Fields)
	})
}

// TestTranslateQuery_pagination covers limit clamping and the continue token.
// The bounds match the generic search API so a client's limit is clamped
// identically, and the page size is capped because the legacy backend loads and
// filters the full rule set in memory before paginating.
func TestTranslateQuery_pagination(t *testing.T) {
	limitQuery := func(n int64) *searchv0.SearchQuery {
		q := query()
		q.Limit = n
		return q
	}

	t.Run("defaults an unset limit", func(t *testing.T) {
		assert.Equal(t, int64(defaultLimit), translate(t, limitQuery(0)).req.Limit)
	})
	t.Run("clamps a limit above the maximum", func(t *testing.T) {
		assert.Equal(t, int64(maxLimit), translate(t, limitQuery(maxLimit+1)).req.Limit)
	})
	t.Run("keeps a limit in range", func(t *testing.T) {
		assert.Equal(t, int64(25), translate(t, limitQuery(25)).req.Limit)
	})
	t.Run("resumes from a token it issued", func(t *testing.T) {
		q := query()
		q.Continue = encodeCursor(40)
		tr := translate(t, q)
		assert.Equal(t, int64(40), tr.offset)
		assert.Equal(t, int64(40), tr.req.Offset)
	})
	t.Run("starts from the beginning with no token", func(t *testing.T) {
		tr := translate(t, query())
		assert.Zero(t, tr.offset)
		assert.Zero(t, tr.req.Offset)
	})
}

// TestResultColumnsCoverSearchFields asserts the result table carries exactly
// the fields the kinds declare, plus the two standard fields the document
// builder supplies. A field added to the CUE but not here would be indexed and
// filterable on the unified backend yet impossible to return, and a name here
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

// TestDefaultReturnFieldsAreServable guards the defaults: a projection can only
// return a column the result table carries, so a default that is not one would
// make every unprojected hit come back with no fields at all.
func TestDefaultReturnFieldsAreServable(t *testing.T) {
	for _, name := range defaultReturnFields {
		assert.Contains(t, results.index, name, "default return field %q is not a result column", name)
	}
}

// TestFieldSets asserts each kind's field set is built and per kind, since every
// validation rule is expressed against it.
func TestFieldSets(t *testing.T) {
	alert := fieldSets[alertrule.ResourceInfo.GroupResource()]
	recording := fieldSets[recordingrule.ResourceInfo.GroupResource()]
	require.NotNil(t, alert)
	require.NotNil(t, recording)

	// Standard fields reach both.
	for _, s := range []*fieldSet{alert, recording} {
		assert.True(t, s.known(fieldTitle))
		assert.True(t, s.known(fieldFolder))
		assert.True(t, s.known(fieldName))
	}

	// Declared fields do not leak across kinds.
	assert.True(t, alert.known(fieldReceiver))
	assert.False(t, recording.known(fieldReceiver))
	assert.True(t, recording.known(fieldMetric))
	assert.False(t, alert.known(fieldMetric))

	// Capabilities come from the declarations.
	assert.True(t, alert.has(fieldTitle, resource.SearchCapabilityText))
	assert.True(t, alert.has(fieldPaused, resource.SearchCapabilityFilter))
	assert.False(t, alert.has(fieldAnnotations, resource.SearchCapabilityFilter))
	assert.False(t, alert.has(fieldName, resource.SearchCapabilityRetrieve))
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

func titles(rules []*ngmodels.AlertRule) []string {
	out := make([]string, len(rules))
	for i, r := range rules {
		out[i] = r.Title
	}
	return out
}

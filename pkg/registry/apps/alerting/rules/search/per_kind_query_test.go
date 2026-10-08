package search

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

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
func translate(t *testing.T, q *searchv0.SearchQuery) *Query {
	t.Helper()
	return translateFor(t, alertRuleKind(t), q)
}

func translateFor(t *testing.T, k perKind, q *searchv0.SearchQuery) *Query {
	t.Helper()
	leaves, errs := validatePerKindQuery(q, k)
	require.Empty(t, errs, "query must be valid before translation")
	return buildPerKindSearchRequest(q, leaves, "default", k)
}

func TestPerKindParseLabelMatcher(t *testing.T) {
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

func TestPerKindMatchLabels(t *testing.T) {
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

func TestPerKindSortRules(t *testing.T) {
	rules := []*ngmodels.AlertRule{
		{Title: "Banana", UID: "u2"},
		{Title: "apple", UID: "u1"},
		{Title: "banana", UID: "u0"},
	}

	perKindSortRules(rules, fieldTitle, false)
	assert.Equal(t, []string{"apple", "banana", "Banana"}, perKindTitles(rules))
	assert.Equal(t, []string{"u1", "u0", "u2"}, []string{rules[0].UID, rules[1].UID, rules[2].UID})

	perKindSortRules(rules, fieldTitle, true)
	assert.Equal(t, []string{"banana", "Banana", "apple"}, perKindTitles(rules))
	assert.Equal(t, []string{"u0", "u2", "u1"}, []string{rules[0].UID, rules[1].UID, rules[2].UID})
}

// TestTranslateQuery_targetsTheEndpointsKind asserts each endpoint searches only
// its own kind. Federation is gone: the kind comes from the path, so a search
// never reaches across to the other one.
func TestPerKindTranslateQuery_targetsTheEndpointsKind(t *testing.T) {
	for name, k := range map[string]perKind{
		"alert rules":     alertRuleKind(t),
		"recording rules": recordingRuleKind(t),
	} {
		t.Run(name, func(t *testing.T) {
			req := buildUnifiedRequest(translateFor(t, k, query()))
			assert.Equal(t, k.groupResource().Group, req.Options.Key.Group)
			assert.Equal(t, k.groupResource().Resource, req.Options.Key.Resource)
			assert.Equal(t, "default", req.Options.Key.Namespace)
			assert.Empty(t, req.Federated, "each endpoint searches one kind")
		})
	}
}

// TestTranslateQuery_extractRoundTrip verifies the request built from a
// SearchQuery can be decoded back into the same filters by the legacy backend.
func TestPerKindTranslateQuery_extractRoundTrip(t *testing.T) {
	q := query()
	q.Where = perKindAndNode(
		perKindTextLeaf("cpu"),
		perKindFilterLeaf(fieldFolder, perKindFilterOperatorIn, "f1", "f2"),
		perKindFilterLeaf(fieldPaused, perKindFilterOperatorIn, "true"),
		perKindFilterLeaf(fieldDatasourceUIDs, perKindFilterOperatorIn, "ds1", "ds2"),
		perKindFilterLeaf(fieldReceiver, perKindFilterOperatorIn, "slack"),
		perKindFilterLeaf(fieldLabels, perKindFilterOperatorNotIn, "__grafana_origin"),
	)
	// labelSelector selects on resource metadata labels, so it targets the
	// controlled group key, not the rules' spec labels.
	q.LabelSelector = &metav1.LabelSelector{MatchLabels: map[string]string{model.GroupLabelKey: "g1"}}
	q.Sort = []searchv0.SortField{{Field: fieldTitle, Direction: sortDescending}}

	tr := translate(t, q)
	assert.Zero(t, tr.Offset)

	f := extractFilters(tr)
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

// TestPerKindTranslateQuery_statusFilters covers state and health: In and NotIn
// split into the include and exclude sides the legacy store pushes down to
// alert_rule.k8s_status.
func TestPerKindTranslateQuery_statusFilters(t *testing.T) {
	t.Run("alert rule", func(t *testing.T) {
		q := query()
		q.Where = perKindAndNode(
			perKindFilterLeaf(fieldState, perKindFilterOperatorIn, "firing", "pending"),
			perKindFilterLeaf(fieldHealth, perKindFilterOperatorNotIn, "error", "nodata"),
		)

		f := extractFilters(translate(t, q))
		assert.Equal(t, listFilter{include: []string{"firing", "pending"}}, f.states)
		assert.Equal(t, listFilter{exclude: []string{"error", "nodata"}}, f.healths)
	})

	t.Run("recording rule health", func(t *testing.T) {
		q := query()
		q.Where = &searchv0.WhereNode{Filter: &searchv0.FilterPredicate{Field: fieldHealth, Operator: perKindFilterOperatorIn, Values: []string{"ok"}}}

		f := extractFilters(translateFor(t, recordingRuleKind(t), q))
		assert.Equal(t, listFilter{include: []string{"ok"}}, f.healths)
		assert.Equal(t, listFilter{}, f.states)
	})

	t.Run("recording rule has no state field", func(t *testing.T) {
		q := query()
		q.Where = &searchv0.WhereNode{Filter: &searchv0.FilterPredicate{Field: fieldState, Operator: perKindFilterOperatorIn, Values: []string{"firing"}}}

		_, errs := validatePerKindQuery(q, recordingRuleKind(t))
		require.Len(t, errs, 1)
		assert.Equal(t, "where.filter.field", errs[0].Field)
	})
}

// TestTranslateQuery_typeFilter covers the "type" filter now that the endpoint
// already fixes the kind. It stays a real requirement so the two backends agree:
// unified filters on the indexed field, and the legacy backend answers with an
// empty page when the filter contradicts the kind it is searching.
func TestPerKindTranslateQuery_typeFilter(t *testing.T) {
	typeQuery := func(value string) *searchv0.SearchQuery {
		q := query()
		q.Where = &searchv0.WhereNode{
			Filter: &searchv0.FilterPredicate{Field: fieldType, Operator: perKindFilterOperatorIn, Values: []string{value}},
		}
		return q
	}

	t.Run("becomes a field requirement", func(t *testing.T) {
		req := translate(t, typeQuery(ruleTypeAlerting))
		wire := buildUnifiedRequest(req)
		require.Len(t, wire.Options.Fields, 1)
		assert.Equal(t, fieldType, wire.Options.Fields[0].Key)
		assert.Equal(t, "in", wire.Options.Fields[0].Operator)
		assert.Equal(t, []string{ruleTypeAlerting}, wire.Options.Fields[0].Values)
		assert.Equal(t, ruleTypeAlerting, extractFilters(req).ruleType)
	})

	t.Run("the legacy backend matches it against the kind it searches", func(t *testing.T) {
		matching := translate(t, typeQuery(ruleTypeAlerting))
		assert.Equal(t, ruleTypeAlerting, ruleTypeForResource(matching))
		assert.Equal(t, ngmodels.RuleTypeFilterAlerting, ruleTypeForRequest(matching))

		contradicting := translate(t, typeQuery(ruleTypeRecording))
		assert.NotEqual(t, extractFilters(contradicting).ruleType, ruleTypeForResource(contradicting),
			"a contradicted type filter must not be silently ignored")

		recording := translateFor(t, recordingRuleKind(t), typeQuery(ruleTypeRecording))
		assert.Equal(t, ruleTypeRecording, ruleTypeForResource(recording))
		assert.Equal(t, ngmodels.RuleTypeFilterRecording, ruleTypeForRequest(recording))
	})
}

// TestTranslateQuery_labelSelector covers the labelSelector lowering onto
// metadata label requirements: it targets metadata.labels (not the rules' spec
// labels), and a Kubernetes "in (a, b)" is set membership so its values must stay
// in one multi-value requirement.
func TestPerKindTranslateQuery_labelSelector(t *testing.T) {
	build := func(t *testing.T, sel *metav1.LabelSelector) *Query {
		t.Helper()
		q := query()
		q.LabelSelector = sel
		return translate(t, q)
	}

	t.Run("selects on metadata labels, not spec labels", func(t *testing.T) {
		req := buildUnifiedRequest(build(t, &metav1.LabelSelector{MatchLabels: map[string]string{model.GroupLabelKey: "g1"}}))
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
		wire := buildUnifiedRequest(req)
		require.Len(t, wire.Options.Labels, 1, "values must stay in one requirement to OR")
		assert.Equal(t, "in", wire.Options.Labels[0].Operator)
		assert.ElementsMatch(t, []string{"g1", "g2"}, wire.Options.Labels[0].Values)

		// the legacy side reads both values into the group include filter
		assert.ElementsMatch(t, []string{"g1", "g2"}, extractFilters(req).groupsInclude)
	})

	t.Run("NotIn becomes a group exclusion", func(t *testing.T) {
		req := build(t, &metav1.LabelSelector{MatchExpressions: []metav1.LabelSelectorRequirement{{
			Key: model.GroupLabelKey, Operator: metav1.LabelSelectorOpNotIn, Values: []string{"g1", "g2"},
		}}})
		wire := buildUnifiedRequest(req)
		require.Len(t, wire.Options.Labels, 1)
		assert.Equal(t, "notin", wire.Options.Labels[0].Operator)

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
func TestPerKindTranslateQuery_labelsFilterLeaf(t *testing.T) {
	leaf := func(op string, vals ...string) searchv0.WhereNode {
		return perKindFilterLeaf(fieldLabels, op, vals...)
	}
	build := func(t *testing.T, nodes ...searchv0.WhereNode) *Query {
		t.Helper()
		q := query()
		q.Where = perKindAndNode(nodes...)
		return translate(t, q)
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
			{perKindFilterOperatorIn, "team=a", "in", "team=a"},
			// "team=" would mean team equals the empty string, not team exists.
			{perKindFilterOperatorIn, "team", "in", "team"},
			{perKindFilterOperatorNotIn, "team=a", "notin", "team=a"},
			{perKindFilterOperatorNotIn, "team", "notin", "team"},
		} {
			req := buildUnifiedRequest(build(t, leaf(tc.op, tc.value)))
			require.Len(t, req.Options.Fields, 1, "%s %q", tc.op, tc.value)
			assert.Equal(t, tc.operator, req.Options.Fields[0].Operator, "%s %q", tc.op, tc.value)
			assert.Equal(t, []string{tc.term}, req.Options.Fields[0].Values, "%s %q", tc.op, tc.value)
		}
	})

	t.Run("repeated leaves conjoin", func(t *testing.T) {
		req := build(t, leaf(perKindFilterOperatorIn, "team=a"), leaf(perKindFilterOperatorNotIn, "env=prod"))
		wire := buildUnifiedRequest(req)
		require.Len(t, wire.Options.Fields, 2, "each leaf gets its own requirement")
		assert.Equal(t, "in", wire.Options.Fields[0].Operator)
		assert.Equal(t, "notin", wire.Options.Fields[1].Operator)

		// The legacy backend rebuilds the matchers from those requirements, so a
		// rule has to satisfy both.
		matchers := extractFilters(req).labelMatchers
		assert.True(t, matchLabels(&ngmodels.AlertRule{Labels: map[string]string{"team": "a"}}, matchers))
		assert.False(t, matchLabels(&ngmodels.AlertRule{Labels: map[string]string{"team": "a", "env": "prod"}}, matchers))
		assert.False(t, matchLabels(&ngmodels.AlertRule{Labels: map[string]string{"other": "x"}}, matchers))
	})
}

// TestTranslateQuery_regexLeaf covers the labels regex leaf: unified gets the
// pattern verbatim as a regex/notregex requirement, and the legacy backend
// evaluates it in memory with Prometheus matcher semantics.
func TestPerKindTranslateQuery_regexLeaf(t *testing.T) {
	t.Run("lowers to a regex requirement per leaf", func(t *testing.T) {
		q := query()
		q.Where = perKindAndNode(
			perKindRegexLeaf(fieldLabels, "team=a|b", false),
			perKindRegexLeaf(fieldLabels, "env=prod.*", true),
		)
		req := buildUnifiedRequest(translate(t, q))
		assert.Equal(t, []*resourcepb.Requirement{
			{Key: fieldLabels, Operator: string(resource.OperatorRegex), Values: []string{"team=a|b"}},
			{Key: fieldLabels, Operator: string(resource.OperatorNotRegex), Values: []string{"env=prod.*"}},
		}, req.Options.Fields)
	})

	t.Run("legacy matching", func(t *testing.T) {
		withTeam := func(v string) *ngmodels.AlertRule {
			return &ngmodels.AlertRule{Labels: map[string]string{"team": v}}
		}
		noTeam := &ngmodels.AlertRule{Labels: map[string]string{"env": "prod"}}
		for _, tc := range []struct {
			name    string
			pattern string
			negate  bool
			rule    *ngmodels.AlertRule
			want    bool
		}{
			{"alternation matches", "team=a|b", false, withTeam("b"), true},
			{"alternation misses", "team=a|b", false, withTeam("c"), false},
			{"anchored to the whole value", "team=a", false, withTeam("ab"), false},
			{"outer anchors are redundant", "team=^a$", false, withTeam("a"), true},
			{"case-sensitive by default", "team=A", false, withTeam("a"), false},
			{"leading (?i) folds the value", "team=(?i)A", false, withTeam("a"), true},
			{"dot matches newline", "team=a.*", false, withTeam("a\nb"), true},
			{"missing label matches a pattern matching empty", "team=.*", false, noTeam, true},
			{"missing label matches the empty pattern", "team=", false, noTeam, true},
			{"empty pattern misses a set label", "team=", false, withTeam("a"), false},
			{"missing label misses a pattern requiring a value", "team=.+", false, noTeam, false},
			{"alternation cannot escape the key", "team=a|env=prod", false, noTeam, false},
			{"negated miss matches", "team=a", true, withTeam("b"), true},
			{"negated match misses", "team=a", true, withTeam("a"), false},
			{"negated keeps a missing label", "team=a", true, noTeam, true},
			{"negated match-all drops a missing label", "team=.*", true, noTeam, false},
		} {
			t.Run(tc.name, func(t *testing.T) {
				q := query()
				regex := perKindRegexLeaf(fieldLabels, tc.pattern, tc.negate)
				q.Where = &regex
				matchers, err := compileLabelRegexes(translate(t, q).Regexes)
				require.NoError(t, err)
				assert.Equal(t, tc.want, matchLabelRegexes(tc.rule, matchers))
			})
		}
	})
}

// TestTranslateQuery_sort covers the sort lowering. An absent sort becomes title
// ascending so free-text order does not change with the storage mode.
func TestPerKindTranslateQuery_sort(t *testing.T) {
	t.Run("defaults to title ascending", func(t *testing.T) {
		sorts := buildUnifiedRequest(translate(t, query())).SortBy
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
			req := buildUnifiedRequest(translate(t, q))
			require.Len(t, req.SortBy, 1)
			assert.Equal(t, fieldTitle, req.SortBy[0].Field)
			assert.Equal(t, tc.desc, req.SortBy[0].Desc)
		})
	}
}

// TestTranslateQuery_returnFields covers the projection. It defaults to what the
// generic search API returns, so the projection does not change when that
// endpoint takes over.
func TestPerKindTranslateQuery_returnFields(t *testing.T) {
	t.Run("requests field-value results", func(t *testing.T) {
		request := translate(t, query())
		assert.Equal(t, resourcepb.ResourceSearchRequest_FIELD_VALUES, buildUnifiedRequest(request).ResultFormat)
	})

	t.Run("defaults to title and folder", func(t *testing.T) {
		request := translate(t, query())
		assert.Equal(t, []string{fieldTitle, fieldFolder}, request.Fields)
	})

	t.Run("honours an explicit projection", func(t *testing.T) {
		q := query()
		q.Fields = []string{fieldPaused, fieldLabels}
		request := translate(t, q)
		assert.Equal(t, []string{fieldPaused, fieldLabels}, request.Fields)
	})
}

// TestTranslateQuery_pagination covers limit clamping and the continue token.
// The bounds match the generic search API so a client's limit is clamped
// identically, and the page size is capped because the legacy backend loads and
// filters the full rule set in memory before paginating.
func TestPerKindTranslateQuery_pagination(t *testing.T) {
	limitQuery := func(n int64) *searchv0.SearchQuery {
		q := query()
		q.Limit = n
		return q
	}

	t.Run("defaults an unset limit", func(t *testing.T) {
		assert.Equal(t, int64(perKindDefaultLimit), translate(t, limitQuery(0)).Limit)
	})
	t.Run("clamps a limit above the maximum", func(t *testing.T) {
		assert.Equal(t, int64(perKindMaxLimit), translate(t, limitQuery(perKindMaxLimit+1)).Limit)
	})
	t.Run("keeps a limit in range", func(t *testing.T) {
		assert.Equal(t, int64(25), translate(t, limitQuery(25)).Limit)
	})
	t.Run("resumes from a token it issued", func(t *testing.T) {
		q := query()
		q.Continue = encodeCursor(40)
		tr := translate(t, q)
		assert.Equal(t, int64(40), tr.Offset)
	})
	t.Run("starts from the beginning with no token", func(t *testing.T) {
		tr := translate(t, query())
		assert.Zero(t, tr.Offset)
	})
}

// Keep return-field validation aligned with the declared search fields.
func TestPerKindResultColumnsCoverSearchFields(t *testing.T) {
	want := map[string]struct{}{fieldTitle: {}, fieldFolder: {}}
	provider := resource.NewManifestBackedProvider(rulesmanifest.LocalManifest().ManifestData)
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

// Default projections must use fields supported by return-field validation.
func TestPerKindDefaultReturnFieldsAreServable(t *testing.T) {
	for _, name := range perKindDefaultReturnFields {
		assert.Contains(t, resultColumns, name, "default return field %q is not a result column", name)
	}
}

// TestFieldSets asserts each kind's field set is built and per kind, since every
// validation rule is expressed against it.
func TestPerKindFieldSets(t *testing.T) {
	alert := perKindFieldSets[alertrule.ResourceInfo.GroupResource()]
	recording := perKindFieldSets[recordingrule.ResourceInfo.GroupResource()]
	require.NotNil(t, alert)
	require.NotNil(t, recording)

	// Standard fields reach both.
	for _, s := range []*perKindFieldSet{alert, recording} {
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

// The old-server fixtures share column definitions across kinds, so conflicting
// declarations would make the fixtures misrepresent one kind's response.
func TestPerKindSearchFieldsAgreeAcrossKinds(t *testing.T) {
	provider := resource.NewManifestBackedProvider(rulesmanifest.LocalManifest().ManifestData)
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

// Missing fixture columns would leave old-server decoding compatibility untested.
func TestOldServerResultTableFixtureBuiltCleanly(t *testing.T) {
	require.NoError(t, results.err)
	require.Empty(t, results.skipped)
	require.Len(t, results.defs, len(resultColumns))
	require.Len(t, results.encoders, len(resultColumns))
}

// Old-server fixtures must use the index's column types to exercise real decoding.
func TestOldServerResultColumnFixturesAreTyped(t *testing.T) {
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

func perKindTitles(rules []*ngmodels.AlertRule) []string {
	out := make([]string, len(rules))
	for i, r := range rules {
		out[i] = r.Title
	}
	return out
}

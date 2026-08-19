package search

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
)

// Builders for the search query tree, so each test states only what it is about.

func testKind(t *testing.T, gr func() kind) kind {
	t.Helper()
	k := gr()
	require.NotNil(t, k.fields, "no field set registered for the kind")
	return k
}

func alertRuleKind(t *testing.T) kind {
	return testKind(t, func() kind { return newKind(alertrule.ResourceInfo, nil) })
}

func recordingRuleKind(t *testing.T) kind {
	return testKind(t, func() kind { return newKind(recordingrule.ResourceInfo, nil) })
}

// query returns a valid, minimal SearchQuery: a correct envelope and nothing
// else, so a test can set the one field it exercises.
func query() *searchv0.SearchQuery {
	return &searchv0.SearchQuery{
		TypeMeta: metav1.TypeMeta{APIVersion: searchv0.APIVERSION, Kind: searchv0.KindSearchQuery},
	}
}

func filterLeaf(field, op string, values ...string) searchv0.WhereNode {
	return searchv0.WhereNode{
		Filter: &searchv0.FilterPredicate{Field: field, Operator: op, Values: values},
	}
}

func textLeaf(value string) searchv0.WhereNode {
	return searchv0.WhereNode{Text: &searchv0.TextPredicate{Value: value}}
}

func andNode(children ...searchv0.WhereNode) *searchv0.WhereNode {
	return &searchv0.WhereNode{And: children}
}

// validate runs the validator for the alert rule kind and reports the field
// paths that failed, so assertions name the offending field rather than matching
// on message text.
func validate(t *testing.T, q *searchv0.SearchQuery) []string {
	t.Helper()
	return validateFor(t, alertRuleKind(t), q)
}

func validateFor(t *testing.T, k kind, q *searchv0.SearchQuery) []string {
	t.Helper()
	_, errs := validateQuery(q, k)
	paths := make([]string, 0, len(errs))
	for _, e := range errs {
		paths = append(paths, e.Field)
	}
	return paths
}

func whereQuery(node *searchv0.WhereNode) *searchv0.SearchQuery {
	q := query()
	q.Where = node
	return q
}

// TestValidateQuery_envelope covers the request envelope. The routes live in the
// alerting group but speak the generic search contract, so the apiVersion names
// search.grafana.app and not this group.
func TestValidateQuery_envelope(t *testing.T) {
	t.Run("accepts the generic search envelope", func(t *testing.T) {
		assert.Empty(t, validate(t, query()))
	})

	t.Run("rejects a missing envelope", func(t *testing.T) {
		assert.ElementsMatch(t, []string{"apiVersion", "kind"}, validate(t, &searchv0.SearchQuery{}))
	})

	t.Run("rejects the alerting group's own apiVersion", func(t *testing.T) {
		q := query()
		q.APIVersion = model.GroupVersion.String()
		assert.Equal(t, []string{"apiVersion"}, validate(t, q))
	})

	t.Run("rejects another envelope kind", func(t *testing.T) {
		q := query()
		q.Kind = searchv0.KindTrashQuery
		assert.Equal(t, []string{"kind"}, validate(t, q))
	})
}

// TestValidateQuery_whereShape covers the accepted subset of the where tree: a
// single top-level leaf, or one and over leaves.
func TestValidateQuery_whereShape(t *testing.T) {
	t.Run("accepts no where at all", func(t *testing.T) {
		assert.Empty(t, validate(t, whereQuery(nil)))
	})

	t.Run("accepts a single top-level leaf", func(t *testing.T) {
		assert.Empty(t, validate(t, whereQuery(&searchv0.WhereNode{Text: &searchv0.TextPredicate{Value: "cpu"}})))
	})

	t.Run("accepts one and over leaves", func(t *testing.T) {
		assert.Empty(t, validate(t, whereQuery(andNode(
			textLeaf("cpu"),
			filterLeaf(fieldFolder, filterOperatorIn, "f1"),
		))))
	})

	// An unset node carries no constraint, so accepting one would turn a filtered
	// search into a match-all.
	t.Run("rejects an unset node", func(t *testing.T) {
		assert.Equal(t, []string{"where"}, validate(t, whereQuery(&searchv0.WhereNode{})))
	})

	// An "and":[] in the body decodes to a set-but-empty combinator, which is a
	// different failure from a node with nothing set at all.
	t.Run("rejects an empty and", func(t *testing.T) {
		node := &searchv0.WhereNode{And: []searchv0.WhereNode{}}
		assert.Equal(t, []string{"where.and"}, validate(t, whereQuery(node)))
		assert.Equal(t, []string{"where"}, validate(t, whereQuery(andNode())))
	})

	t.Run("rejects an unset and child", func(t *testing.T) {
		assert.Equal(t, []string{"where.and[0]"}, validate(t, whereQuery(andNode(searchv0.WhereNode{}))))
	})

	t.Run("rejects a node setting more than one key", func(t *testing.T) {
		node := &searchv0.WhereNode{
			Text:   &searchv0.TextPredicate{Value: "cpu"},
			Filter: &searchv0.FilterPredicate{Field: fieldFolder, Operator: filterOperatorIn, Values: []string{"f1"}},
		}
		assert.Equal(t, []string{"where"}, validate(t, whereQuery(node)))
	})

	t.Run("rejects nested and", func(t *testing.T) {
		assert.Equal(t, []string{"where.and[0]"}, validate(t, whereQuery(andNode(*andNode(textLeaf("cpu"))))))
	})

	// A second text leaf would overwrite the backend query rather than add to it.
	t.Run("rejects a second text leaf", func(t *testing.T) {
		assert.Equal(t, []string{"where.and[1].text"},
			validate(t, whereQuery(andNode(textLeaf("cpu"), textLeaf("mem")))))
	})
}

// TestValidateQuery_futureWhereNodes covers the node types the schema models for
// forward compatibility but no version serves. They have to be rejected rather
// than ignored, else a query would come back answered by a subset of what it
// asked for.
func TestValidateQuery_futureWhereNodes(t *testing.T) {
	leaf := filterLeaf(fieldFolder, filterOperatorIn, "f1")
	for name, node := range map[string]*searchv0.WhereNode{
		"or":     {Or: []searchv0.WhereNode{leaf}},
		"not":    {Not: &leaf},
		"range":  {Range: &searchv0.RangePredicate{Field: fieldPanelID}},
		"exists": {Exists: &searchv0.ExistsPredicate{Field: fieldFolder}},
	} {
		t.Run(name, func(t *testing.T) {
			assert.Equal(t, []string{"where"}, validate(t, whereQuery(node)))
		})
	}

	t.Run("boost on a text leaf", func(t *testing.T) {
		boost := 2.0
		node := &searchv0.WhereNode{Text: &searchv0.TextPredicate{Value: "cpu", Boost: &boost}}
		assert.Equal(t, []string{"where.text.boost"}, validate(t, whereQuery(node)))
	})
}

func TestValidateQuery_textLeaf(t *testing.T) {
	t.Run("requires a value", func(t *testing.T) {
		for _, v := range []string{"", "   "} {
			node := &searchv0.WhereNode{Text: &searchv0.TextPredicate{Value: v}}
			assert.Equal(t, []string{"where.text.value"}, validate(t, whereQuery(node)), "value %q", v)
		}
	})

	t.Run("accepts an explicit title field", func(t *testing.T) {
		node := &searchv0.WhereNode{Text: &searchv0.TextPredicate{Value: "cpu", Fields: []string{fieldTitle}}}
		assert.Empty(t, validate(t, whereQuery(node)))
	})

	t.Run("rejects backend wildcard characters", func(t *testing.T) {
		for _, value := range []string{"*", "%"} {
			node := &searchv0.WhereNode{Text: &searchv0.TextPredicate{Value: value}}
			assert.Equal(t, []string{"where.text.value"}, validate(t, whereQuery(node)), "value %q", value)
		}
	})

	t.Run("accepts an underscore as a literal", func(t *testing.T) {
		node := &searchv0.WhereNode{Text: &searchv0.TextPredicate{Value: "cpu_usage"}}
		assert.Empty(t, validate(t, whereQuery(node)))
	})

	// The legacy store's only free-text capability is a word search over the
	// title, so naming another text-capable field would silently search the title.
	t.Run("rejects other text-capable fields", func(t *testing.T) {
		node := &searchv0.WhereNode{Text: &searchv0.TextPredicate{Value: "cpu", Fields: []string{"description"}}}
		assert.Equal(t, []string{"where.text.fields[0]"}, validate(t, whereQuery(node)))
	})

	t.Run("rejects a field that is not text-capable", func(t *testing.T) {
		node := &searchv0.WhereNode{Text: &searchv0.TextPredicate{Value: "cpu", Fields: []string{fieldFolder}}}
		assert.Equal(t, []string{"where.text.fields[0]"}, validate(t, whereQuery(node)))
	})

	// A repeated field would add its scored clause twice, an implicit boost.
	t.Run("rejects a repeated field", func(t *testing.T) {
		node := &searchv0.WhereNode{Text: &searchv0.TextPredicate{Value: "cpu", Fields: []string{fieldTitle, fieldTitle}}}
		assert.Equal(t, []string{"where.text.fields[1]"}, validate(t, whereQuery(node)))
	})
}

func TestValidateQuery_filterLeaf(t *testing.T) {
	leafErrs := func(t *testing.T, node searchv0.WhereNode) []string {
		t.Helper()
		return validate(t, whereQuery(&node))
	}

	t.Run("requires a field", func(t *testing.T) {
		assert.Equal(t, []string{"where.filter.field"}, leafErrs(t, filterLeaf("", filterOperatorIn, "x")))
	})
	t.Run("rejects an unknown field", func(t *testing.T) {
		assert.Equal(t, []string{"where.filter.field"}, leafErrs(t, filterLeaf("bogus", filterOperatorIn, "x")))
	})
	t.Run("requires at least one value", func(t *testing.T) {
		assert.Equal(t, []string{"where.filter.values"}, leafErrs(t, filterLeaf(fieldFolder, filterOperatorIn)))
	})
	t.Run("rejects an unsupported operator", func(t *testing.T) {
		assert.Equal(t, []string{"where.filter.operator"}, leafErrs(t, filterLeaf(fieldFolder, "Equals", "f1")))
	})
	// The backend still reads '*' as a wildcard in field filters, so a literal
	// '*' in a value would be misinterpreted.
	t.Run("rejects wildcard values", func(t *testing.T) {
		assert.Equal(t, []string{"where.filter.values[0]"}, leafErrs(t, filterLeaf(fieldFolder, filterOperatorIn, "f*")))
	})

	// A field a kind declares retrieve-only cannot be filtered.
	t.Run("rejects a field that is not filterable", func(t *testing.T) {
		assert.Equal(t, []string{"where.filter.field"}, leafErrs(t, filterLeaf(fieldAnnotations, filterOperatorIn, "x")))
	})

	// Declared filterable, but the legacy store has no exact-match matcher, so
	// honouring it on unified alone would give two different answers.
	t.Run("rejects fields the legacy backend cannot filter", func(t *testing.T) {
		for _, name := range []string{fieldTitle, fieldInterval, fieldFor, fieldKeepFiringFor} {
			assert.Equal(t, []string{"where.filter.field"},
				leafErrs(t, filterLeaf(name, filterOperatorIn, "x")), "field %q", name)
		}
	})

	t.Run("scalar fields accept exactly one value", func(t *testing.T) {
		assert.Empty(t, leafErrs(t, filterLeaf(fieldPanelID, filterOperatorIn, "1")))
		assert.Equal(t, []string{"where.filter.values"}, leafErrs(t, filterLeaf(fieldPanelID, filterOperatorIn, "1", "2")))
	})

	t.Run("multi-value fields accept a set", func(t *testing.T) {
		assert.Empty(t, leafErrs(t, filterLeaf(fieldFolder, filterOperatorIn, "f1", "f2")))
	})

	// NotIn only round-trips negation on the labels field; on any other field the
	// legacy backend ignores the operator and would invert the result.
	t.Run("rejects NotIn except on labels", func(t *testing.T) {
		for _, name := range []string{fieldName, fieldFolder, fieldDatasourceUIDs, fieldReceiver} {
			assert.Equal(t, []string{"where.filter.operator"},
				leafErrs(t, filterLeaf(name, filterOperatorNotIn, "x")), "field %q", name)
		}
		assert.Empty(t, leafErrs(t, filterLeaf(fieldLabels, filterOperatorNotIn, "team=a")))
	})

	t.Run("paused must be a boolean", func(t *testing.T) {
		assert.Empty(t, leafErrs(t, filterLeaf(fieldPaused, filterOperatorIn, "true")))
		assert.Equal(t, []string{"where.filter.values[0]"}, leafErrs(t, filterLeaf(fieldPaused, filterOperatorIn, "yes")))
	})

	t.Run("normalizes scalar values for both backends", func(t *testing.T) {
		for _, tc := range []struct {
			field string
			value string
			want  string
		}{
			{fieldPaused, "TRUE", "true"},
			{fieldPaused, "1", "true"},
			{fieldPaused, "0", "false"},
			{fieldPanelID, "+10", "10"},
			{fieldPanelID, "010", "10"},
		} {
			node := filterLeaf(tc.field, filterOperatorIn, tc.value)
			assert.Empty(t, leafErrs(t, node), "%s=%s", tc.field, tc.value)
			assert.Equal(t, tc.want, node.Filter.Values[0], "%s=%s", tc.field, tc.value)
		}
	})

	t.Run("panelID must be an integer", func(t *testing.T) {
		assert.Equal(t, []string{"where.filter.values[0]"}, leafErrs(t, filterLeaf(fieldPanelID, filterOperatorIn, "x")))
	})

	t.Run("type must name a rule kind", func(t *testing.T) {
		assert.Empty(t, leafErrs(t, filterLeaf(fieldType, filterOperatorIn, ruleTypeAlerting)))
		assert.Equal(t, []string{"where.filter.values[0]"}, leafErrs(t, filterLeaf(fieldType, filterOperatorIn, "bogus")))
	})

	// The In/NotIn operator already carries negation, so a "!"-prefixed value
	// would double-negate.
	t.Run("rejects a negated labels value", func(t *testing.T) {
		assert.Equal(t, []string{"where.filter.values[0]"}, leafErrs(t, filterLeaf(fieldLabels, filterOperatorIn, "!team")))
		assert.Equal(t, []string{"where.filter.values[0]"}, leafErrs(t, filterLeaf(fieldLabels, filterOperatorIn, "team!=a")))
	})

	// Synthetic expression UIDs are never indexed as query datasources, so a
	// filter on one could never match.
	t.Run("rejects server-side expression datasource UIDs", func(t *testing.T) {
		assert.Empty(t, leafErrs(t, filterLeaf(fieldDatasourceUIDs, filterOperatorIn, "ds_1", "ds-2")))
		assert.Equal(t, []string{"where.filter.values[1]"},
			leafErrs(t, filterLeaf(fieldDatasourceUIDs, filterOperatorIn, "ds1", expr.DatasourceUID)))
	})

	t.Run("rejects invalid datasource UIDs", func(t *testing.T) {
		assert.Equal(t, []string{"where.filter.values[0]"},
			leafErrs(t, filterLeaf(fieldDatasourceUIDs, filterOperatorIn, "%")))
	})
}

// TestValidateQuery_fieldsArePerKind is the point of having one endpoint per
// kind: a field the other kind declares is unknown here, so filtering or
// projecting it is an error rather than a filter that can never match.
func TestValidateQuery_fieldsArePerKind(t *testing.T) {
	alert, recording := alertRuleKind(t), recordingRuleKind(t)

	t.Run("recording-rule fields are unknown to alert rules", func(t *testing.T) {
		for _, name := range []string{fieldMetric, fieldTargetDatasourceUID} {
			q := whereQuery(&searchv0.WhereNode{
				Filter: &searchv0.FilterPredicate{Field: name, Operator: filterOperatorIn, Values: []string{"x"}},
			})
			assert.Equal(t, []string{"where.filter.field"}, validateFor(t, alert, q), "field %q", name)
			assert.Empty(t, validateFor(t, recording, q), "field %q", name)
		}
	})

	t.Run("alert-rule fields are unknown to recording rules", func(t *testing.T) {
		for _, name := range []string{fieldDashboardUID, fieldReceiver, fieldNotificationType, fieldRoutingTree} {
			value := "x"
			if name == fieldNotificationType {
				value = notificationTypeNames()[0]
			}
			q := whereQuery(&searchv0.WhereNode{
				Filter: &searchv0.FilterPredicate{Field: name, Operator: filterOperatorIn, Values: []string{value}},
			})
			assert.Equal(t, []string{"where.filter.field"}, validateFor(t, recording, q), "field %q", name)
			assert.Empty(t, validateFor(t, alert, q), "field %q", name)
		}
	})

	t.Run("projection is per kind too", func(t *testing.T) {
		q := query()
		q.Fields = []string{fieldMetric}
		assert.Equal(t, []string{"fields[0]"}, validateFor(t, alert, q))
		assert.Empty(t, validateFor(t, recording, q))
	})
}

// TestValidateQuery_repeatedFilterFields covers a field filtered twice. The two
// backends disagree on it: legacy keeps one leaf, unified ANDs both into an
// unsatisfiable conjunction and returns nothing.
func TestValidateQuery_repeatedFilterFields(t *testing.T) {
	t.Run("rejects a repeated field", func(t *testing.T) {
		assert.Equal(t, []string{"where.and[1].filter.field"}, validate(t, whereQuery(andNode(
			filterLeaf(fieldFolder, filterOperatorIn, "f1"),
			filterLeaf(fieldFolder, filterOperatorIn, "f2"),
		))))
	})

	// labels is the exception: repeating it is how a caller ANDs matchers, and
	// each leaf keeps its own polarity.
	t.Run("allows repeated labels", func(t *testing.T) {
		assert.Empty(t, validate(t, whereQuery(andNode(
			filterLeaf(fieldLabels, filterOperatorIn, "team=a"),
			filterLeaf(fieldLabels, filterOperatorNotIn, "env=prod"),
		))))
	})

	t.Run("still allows one filter per field", func(t *testing.T) {
		assert.Empty(t, validate(t, whereQuery(andNode(
			filterLeaf(fieldFolder, filterOperatorIn, "f1", "f2"),
			filterLeaf(fieldReceiver, filterOperatorIn, "slack"),
		))))
	})
}

func TestValidateQuery_sort(t *testing.T) {
	sortQuery := func(fields ...searchv0.SortField) *searchv0.SearchQuery {
		q := query()
		q.Sort = fields
		return q
	}

	t.Run("accepts title in either direction", func(t *testing.T) {
		for _, dir := range []string{"", sortAscending, sortDescending} {
			assert.Empty(t, validate(t, sortQuery(searchv0.SortField{Field: fieldTitle, Direction: dir})), "direction %q", dir)
		}
	})

	t.Run("rejects an unknown direction", func(t *testing.T) {
		assert.Equal(t, []string{"sort[0].direction"},
			validate(t, sortQuery(searchv0.SortField{Field: fieldTitle, Direction: "descending"})))
	})

	// folder and name declare the sort capability, but the legacy store orders by
	// title whatever it is asked for, so sorting on them would silently lie.
	t.Run("rejects fields the legacy backend cannot order by", func(t *testing.T) {
		for _, name := range []string{fieldFolder, fieldName} {
			assert.Equal(t, []string{"sort[0].field"},
				validate(t, sortQuery(searchv0.SortField{Field: name})), "field %q", name)
		}
	})

	t.Run("rejects a field that is not sortable", func(t *testing.T) {
		assert.Equal(t, []string{"sort[0].field"}, validate(t, sortQuery(searchv0.SortField{Field: fieldLabels})))
	})

	t.Run("rejects an unknown field", func(t *testing.T) {
		assert.Equal(t, []string{"sort[0].field"}, validate(t, sortQuery(searchv0.SortField{Field: "bogus"})))
	})

	t.Run("rejects a repeated field", func(t *testing.T) {
		assert.Equal(t, []string{"sort[1].field"}, validate(t, sortQuery(
			searchv0.SortField{Field: fieldTitle},
			searchv0.SortField{Field: fieldTitle, Direction: sortDescending},
		)))
	})
}

func TestValidateQuery_returnFields(t *testing.T) {
	fieldsQuery := func(names ...string) *searchv0.SearchQuery {
		q := query()
		q.Fields = names
		return q
	}

	t.Run("accepts retrievable fields", func(t *testing.T) {
		assert.Empty(t, validate(t, fieldsQuery(fieldTitle, fieldFolder, fieldLabels, fieldAnnotations, fieldPaused)))
	})

	t.Run("accepts the defaults", func(t *testing.T) {
		assert.Empty(t, validate(t, fieldsQuery(defaultReturnFields...)))
	})

	t.Run("rejects an unknown field", func(t *testing.T) {
		assert.Equal(t, []string{"fields[0]"}, validate(t, fieldsQuery("bogus")))
	})

	// name is filterable and sortable but never stored, so asking for it would
	// return a hit missing the field it asked for.
	t.Run("rejects a field that is not retrievable", func(t *testing.T) {
		assert.Equal(t, []string{"fields[0]"}, validate(t, fieldsQuery(fieldName)))
	})

	// Declared retrievable by the standard field set, but no rule row carries it.
	t.Run("rejects standard fields the result table does not carry", func(t *testing.T) {
		for _, name := range []string{"description", "tags", "createdBy"} {
			assert.Equal(t, []string{"fields[0]"}, validate(t, fieldsQuery(name)), "field %q", name)
		}
	})
}

// No rule field declares the facet capability, so every facet is rejected. The
// check is written against the capability, so declaring one is all it takes.
func TestValidateQuery_facets(t *testing.T) {
	q := query()
	q.Facets = []string{fieldType}
	assert.Equal(t, []string{"facets[0]"}, validate(t, q))

	q = query()
	q.Facets = []string{"bogus"}
	assert.Equal(t, []string{"facets[0]"}, validate(t, q))
}

func TestValidateQuery_limits(t *testing.T) {
	t.Run("rejects a negative limit", func(t *testing.T) {
		q := query()
		q.Limit = -1
		assert.Equal(t, []string{"limit"}, validate(t, q))
	})

	// Zero means "use the default", matching the generic contract, so it is not
	// an error even though it is not a usable page size.
	t.Run("accepts a zero limit", func(t *testing.T) {
		q := query()
		q.Limit = 0
		assert.Empty(t, validate(t, q))
	})

	t.Run("rejects a negative facetLimit", func(t *testing.T) {
		q := query()
		q.FacetLimit = -1
		assert.Equal(t, []string{"facetLimit"}, validate(t, q))
	})
}

// The token is opaque, so a client-constructed one is rejected rather than
// interpreted: "40" is a plausible offset but not a token this API issued.
func TestValidateQuery_continueToken(t *testing.T) {
	continueQuery := func(token string) *searchv0.SearchQuery {
		q := query()
		q.Continue = token
		return q
	}

	t.Run("rejects a token it did not issue", func(t *testing.T) {
		for _, v := range []string{"notanumber", "-1", "40", encodeCursor(0), encodeCursor(-1)} {
			assert.Equal(t, []string{"continue"}, validate(t, continueQuery(v)), "continue %q", v)
		}
	})

	t.Run("accepts a token it issued", func(t *testing.T) {
		assert.Empty(t, validate(t, continueQuery(encodeCursor(40))))
	})

	t.Run("treats an empty token as the first page", func(t *testing.T) {
		assert.Empty(t, validate(t, continueQuery("")))
	})
}

// TestValidateQuery_labelSelector covers the metadata label selector. It targets
// metadata.labels, not the rules' own alerting labels, and only the controlled
// keys the legacy backend can filter are selectable.
func TestValidateQuery_labelSelector(t *testing.T) {
	selectorQuery := func(sel *metav1.LabelSelector) *searchv0.SearchQuery {
		q := query()
		q.LabelSelector = sel
		return q
	}

	t.Run("accepts the group label", func(t *testing.T) {
		assert.Empty(t, validate(t, selectorQuery(&metav1.LabelSelector{
			MatchLabels: map[string]string{model.GroupLabelKey: "g1"},
		})))
		assert.Empty(t, validate(t, selectorQuery(&metav1.LabelSelector{
			MatchExpressions: []metav1.LabelSelectorRequirement{{
				Key: model.GroupLabelKey, Operator: metav1.LabelSelectorOpNotIn, Values: []string{"g1", "g2"},
			}},
		})))
	})

	// A rule spec label is not a metadata label: selecting on it would match
	// nothing rather than filter by rule label.
	t.Run("rejects keys that are not selectable", func(t *testing.T) {
		assert.Equal(t, []string{"labelSelector.matchLabels[team]"}, validate(t, selectorQuery(&metav1.LabelSelector{
			MatchLabels: map[string]string{"team": "a"},
		})))
		assert.Equal(t, []string{"labelSelector.matchExpressions[0].key"}, validate(t, selectorQuery(&metav1.LabelSelector{
			MatchExpressions: []metav1.LabelSelectorRequirement{{
				Key: "team", Operator: metav1.LabelSelectorOpIn, Values: []string{"a"},
			}},
		})))
	})

	// Existence operators have no requirement representation and the legacy
	// backend cannot express them.
	t.Run("rejects existence operators", func(t *testing.T) {
		for _, op := range []metav1.LabelSelectorOperator{metav1.LabelSelectorOpExists, metav1.LabelSelectorOpDoesNotExist} {
			paths := validate(t, selectorQuery(&metav1.LabelSelector{
				MatchExpressions: []metav1.LabelSelectorRequirement{{Key: model.GroupLabelKey, Operator: op}},
			}))
			assert.Contains(t, paths, "labelSelector.matchExpressions[0].operator", "operator %q", op)
		}
	})

	t.Run("rejects a malformed selector", func(t *testing.T) {
		assert.NotEmpty(t, validate(t, selectorQuery(&metav1.LabelSelector{
			MatchLabels: map[string]string{"": "a"},
		})))
	})

	// An empty In would otherwise reach the backend as a match-all filter.
	t.Run("rejects In with no values", func(t *testing.T) {
		assert.NotEmpty(t, validate(t, selectorQuery(&metav1.LabelSelector{
			MatchExpressions: []metav1.LabelSelectorRequirement{{
				Key: model.GroupLabelKey, Operator: metav1.LabelSelectorOpIn,
			}},
		})))
	})
}

// TestValidateQuery_reportsEveryProblem asserts validation accumulates rather
// than stopping at the first error, so a client fixing one field is not sent
// round again for the next.
func TestValidateQuery_reportsEveryProblem(t *testing.T) {
	q := &searchv0.SearchQuery{
		Sort:   []searchv0.SortField{{Field: "bogus"}},
		Fields: []string{"alsobogus"},
		Limit:  -1,
	}
	assert.ElementsMatch(t,
		[]string{"apiVersion", "kind", "sort[0].field", "fields[0]", "limit"},
		validate(t, q))
}

// TestValidateQuery_returnsLeaves asserts the validator hands back the flattened
// leaves, so the translation does not walk the tree a second time.
func TestValidateQuery_returnsLeaves(t *testing.T) {
	t.Run("a single leaf", func(t *testing.T) {
		leaves, errs := validateQuery(whereQuery(&searchv0.WhereNode{
			Text: &searchv0.TextPredicate{Value: "cpu"},
		}), alertRuleKind(t))
		require.Empty(t, errs)
		require.Len(t, leaves, 1)
		require.NotNil(t, leaves[0].Text)
	})

	t.Run("every child of an and", func(t *testing.T) {
		leaves, errs := validateQuery(whereQuery(andNode(
			textLeaf("cpu"),
			filterLeaf(fieldFolder, filterOperatorIn, "f1"),
			filterLeaf(fieldReceiver, filterOperatorIn, "slack"),
		)), alertRuleKind(t))
		require.Empty(t, errs)
		require.Len(t, leaves, 3)
	})

	t.Run("nothing when there is no where", func(t *testing.T) {
		leaves, errs := validateQuery(query(), alertRuleKind(t))
		require.Empty(t, errs)
		require.Empty(t, leaves)
	})
}

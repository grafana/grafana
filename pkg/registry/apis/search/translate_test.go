package search

import (
	"encoding/base64"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var dashboardsGVR = schema.GroupVersionResource{
	Group:    "dashboard.grafana.app",
	Version:  "v1beta1",
	Resource: "dashboards",
}

// fakeProvider declares a couple of kind-specific fields for tests.
type fakeProvider struct {
	fields []resource.SearchFieldDefinition
}

func (f *fakeProvider) Fields(schema.GroupVersionResource) []resource.SearchFieldDefinition {
	return f.fields
}
func (f *fakeProvider) PreferredVersion(string, string) string   { return "" }
func (f *fakeProvider) IndexAffectingHash(string, string) string { return "" }

func testProvider() resource.SearchFieldsProvider {
	return &fakeProvider{fields: []resource.SearchFieldDefinition{
		{
			Name:         "panel_type",
			Type:         resource.SearchFieldTypeString,
			Array:        true,
			Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityFacet, resource.SearchCapabilityRetrieve},
		},
		{
			Name:         "panel_title",
			Type:         resource.SearchFieldTypeString,
			Capabilities: []resource.SearchCapability{resource.SearchCapabilityText, resource.SearchCapabilityRetrieve},
		},
		{
			// non-string but filterable (shaped like alert-rule "paused").
			Name:         "paused",
			Type:         resource.SearchFieldTypeBoolean,
			Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve},
		},
		{
			// non-string but sortable (shaped like alert-rule "panelID").
			Name:         "panel_id",
			Type:         resource.SearchFieldTypeInt64,
			Capabilities: []resource.SearchCapability{resource.SearchCapabilitySort, resource.SearchCapabilityRetrieve},
		},
		{
			// string array with sort capability: exercises the Array half of the
			// scalar-string sort check.
			Name:         "contributors",
			Type:         resource.SearchFieldTypeString,
			Array:        true,
			Capabilities: []resource.SearchCapability{resource.SearchCapabilitySort, resource.SearchCapabilityRetrieve},
		},
	}}
}

func searchQuery(where *searchv0.WhereNode) *searchv0.SearchQuery {
	return &searchv0.SearchQuery{
		TypeMeta: metav1.TypeMeta{APIVersion: searchv0.APIVERSION, Kind: searchv0.KindSearchQuery},
		Where:    where,
	}
}

func TestTranslateSearchQuery_TextAndFilters(t *testing.T) {
	q := searchQuery(&searchv0.WhereNode{
		And: []searchv0.WhereNode{
			{Text: &searchv0.TextPredicate{Value: "cpu latency", Fields: []string{"title", "panel_title"}}},
			{Filter: &searchv0.FilterPredicate{Field: "folder", Operator: "In", Values: []string{"platform"}}},
			{Filter: &searchv0.FilterPredicate{Field: "panel_type", Operator: "NotIn", Values: []string{"row"}}},
		},
	})
	q.Facets = []string{"panel_type"}
	q.Sort = []searchv0.SortField{{Field: "title", Direction: "asc"}}
	q.Fields = []string{"title", "folder", "panel_type"}
	q.Limit = 42

	req, errs := TranslateSearchQuery(q, dashboardsGVR, "default", testProvider())
	require.Empty(t, errs)
	require.NotNil(t, req)

	assert.Equal(t, "cpu latency", req.Query)
	require.Len(t, req.QueryFields, 2)
	assert.Equal(t, "title", req.QueryFields[0].Name)
	assert.Equal(t, "panel_title", req.QueryFields[1].Name)
	assert.Equal(t, resourcepb.QueryFieldType_TEXT, req.QueryFields[0].Type)
	// neutral boost so hits are scored (backend applies boost unconditionally).
	assert.Equal(t, float32(1), req.QueryFields[0].Boost)
	assert.Equal(t, float32(1), req.QueryFields[1].Boost)

	require.Len(t, req.Options.Fields, 2)
	assert.Equal(t, "folder", req.Options.Fields[0].Key)
	assert.Equal(t, "in", req.Options.Fields[0].Operator)
	assert.Equal(t, "panel_type", req.Options.Fields[1].Key)
	assert.Equal(t, "notin", req.Options.Fields[1].Operator)

	require.Len(t, req.SortBy, 1)
	assert.Equal(t, "title", req.SortBy[0].Field)
	assert.False(t, req.SortBy[0].Desc)

	assert.Equal(t, []string{"title", "folder", "panel_type"}, req.Fields)
	require.Contains(t, req.Facet, "panel_type")
	assert.Equal(t, int64(DefaultFacetLimit), req.Facet["panel_type"].Limit)

	assert.Equal(t, int64(42), req.Limit)
	assert.Equal(t, "default", req.Options.Key.Namespace)
	assert.Equal(t, "dashboards", req.Options.Key.Resource)
}

func TestTranslateSearchQuery_SingleLeaf(t *testing.T) {
	q := searchQuery(&searchv0.WhereNode{Text: &searchv0.TextPredicate{Value: "cpu"}})
	req, errs := TranslateSearchQuery(q, dashboardsGVR, "default", testProvider())
	require.Empty(t, errs)
	assert.Equal(t, "cpu", req.Query)
	// default text field is title
	require.Len(t, req.QueryFields, 1)
	assert.Equal(t, resource.SEARCH_FIELD_TITLE, req.QueryFields[0].Name)
	assert.Equal(t, float32(1), req.QueryFields[0].Boost)
	// text query present -> no explicit sort (relevance order)
	assert.Empty(t, req.SortBy)
}

func TestTranslateSearchQuery_Defaults(t *testing.T) {
	q := searchQuery(nil) // match all
	req, errs := TranslateSearchQuery(q, dashboardsGVR, "default", testProvider())
	require.Empty(t, errs)
	assert.Empty(t, req.Query)
	// no text -> default sort by name asc
	require.Len(t, req.SortBy, 1)
	assert.Equal(t, resource.SEARCH_FIELD_NAME, req.SortBy[0].Field)
	// default return fields
	assert.Equal(t, []string{resource.SEARCH_FIELD_TITLE, resource.SEARCH_FIELD_FOLDER}, req.Fields)
	// default limit
	assert.Equal(t, int64(DefaultLimit), req.Limit)
}

func TestTranslateSearchQuery_LabelSelector(t *testing.T) {
	q := searchQuery(nil)
	q.LabelSelector = &metav1.LabelSelector{
		MatchLabels: map[string]string{"team": "platform"},
		MatchExpressions: []metav1.LabelSelectorRequirement{
			{Key: "env", Operator: metav1.LabelSelectorOpIn, Values: []string{"prod", "staging"}},
		},
	}
	req, errs := TranslateSearchQuery(q, dashboardsGVR, "default", testProvider())
	require.Empty(t, errs)
	require.Len(t, req.Options.Labels, 2)
	assert.Equal(t, "team", req.Options.Labels[0].Key)
	assert.Equal(t, "in", req.Options.Labels[0].Operator)
	assert.Equal(t, "env", req.Options.Labels[1].Key)
}

func TestTranslateSearchQuery_LimitClamp(t *testing.T) {
	q := searchQuery(nil)
	q.Limit = 10000
	req, errs := TranslateSearchQuery(q, dashboardsGVR, "default", testProvider())
	require.Empty(t, errs)
	assert.Equal(t, int64(MaxLimit), req.Limit)
}

func TestTranslateSearchQuery_ValidationErrors(t *testing.T) {
	tests := []struct {
		name      string
		mutate    func(*searchv0.SearchQuery)
		wantField string
	}{
		{
			name:      "wrong kind",
			mutate:    func(q *searchv0.SearchQuery) { q.Kind = "TrashQuery" },
			wantField: "kind",
		},
		{
			name: "multiple text leaves rejected",
			mutate: func(q *searchv0.SearchQuery) {
				q.Where = &searchv0.WhereNode{And: []searchv0.WhereNode{
					{Text: &searchv0.TextPredicate{Value: "a"}},
					{Text: &searchv0.TextPredicate{Value: "b"}},
				}}
			},
			wantField: "where.and[1].text",
		},
		{
			name: "label selector In with empty values",
			mutate: func(q *searchv0.SearchQuery) {
				q.LabelSelector = &metav1.LabelSelector{MatchExpressions: []metav1.LabelSelectorRequirement{{Key: "env", Operator: metav1.LabelSelectorOpIn}}}
			},
			wantField: "labelSelector.matchExpressions[0].values",
		},
		{
			name: "or not supported",
			mutate: func(q *searchv0.SearchQuery) {
				q.Where = &searchv0.WhereNode{Or: []searchv0.WhereNode{{Text: &searchv0.TextPredicate{Value: "x"}}}}
			},
			wantField: "where",
		},
		{
			name: "nested and",
			mutate: func(q *searchv0.SearchQuery) {
				q.Where = &searchv0.WhereNode{And: []searchv0.WhereNode{{And: []searchv0.WhereNode{{Text: &searchv0.TextPredicate{Value: "x"}}}}}}
			},
			wantField: "where.and[0]",
		},
		{
			name:      "empty and",
			mutate:    func(q *searchv0.SearchQuery) { q.Where = &searchv0.WhereNode{And: []searchv0.WhereNode{}} },
			wantField: "where.and",
		},
		{
			name: "two keys in one node",
			mutate: func(q *searchv0.SearchQuery) {
				q.Where = &searchv0.WhereNode{Text: &searchv0.TextPredicate{Value: "x"}, Filter: &searchv0.FilterPredicate{Field: "folder", Operator: "In", Values: []string{"a"}}}
			},
			wantField: "where",
		},
		{
			name:      "empty text value",
			mutate:    func(q *searchv0.SearchQuery) { q.Where = &searchv0.WhereNode{Text: &searchv0.TextPredicate{Value: ""}} },
			wantField: "where.text.value",
		},
		{
			name: "duplicate text fields",
			mutate: func(q *searchv0.SearchQuery) {
				q.Where = &searchv0.WhereNode{Text: &searchv0.TextPredicate{Value: "x", Fields: []string{"title", "title"}}}
			},
			wantField: "where.text.fields[1]",
		},
		{
			name: "text on non-text field",
			mutate: func(q *searchv0.SearchQuery) {
				q.Where = &searchv0.WhereNode{Text: &searchv0.TextPredicate{Value: "x", Fields: []string{"folder"}}}
			},
			wantField: "where.text.fields[0]",
		},
		{
			name: "filter unknown field",
			mutate: func(q *searchv0.SearchQuery) {
				q.Where = &searchv0.WhereNode{Filter: &searchv0.FilterPredicate{Field: "nope", Operator: "In", Values: []string{"a"}}}
			},
			wantField: "where.filter.field",
		},
		{
			name: "filter bad operator",
			mutate: func(q *searchv0.SearchQuery) {
				q.Where = &searchv0.WhereNode{Filter: &searchv0.FilterPredicate{Field: "folder", Operator: "Equals", Values: []string{"a"}}}
			},
			wantField: "where.filter.operator",
		},
		{
			name: "filter wildcard value",
			mutate: func(q *searchv0.SearchQuery) {
				q.Where = &searchv0.WhereNode{Filter: &searchv0.FilterPredicate{Field: "folder", Operator: "In", Values: []string{"a*"}}}
			},
			wantField: "where.filter.values[0]",
		},
		{
			name: "filter on labels",
			mutate: func(q *searchv0.SearchQuery) {
				q.Where = &searchv0.WhereNode{Filter: &searchv0.FilterPredicate{Field: "labels", Operator: "In", Values: []string{"a"}}}
			},
			wantField: "where.filter.field",
		},
		{
			name:      "sort on non-sortable field",
			mutate:    func(q *searchv0.SearchQuery) { q.Sort = []searchv0.SortField{{Field: "panel_type"}} },
			wantField: "sort[0].field",
		},
		{
			name:      "sort on non-string field",
			mutate:    func(q *searchv0.SearchQuery) { q.Sort = []searchv0.SortField{{Field: "panel_id"}} },
			wantField: "sort[0].field",
		},
		{
			name:      "sort on string array field",
			mutate:    func(q *searchv0.SearchQuery) { q.Sort = []searchv0.SortField{{Field: "contributors"}} },
			wantField: "sort[0].field",
		},
		{
			name: "filter on non-string field",
			mutate: func(q *searchv0.SearchQuery) {
				q.Where = &searchv0.WhereNode{Filter: &searchv0.FilterPredicate{Field: "paused", Operator: "In", Values: []string{"true"}}}
			},
			wantField: "where.filter.field",
		},
		{
			name: "whitespace-only text value",
			mutate: func(q *searchv0.SearchQuery) {
				q.Where = &searchv0.WhereNode{Text: &searchv0.TextPredicate{Value: "   "}}
			},
			wantField: "where.text.value",
		},
		{
			name:      "non-empty continue token with empty cursor",
			mutate:    func(q *searchv0.SearchQuery) { q.Continue = base64.RawURLEncoding.EncodeToString([]byte("[]")) },
			wantField: "continue",
		},
		{
			name:      "return non-retrievable field",
			mutate:    func(q *searchv0.SearchQuery) { q.Fields = []string{"managedBy"} },
			wantField: "fields[0]",
		},
		{
			name:      "facet on non-facetable field",
			mutate:    func(q *searchv0.SearchQuery) { q.Facets = []string{"folder"} },
			wantField: "facets[0]",
		},
		{
			name:      "negative limit",
			mutate:    func(q *searchv0.SearchQuery) { q.Limit = -1 },
			wantField: "limit",
		},
		{
			name: "label wildcard value still rejected",
			mutate: func(q *searchv0.SearchQuery) {
				q.LabelSelector = &metav1.LabelSelector{MatchLabels: map[string]string{"team": "a*"}}
			},
			wantField: "labelSelector.matchLabels",
		},
		{
			name: "label selector bad operator",
			mutate: func(q *searchv0.SearchQuery) {
				q.LabelSelector = &metav1.LabelSelector{MatchExpressions: []metav1.LabelSelectorRequirement{{Key: "env", Operator: metav1.LabelSelectorOpExists}}}
			},
			wantField: "labelSelector.matchExpressions[0].operator",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			q := searchQuery(nil)
			tt.mutate(q)
			req, errs := TranslateSearchQuery(q, dashboardsGVR, "default", testProvider())
			assert.Nil(t, req)
			require.NotEmpty(t, errs)
			assert.Equal(t, tt.wantField, errs[0].Field)
		})
	}
}

func trashQuery(where *searchv0.WhereNode) *searchv0.TrashQuery {
	return &searchv0.TrashQuery{
		TypeMeta: metav1.TypeMeta{APIVersion: searchv0.APIVERSION, Kind: searchv0.KindTrashQuery},
		Where:    where,
	}
}

func TestTranslateTrashQuery_Defaults(t *testing.T) {
	q := trashQuery(nil)
	req, errs := TranslateTrashQuery(q, dashboardsGVR, "default")
	require.Empty(t, errs)
	assert.True(t, req.IsDeleted)
	// default sort deletion_time desc
	require.Len(t, req.SortBy, 1)
	assert.Equal(t, trashFieldDeletionTime, req.SortBy[0].Field)
	assert.True(t, req.SortBy[0].Desc)
	// deleted_rv always in return fields
	assert.Contains(t, req.Fields, trashFieldDeletedRV)
	assert.Equal(t, []string{trashFieldTitle, trashFieldFolder, trashFieldDeletedBy, trashFieldDeletionTime, trashFieldDeletedRV}, req.Fields)
}

func TestTranslateTrashQuery_SortByTitleAllowed(t *testing.T) {
	// title is text + sort in the trash field set, so sorting by it is valid.
	q := trashQuery(nil)
	q.Sort = []searchv0.SortField{{Field: trashFieldTitle, Direction: "asc"}}
	req, errs := TranslateTrashQuery(q, dashboardsGVR, "default")
	require.Empty(t, errs)
	require.Len(t, req.SortBy, 1)
	assert.Equal(t, trashFieldTitle, req.SortBy[0].Field)
	assert.False(t, req.SortBy[0].Desc)
}

func TestTranslateTrashQuery_ExplicitFieldsAddDeletedRV(t *testing.T) {
	q := trashQuery(nil)
	q.Fields = []string{"title"}
	req, errs := TranslateTrashQuery(q, dashboardsGVR, "default")
	require.Empty(t, errs)
	assert.Equal(t, []string{"title", trashFieldDeletedRV}, req.Fields)
}

func TestTranslateTrashQuery_TextAndFilter(t *testing.T) {
	q := trashQuery(&searchv0.WhereNode{
		And: []searchv0.WhereNode{
			{Text: &searchv0.TextPredicate{Value: "cpu"}},
			{Filter: &searchv0.FilterPredicate{Field: "deleted_by", Operator: "In", Values: []string{"user:u123"}}},
		},
	})
	req, errs := TranslateTrashQuery(q, dashboardsGVR, "default")
	require.Empty(t, errs)
	assert.Equal(t, "cpu", req.Query)
	require.Len(t, req.Options.Fields, 1)
	assert.Equal(t, "deleted_by", req.Options.Fields[0].Key)
	// A text query keeps relevance order; deletion_time desc is not forced.
	assert.Empty(t, req.SortBy)
}

func TestTranslateTrashQuery_ValidationErrors(t *testing.T) {
	tests := []struct {
		name      string
		mutate    func(*searchv0.TrashQuery)
		wantField string
	}{
		{
			name:      "wrong kind",
			mutate:    func(q *searchv0.TrashQuery) { q.Kind = searchv0.KindSearchQuery },
			wantField: "kind",
		},
		{
			name: "filter on disallowed field",
			mutate: func(q *searchv0.TrashQuery) {
				q.Where = &searchv0.WhereNode{Filter: &searchv0.FilterPredicate{Field: "title", Operator: "In", Values: []string{"a"}}}
			},
			wantField: "where.filter.field",
		},
		{
			name: "text on disallowed field",
			mutate: func(q *searchv0.TrashQuery) {
				q.Where = &searchv0.WhereNode{Text: &searchv0.TextPredicate{Value: "x", Fields: []string{"folder"}}}
			},
			wantField: "where.text.fields[0]",
		},
		{
			name:      "return disallowed field",
			mutate:    func(q *searchv0.TrashQuery) { q.Fields = []string{"panel_type"} },
			wantField: "fields[0]",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			q := trashQuery(nil)
			tt.mutate(q)
			req, errs := TranslateTrashQuery(q, dashboardsGVR, "default")
			assert.Nil(t, req)
			require.NotEmpty(t, errs)
			assert.Equal(t, tt.wantField, errs[0].Field)
		})
	}
}

func TestContinueToken_RoundTrip(t *testing.T) {
	assert.Empty(t, encodeContinue(nil))

	token := encodeContinue([]string{"a", "10", "x"})
	require.NotEmpty(t, token)

	got, err := decodeContinue(token)
	require.NoError(t, err)
	assert.Equal(t, []string{"a", "10", "x"}, got)

	_, err = decodeContinue("!!!not-base64!!!")
	assert.Error(t, err)

	// A non-empty token that decodes to an empty cursor is invalid: encodeContinue
	// never emits one, so it can only be forged or corrupt.
	_, err = decodeContinue(base64.RawURLEncoding.EncodeToString([]byte("[]")))
	assert.Error(t, err)
	_, err = decodeContinue(base64.RawURLEncoding.EncodeToString([]byte("null")))
	assert.Error(t, err)
}

func TestTranslateSearchQuery_ContinueToken(t *testing.T) {
	q := searchQuery(nil)
	q.Continue = encodeContinue([]string{"cursor-value"})
	req, errs := TranslateSearchQuery(q, dashboardsGVR, "default", testProvider())
	require.Empty(t, errs)
	assert.Equal(t, []string{"cursor-value"}, req.SearchAfter)
}

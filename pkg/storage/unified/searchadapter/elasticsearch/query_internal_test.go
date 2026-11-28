package elasticsearch

import (
	"encoding/json"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func elasticsearchQueryFields() []resource.SearchFieldDefinition {
	return []resource.SearchFieldDefinition{
		{Name: "summary", Type: resource.SearchFieldTypeString, Capabilities: []resource.SearchCapability{
			resource.SearchCapabilityText, resource.SearchCapabilityPartial, resource.SearchCapabilityFilter,
			resource.SearchCapabilitySort, resource.SearchCapabilityFacet, resource.SearchCapabilityRetrieve,
		}},
		{Name: "severity", Type: resource.SearchFieldTypeString, Array: true, Capabilities: []resource.SearchCapability{
			resource.SearchCapabilityFilter, resource.SearchCapabilitySort, resource.SearchCapabilityFacet, resource.SearchCapabilityRetrieve,
		}},
		{Name: "views", Type: resource.SearchFieldTypeInt64, Capabilities: []resource.SearchCapability{
			resource.SearchCapabilityFilter, resource.SearchCapabilitySort, resource.SearchCapabilityRetrieve,
		}},
		{Name: "ratio", Type: resource.SearchFieldTypeDouble, Capabilities: []resource.SearchCapability{
			resource.SearchCapabilityFilter, resource.SearchCapabilitySort, resource.SearchCapabilityRetrieve,
		}},
		{Name: "paused", Type: resource.SearchFieldTypeBoolean, Capabilities: []resource.SearchCapability{
			resource.SearchCapabilityFilter, resource.SearchCapabilitySort, resource.SearchCapabilityRetrieve,
		}},
		{Name: "stored", Type: resource.SearchFieldTypeInt64, Capabilities: []resource.SearchCapability{resource.SearchCapabilityRetrieve}},
	}
}

func elasticsearchQueryBuilderForTest(t *testing.T) *elasticsearchQueryBuilder {
	t.Helper()
	key := resource.NamespacedResource{Namespace: "default", Group: "dashboard.grafana.app", Resource: "dashboards"}
	provider := resource.NewMapProvider(map[schema.GroupVersionResource][]resource.SearchFieldDefinition{
		{Group: key.Group, Version: "v1", Resource: key.Resource}: elasticsearchQueryFields(),
	}, nil)
	builder, err := newElasticsearchQueryBuilder(provider, key, []string{"spec.paused"})
	require.NoError(t, err)
	return builder
}

func requireElasticsearchJSON(t *testing.T, expected string, actual any) {
	t.Helper()
	data, err := json.Marshal(actual)
	require.NoError(t, err)
	require.JSONEq(t, expected, string(data))
}

func TestElasticsearchRequirement(t *testing.T) {
	builder := elasticsearchQueryBuilderForTest(t)
	for _, tc := range []struct {
		name, field, operator string
		values                []string
		expected              string
	}{
		{"keyword equals AND", "fields.severity", "=", []string{"warn", "critical"}, `{"bool":{"must":[{"term":{"fields.severity":"warn"}},{"term":{"fields.severity":"critical"}}]}}`},
		{"keyword in OR", "fields.severity", "in", []string{"warn", "critical"}, `{"bool":{"should":[{"term":{"fields.severity":"warn"}},{"term":{"fields.severity":"critical"}}],"minimum_should_match":1}}`},
		{"keyword stars are literal", "fields.severity", "=", []string{"crit*"}, `{"term":{"fields.severity":"crit*"}}`},
		{"keyword notin allows wildcard", "fields.severity", "notin", []string{"crit*"}, `{"bool":{"must_not":[{"wildcard":{"fields.severity":{"value":"crit*"}}}]}}`},
		{"title in exact lowered", "title", "in", []string{"Hello WORLD"}, `{"term":{"title_phrase":"hello world"}}`},
		{"text exact lowered", "fields.summary", "==", []string{"Hello WORLD "}, `{"term":{"fields.summary_keyword":"hello world"}}`},
		{"labels exact case sensitive", "labels.team", "=", []string{"Team A"}, `{"match":{"labels.team":"Team A"}}`},
		{"selectable exact", "selectableFields.spec.paused", "=", []string{"false"}, `{"term":{"selectableFields.spec.paused":"false"}}`},
		{"boolean false", "fields.paused", "=", []string{"false"}, `{"term":{"fields.paused":false}}`},
		{"integer zero", "fields.views", "=", []string{"0"}, `{"term":{"fields.views":0}}`},
		{"large integer not rounded", "fields.views", "==", []string{"1800000000000000001"}, `{"term":{"fields.views":1800000000000000001}}`},
		{"inclusive integer range", "fields.views", string(resource.OperatorGreaterThanOrEqual), []string{"10"}, `{"range":{"fields.views":{"gte":10}}}`},
		{"exclusive double range", "fields.ratio", string(selection.LessThan), []string{"1.25"}, `{"range":{"fields.ratio":{"lt":1.25}}}`},
		{"numeric notin", "fields.views", "notin", []string{"10"}, `{"bool":{"must_not":[{"term":{"fields.views":10}}]}}`},
		{"empty string set remains unfiltered", "fields.severity", "in", nil, `{"match_all":{}}`},
		{"empty string exclusion remains unfiltered", "fields.severity", "notin", nil, `{"match_all":{}}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			q, err := builder.requirement(&resourcepb.Requirement{Key: tc.field, Operator: tc.operator, Values: tc.values})
			require.Nil(t, err)
			requireElasticsearchJSON(t, tc.expected, q)
			if tc.name == "large integer not rounded" {
				require.Equal(t, int64(1800000000000000001), q["term"].(elasticsearchObject)["fields.views"])
			}
		})
	}
}

func TestElasticsearchRequirementErrors(t *testing.T) {
	builder := elasticsearchQueryBuilderForTest(t)
	for _, tc := range []struct {
		field, operator string
		values          []string
	}{
		{"fields.paused", "=", []string{"False"}},
		{"fields.paused", string(selection.GreaterThan), []string{"true"}},
		{"fields.views", "=", []string{"1.5"}},
		{"fields.views", "=", []string{"9223372036854775808"}},
		{"fields.ratio", "=", []string{"NaN"}},
		{"fields.ratio", "=", []string{"Inf"}},
		{"fields.views", "in", nil},
		{"fields.views", string(selection.GreaterThan), []string{"1", "2"}},
		{"fields.stored", "=", []string{"1"}},
		{"title", "==", []string{"a", "b"}},
		{"title", "!=", []string{"a"}},
		{"title", "exists", nil},
		{"fields.severity", string(resource.OperatorRegex), []string{"crit.*"}},
		{"fields.severity", string(resource.OperatorNotRegex), []string{"crit.*"}},
	} {
		t.Run(tc.field+tc.operator, func(t *testing.T) {
			q, err := builder.requirement(&resourcepb.Requirement{Key: tc.field, Operator: tc.operator, Values: tc.values})
			require.Nil(t, q)
			require.NotNil(t, err)
			require.Equal(t, int32(400), err.Code)
		})
	}
}

func TestElasticsearchPrepare(t *testing.T) {
	builder := elasticsearchQueryBuilderForTest(t)
	t.Run("resolves fields without mutating the request", func(t *testing.T) {
		req := &resourcepb.ResourceSearchRequest{Query: "QA W", Fields: []string{"summary"},
			Options: &resourcepb.ListOptions{
				Labels: []*resourcepb.Requirement{{Key: "team", Operator: "=", Values: []string{"Team A"}}},
				Fields: []*resourcepb.Requirement{{Key: "folder", Operator: "=", Values: []string{"general"}}},
			},
			SortBy: []*resourcepb.ResourceSearchRequest_Sort{{Field: "summary", Desc: true}},
		}
		original := proto.Clone(req)
		prepared, err := builder.prepare(req, 0)
		require.Nil(t, err)
		require.True(t, proto.Equal(original, req))
		require.Contains(t, prepared.fields, "fields.summary")
		require.Equal(t, []Sort{{Field: "fields.summary_keyword", Desc: true}, {Field: "name"}, {Field: elasticsearchDocumentIDField}}, prepared.order)
		requireElasticsearchJSON(t, `{"bool":{"must":{"bool":{"should":[{"wildcard":{"title":{"value":"qa w*"}}},{"wildcard":{"title_phrase":{"value":"qa w*"}}}],"minimum_should_match":1}},"filter":[{"match":{"labels.team":"Team A"}},{"bool":{"should":[{"term":{"folder":""}},{"term":{"folder":"general"}}],"minimum_should_match":1}}],"must_not":{"term":{"_deleted":true}}}}`, prepared.query)
	})
	t.Run("array order uses the first source value", func(t *testing.T) {
		prepared, err := builder.prepare(&resourcepb.ResourceSearchRequest{SortBy: []*resourcepb.ResourceSearchRequest_Sort{{Field: "severity", Desc: true}}}, 0)
		require.Nil(t, err)
		require.Equal(t, Sort{Field: "_sort.fields.severity", Desc: true}, prepared.order[0])
	})
	t.Run("default title order", func(t *testing.T) {
		prepared, err := builder.prepare(&resourcepb.ResourceSearchRequest{}, 0)
		require.Nil(t, err)
		require.Equal(t, []Sort{{Field: "title_phrase"}, {Field: "name"}, {Field: elasticsearchDocumentIDField}}, prepared.order)
	})
	t.Run("default relevance order", func(t *testing.T) {
		prepared, err := builder.prepare(&resourcepb.ResourceSearchRequest{Query: "grafana"}, 0)
		require.Nil(t, err)
		require.Equal(t, []Sort{{Field: "_score", Desc: true}, {Field: "name"}, {Field: elasticsearchDocumentIDField}}, prepared.order)
		require.Contains(t, prepared.fields, "_score")
	})
	t.Run("trash includes only restorable unexpired documents", func(t *testing.T) {
		prepared, err := builder.prepare(&resourcepb.ResourceSearchRequest{IsDeleted: true}, 123)
		require.Nil(t, err)
		requireElasticsearchJSON(t, `{"bool":{"filter":[{"term":{"_deleted":true}}],"must_not":[{"term":{"_provisioned":true}},{"range":{"deletion_time":{"lt":123}}}]}}`, prepared.query)
	})
	t.Run("trash resource-version lower bound", func(t *testing.T) {
		req := &resourcepb.ResourceSearchRequest{IsDeleted: true,
			SortBy: []*resourcepb.ResourceSearchRequest_Sort{{Field: resource.SEARCH_FIELD_DELETED_RV}}, SearchAfter: []string{"1800000000000000001", ""}}
		prepared, err := builder.prepare(req, 0)
		require.Nil(t, err)
		require.Equal(t, []string{`"1800000000000000001"`, `""`, `""`}, prepared.cursor)
		require.Equal(t, []string{"1800000000000000001", ""}, req.SearchAfter)
	})
	for name, req := range map[string]*resourcepb.ResourceSearchRequest{
		"internal field":      {Fields: []string{"_rv"}},
		"internal filter":     {Options: &resourcepb.ListOptions{Fields: []*resourcepb.Requirement{{Key: "_deleted", Operator: "=", Values: []string{"true"}}}}},
		"live trash field":    {Fields: []string{"deleted_by"}},
		"unknown sort":        {SortBy: []*resourcepb.ResourceSearchRequest_Sort{{Field: "unknown"}}},
		"retrieve-only sort":  {SortBy: []*resourcepb.ResourceSearchRequest_Sort{{Field: "stored"}}},
		"unknown facet":       {Facet: map[string]*resourcepb.ResourceSearchRequest_Facet{"x": {Field: "title"}}},
		"negative facet":      {Facet: map[string]*resourcepb.ResourceSearchRequest_Facet{"x": {Field: "tags", Limit: -1}}},
		"unmapped selectable": {Options: &resourcepb.ListOptions{Fields: []*resourcepb.Requirement{{Key: "selectableFields.spec.missing", Operator: "=", Values: []string{"x"}}}}},
		"folder tree":         {Options: &resourcepb.ListOptions{Fields: []*resourcepb.Requirement{{Key: resource.SEARCH_FIELD_FOLDER_TREE, Operator: "in", Values: []string{"team"}}}}},
		"wrong cursor size":   {SearchAfter: []string{`"x"`}},
		"invalid JSON cursor": {SearchAfter: []string{"x", `"name"`, `"id"`}},
		"object cursor":       {SearchAfter: []string{"{}", `"name"`, `"id"`}},
		"array cursor":        {SearchAfter: []string{"[]", `"name"`, `"id"`}},
		"boolean cursor":      {SearchAfter: []string{"true", `"name"`, `"id"`}},
		"both cursors":        {SearchBefore: []string{`"x"`}, SearchAfter: []string{`"x"`}},
	} {
		t.Run(name, func(t *testing.T) {
			_, err := builder.prepare(req, 0)
			require.NotNil(t, err)
		})
	}
}

func TestElasticsearchSort(t *testing.T) {
	for _, desc := range []bool{false, true} {
		for _, reverse := range []bool{false, true} {
			t.Run("desc="+strconv.FormatBool(desc)+"/reverse="+strconv.FormatBool(reverse), func(t *testing.T) {
				sort := Sort{Field: "fields.severity", Desc: desc}
				options := sort.Request(reverse)[sort.Field].(elasticsearchObject)
				direction, missing := "asc", "_last"
				if desc != reverse {
					direction = "desc"
				}
				if reverse {
					missing = "_first"
				}
				require.Equal(t, elasticsearchObject{"order": direction, "missing": missing}, options)
			})
		}
	}
}

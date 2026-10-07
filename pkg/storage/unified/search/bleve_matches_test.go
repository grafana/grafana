package search

import (
	"slices"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestSearchTextMatches(t *testing.T) {
	key := &resourcepb.ResourceKey{Namespace: "default", Group: "example.test", Resource: "widgets"}
	provider := resource.NewMapProvider(map[schema.GroupVersionResource][]resource.SearchFieldDefinition{
		{Group: key.Group, Resource: key.Resource, Version: "v1"}: {
			{Name: "messages", Type: resource.SearchFieldTypeString, Array: true, Capabilities: []resource.SearchCapability{resource.SearchCapabilityText, resource.SearchCapabilityRetrieve}},
			{Name: "description", Type: resource.SearchFieldTypeString, Capabilities: []resource.SearchCapability{resource.SearchCapabilityText, resource.SearchCapabilityRetrieve}},
		},
	}, nil)
	registry := resource.NewSearchFieldsRegistry(nil, nil, map[resource.LowerGroupResource]resource.SearchFieldsProvider{
		resource.NewLowerGroupResource(key.Group, key.Resource): provider,
	})
	backend, _ := setupBleveBackend(t, withSearchFields(registry))
	documentIndex, err := backend.BuildIndex(t.Context(), resource.NamespacedResource{
		Namespace: key.Namespace, Group: key.Group, Resource: key.Resource,
	}, 1, "test", func(resource.ResourceIndex) (int64, error) { return 0, nil }, nil, false, time.Time{}, 0)
	require.NoError(t, err)
	index := documentIndex.(*bleveIndex)
	messages := []string{"", "Dog bones", "A big dog", "Another big dog dog", "CPU usage"}
	require.NoError(t, index.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{{
		Action: resource.ActionIndex,
		Doc: &resource.IndexableDocument{
			Key:  &resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: "one"},
			Name: "one", Title: "The bigger dog", Description: "The quiet cat",
			Fields: map[string]any{"messages": messages, "description": "Circuit breaker"},
		},
	}}}))
	for _, tc := range []struct {
		name        string
		query       string
		queryFields []string
		titleFilter bool
		noMatches   bool
		oldIndex    bool
		federated   bool
		want        map[string][]uint64
	}{
		{name: "fields and array elements", query: "the big dog", queryFields: []string{"title", "description", "messages"}, want: map[string][]uint64{"title": nil, "messages": {1, 2, 3}}},
		{name: "filter does not count", query: "big dog", queryFields: []string{"messages"}, titleFilter: true, want: map[string][]uint64{"messages": {1, 2, 3}}},
		{name: "filters only", titleFilter: true},
		{name: "match all with filter", query: "*", titleFilter: true},
		{name: "title variants", query: "The bigger dog", queryFields: []string{"title"}, want: map[string][]uint64{"title": nil}},
		{name: "title partial variant", query: "bigg", queryFields: []string{"title"}, want: map[string][]uint64{"title": nil}},
		{name: "description", query: "quiet", queryFields: []string{"description"}, want: map[string][]uint64{"description": nil}},
		{name: "custom field does not mark standard field", query: "circuit", queryFields: []string{"fields.description"}},
		{name: "wildcard", query: "big*", queryFields: []string{"messages"}, want: map[string][]uint64{"messages": {2, 3}}},
		{name: "not requested", query: "big dog", queryFields: []string{"messages"}, noMatches: true},
		{name: "old index", query: "big dog", queryFields: []string{"messages"}, oldIndex: true},
		{name: "federated search", query: "big dog", queryFields: []string{"messages"}, federated: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			originalFeatures := index.features
			if tc.oldIndex {
				index.features = slices.DeleteFunc(slices.Clone(index.features), func(feature resource.IndexFeature) bool {
					return feature == resource.IndexFeatureTextMatchLocations
				})
				t.Cleanup(func() { index.features = originalFeatures })
			}
			req := &resourcepb.ResourceSearchRequest{
				Options: &resourcepb.ListOptions{Key: key}, Query: tc.query, Limit: 10,
				Fields:       []string{"title", "description", "messages"},
				ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES, IncludeMatches: !tc.noMatches,
			}
			for _, name := range tc.queryFields {
				req.QueryFields = append(req.QueryFields, &resourcepb.ResourceSearchRequest_QueryField{Name: name, Boost: 1})
			}
			if tc.titleFilter {
				req.Options.Fields = []*resourcepb.Requirement{{Key: "title", Operator: "=", Values: []string{"The bigger dog"}}}
			}
			var federate []resource.ResourceIndex
			if tc.federated {
				req.Federated = []*resourcepb.ResourceKey{{Namespace: key.Namespace, Group: key.Group, Resource: "other"}}
				other, err := backend.BuildIndex(t.Context(), resource.NamespacedResource{
					Namespace: key.Namespace, Group: key.Group, Resource: "other",
				}, 0, "test", func(resource.ResourceIndex) (int64, error) { return 0, nil }, nil, false, time.Time{}, 0)
				require.NoError(t, err)
				federate = []resource.ResourceIndex{other}
			}
			response, err := index.Search(t.Context(), nil, req, federate, nil)
			require.NoError(t, err)
			require.Nil(t, response.Error)
			require.Equal(t, !tc.noMatches && !tc.oldIndex && !tc.federated, response.MatchesAvailable)
			require.Len(t, response.Rows, 1)
			got := make(map[string][]uint64)
			for _, value := range response.Rows[0].Values {
				if response.Fields[value.FieldIndex].Name == "messages" {
					require.Equal(t, messages, value.StringValues)
				}
				if value.Matched {
					got[response.Fields[value.FieldIndex].Name] = value.MatchedArrayIndices
				} else {
					require.Empty(t, value.MatchedArrayIndices)
				}
			}
			if tc.want == nil {
				require.Empty(t, got)
			} else {
				require.Equal(t, tc.want, got)
			}
		})
	}
	response, err := index.Search(t.Context(), nil, &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{Key: key}, Query: "dog", IncludeMatches: true,
	}, nil, nil)
	require.NoError(t, err)
	require.Equal(t, int32(400), response.GetError().GetCode())
}

package search

import (
	"testing"

	blevesearch "github.com/blevesearch/bleve/v2/search"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestHitsToFieldValuesUsesZeroForMalformedLegacyID(t *testing.T) {
	key := &resourcepb.ResourceKey{Namespace: "default", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash-1"}
	match := &blevesearch.DocumentMatch{
		ID: resource.SearchID(key),
		Fields: map[string]any{
			resource.SEARCH_FIELD_LABELS + "." + resource.SEARCH_FIELD_LEGACY_ID: "not-an-integer",
			resource.SEARCH_FIELD_TITLE: "Dashboard",
		},
	}
	hits := blevesearch.DocumentMatchCollection{match}
	index := &bleveIndex{standard: resource.StandardSearchFields(), logger: log.NewNopLogger()}

	table, err := index.hitsToTable(t.Context(), []string{resource.SEARCH_FIELD_LEGACY_ID, resource.SEARCH_FIELD_TITLE}, hits, nil, false)
	require.NoError(t, err)
	require.Len(t, table.Rows, 1)
	legacyID, err := resource.DecodeCell(table.Columns[0], 0, table.Rows[0].Cells[0])
	require.NoError(t, err)
	require.Equal(t, int64(0), legacyID)

	schema := &fieldValueResultSchema{
		fields: []*resourcepb.ResourceSearchField{
			{Name: resource.SEARCH_FIELD_LEGACY_ID, Type: resourcepb.ResourceSearchField_INT64},
			{Name: resource.SEARCH_FIELD_TITLE, Type: resourcepb.ResourceSearchField_STRING},
		},
		definitions: []resource.SearchFieldDefinition{
			{Name: resource.SEARCH_FIELD_LEGACY_ID, Type: resource.SearchFieldTypeInt64},
			{Name: resource.SEARCH_FIELD_TITLE, Type: resource.SearchFieldTypeString},
		},
	}
	fields, rows, err := index.hitsToFieldValues(schema, hits, nil)
	require.NoError(t, err)
	require.Equal(t, schema.fields, fields)
	require.Len(t, rows, 1)
	require.Equal(t, key, rows[0].Key)
	require.Equal(t, []*resourcepb.ResourceSearchValue{
		{FieldIndex: 0, Int64Values: []int64{0}},
		{FieldIndex: 1, StringValues: []string{"Dashboard"}},
	}, rows[0].Values)
}

func TestHitsToFieldValuesUsesZeroForInvalidResourceVersion(t *testing.T) {
	key := &resourcepb.ResourceKey{Namespace: "default", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash-1"}
	hits := blevesearch.DocumentMatchCollection{{
		ID:     resource.SearchID(key),
		Fields: map[string]any{resource.SEARCH_FIELD_RV_STRING: "not-an-integer"},
	}}
	index := &bleveIndex{logger: log.NewNopLogger()}

	_, rows, err := index.hitsToFieldValues(&fieldValueResultSchema{includeResourceVersion: true}, hits, nil)
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, key, rows[0].Key)
	require.Zero(t, rows[0].ResourceVersion)
}

func TestHitsToFieldValuesRejectsInvalidResourceIdentity(t *testing.T) {
	hits := blevesearch.DocumentMatchCollection{{ID: "not-a-search-id"}}
	index := &bleveIndex{logger: log.NewNopLogger()}

	_, _, err := index.hitsToFieldValues(&fieldValueResultSchema{}, hits, nil)
	require.Error(t, err)
}

func TestNewSearchResultValue(t *testing.T) {
	t.Run("scalar zero values remain present", func(t *testing.T) {
		boolean, err := newSearchResultValue(1, resource.SearchFieldDefinition{Type: resource.SearchFieldTypeBoolean}, false)
		require.NoError(t, err)
		require.Equal(t, []bool{false}, boolean.BooleanValues)

		integer, err := newSearchResultValue(2, resource.SearchFieldDefinition{Type: resource.SearchFieldTypeInt64}, float64(0))
		require.NoError(t, err)
		require.Equal(t, []int64{0}, integer.Int64Values)

		text, err := newSearchResultValue(3, resource.SearchFieldDefinition{Type: resource.SearchFieldTypeString}, "")
		require.NoError(t, err)
		require.Equal(t, []string{""}, text.StringValues)
	})

	t.Run("array values", func(t *testing.T) {
		value, err := newSearchResultValue(4, resource.SearchFieldDefinition{
			Type:  resource.SearchFieldTypeString,
			Array: true,
		}, []any{"one", "two"})
		require.NoError(t, err)
		require.Equal(t, uint32(4), value.FieldIndex)
		require.Equal(t, []string{"one", "two"}, value.StringValues)
	})

	t.Run("other scalar types", func(t *testing.T) {
		double, err := newSearchResultValue(5, resource.SearchFieldDefinition{Type: resource.SearchFieldTypeDouble}, float64(1.5))
		require.NoError(t, err)
		require.Equal(t, []float64{1.5}, double.DoubleValues)

		date, err := newSearchResultValue(6, resource.SearchFieldDefinition{Type: resource.SearchFieldTypeDate}, float64(1234))
		require.NoError(t, err)
		require.Equal(t, []int64{1234}, date.Int64Values)

		booleans, err := newSearchResultValue(7, resource.SearchFieldDefinition{
			Type:  resource.SearchFieldTypeBoolean,
			Array: true,
		}, []any{true, false})
		require.NoError(t, err)
		require.Equal(t, []bool{true, false}, booleans.BooleanValues)
	})

	t.Run("empty array remains present", func(t *testing.T) {
		value, err := newSearchResultValue(8, resource.SearchFieldDefinition{
			Type:  resource.SearchFieldTypeInt64,
			Array: true,
		}, []int64{})
		require.NoError(t, err)
		require.NotNil(t, value)
		require.Empty(t, value.Int64Values)
	})

	t.Run("invalid values", func(t *testing.T) {
		_, err := newSearchResultValue(0, resource.SearchFieldDefinition{Type: resource.SearchFieldTypeString}, []string{"one", "two"})
		require.ErrorContains(t, err, "scalar field has 2 values")

		_, err = newSearchResultValue(0, resource.SearchFieldDefinition{Type: resource.SearchFieldTypeInt64}, "not a number")
		require.ErrorContains(t, err, "expected int64-compatible number")
	})
}

// A stored value that is not a valid resource version must not fail the search:
// it is indexed data, and the caller can do nothing about it.
func TestHitResourceVersion(t *testing.T) {
	idx := &bleveIndex{logger: log.NewNopLogger()}

	for _, tc := range []struct {
		name  string
		value any
		want  int64
	}{
		{name: "absent", value: nil, want: 0},
		{name: "valid", value: "1958241239561142273", want: 1958241239561142273},
		{name: "not a number", value: "nope", want: 0},
		{name: "empty", value: "", want: 0},
		{name: "overflows int64", value: "99999999999999999999", want: 0},
		{name: "not a string", value: float64(12), want: 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			match := &blevesearch.DocumentMatch{ID: "default/group/resource/name"}
			if tc.value != nil {
				match.Fields = map[string]any{resource.SEARCH_FIELD_RV_STRING: tc.value}
			}
			require.Equal(t, tc.want, idx.hitResourceVersion(match))
		})
	}
}

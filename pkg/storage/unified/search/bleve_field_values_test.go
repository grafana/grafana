package search

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

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

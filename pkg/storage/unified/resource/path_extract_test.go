package resource

import (
	"math"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCoerceToFieldShape_String(t *testing.T) {
	v, ok := coerceToFieldShape("hello", SearchFieldTypeString, false)
	require.True(t, ok)
	assert.Equal(t, "hello", v)

	// Non-string is rejected.
	_, ok = coerceToFieldShape(42, SearchFieldTypeString, false)
	assert.False(t, ok)
}

func TestCoerceToFieldShape_Boolean(t *testing.T) {
	v, ok := coerceToFieldShape(true, SearchFieldTypeBoolean, false)
	require.True(t, ok)
	assert.Equal(t, true, v)

	_, ok = coerceToFieldShape("true", SearchFieldTypeBoolean, false)
	assert.False(t, ok)
}

func TestCoerceToFieldShape_Int64(t *testing.T) {
	// unstructured.UnmarshalJSON preserves integers as int64.
	v, ok := coerceToFieldShape(int64(42), SearchFieldTypeInt64, false)
	require.True(t, ok)
	assert.Equal(t, int64(42), v)

	// Float64 with no fractional part: pass through cleanly.
	v, ok = coerceToFieldShape(float64(7), SearchFieldTypeInt64, false)
	require.True(t, ok)
	assert.Equal(t, int64(7), v)

	// Fractional float: rounded half away from zero rather than rejected.
	cases := []struct {
		in   float64
		want int64
	}{
		{3.4, 3},
		{3.5, 4},
		{3.7, 4},
		{-3.4, -3},
		{-3.5, -4},
	}
	for _, tc := range cases {
		got, ok := coerceToFieldShape(tc.in, SearchFieldTypeInt64, false)
		require.True(t, ok, "%v", tc.in)
		assert.Equal(t, tc.want, got, "%v", tc.in)
	}

	// Out of int64 range: rejected (Go's implementation-defined conversion
	// would otherwise saturate or wrap).
	_, ok = coerceToFieldShape(1e20, SearchFieldTypeInt64, false)
	assert.False(t, ok, "value above MaxInt64 must be rejected")
	_, ok = coerceToFieldShape(-1e20, SearchFieldTypeInt64, false)
	assert.False(t, ok, "value below MinInt64 must be rejected")

	// NaN and infinities are rejected.
	_, ok = coerceToFieldShape(math.NaN(), SearchFieldTypeInt64, false)
	assert.False(t, ok)
	_, ok = coerceToFieldShape(math.Inf(1), SearchFieldTypeInt64, false)
	assert.False(t, ok)
}

func TestCoerceToFieldShape_Double(t *testing.T) {
	v, ok := coerceToFieldShape(3.14, SearchFieldTypeDouble, false)
	require.True(t, ok)
	assert.Equal(t, 3.14, v)

	// An integer JSON value (preserved as int64 by unstructured) is accepted
	// for a Double field — it is still a valid double.
	v, ok = coerceToFieldShape(int64(7), SearchFieldTypeDouble, false)
	require.True(t, ok)
	assert.Equal(t, float64(7), v)
}

func TestCoerceToFieldShape_Array(t *testing.T) {
	v, ok := coerceToFieldShape([]any{"a", "b"}, SearchFieldTypeString, true)
	require.True(t, ok)
	assert.Equal(t, []any{"a", "b"}, v)

	// Mixed types in array fail the whole array.
	_, ok = coerceToFieldShape([]any{"a", 42}, SearchFieldTypeString, true)
	assert.False(t, ok)

	// Non-slice when Array is true is rejected.
	_, ok = coerceToFieldShape("a", SearchFieldTypeString, true)
	assert.False(t, ok)

	// Nil elements (produced by array projections for entries
	// whose sub-path was missing) are skipped, not treated as a coercion
	// failure for the whole array.
	v, ok = coerceToFieldShape([]any{"alice", nil, "bob"}, SearchFieldTypeString, true)
	require.True(t, ok)
	assert.Equal(t, []any{"alice", "bob"}, v)

	// An all-nil array indexes as an empty slice, not a dropped field.
	v, ok = coerceToFieldShape([]any{nil, nil}, SearchFieldTypeString, true)
	require.True(t, ok)
	assert.Equal(t, []any{}, v)
}

func TestCoerceToFieldShape_Nil(t *testing.T) {
	_, ok := coerceToFieldShape(nil, SearchFieldTypeString, false)
	assert.False(t, ok)
}

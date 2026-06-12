package resource

import (
	"math"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestExtractPath_DotTraversal(t *testing.T) {
	obj := map[string]any{
		"spec": map[string]any{
			"email": "alice@example.com",
			"profile": map[string]any{
				"city": "Brno",
			},
		},
	}

	t.Run("scalar", func(t *testing.T) {
		v, err := extractPath(obj, "spec.email")
		require.NoError(t, err)
		assert.Equal(t, "alice@example.com", v)
	})

	t.Run("nested scalar", func(t *testing.T) {
		v, err := extractPath(obj, "spec.profile.city")
		require.NoError(t, err)
		assert.Equal(t, "Brno", v)
	})

	t.Run("missing segment returns nil", func(t *testing.T) {
		v, err := extractPath(obj, "spec.does.not.exist")
		require.NoError(t, err)
		assert.Nil(t, v)
	})

	t.Run("empty path is an error", func(t *testing.T) {
		_, err := extractPath(obj, "")
		require.Error(t, err)
	})
}

func TestExtractPath_ScalarArrayPassthrough(t *testing.T) {
	obj := map[string]any{
		"spec": map[string]any{
			"tags": []any{"alpha", "beta", "gamma"},
		},
	}

	v, err := extractPath(obj, "spec.tags")
	require.NoError(t, err)
	assert.Equal(t, []any{"alpha", "beta", "gamma"}, v)
}

func TestExtractPath_ArrayProjection(t *testing.T) {
	obj := map[string]any{
		"spec": map[string]any{
			"members": []any{
				map[string]any{"name": "alice", "role": "admin"},
				map[string]any{"name": "bob"},
				map[string]any{"role": "viewer"}, // no name
			},
		},
	}

	t.Run("projects field from each element", func(t *testing.T) {
		v, err := extractPath(obj, "spec.members[*].name")
		require.NoError(t, err)
		// Last element has no name and contributes nil.
		assert.Equal(t, []any{"alice", "bob", nil}, v)
	})

	t.Run("identity projection returns the slice", func(t *testing.T) {
		v, err := extractPath(obj, "spec.members[*]")
		require.NoError(t, err)
		got, isSlice := v.([]any)
		require.True(t, isSlice)
		require.Len(t, got, 3)
	})

	t.Run("missing slice", func(t *testing.T) {
		v, err := extractPath(map[string]any{}, "spec.members[*].name")
		require.NoError(t, err)
		assert.Nil(t, v)
	})

	t.Run("non-slice under projection is an error", func(t *testing.T) {
		_, err := extractPath(map[string]any{
			"spec": map[string]any{"members": "not a slice"},
		}, "spec.members[*].name")
		require.Error(t, err)
	})

	t.Run("more than one projection is rejected", func(t *testing.T) {
		_, err := extractPath(obj, "spec.members[*].nested[*].deep")
		require.Error(t, err)
	})
}

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
}

func TestCoerceToFieldShape_Nil(t *testing.T) {
	_, ok := coerceToFieldShape(nil, SearchFieldTypeString, false)
	assert.False(t, ok)
}

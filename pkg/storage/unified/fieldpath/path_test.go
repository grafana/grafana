package fieldpath

import (
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
		v, err := Extract(obj, "spec.email")
		require.NoError(t, err)
		assert.Equal(t, "alice@example.com", v)
	})

	t.Run("nested scalar", func(t *testing.T) {
		v, err := Extract(obj, "spec.profile.city")
		require.NoError(t, err)
		assert.Equal(t, "Brno", v)
	})

	t.Run("missing segment returns nil", func(t *testing.T) {
		v, err := Extract(obj, "spec.does.not.exist")
		require.NoError(t, err)
		assert.Nil(t, v)
	})

	t.Run("empty path is an error", func(t *testing.T) {
		_, err := Extract(obj, "")
		require.Error(t, err)
	})
}

func TestExtractPath_ScalarArrayPassthrough(t *testing.T) {
	obj := map[string]any{
		"spec": map[string]any{
			"tags": []any{"alpha", "beta", "gamma"},
		},
	}

	v, err := Extract(obj, "spec.tags")
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
		v, err := Extract(obj, "spec.members[*].name")
		require.NoError(t, err)
		// Last element has no name and contributes nil.
		assert.Equal(t, []any{"alice", "bob", nil}, v)
	})

	t.Run("identity projection returns the slice", func(t *testing.T) {
		v, err := Extract(obj, "spec.members[*]")
		require.NoError(t, err)
		got, isSlice := v.([]any)
		require.True(t, isSlice)
		require.Len(t, got, 3)
	})

	t.Run("missing slice", func(t *testing.T) {
		v, err := Extract(map[string]any{}, "spec.members[*].name")
		require.NoError(t, err)
		assert.Nil(t, v)
	})

	t.Run("non-slice under projection is an error", func(t *testing.T) {
		_, err := Extract(map[string]any{
			"spec": map[string]any{"members": "not a slice"},
		}, "spec.members[*].name")
		require.Error(t, err)
	})

	t.Run("nested projections preserve source order", func(t *testing.T) {
		obj := map[string]any{"spec": map[string]any{"groups": []any{
			map[string]any{"members": []any{map[string]any{"name": "alice"}, map[string]any{"name": "bob"}}},
			map[string]any{"members": nil},
			map[string]any{"members": []any{nil, map[string]any{"name": "carol"}}},
		}}}
		got, err := Extract(obj, "spec.groups[*].members[*].name")
		require.NoError(t, err)
		assert.Equal(t, []any{"alice", "bob", nil, nil, "carol"}, got)
	})
}

func TestExtractPath_ProjectedArrays(t *testing.T) {
	t.Run("projected array leaves are flattened", func(t *testing.T) {
		obj := map[string]any{"spec": map[string]any{"members": []any{
			map[string]any{"tags": []any{"a", "b"}},
			map[string]any{"tags": []any{}},
			map[string]any{"tags": nil},
			map[string]any{"tags": []any{"c", nil, "d"}},
		}}}
		got, err := Extract(obj, "spec.members[*].tags")
		require.NoError(t, err)
		assert.Equal(t, []any{"a", "b", nil, "c", nil, "d"}, got)
	})

	t.Run("identity projection flattens array elements", func(t *testing.T) {
		obj := map[string]any{"tags": []any{[]any{"a", "b"}, []any{}, nil, []any{"c", nil, "d"}}}
		got, err := Extract(obj, "tags[*]")
		require.NoError(t, err)
		assert.Equal(t, []any{"a", "b", nil, "c", nil, "d"}, got)

		plain, err := Extract(obj, "tags")
		require.NoError(t, err)
		assert.Equal(t, obj["tags"], plain)
	})
}

func TestExtractPath_Nulls(t *testing.T) {
	for _, tc := range []struct {
		name string
		obj  map[string]any
		path string
		want any
	}{
		{
			name: "null leaf", obj: map[string]any{"spec": map[string]any{"title": nil}},
			path: "spec.title",
		},
		{
			name: "null parent", obj: map[string]any{"spec": nil},
			path: "spec.title",
		},
		{
			name: "null nested parent", obj: map[string]any{"spec": map[string]any{"profile": nil}},
			path: "spec.profile.name",
		},
		{
			name: "null projected array", obj: map[string]any{"spec": map[string]any{"members": nil}},
			path: "spec.members[*].name",
		},
		{
			name: "null parent before projection", obj: map[string]any{"spec": nil},
			path: "spec.members[*].name",
		},
		{
			name: "nulls within projection",
			obj: map[string]any{"members": []any{
				map[string]any{"profile": nil},
				nil,
				map[string]any{"profile": map[string]any{"name": "alice"}},
				map[string]any{"profile": map[string]any{"name": nil}},
			}},
			path: "members[*].profile.name", want: []any{nil, nil, "alice", nil},
		},
		{
			name: "identity projection preserves nulls", obj: map[string]any{"tags": []any{"a", nil, "b"}},
			path: "tags[*]", want: []any{"a", nil, "b"},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := Extract(tc.obj, tc.path)
			require.NoError(t, err)
			assert.Equal(t, tc.want, got)
		})
	}
}

func TestExtractPath_NonObjectParentIsAnError(t *testing.T) {
	obj := map[string]any{
		"profile": "not an object",
		"members": []any{map[string]any{"profile": "not an object"}},
		"groups":  []any{map[string]any{"members": "not an array"}},
	}
	for _, path := range []string{"profile.name", "members[*].profile.name", "groups[*].members[*].name"} {
		t.Run(path, func(t *testing.T) {
			_, err := Extract(obj, path)
			require.Error(t, err)
		})
	}
}

package filestorage

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestWrapper_addRootFolderToFilters(t *testing.T) {
	t.Run("should return null if passed filters are null", func(t *testing.T) {
		require.Nil(t, addRootFolderToFilters(nil, "root"))
	})

	t.Run("should not allocate empty arrays in place of nil arrays", func(t *testing.T) {
		filters := NewPathFilters(nil, nil, nil, nil)
		rootedFilters := addRootFolderToFilters(filters, "root")
		require.NotNil(t, rootedFilters)
		require.Nil(t, rootedFilters.disallowedPrefixes)
		require.Nil(t, rootedFilters.disallowedPaths)
		require.Nil(t, rootedFilters.allowedPrefixes)
		require.Nil(t, rootedFilters.allowedPaths)
	})

	t.Run("should preserve empty arrays", func(t *testing.T) {
		filters := NewPathFilters([]string{}, []string{}, nil, nil)
		rootedFilters := addRootFolderToFilters(filters, "root")
		require.NotNil(t, rootedFilters)
		require.Nil(t, rootedFilters.disallowedPrefixes)
		require.Nil(t, rootedFilters.disallowedPaths)
		require.NotNil(t, rootedFilters.allowedPrefixes)
		require.Equal(t, []string{}, rootedFilters.allowedPrefixes)

		require.NotNil(t, rootedFilters.allowedPaths)
		require.Equal(t, []string{}, rootedFilters.allowedPaths)
	})

	t.Run("should mutate arrays rather than reallocate", func(t *testing.T) {
		filters := NewPathFilters([]string{"/abc", "/abc2"}, nil, nil, []string{"/abc/", "/abc2/"})
		originalAllowedPrefixes := filters.allowedPrefixes
		originalDisallowedPaths := filters.disallowedPaths

		rootedFilters := addRootFolderToFilters(filters, "root/")
		require.NotNil(t, rootedFilters)
		require.Nil(t, rootedFilters.allowedPaths)
		require.Nil(t, rootedFilters.disallowedPrefixes)

		expectedAllowedPrefixes := []string{"root/abc", "root/abc2"}
		expectedDisallowedPaths := []string{"root/abc/", "root/abc2/"}
		require.Equal(t, expectedAllowedPrefixes, rootedFilters.allowedPrefixes)
		require.Equal(t, expectedDisallowedPaths, rootedFilters.disallowedPaths)

		require.Equal(t, expectedAllowedPrefixes, originalAllowedPrefixes)
		require.Equal(t, expectedDisallowedPaths, originalDisallowedPaths)
	})
}

func TestWrapper_copyPathFilters(t *testing.T) {
	t.Run("should return null if passed pathFilters are null", func(t *testing.T) {
		require.Nil(t, copyPathFilters(nil))
	})

	t.Run("should not allocate empty arrays in place of nil arrays", func(t *testing.T) {
		copiedFilters := copyPathFilters(NewPathFilters(nil, nil, nil, nil))
		require.NotNil(t, copiedFilters)
		require.Nil(t, copiedFilters.disallowedPrefixes)
		require.Nil(t, copiedFilters.disallowedPaths)
		require.Nil(t, copiedFilters.allowedPrefixes)
		require.Nil(t, copiedFilters.allowedPaths)
	})

	t.Run("should preserve empty arrays", func(t *testing.T) {
		copiedFilters := copyPathFilters(NewPathFilters([]string{}, []string{}, nil, nil))
		require.NotNil(t, copiedFilters)
		require.Nil(t, copiedFilters.disallowedPrefixes)
		require.Nil(t, copiedFilters.disallowedPaths)
		require.NotNil(t, copiedFilters.allowedPrefixes)
		require.Equal(t, []string{}, copiedFilters.allowedPrefixes)

		require.NotNil(t, copiedFilters.allowedPaths)
		require.Equal(t, []string{}, copiedFilters.allowedPaths)
	})

	t.Run("should new pointer with new slices", func(t *testing.T) {
		filters := NewPathFilters([]string{"/abc", "/abc2"}, nil, nil, []string{"/abc/", "/abc2/"})

		copiedFilters := copyPathFilters(filters)

		require.NotSame(t, filters, copiedFilters)

		require.Equal(t, filters.allowedPrefixes, copiedFilters.allowedPrefixes)
		require.Equal(t, filters.allowedPaths, copiedFilters.allowedPaths)
		require.Equal(t, filters.disallowedPrefixes, copiedFilters.disallowedPrefixes)
		require.Equal(t, filters.disallowedPaths, copiedFilters.disallowedPaths)

		copiedFilters.disallowedPaths[0] = "changed"
		require.Equal(t, []string{"/abc/", "/abc2/"}, filters.disallowedPaths)
		require.Equal(t, []string{"changed", "/abc2/"}, copiedFilters.disallowedPaths)
		require.NotEqual(t, filters.disallowedPaths, copiedFilters.disallowedPaths)
	})
}

func TestWrapper_addPathFilters(t *testing.T) {
	t.Run("should return pointer to the first argument", func(t *testing.T) {
		base := NewPathFilters(nil, nil, nil, nil)
		toAdd := NewPathFilters([]string{"abc"}, []string{"abc2"}, []string{"abc3"}, []string{"abc4"})
		require.Same(t, base, addPathFilters(base, toAdd))
	})

	testcases := []struct {
		base     *PathFilters
		toAdd    *PathFilters
		expected *PathFilters
	}{
		{
			base:     NewPathFilters(nil, nil, nil, nil),
			toAdd:    NewPathFilters([]string{"abc"}, []string{"abc2"}, []string{"abc3"}, []string{"abc4"}),
			expected: NewPathFilters([]string{"abc"}, []string{"abc2"}, []string{"abc3"}, []string{"abc4"}),
		},
		{
			base:     NewPathFilters([]string{"abc"}, []string{"abc2"}, []string{"abc3"}, []string{"abc4"}),
			toAdd:    NewPathFilters(nil, nil, nil, nil),
			expected: NewPathFilters([]string{"abc"}, []string{"abc2"}, []string{"abc3"}, []string{"abc4"}),
		},
		{
			base:     NewPathFilters([]string{"abc"}, []string{"abc2"}, []string{"abc3"}, []string{"abc4"}),
			toAdd:    NewPathFilters([]string{"abc"}, []string{"abc2"}, []string{"abc3"}, []string{"abc4"}),
			expected: NewPathFilters([]string{"abc", "abc"}, []string{"abc2", "abc2"}, []string{"abc3", "abc3"}, []string{"abc4", "abc4"}),
		},
		{
			base:     NewPathFilters([]string{"abc"}, []string{}, nil, []string{"abc4"}),
			toAdd:    NewPathFilters([]string{"abc"}, []string{"abc2", "abc22", "abc222"}, []string{"abc3"}, []string{"abc4"}),
			expected: NewPathFilters([]string{"abc", "abc"}, []string{"abc2", "abc22", "abc222"}, []string{"abc3"}, []string{"abc4", "abc4"}),
		},
	}

	for _, tt := range testcases {
		require.Equal(t, tt.expected, addPathFilters(tt.base, tt.toAdd))
	}

	t.Run("should not reuse arrays allocations from the second arg", func(t *testing.T) {
		base := NewPathFilters(nil, []string{}, nil, nil)
		toAdd := NewPathFilters([]string{"abc"}, []string{"abc2"}, []string{"abc3"}, []string{"abc4"})

		_ = addPathFilters(base, toAdd)

		require.Equal(t, toAdd.allowedPaths, base.allowedPaths)
		base.allowedPaths[0] = "mutated"
		require.Equal(t, []string{"mutated"}, base.allowedPaths)
		require.Equal(t, []string{"abc2"}, toAdd.allowedPaths)
		require.NotEqual(t, toAdd.allowedPaths, base.allowedPaths)

		require.Equal(t, toAdd.allowedPrefixes, base.allowedPrefixes)
		base.allowedPrefixes[0] = "mutated2"
		require.Equal(t, []string{"mutated2"}, base.allowedPrefixes)
		require.Equal(t, []string{"abc"}, toAdd.allowedPrefixes)
		require.NotEqual(t, toAdd.allowedPrefixes, base.allowedPrefixes)
	})
}

func TestFilestorage_getParentFolderPath(t *testing.T) {
	var tests = []struct {
		name     string
		path     string
		expected string
	}{
		{
			name:     "should return empty path if path has a single part - relative, suffix",
			path:     "ab/",
			expected: "",
		},
		{
			name:     "should return empty path if path has a single part - relative, no suffix",
			path:     "ab",
			expected: "",
		},
		{
			name:     "should return root if path has a single part - abs, no suffix",
			path:     "/public",
			expected: Delimiter,
		},
		{
			name:     "should return root if path has a single part - abs, suffix",
			path:     "/public/",
			expected: Delimiter,
		},
	}
	for _, tt := range tests {
		t.Run(fmt.Sprintf(tt.name), func(t *testing.T) {
			require.Equal(t, tt.expected, getParentFolderPath(tt.path))
		})
	}
}

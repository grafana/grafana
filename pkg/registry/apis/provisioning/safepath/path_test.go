package safepath

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPathJoin(t *testing.T) {
	testCases := []struct {
		Comment string
		In      []string
		Out     any // string or error
	}{
		{"Empty elements should not change input", []string{"/test/"}, "/test/"},
		{"Empty elements without leading slash should not change input", []string{"test/"}, "test/"},
		{"Single element should be added to path", []string{"/test/", "abc"}, "/test/abc"},
		{"Single element should be added to path with current dir prefix", []string{"./test/", "abc"}, "test/abc"},
		{"Single element with leading slash should be added to path", []string{"/test/", "/abc"}, "/test/abc"},
		{"Many elements are all appended to path", []string{"/test/", "a", "b", "c"}, "/test/a/b/c"},
		{"Path traversal within same directory should be expanded", []string{"/test/", "a", "..", "b", ".", "..", "c"}, "/test/c"},
		{"Complex path traversal remaining in prefix should be expanded", []string{"/test/", "a/..///c/", "../../test/d/"}, "/test/d/"},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.Comment, func(t *testing.T) {
			path := Join(tc.In...)
			if str, ok := tc.Out.(string); ok {
				assert.Equal(t, str, path)
			} else {
				panic("expected out was neither string nor error")
			}
		})
	}
}

func TestPathClean(t *testing.T) {
	orig := osSeparator
	osSeparator = '\\' // pretend we're on Windows
	defer func() { osSeparator = orig }()

	testCases := []struct {
		Comment string
		In      string
		Out     string
	}{
		{"Simple path", "/test/", "/test"},
		{"Simple path with OS separators", "\\test\\here", "/test/here"},
		{"Simple path with mixed separators", "\\test/here", "/test/here"},
		{"Path traversal within directory", "/test/abc/../def", "/test/def"},
		{"Multiple path traversals", "/test/abc/../../def", "/def"},
		{"Path traversal beyond root", "/test/../../../def", "/def"},
		{"Complex path traversal with mixed separators", "\\test\\abc\\..\\..\\def/ghi\\..", "/def"},
		{"Path traversal with multiple slashes", "/test////abc/..//def", "/test/def"},
		{"Path traversal with current directory", "/test/./abc/../def/./ghi", "/test/def/ghi"},
		{"Empty path segments with traversal", "//test//abc//..//def", "/test/def"},
		{"Root path returns empty string", "/", ""},
		{"Current directory returns empty string", ".", ""},
		{"Path traversal to root returns empty string", "/test/..", ""},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.Comment, func(t *testing.T) {
			assert.Equal(t, tc.Out, Clean(tc.In))
		})
	}
}

func TestBase(t *testing.T) {
	testCases := []struct {
		name     string
		path     string
		expected string
	}{
		{
			name:     "empty path",
			path:     "",
			expected: "",
		},
		{
			name:     "root path",
			path:     "/",
			expected: "",
		},
		{
			name:     "current directory",
			path:     ".",
			expected: "",
		},
		{
			name:     "simple filename",
			path:     "file.txt",
			expected: "file.txt",
		},
		{
			name:     "path with directory",
			path:     "/path/to/file.txt",
			expected: "file.txt",
		},
		{
			name:     "path with trailing slash",
			path:     "/path/to/dir/",
			expected: "dir",
		},
		{
			name:     "hidden file",
			path:     ".gitignore",
			expected: ".gitignore",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := Base(tc.path)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestRemoveExt(t *testing.T) {
	testCases := []struct {
		name     string
		path     string
		expected string
	}{
		{
			name:     "empty path",
			path:     "",
			expected: "",
		},
		{
			name:     "no extension",
			path:     "filename",
			expected: "filename",
		},
		{
			name:     "simple extension",
			path:     "file.txt",
			expected: "file",
		},
		{
			name:     "multiple dots",
			path:     "file.tar.gz",
			expected: "file.tar",
		},
		{
			name:     "hidden file",
			path:     ".gitignore",
			expected: ".gitignore",
		},
		{
			name:     "path with directory",
			path:     "/path/to/file.txt",
			expected: "/path/to/file",
		},
		{
			name:     "path with trailing slash",
			path:     "/path/to/dir/",
			expected: "/path/to/dir/",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := RemoveExt(tc.path)
			assert.Equal(t, tc.expected, result)
		})
	}
}

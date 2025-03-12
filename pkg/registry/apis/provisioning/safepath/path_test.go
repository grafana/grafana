package safepath

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPathJoin(t *testing.T) {
	orig := osSeparator
	osSeparator = '\\' // pretend we're on Windows
	defer func() { osSeparator = orig }()

	testCases := []struct {
		Comment string
		In      []string
		Out     any // string or error
	}{
		{"Empty elements should not change input", []string{"/test/"}, "/test"},
		{"Empty elements without leading slash should not change input", []string{"test/"}, "test"},
		{"Single element should be added to path", []string{"/test/", "abc"}, "/test/abc"},
		{"Single element should be added to path with current dir prefix", []string{"./test/", "abc"}, "test/abc"},
		{"Single element with leading slash should be added to path", []string{"/test/", "/abc"}, "/test/abc"},
		{"Many elements are all appended to path", []string{"/test/", "a", "b", "c"}, "/test/a/b/c"},
		{"Path traversal within same directory should be expanded", []string{"/test/", "a", "..", "b", ".", "..", "c"}, "/test/c"},
		{"Path traversal escaping root dir prefix should return err", []string{"/test/", ".."}, ErrUnsafePathTraversal},
		{"Path traversal escaping no dir prefix should return err", []string{"test/", ".."}, ErrUnsafePathTraversal},
		{"Path traversal escaping current dir prefix should return err", []string{"./test/", ".."}, ErrUnsafePathTraversal},
		{"Complex path traversal escaping prefix should return err", []string{"/test/", "a/..///c/", "../../test/d/../a/../.."}, ErrUnsafePathTraversal},
		{"Complex path traversal remaining in prefix should be expanded", []string{"/test/", "a/..///c/", "../../test/d/"}, "/test/d"},
		{"Problematic code example from the g304 website", []string{"/safe/path", "../../private/path"}, ErrUnsafePathTraversal},
		{"Traversing beyond root should be expanded", []string{"/test/", "/../a"}, "/test/a"},
		{"OS separator should be replaced with a slash", []string{"/test\\test", "abc\\test"}, "/test/test/abc/test"},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.Comment, func(t *testing.T) {
			path, err := Join(tc.In[0], tc.In[1:]...)
			if ee, ok := tc.Out.(error); ok {
				assert.ErrorIs(t, err, ee, "expected unsuccessful outcome")
				assert.Empty(t, path, "expected empty string when unsuccessful")
			} else if str, ok := tc.Out.(string); ok {
				assert.NoError(t, err, "expected successful outcome")
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
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.Comment, func(t *testing.T) {
			assert.Equal(t, tc.Out, Clean(tc.In))
		})
	}
}

package safepath

import (
	"os"
	"path"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// ErrUnsafePathTraversal indicates that an input path had a path traversal which led to escaping the required prefix.
// E.g. Join("/test", "..") would return this, because it doesn't stay within the '/test' directory.
var ErrUnsafePathTraversal = apierrors.NewBadRequest("the input path had an unacceptable path traversal")

// Join joins any number of elements in a path under a common prefix path.
// If the elems do path traversal, they are permitted to do so under their own directories.
// The output result will _always_ have a prefix of the given prefix, and no path traversals in the output string.
// The output result will not end with a trailing slash.
// The output result will have a leading slash if one is given as a prefix.
// If the prefix would ultimately be escaped, an error is returned.
//
// This function is safe for <https://securego.io/docs/rules/g304.html>.
func Join(prefix string, elem ...string) (string, error) {
	// We clean early to make the HasPrefix check be sensible after path.Join does a Clean for us.
	prefix = replaceOSSeparators(path.Clean(prefix))
	if len(elem) == 0 {
		return prefix, nil
	}

	for i, e := range elem {
		// We don't use Clean here because the output of path.Join will clean for us.
		elem[i] = replaceOSSeparators(e)
	}
	subPath := path.Join(elem...) // performs a Clean after joining
	completePath := path.Join(prefix, subPath)
	if !strings.HasPrefix(completePath, prefix) {
		return "", ErrUnsafePathTraversal
	}
	return completePath, nil
}

// Performs a [path.Clean] on the path, as well as replacing its OS separators.
// Note that this does no effort to ensure the paths are safe to use. It only cleans them.
func Clean(p string) string {
	return path.Clean(replaceOSSeparators(p))
}

// osSeparator is declared as a var here only to ensure we can change it in tests.
var osSeparator = os.PathSeparator

// This replaces the OS separator with a slash.
// All OSes we target (Linux, macOS, and Windows) support forward-slashes in path traversals, as such it's simpler to use the same character everywhere.
// BSDs do as well (even though they're not a target as of writing).
func replaceOSSeparators(p string) string {
	if osSeparator == '/' { // perf: nothing to do!
		return p
	}
	return strings.ReplaceAll(p, string(osSeparator), "/")
}

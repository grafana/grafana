package safepath

import (
	"os"
	"path"
	"strings"
)

// TODO: explore if we want to use our own type for safepath
// to make it clearer that this is a safe path and not a regular path

// osSeparator is declared as a var here only to ensure we can change it in tests.
var osSeparator = os.PathSeparator

// Performs a [path.Clean] on the path, as well as replacing its OS separators.
//
// This replaces the OS separator with a slash.
// All OSes we target (Linux, macOS, and Windows) support forward-slashes in path traversals, as such it's simpler to use the same character everywhere.
// BSDs do as well (even though they're not a target as of writing).
//
// The output of a root path (i.e. absolute root or relative current dir) is always "" (empty string).
func Clean(p string) string {
	if osSeparator != '/' {
		p = strings.ReplaceAll(p, string(osSeparator), "/")
	}

	cleaned := path.Clean(p)
	if cleaned == "." || cleaned == "/" {
		return ""
	}
	return cleaned
}

// Join is like path.Join but preserves trailing slashes from the last element
func Join(elem ...string) string {
	if len(elem) == 0 {
		return ""
	}

	joined := path.Join(elem...)
	// Preserve trailing slash if the last element had one
	if strings.HasSuffix(elem[len(elem)-1], "/") {
		return joined + "/"
	}

	return joined
}

// Base returns the last element of the path.
func Base(p string) string {
	b := path.Base(p)
	if b == "." || b == "/" {
		return ""
	}

	return b
}

// RemoveExt returns the path without the extension.
// It should not remove the dot if the filename is e.g. `.gitignore`
func RemoveExt(p string) string {
	// Special case: if the file starts with a dot and has no other dots,
	// it's a hidden file and should not have its "extension" removed
	base := Base(p)
	if strings.HasPrefix(base, ".") && strings.Count(base, ".") == 1 {
		return p
	}

	ext := path.Ext(p)
	if ext == "" {
		return p
	}

	return p[0 : len(p)-len(ext)]
}

func IsAbs(p string) bool {
	return path.IsAbs(p)
}

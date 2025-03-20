package safepath

import (
	"path"
	"strings"
)

// IsDir returns true if the filePath ends with a slash.
// Empty string is considered a directory.
func IsDir(filePath string) bool {
	if filePath == "" {
		return true
	}

	return strings.HasSuffix(filePath, "/")
}

// Dir behaves exactly as path.Dir, but returns "" for the root directory.
// and returns a trailing slash for all other directories.
func Dir(filePath string) string {
	if filePath == "" {
		return ""
	}

	dir := path.Dir(filePath)
	if dir == "." || dir == "/" {
		return ""
	}

	return dir + "/"
}

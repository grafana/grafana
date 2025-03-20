package safepath

import "strings"

// IsDir returns true if the filePath ends with a slash.
// Empty string is considered a directory.
func IsDir(filePath string) bool {
	if filePath == "" {
		return true
	}

	return strings.HasSuffix(filePath, "/")
}

package safepath

import "strings"

// IsDir returns true if the filePath ends with a slash.
func IsDir(filePath string) bool {
	return strings.HasSuffix(filePath, "/")
}

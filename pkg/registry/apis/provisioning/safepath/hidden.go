package safepath

import "strings"

// IsHidden returns true if the path starts with a dot.
func IsHidden(filePath string) bool {
	return strings.HasPrefix(filePath, ".")
}

// NotHiddenPath returns the part until the first hidden folder in the path.
// The returned value will include the trailing slash for directories.
// If the path refers to a file, it will return the parent directory with a trailing slash.
// If the path doesn't contain any hidden folder or files, it will return the original path.
func NotHiddenPath(filePath string) string {
	if filePath == "" {
		return ""
	}

	parts := Split(filePath)
	for i, part := range parts {
		if !IsHidden(part) {
			continue
		}

		if i == 0 {
			return ""
		}

		return strings.Join(parts[:i], "/") + "/"
	}

	return filePath
}

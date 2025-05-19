package safepath

import (
	"fmt"
	"path"
	"strings"
)

// IsDir returns true if the filePath ends with a slash.
// Empty string is considered a directory.
func IsDir(filePath string) bool {
	if filePath == "" || filePath == "." {
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

	// Trim trailing slash before getting the directory
	cleanPath := strings.TrimSuffix(filePath, "/")
	dir := path.Dir(cleanPath)
	if dir == "." || dir == "/" {
		return ""
	}

	return dir + "/"
}

// InDir returns true if the filePath is a subdirectory of the given directory.
func InDir(filePath, dir string) bool {
	return strings.HasPrefix(filePath, dir)
}

// RelativeTo returns the relative path of the filePath to the given directory.
// It handles cases where either filePath or dir have leading or trailing slashes.
func RelativeTo(filePath, dir string) (string, error) {
	if dir == "/" || dir == "" {
		return filePath, nil
	}

	// Normalize paths by trimming leading and trailing slashes
	normalizedDir := strings.Trim(dir, "/")
	if normalizedDir != "" {
		normalizedDir += "/"
	}

	normalizedPath := strings.TrimPrefix(filePath, "/")

	// Check if the normalized path is in the normalized directory
	if !strings.HasPrefix(normalizedPath, normalizedDir) {
		return "", fmt.Errorf("filePath is not a subdirectory of dir")
	}

	// Get the relative path by trimming the directory prefix
	relativePath := strings.TrimPrefix(normalizedPath, normalizedDir)

	return relativePath, nil
}

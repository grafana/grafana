package safepath

import (
	"errors"
	"regexp"
	"strings"
)

var (
	ErrPathTooLong          = errors.New("path too long")
	ErrInvalidCharacters    = errors.New("path contains invalid characters")
	ErrDoubleSlash          = errors.New("path contains double slashes")
	ErrInvalidFormat        = errors.New("invalid path format")
	ErrPercentChar          = errors.New("path contains percent character which could be used for URL encoding attacks")
	ErrHiddenPath           = errors.New("path contains hidden file or directory (starting with dot)")
	ErrPathTraversalAttempt = errors.New("path contains traversal attempt (./ or ../)")
)

const (
	MaxPathLength = 1024 // Maximum allowed path length in characters
)

// validPathPattern matches valid path characters:
// - Alphanumeric (a-z, A-Z, 0-9)
// - Forward slash for path separation
// - Dots for file extensions and current directory
// - Underscores and hyphens for file/folder names
var validPathPattern = regexp.MustCompile(`^[a-zA-Z0-9/_.-]+$`)

func IsSafe(path string) error {
	// Check path length
	if len(path) > MaxPathLength {
		return ErrPathTooLong
	}

	// Empty path is valid (represents current directory)
	if path == "" {
		return nil
	}

	// Check specifically for percent character first
	if strings.Contains(path, "%") {
		return ErrPercentChar
	}

	// Check for invalid characters
	if !validPathPattern.MatchString(path) {
		return ErrInvalidCharacters
	}

	// Check for double slashes
	if strings.Contains(path, "//") {
		return ErrDoubleSlash
	}

	parts := Split(path)

	// Check for path traversal attempts first
	for _, part := range parts {
		if part == ".." || part == "." {
			return ErrPathTraversalAttempt
		}
	}

	// Check for hidden files/directories in any part of the path
	for _, part := range parts {
		if part != "" && part[0] == '.' && part != ".." && part != "." {
			return ErrHiddenPath
		}
	}

	// If it's not a directory, it should have a filename component
	if !IsDir(path) && len(parts) > 0 {
		filename := parts[len(parts)-1]
		if filename == "" {
			return ErrInvalidFormat
		}
	}

	return nil
}

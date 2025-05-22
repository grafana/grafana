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
var validPathPattern = regexp.MustCompile(`^[a-zA-Z0-9 /_.-]+$`)

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
	for _, part := range parts {
		// Check for path traversal attempts first
		if part == ".." || part == "." {
			return ErrPathTraversalAttempt
		}

		// Check for hidden files/directories in any part of the path
		if part == "" || strings.HasPrefix(part, ".") {
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

// SafeSegment returns a safe part of the path
// It ensures the path is free from traversal attempts, hidden files,
// and other potentially dangerous patterns.
func SafeSegment(path string) string {
	if path == "" {
		return ""
	}

	parts := Split(path)
	if len(parts) == 0 {
		return ""
	}

	// Build up the path segment by segment, checking safety
	var safePath string
	for _, part := range parts {
		// Check if this segment is safe
		testPath := Join(safePath, part)
		if IsSafe(testPath) != nil || part == "" {
			// If this segment is unsafe, return the path up to but not including this segment
			// Add trailing slash for directories
			if safePath != "" {
				return safePath + "/"
			}
			return ""
		}
		safePath = testPath
	}

	// If we made it through all segments, the path is safe
	// Preserve trailing slash if original path had one
	if IsDir(path) && safePath != "" {
		return safePath + "/"
	}

	return safePath
}

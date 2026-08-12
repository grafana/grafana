package app

import (
	"fmt"
	"net/url"
	"path"
	"strings"
)

// Local error definitions to avoid importing the main shorturls package
var (
	ErrShortURLAbsolutePath = fmt.Errorf("path should be relative")
	ErrShortURLInvalidPath  = fmt.Errorf("invalid short URL path")
)

// validateRelativePath checks that a short URL path is a safe relative path
// that will not redirect to an external domain.
func validateRelativePath(rawPath string) error {
	p := strings.TrimSpace(rawPath)

	// IMPORTANT: This logic is duplicated in pkg/services/shorturls/models.go — keep both in sync.
	// Reject path traversal (forward and backslash variants)
	if strings.Contains(p, "../") || strings.Contains(p, `..\`) {
		return fmt.Errorf("%w: %s", ErrShortURLInvalidPath, p)
	}

	// Reject protocol-relative URLs (//evil.com) before the general absolute path check
	if strings.HasPrefix(p, "//") {
		return fmt.Errorf("%w: %s", ErrShortURLInvalidPath, p)
	}

	// Reject backslash-based paths that browsers may interpret as URLs
	if strings.HasPrefix(p, `\`) {
		return fmt.Errorf("%w: %s", ErrShortURLInvalidPath, p)
	}

	// Reject URLs containing a scheme (e.g. http://evil.com)
	if strings.Contains(p, "://") {
		return fmt.Errorf("%w: %s", ErrShortURLInvalidPath, p)
	}

	// Parse as URL and reject if it has a scheme (catches scheme:... patterns like javascript:alert(1))
	parsed, err := url.Parse(p)
	if err == nil && parsed.Scheme != "" {
		return fmt.Errorf("%w: %s", ErrShortURLInvalidPath, p)
	}

	// Reject absolute filesystem paths (starts with /)
	if path.IsAbs(p) {
		return fmt.Errorf("%w: %s", ErrShortURLAbsolutePath, p)
	}

	return nil
}

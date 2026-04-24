package shorturls

import (
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

var (
	ErrShortURLBadRequest   = errutil.BadRequest("shorturl.bad-request")
	ErrShortURLNotFound     = errutil.NotFound("shorturl.not-found")
	ErrShortURLAbsolutePath = errutil.ValidationFailed("shorturl.absolute-path", errutil.WithPublicMessage("Path should be relative"))
	ErrShortURLInvalidPath  = errutil.ValidationFailed("shorturl.invalid-path", errutil.WithPublicMessage("Invalid short URL path"))
	ErrShortURLInternal     = errutil.Internal("shorturl.internal")
	ErrShortURLConflict     = errutil.Conflict("shorturl.conflict")
)

type ShortUrl struct {
	Id         int64  `json:"-"`
	OrgId      int64  `json:"-"`
	Uid        string `json:"uid"`
	Path       string `json:"path"`
	CreatedBy  int64  `json:"-"`
	CreatedAt  int64  `json:"-"`
	LastSeenAt int64  `json:"lastSeenAt"`
}

// ValidateRelativePath checks that a short URL path is a safe relative path
// that will not redirect to an external domain. It returns an appropriate error
// if the path is invalid, or nil if the path is safe.
// IMPORTANT: This logic is duplicated in apps/shorturl/pkg/app/app.go — keep both in sync.
func ValidateRelativePath(rawPath string) error {
	p := strings.TrimSpace(rawPath)

	// Reject path traversal (forward and backslash variants)
	if strings.Contains(p, "../") || strings.Contains(p, `..\`) {
		return ErrShortURLInvalidPath.Errorf("path cannot contain '../': %s", p)
	}

	// Reject protocol-relative URLs (//evil.com) before the general absolute path check
	if strings.HasPrefix(p, "//") {
		return ErrShortURLInvalidPath.Errorf("path cannot start with '//': %s", p)
	}

	// Reject backslash-based paths that browsers may interpret as URLs (\\evil.com, \evil.com)
	if strings.HasPrefix(p, `\`) {
		return ErrShortURLInvalidPath.Errorf("path cannot start with backslash: %s", p)
	}

	// Reject URLs containing a scheme (e.g. http://evil.com)
	if strings.Contains(p, "://") {
		return ErrShortURLInvalidPath.Errorf("path cannot contain a URL scheme: %s", p)
	}

	// Parse as URL and reject if it has a scheme (catches scheme:... patterns like javascript:alert(1))
	parsed, err := url.Parse(p)
	if err == nil && parsed.Scheme != "" {
		return ErrShortURLInvalidPath.Errorf("path cannot contain a URL scheme: %s", p)
	}

	// Reject absolute filesystem paths (starts with /)
	if path.IsAbs(p) {
		return ErrShortURLAbsolutePath.Errorf("expected relative path: %s", p)
	}

	return nil
}

type DeleteShortUrlCommand struct {
	Uid       string
	OlderThan time.Time

	NumDeleted int64
}

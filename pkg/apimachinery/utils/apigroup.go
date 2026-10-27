package utils

import (
	"net/http"
	"net/url"
	"strings"
)

const apisPrefix = "/apis/"

// APIGroupFromRequest returns the API group a request to /apis/<group>/... is
// addressed to, or "" for any other request. Access tokens may name that group
// as their audience.
//
// Only canonical paths count, so that path normalization by a later handler
// cannot change the group a token was accepted for: the path must not contain
// an encoded slash, or an empty, "." or ".." segment. The group must be a
// Kubernetes DNS subdomain name (see IsAPIGroup).
func APIGroupFromRequest(req *http.Request) string {
	if req == nil || req.URL == nil {
		return ""
	}
	rest, ok := strings.CutPrefix(req.URL.Path, apisPrefix)
	if !ok || !IsCanonicalAPIPath(req.URL) {
		return ""
	}
	group, _, _ := strings.Cut(rest, "/")
	if !IsAPIGroup(group) {
		return ""
	}
	return group
}

// IsCanonicalAPIPath reports whether u's path can be routed as sent: no
// empty, "." or ".." segments other than a single trailing slash, and no
// encoded slash. Otherwise a handler that cleans or decodes the path could
// serve a different group or namespace than the one the path was routed or
// authorized by.
func IsCanonicalAPIPath(u *url.URL) bool {
	if hasEncodedSlash(u) {
		return false
	}
	// The same as path.Clean(p) == p, segment by segment and without
	// building the cleaned path.
	p := strings.TrimSuffix(u.Path, "/")
	if p == "/" {
		return true
	}
	rest, ok := strings.CutPrefix(p, "/")
	if !ok || strings.HasSuffix(p, "/") {
		return false
	}
	for rest != "" {
		var segment string
		segment, rest, _ = strings.Cut(rest, "/")
		if !isPathSegment(segment) {
			return false
		}
	}
	return true
}

// canonicalPathParts appends the segments of u's path to parts, or reports
// false when it is not canonical (see IsCanonicalAPIPath). It checks the
// segments as it splits them, for callers that need them anyway, and splits
// into parts so a caller can provide the room for them.
func canonicalPathParts(u *url.URL, parts []string) ([]string, bool) {
	if hasEncodedSlash(u) {
		return nil, false
	}
	rest, ok := strings.CutPrefix(strings.TrimSuffix(u.Path, "/"), "/")
	if !ok {
		return nil, false
	}
	if rest == "" {
		return parts, true
	}
	for {
		part, tail, more := strings.Cut(rest, "/")
		if !isPathSegment(part) {
			return nil, false
		}
		parts = append(parts, part)
		if !more {
			return parts, true
		}
		rest = tail
	}
}

// hasEncodedSlash reports whether u's path encodes a slash. Escaping Path
// never escapes slashes, so an encoded slash can only come from RawPath.
// Avoid escaping, decoding, or lowercasing the path unless RawPath actually
// contains one. EscapedPath also checks that RawPath is a valid encoding of
// Path (it may be stale after a rewrite).
func hasEncodedSlash(u *url.URL) bool {
	raw := u.RawPath
	return raw != "" && (strings.Contains(raw, "%2f") || strings.Contains(raw, "%2F")) && u.EscapedPath() == raw
}

func isPathSegment(segment string) bool {
	return segment != "" && segment != "." && segment != ".."
}

// IsAPIGroup reports whether name is a Kubernetes DNS subdomain name:
// 1–253 lowercase ASCII letters, digits, hyphens, or dots, with each
// dot-separated label starting and ending with a letter or digit. Dotted API
// groups and hyphenated plugin IDs both qualify.
func IsAPIGroup(name string) bool {
	if len(name) == 0 || len(name) > 253 || !isLowerAlphanumeric(name[0]) || !isLowerAlphanumeric(name[len(name)-1]) {
		return false
	}
	// Check bytes directly to avoid allocations and regular-expression work
	// on the request path. The endpoints have already been validated.
	for i := 1; i < len(name)-1; i++ {
		c := name[i]
		if isLowerAlphanumeric(c) || c == '-' {
			continue
		}
		if c != '.' || !isLowerAlphanumeric(name[i-1]) || !isLowerAlphanumeric(name[i+1]) {
			return false
		}
	}
	return true
}

func isLowerAlphanumeric(c byte) bool {
	return c >= 'a' && c <= 'z' || c >= '0' && c <= '9'
}

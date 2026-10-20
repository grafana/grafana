package utils

import (
	"net/http"
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
	if !ok {
		return ""
	}
	// Escaping Path never escapes slashes, so an encoded slash can only
	// come from RawPath. Avoid escaping, decoding, or lowercasing the path
	// unless RawPath actually contains one. EscapedPath also checks that
	// RawPath is a valid encoding of Path (it may be stale after a rewrite).
	if raw := req.URL.RawPath; raw != "" && (strings.Contains(raw, "%2f") || strings.Contains(raw, "%2F")) && req.URL.EscapedPath() == raw {
		return ""
	}
	group, rest, _ := strings.Cut(rest, "/")
	if !IsAPIGroup(group) {
		return ""
	}
	// Cut advances through the path without revisiting the group. A single
	// trailing slash is allowed; all other empty segments are rejected.
	for rest != "" {
		var segment string
		segment, rest, _ = strings.Cut(rest, "/")
		if segment == "" || segment == "." || segment == ".." {
			return ""
		}
	}
	return group
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

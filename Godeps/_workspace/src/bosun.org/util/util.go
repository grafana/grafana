// Package util defines utilities for bosun.
package util

import (
	"os"
	"strings"
)

var (
	// Hostname is the machine's hostname.
	Hostname string
	// FullHostname will, if false, uses the hostname upto the first ".". Run Set()
	// manually after changing.
	FullHostname bool
)

// Clean cleans a hostname based on the current FullHostname setting.
func Clean(s string) string {
	if !FullHostname {
		s = strings.SplitN(s, ".", 2)[0]
	}
	return strings.ToLower(s)
}

// Set sets Hostntame based on the current preferences.
func Set() {
	h, err := os.Hostname()
	if err == nil {
		if !FullHostname {
			h = strings.SplitN(h, ".", 2)[0]
		}
	} else {
		h = "unknown"
	}
	Hostname = Clean(h)
}

func init() {
	Set()
}

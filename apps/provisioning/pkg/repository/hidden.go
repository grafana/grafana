package repository

import "github.com/grafana/grafana/apps/provisioning/pkg/safepath"

// IsIgnoredPath reports whether a path relative to the configured repository root
// is hidden. A .keep file in a visible directory is retained as a folder marker.
func IsIgnoredPath(path string, isDir bool) bool {
	// Keep empty-folder markers available for folder metadata repair.
	if !isDir && safepath.Base(path) == ".keep" {
		path = safepath.Dir(path)
	}
	return safepath.IsHidden(path)
}

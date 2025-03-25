package safepath

import (
	"context"
	"path"
	"strings"
)

type WalkFunc = func(ctx context.Context, path string) error

// Walk walks the given folder path and calls the given function for each folder.
func Walk(ctx context.Context, p string, fn WalkFunc) error {
	if p == "." || p == "/" {
		return nil
	}

	var currentPath string
	for _, folder := range strings.Split(p, "/") {
		if folder == "" {
			// Trailing / leading slash?
			continue
		}

		currentPath = path.Join(currentPath, folder)
		if err := fn(ctx, currentPath); err != nil {
			return err
		}
	}

	return nil
}

// Depth returns the depth of the given path.
func Depth(p string) int {
	return len(Split(p))
}

// Split splits the given path into segments.
func Split(p string) []string {
	trimmed := strings.Trim(p, "/")
	if trimmed == "" {
		return []string{}
	}
	return strings.Split(trimmed, "/")
}

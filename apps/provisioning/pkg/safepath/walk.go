package safepath

import (
	"context"
	"path"
	"sort"
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

// SortByDepth will sort any resource, by its path depth. You must pass in
// a way to get said path. Ties are alphabetical by default.
func SortByDepth[T any](items []T, pathExtractor func(T) string, asc bool) {
	sort.Slice(items, func(i, j int) bool {
		pathI, pathJ := pathExtractor(items[i]), pathExtractor(items[j])
		depthI, depthJ := Depth(pathI), Depth(pathJ)

		if depthI == depthJ {
			// alphabetical by default if depth is the same
			return pathI < pathJ
		}

		if asc {
			return depthI < depthJ
		}
		return depthI > depthJ
	})
}

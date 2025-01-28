package safepath

import (
	"context"
	"path"
	"strings"
)

type WalkFunc func(ctx context.Context, path string) error

// Walk walks the given folder path and calls the given function for each folder.
func Walk(ctx context.Context, folderPath string, fn WalkFunc) error {
	if folderPath == "." || folderPath == "/" {
		return nil
	}

	var currentPath string
	for _, folder := range strings.Split(folderPath, "/") {
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

package resources

import (
	"context"
	"fmt"
	"path"
	"strings"
)

type WalkFunc func(ctx context.Context, path, parent string) (string, error)

// Walk walks the given folder path and calls the given function for each folder.
func Walk(ctx context.Context, folderPath, parent string, fn WalkFunc) error {
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
		id, err := fn(ctx, currentPath, parent)
		if err != nil {
			return fmt.Errorf("failed to create folder '%s': %w", id, err)
		}

		parent = id
	}

	return nil
}

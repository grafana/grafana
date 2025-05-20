package containers

import (
	"embed"
	"io/fs"
	"path/filepath"

	"dagger.io/dagger"
)

func WithEmbeddedFS(client *dagger.Client, c *dagger.Container, path string, e embed.FS) (*dagger.Container, error) {
	dir := client.Directory()

	err := fs.WalkDir(e, ".", func(path string, entry fs.DirEntry, err error) error {
		if entry.IsDir() {
			return nil
		}
		if err != nil {
			return err
		}

		content, err := e.ReadFile(path)
		if err != nil {
			return err
		}
		rel, err := filepath.Rel("scripts/packaging/windows", path)
		if err != nil {
			return err
		}

		dir = dir.WithNewFile(rel, string(content))
		return nil
	})
	if err != nil {
		return nil, err
	}

	return c.WithDirectory(path, dir), nil
}

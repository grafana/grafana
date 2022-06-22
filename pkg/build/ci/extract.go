package main

import (
	"io"
	"io/fs"
	"os"
	"path/filepath"
)

// TODO: put this in the scribe repo
// Extract extracts the filesystem, returned from "state.GetDirectory(arg)", to the destination (dst).
func Extract(dir fs.FS, dst string) error {
	return fs.WalkDir(dir, ".", func(path string, d fs.DirEntry, err error) error {
		if path == "." {
			return nil
		}

		r, err := dir.Open(path)
		if err != nil {
			return err
		}

		w, err := os.Create(filepath.Join(dst, path))
		if err != nil {
			return err
		}

		if _, err := io.Copy(w, r); err != nil {
			return err
		}

		return nil
	})
}

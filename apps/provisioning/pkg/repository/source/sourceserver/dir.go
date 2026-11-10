package sourceserver

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// LoadDir reads every manifest under dir into a path-to-content map, skipping dot-prefixed entries.
func LoadDir(dir string) (map[string][]byte, error) {
	files := map[string][]byte{}
	err := filepath.WalkDir(dir, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if p == dir {
			return nil
		}
		if strings.HasPrefix(d.Name(), ".") {
			if d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if d.IsDir() {
			return nil
		}
		switch filepath.Ext(d.Name()) {
		case ".yaml", ".yml", ".json":
		default:
			return nil
		}

		rel, err := filepath.Rel(dir, p)
		if err != nil {
			return err
		}
		data, err := os.ReadFile(p) //nolint:gosec
		if err != nil {
			return err
		}
		files[filepath.ToSlash(rel)] = data
		return nil
	})
	return files, err
}

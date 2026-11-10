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
		// Hidden entries are skipped, except the .keep markers that stand for empty directories.
		if strings.HasPrefix(d.Name(), ".") && d.Name() != ".keep" {
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
			if d.Name() != ".keep" {
				return nil
			}
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

// SaveDir makes dir hold exactly files, so that edits made through the API survive a reload.
func SaveDir(dir string, files map[string][]byte) error {
	existing, err := LoadDir(dir)
	if err != nil {
		return err
	}

	for p, data := range files {
		full := filepath.Join(dir, filepath.FromSlash(p))
		if err := os.MkdirAll(filepath.Dir(full), 0o750); err != nil {
			return err
		}
		if err := os.WriteFile(full, data, 0o600); err != nil {
			return err
		}
	}
	for p := range existing {
		if _, keep := files[p]; keep {
			continue
		}
		if err := os.Remove(filepath.Join(dir, filepath.FromSlash(p))); err != nil {
			return err
		}
	}
	return removeEmptyDirs(dir)
}

func removeEmptyDirs(dir string) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}
	for _, e := range entries {
		if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		sub := filepath.Join(dir, e.Name())
		if err := removeEmptyDirs(sub); err != nil {
			return err
		}
		if rest, err := os.ReadDir(sub); err == nil && len(rest) == 0 {
			if err := os.Remove(sub); err != nil {
				return err
			}
		}
	}
	return nil
}

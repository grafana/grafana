package search

import (
	"path/filepath"
	"strings"
	"testing"
)

// A bypass in this validator would let a malicious snapshot manifest
// write outside its destination during DownloadIndexSnapshot. After a
// successful validation, the fuzz body re-checks every accepted path
// against the validator's own claim: canonical, non-empty, non-absolute,
// not escaping the snapshot prefix.
func FuzzValidateIndexSnapshotManifest(f *testing.F) {
	seeds := []struct{ p1, p2 string }{
		// Realistic paths.
		{"store/root.bolt", ""},
		{"store/00001.zap", "store/index_meta.json"},
		{"file.bleve", ""},

		// Adversarial paths the validator must reject.
		{"../escape", ""},
		{"../../etc/passwd", ""},
		{"/abs/path", ""},
		{".", ""},
		{"..", ""},
		{"./not-canonical", ""},
		{"a//b", ""},
		{"a/../b", ""},
		{"a/./b", ""},
		{"", ""},
		{"\x00", ""},
	}
	for _, s := range seeds {
		f.Add(s.p1, s.p2)
	}

	f.Fuzz(func(t *testing.T, p1, p2 string) {
		meta := &IndexMeta{Files: map[string]int64{}}
		if p1 != "" {
			meta.Files[p1] = 1
		}
		if p2 != "" {
			meta.Files[p2] = 2
		}

		err := ValidateIndexSnapshotManifest(meta)
		if err != nil {
			return
		}

		// Validation passed. Re-check the security property the validator
		// claims to enforce: every path must be canonical and contained.
		for relPath := range meta.Files {
			clean := filepath.ToSlash(filepath.Clean(filepath.FromSlash(relPath)))
			if clean != relPath {
				t.Fatalf("validator accepted non-canonical path %q (canonical: %q)", relPath, clean)
			}
			if clean == "." || clean == ".." || filepath.IsAbs(clean) || strings.HasPrefix(clean, "../") {
				t.Fatalf("validator accepted escaping path %q", relPath)
			}
		}
	})
}

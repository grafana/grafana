package conversion

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"
)

const goldenChecksumsPath = "testdata/golden_checksums.json"

var goldenChecksums = &checksumStore{}

type checksumStore struct {
	mu     sync.Mutex
	data   map[string]string
	dirty  bool
	loaded bool
}

func (s *checksumStore) load() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.loaded {
		return
	}

	//nolint:gosec
	raw, err := os.ReadFile(goldenChecksumsPath)
	if err != nil {
		s.data = make(map[string]string)
		s.loaded = true
		return
	}

	s.data = make(map[string]string)
	_ = json.Unmarshal(raw, &s.data)
	s.loaded = true
}

func (s *checksumStore) save() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.dirty {
		return nil
	}

	raw, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return fmt.Errorf("marshaling checksums: %w", err)
	}

	raw = append(raw, '\n')

	//nolint:gosec
	if err := os.WriteFile(goldenChecksumsPath, raw, 0644); err != nil {
		return fmt.Errorf("writing checksums file: %w", err)
	}

	return nil
}

// validateOrUpdate compares the SHA-256 of data against the stored checksum for
// key when running in validation mode, or records the new hash when
// REGENERATE_CHECKSUMS=true.
func (s *checksumStore) validateOrUpdate(t *testing.T, key string, data []byte) {
	t.Helper()

	hash := sha256Hex(data)

	s.mu.Lock()
	defer s.mu.Unlock()

	if shouldRegenerateChecksums() {
		s.data[key] = hash
		s.dirty = true
		return
	}

	expected, ok := s.data[key]
	if !ok {
		t.Errorf("no checksum found for %s (got %s); run with REGENERATE_CHECKSUMS=true to generate", key, hash)
		return
	}

	if expected != hash {
		t.Errorf("checksum mismatch for %s:\n  expected: %s\n       got: %s\nRun with REGENERATE_CHECKSUMS=true to update", key, expected, hash)
	}
}

func shouldRegenerateChecksums() bool {
	v := os.Getenv("REGENERATE_CHECKSUMS")
	return v == "true" || v == "1"
}

func sha256Hex(data []byte) string {
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:])
}

// checksumKey returns a platform-independent key for the given file path
// relative to the testdata directory.
func checksumKey(outputPath string) (string, error) {
	rel, err := filepath.Rel("testdata", outputPath)
	if err != nil {
		return "", fmt.Errorf("computing relative path for %s: %w", outputPath, err)
	}
	return filepath.ToSlash(rel), nil
}

func TestMain(m *testing.M) {
	goldenChecksums.load()

	code := m.Run()

	if shouldRegenerateChecksums() {
		if err := goldenChecksums.save(); err != nil {
			fmt.Fprintf(os.Stderr, "ERROR saving golden checksums: %v\n", err)
			os.Exit(1)
		}
	}

	os.Exit(code)
}

package testutil

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

// ChecksumStore manages SHA-256 checksums for golden test files.
// Each test package that produces golden output should create its own instance
// via NewChecksumStore and wire it into TestMain (Load before tests, Save after).
//
// During regeneration (REGENERATE_CHECKSUMS=true), the store starts empty so
// only checksums produced by the current run are kept. Orphan entries from
// deleted test inputs are pruned automatically.
type ChecksumStore struct {
	mu     sync.Mutex
	path   string
	data   map[string]string
	dirty  bool
	loaded bool
}

func NewChecksumStore(path string) *ChecksumStore {
	return &ChecksumStore{path: path}
}

func (s *ChecksumStore) Load() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.loaded {
		return
	}

	s.data = make(map[string]string)
	s.loaded = true

	if ShouldRegenerateChecksums() {
		return
	}

	//nolint:gosec
	raw, err := os.ReadFile(s.path)
	if err != nil {
		return
	}

	if err := json.Unmarshal(raw, &s.data); err != nil {
		fmt.Fprintf(os.Stderr, "WARNING: invalid %s: %v\n", s.path, err)
	}
}

func (s *ChecksumStore) Save() error {
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
	if err := os.WriteFile(s.path, raw, 0644); err != nil {
		return fmt.Errorf("writing checksums file: %w", err)
	}

	return nil
}

// ValidateOrUpdate compares the SHA-256 of data against the stored checksum
// for key, or records the new hash when ShouldRegenerateChecksums() is true.
func (s *ChecksumStore) ValidateOrUpdate(t *testing.T, key string, data []byte) {
	t.Helper()

	hash := sha256Hex(data)

	s.mu.Lock()
	defer s.mu.Unlock()

	if ShouldRegenerateChecksums() {
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

func ShouldRegenerateChecksums() bool {
	v := os.Getenv("REGENERATE_CHECKSUMS")
	return v == "true" || v == "1"
}

func sha256Hex(data []byte) string {
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:])
}

// ChecksumKey returns a platform-independent key for outputPath relative to baseDir.
func ChecksumKey(baseDir, outputPath string) (string, error) {
	rel, err := filepath.Rel(baseDir, outputPath)
	if err != nil {
		return "", fmt.Errorf("computing relative path for %s: %w", outputPath, err)
	}
	return filepath.ToSlash(rel), nil
}

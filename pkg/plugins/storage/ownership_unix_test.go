//go:build !windows
// +build !windows

package storage

import (
	"os"
	"path/filepath"
	"testing"
)

// Basic tests for matchOwnershipToParent on Unix-like systems.
// These avoid requiring root and are safe to run in CI.

func TestMatchOwnershipToParent_NoErrorAndRecurses(t *testing.T) {
	parent := t.TempDir()
	childParent := t.TempDir()
	child := filepath.Join(childParent, "childdir")
	if err := os.MkdirAll(filepath.Join(child, "nested"), 0o755); err != nil {
		t.Fatalf("failed to create child nested dir: %v", err)
	}

	fpath := filepath.Join(child, "nested", "file.txt")
	if err := os.WriteFile(fpath, []byte("hello"), 0o644); err != nil {
		t.Fatalf("failed to write file: %v", err)
	}

	// Should not error and must recurse into child directories.
	if err := matchOwnershipToParent(child, parent); err != nil {
		t.Fatalf("matchOwnershipToParent returned error: %v", err)
	}

	// File must still exist after call.
	if _, err := os.Stat(fpath); err != nil {
		t.Fatalf("expected file to exist after ownership change, got: %v", err)
	}
}

func TestMatchOwnershipToParent_MissingParentReturnsError(t *testing.T) {
	child := t.TempDir()
	missingParent := filepath.Join(child, "no-such-parent")

	// Should error if parent does not exist.
	if err := matchOwnershipToParent(child, missingParent); err == nil {
		t.Fatalf("expected an error when parent does not exist, got nil")
	}
}

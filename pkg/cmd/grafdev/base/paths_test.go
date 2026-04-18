package base

import (
	"os"
	"path/filepath"
	"testing"
)

func TestAssertGrafanaModule(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "go.mod"), []byte("module github.com/grafana/grafana\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := assertGrafanaModule(dir); err != nil {
		t.Fatal(err)
	}
	if err := assertGrafanaModule(filepath.Join(dir, "nested")); err == nil {
		t.Fatal("expected error for dir without go.mod")
	}
}

func TestResolveOSSRoot_FromFlag(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "go.mod"), []byte("module github.com/grafana/grafana\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	abs, err := resolveOSSRoot(dir)
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Clean(abs) != filepath.Clean(dir) {
		t.Fatalf("got %s want %s", abs, dir)
	}
}

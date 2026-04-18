package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestAddEnterpriseImport(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	extDir := filepath.Join(dir, "pkg", "extensions")
	if err := os.MkdirAll(extDir, 0o755); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(extDir, "enterprise_imports.go")
	src := `//go:build enterprise

package extensions

import (
	_ "example.com/existing"
)
`
	if err := os.WriteFile(path, []byte(src), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := addEnterpriseImport(dir, "example.com/newmod"); err != nil {
		t.Fatal(err)
	}
	out, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := addEnterpriseImport(dir, "example.com/newmod"); err == nil {
		t.Fatal("expected duplicate import error")
	}
	got := string(out)
	if !strings.Contains(got, `"example.com/newmod"`) || !strings.Contains(got, `"example.com/existing"`) {
		t.Fatalf("unexpected file content:\n%s", got)
	}
}

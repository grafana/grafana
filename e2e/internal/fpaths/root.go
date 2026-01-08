package fpaths

import (
	"context"
	"fmt"
	"os/exec"
	"path"
	"path/filepath"
	"strings"
)

// RepoRoot finds the root directory of the git repository.
func RepoRoot(ctx context.Context, dir string) (string, error) {
	cmd := exec.CommandContext(ctx, "git", "rev-parse", "--show-toplevel")
	cmd.Dir = dir
	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to get git repo root: %w", err)
	}
	p := strings.TrimSpace(string(out))
	p, err = NormalisePath(p)
	if err != nil {
		return "", fmt.Errorf("failed to normalise git repo root path: %w", err)
	}
	return p, nil
}

// NormalisePath converts a path to an absolute path, cleans it, and converts it to a forward-slash format.
func NormalisePath(p string) (string, error) {
	absPath, err := filepath.Abs(p)
	if err != nil {
		return "", fmt.Errorf("failed to get absolute path: %w", err)
	}
	return path.Clean(filepath.ToSlash(absPath)), nil
}

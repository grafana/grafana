package main

import (
	"bytes"
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
)

func git(dir string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	out := strings.TrimSpace(stdout.String())
	if err != nil {
		return out, fmt.Errorf("git %s (in %s): %w\n%s", strings.Join(args, " "), dir, err, strings.TrimSpace(stderr.String()))
	}
	return out, nil
}

func gitQuiet(dir string, args ...string) error {
	_, err := git(dir, args...)
	return err
}

func currentBranch(dir string) (string, error) {
	return git(dir, "rev-parse", "--abbrev-ref", "HEAD")
}

func isCleanWorktree(dir string) (bool, error) {
	out, err := git(dir, "status", "--porcelain")
	if err != nil {
		return false, err
	}
	return strings.TrimSpace(out) == "", nil
}

// commitsRelativeToRef returns how many commits ref has that are not reachable from HEAD (behind),
// and how many commits HEAD has not reachable from ref (ahead).
func commitsRelativeToRef(dir, ref string) (behind, ahead int, err error) {
	behindStr, err := git(dir, "rev-list", "--count", fmt.Sprintf("HEAD..%s", ref))
	if err != nil {
		return 0, 0, err
	}
	aheadStr, err := git(dir, "rev-list", "--count", fmt.Sprintf("%s..HEAD", ref))
	if err != nil {
		return 0, 0, err
	}
	_, err = fmt.Sscanf(strings.TrimSpace(behindStr), "%d", &behind)
	if err != nil {
		return 0, 0, err
	}
	_, err = fmt.Sscanf(strings.TrimSpace(aheadStr), "%d", &ahead)
	if err != nil {
		return 0, 0, err
	}
	return behind, ahead, nil
}

func remoteDefaultBranch(dir, remote string) (string, error) {
	// modern: git symbolic-ref refs/remotes/origin/HEAD
	ref, err := git(dir, "symbolic-ref", fmt.Sprintf("refs/remotes/%s/HEAD", remote))
	if err == nil && ref != "" {
		// refs/remotes/origin/main -> main
		return filepath.Base(ref), nil
	}
	// fallback
	if err := gitQuiet(dir, "remote", "set-head", remote, "-a"); err != nil {
		return "", fmt.Errorf("could not determine default branch for remote %q: %w", remote, err)
	}
	ref, err = git(dir, "symbolic-ref", fmt.Sprintf("refs/remotes/%s/HEAD", remote))
	if err != nil {
		return "", err
	}
	return filepath.Base(ref), nil
}

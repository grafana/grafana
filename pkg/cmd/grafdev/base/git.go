package base

import (
	"bytes"
	"fmt"
	"io"
	"os/exec"
	"path/filepath"
	"strings"
)

func Git(dir string, args ...string) (string, error) {
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

func GitQuiet(dir string, args ...string) error {
	_, err := Git(dir, args...)
	return err
}

func CurrentBranch(dir string) (string, error) {
	return Git(dir, "rev-parse", "--abbrev-ref", "HEAD")
}

func IsCleanWorktree(dir string) (bool, error) {
	out, err := Git(dir, "status", "--porcelain")
	if err != nil {
		return false, err
	}
	return strings.TrimSpace(out) == "", nil
}

func CommitsRelativeToRef(dir, ref string) (behind, ahead int, err error) {
	behindStr, err := Git(dir, "rev-list", "--count", fmt.Sprintf("HEAD..%s", ref))
	if err != nil {
		return 0, 0, err
	}
	aheadStr, err := Git(dir, "rev-list", "--count", fmt.Sprintf("%s..HEAD", ref))
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

func RemoteDefaultBranch(dir, remote string) (string, error) {
	ref, err := Git(dir, "symbolic-ref", fmt.Sprintf("refs/remotes/%s/HEAD", remote))
	if err == nil && ref != "" {
		return filepath.Base(ref), nil
	}
	out, err := Git(dir, "ls-remote", "--symref", remote, "HEAD")
	if err != nil {
		return "", fmt.Errorf("could not determine default branch for remote %q: %w", remote, err)
	}
	base, perr := defaultBranchFromLsRemoteSymrefOutput(out)
	if perr != nil {
		return "", fmt.Errorf("could not parse default branch from ls-remote --symref for remote %q: %w", remote, perr)
	}
	return base, nil
}

func defaultBranchFromLsRemoteSymrefOutput(out string) (string, error) {
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "ref:") {
			continue
		}
		rest := strings.TrimSpace(strings.TrimPrefix(line, "ref:"))
		fields := strings.Fields(rest)
		if len(fields) < 1 {
			continue
		}
		return filepath.Base(fields[0]), nil
	}
	return "", fmt.Errorf("no symref line in ls-remote output")
}

func localBranchExists(dir, branch string) (bool, error) {
	err := GitQuiet(dir, "show-ref", "-q", "--verify", fmt.Sprintf("refs/heads/%s", branch))
	if err == nil {
		return true, nil
	}
	return false, nil
}

// SwitchToBranchFromRef creates branch at startRef, or resets with git switch -C when resetExisting.
func SwitchToBranchFromRef(dir, branch, startRef string, resetExisting bool, w io.Writer) error {
	exists, err := localBranchExists(dir, branch)
	if err != nil {
		return err
	}
	if exists && !resetExisting {
		return fmt.Errorf("%s: branch %q already exists; refusing to reset to %s (pass --reset-existing)", dir, branch, startRef)
	}
	if exists {
		if _, err := Git(dir, "switch", "-C", branch, startRef); err != nil {
			return err
		}
		_, _ = fmt.Fprintf(w, "%s: reset branch %q to %s\n", dir, branch, startRef)
		return nil
	}
	if _, err := Git(dir, "switch", "-c", branch, startRef); err != nil {
		return err
	}
	_, _ = fmt.Fprintf(w, "%s: created branch %q at %s\n", dir, branch, startRef)
	return nil
}

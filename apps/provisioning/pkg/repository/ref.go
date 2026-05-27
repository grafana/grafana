package repository

import (
	"regexp"
	"strings"
)

// basicGitBranchNameRegex matches the character set allowed for git branch names.
// Mirrors the validation in apps/provisioning/pkg/repository/git/branch.go, duplicated
// here to avoid an import cycle (the git package imports repository).
var basicGitBranchNameRegex = regexp.MustCompile(`^[a-zA-Z0-9\-\_\/\.]+$`)

// commitHashRegex matches a 7–40 character hex string covering short and full git SHAs.
var commitHashRegex = regexp.MustCompile(`^[0-9a-fA-F]{7,40}$`)

// IsValidRef reports whether ref is a valid git ref to forward to a backend.
// An empty ref is considered valid: callers default it to the configured branch.
// A non-empty ref must be either a valid git branch name or a 7–40 char commit SHA.
func IsValidRef(ref string) bool {
	if ref == "" {
		return true
	}
	if commitHashRegex.MatchString(ref) {
		return true
	}
	return isValidGitBranchName(ref)
}

func isValidGitBranchName(branch string) bool {
	if !basicGitBranchNameRegex.MatchString(branch) {
		return false
	}
	if strings.HasPrefix(branch, "/") || strings.HasSuffix(branch, "/") ||
		strings.HasSuffix(branch, ".") || strings.Contains(branch, "..") ||
		strings.Contains(branch, "//") || strings.HasSuffix(branch, ".lock") {
		return false
	}
	return true
}

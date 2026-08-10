package git

import (
	"regexp"
	"strings"
)

// basicGitBranchNameRegex is a regular expression to validate a git branch name
// it does not cover all cases as positive lookaheads are not supported in Go's regexp
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
	return IsValidGitBranchName(ref)
}

// IsValidGitBranchName checks if a branch name is valid.
// It uses the following regexp `^[a-zA-Z0-9\-\_\/\.]+$` to validate the branch name with some additional checks that must satisfy the following rules:
// 1. The branch name must have at least one character and must not be empty.
// 2. The branch name cannot start with `/` or end with `/`, `.`, or whitespace.
// 3. The branch name cannot contain consecutive slashes (`//`).
// 4. The branch name cannot contain consecutive dots (`..`).
// 5. The branch name cannot contain `@{`.
// 6. The branch name cannot include the following characters: `~`, `^`, `:`, `?`, `*`, `[`, `\`, or `]`.
func IsValidGitBranchName(branch string) bool {
	if !basicGitBranchNameRegex.MatchString(branch) {
		return false
	}

	// Additional checks for invalid patterns
	if strings.HasPrefix(branch, "/") || strings.HasSuffix(branch, "/") ||
		strings.HasSuffix(branch, ".") || strings.Contains(branch, "..") ||
		strings.Contains(branch, "//") || strings.HasSuffix(branch, ".lock") {
		return false
	}

	return true
}

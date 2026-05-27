package repository

import (
	"strings"
	"testing"
)

func TestIsValidRef(t *testing.T) {
	tests := []struct {
		name string
		ref  string
		want bool
	}{
		// Empty: callers default to the configured branch downstream.
		{"empty", "", true},

		// Valid branch names.
		{"simple branch", "main", true},
		{"branch with slash", "feature/my-branch", true},
		{"branch with hyphen", "feature-x", true},
		{"branch with underscore", "feature_x", true},
		{"branch with dot", "v1.0", true},
		{"release branch", "release/v2.10.3", true},

		// Valid commit SHAs.
		{"short sha 7 chars", "abc1234", true},
		{"sha 8 chars", "abc12345", true},
		{"full sha 40 chars", "abcdef0123456789abcdef0123456789abcdef01", true},
		{"upper case sha", "ABCDEF0123456789ABCDEF0123456789ABCDEF01", true},
		{"mixed case sha", "AbCdEf0123456789", true},

		// Invalid: shell metacharacters and other dangerous chars.
		{"shell injection semicolon", "main; rm -rf /", false},
		{"shell injection pipe", "main|cat", false},
		{"shell injection backtick", "main`whoami`", false},
		{"shell injection dollar", "main$(whoami)", false},
		{"shell injection ampersand", "main&", false},
		{"space", "main branch", false},
		{"colon", "main:foo", false},
		{"question mark", "main?", false},
		{"asterisk", "main*", false},
		{"tilde", "main~1", false},
		{"caret", "main^", false},
		{"left bracket", "main[", false},
		{"backslash", "main\\branch", false},

		// Invalid: git branch naming rules.
		{"leading slash", "/main", false},
		{"trailing slash", "main/", false},
		{"trailing dot", "main.", false},
		{"double dots", "feature/..bad", false},
		{"double slashes", "feature//bad", false},
		{"trailing .lock", "feature.lock", false},

		// Hex strings shorter than the SHA minimum still pass branch-name validation,
		// so they are accepted as branches (callers cannot tell the difference and
		// the backend resolves the ambiguity).
		{"6-char hex is valid branch", "abcdef", true},
		{"41-char hex is valid branch", strings.Repeat("a", 41), true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsValidRef(tt.ref); got != tt.want {
				t.Errorf("IsValidRef(%q) = %v, want %v", tt.ref, got, tt.want)
			}
		})
	}
}

package git_test

import (
	"testing"

	"github.com/grafana/grafana/pkg/build/git"
	"github.com/stretchr/testify/assert"
)

func TestPRCheckRegexp(t *testing.T) {
	var (
		shouldMatch    = []string{"pr-check-1/branch-name", "pr-check-111/branch/name", "pr-check-102930122/branch-name"}
		shouldNotMatch = []string{"pr-check-a/branch", "km/test", "test", "pr-check", "pr-check/test", "price"}
	)

	regex := git.PRCheckRegexp()

	for _, v := range shouldMatch {
		assert.Truef(t, regex.MatchString(v), "regex should match %s", v)
	}

	for _, v := range shouldNotMatch {
		assert.False(t, regex.MatchString(v), "regex should not match %s", v)
	}
}

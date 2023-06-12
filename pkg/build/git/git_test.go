package git_test

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/build/git"
)

func TestPRCheckRegexp(t *testing.T) {
	type match struct {
		String string
		Commit string
		Branch string
		PR     string
	}

	var (
		shouldMatch = []match{
			{
				String: "prc-1-a1b2c3d4/branch-name",
				Branch: "branch-name",
				Commit: "a1b2c3d4",
				PR:     "1",
			},
			{
				String: "prc-111-a1b2c3d4/branch/name",
				Branch: "branch/name",
				Commit: "a1b2c3d4",
				PR:     "111",
			},
			{
				String: "prc-102930122-a1b2c3d4/branch-name",
				Branch: "branch-name",
				Commit: "a1b2c3d4",
				PR:     "102930122",
			},
		}

		shouldNotMatch = []string{"prc-a/branch", "km/test", "test", "prc", "prc/test", "price"}
	)

	regex := git.PRCheckRegexp()

	for _, v := range shouldMatch {
		assert.Truef(t, regex.MatchString(v.String), "regex '%s' should match %s", regex.String(), v)
		m := regex.FindStringSubmatch(v.String)
		assert.Equal(t, m[1], v.PR)
		assert.Equal(t, m[2], v.Commit)
		assert.Equal(t, m[3], v.Branch)
	}

	for _, v := range shouldNotMatch {
		assert.False(t, regex.MatchString(v), "regex '%s' should not match %s", regex.String(), v)
	}
}

package manager

import (
	"testing"

	"github.com/Masterminds/semver"
	"github.com/stretchr/testify/require"
)

func TestSemVersion(t *testing.T) {
	con, _ := semver.NewConstraint(">=7.5.0, <=7.x")
	ver, _ := semver.NewVersion("8.3.0")
	require.True(t, con.Check(ver))
}

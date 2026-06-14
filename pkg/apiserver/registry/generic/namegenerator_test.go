package generic_test

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/util"
)

func TestShortUIDNameGenerator(t *testing.T) {
	t.Parallel()

	t.Run("appends a valid short UID to the base", func(t *testing.T) {
		t.Parallel()
		got := generic.ShortUIDNameGenerator.GenerateName("team-")
		require.True(t, strings.HasPrefix(got, "team-"), "expected %q to keep the base prefix", got)
		suffix := strings.TrimPrefix(got, "team-")
		require.NotEmpty(t, suffix)
		require.True(t, util.IsValidShortUID(suffix), "suffix must be a valid short UID, got %q", suffix)
	})

	t.Run("returns the short UID when base is empty", func(t *testing.T) {
		t.Parallel()
		got := generic.ShortUIDNameGenerator.GenerateName("")
		require.NotEmpty(t, got)
		require.True(t, util.IsValidShortUID(got), "generated name must be a valid short UID, got %q", got)
	})

	t.Run("returns unique names across calls", func(t *testing.T) {
		t.Parallel()
		a := generic.ShortUIDNameGenerator.GenerateName("")
		b := generic.ShortUIDNameGenerator.GenerateName("")
		require.NotEqual(t, a, b)
	})
}

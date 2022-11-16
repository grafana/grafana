package kindsys

import (
	"sort"
	"testing"

	"cuelang.org/go/cue/cuecontext"
	"github.com/stretchr/testify/require"
)

// This is a brick-dumb test that just ensures slots are being loaded correctly
// from their declarations in .cue files.
//
// If this test fails, it's either because:
// - They're not being loaded correctly - there's a bug in kindsys somewhere, fix it
// - The set of slots names has been modified - update the static list here
func TestSlotsAreLoaded(t *testing.T) {
	slots := []string{"Panel", "Query", "DSOptions"}
	all := AllSlots(cuecontext.New())
	var loadedSlots []string
	for k := range all {
		loadedSlots = append(loadedSlots, k)
	}

	sort.Strings(slots)
	sort.Strings(loadedSlots)

	require.Equal(t, slots, loadedSlots, "slots loaded from cue differs from fixture set - either a bug or fixture needs updating")
}

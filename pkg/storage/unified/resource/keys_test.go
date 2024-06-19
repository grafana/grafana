package resource

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestKeyMatching(t *testing.T) {
	t.Run("key matching", func(t *testing.T) {
		require.True(t, matchesQueryKey(&ResourceKey{
			Group:     "ggg",
			Resource:  "rrr",
			Namespace: "ns",
		}, &ResourceKey{
			Group:     "ggg",
			Resource:  "rrr",
			Namespace: "ns",
		}))
	})
}

package resource

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestKeyConversions(t *testing.T) {
	t.Run("key namespaced path", func(t *testing.T) {
		conv := &simpleConverter{}
		key := &ResourceKey{
			Group:     "ggg",
			Resource:  "rrr",
			Namespace: "ns",
		}
		p, err := conv.KeyToPath(key, 0)
		require.NoError(t, err)
		require.Equal(t, "ggg/rrr/ns", p)

		key.Name = "name"
		p, err = conv.KeyToPath(key, 0)
		require.NoError(t, err)
		require.Equal(t, "ggg/rrr/ns/name", p)
		require.Equal(t, "ggg/rrr", conv.PathPrefix(&ResourceKey{
			Group:    "ggg",
			Resource: "rrr",
		}))
	})
}

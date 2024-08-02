package v0alpha1

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRefs(t *testing.T) {
	v, err := ParseResourceRef("a/b/c")
	require.NoError(t, err)
	require.Equal(t, ResourceRef{
		Group:    "a",
		Resource: "b",
		Name:     "c",
	}, v)

	v, err = ParseResourceRef("a/namespaces/ns/b/c")
	require.NoError(t, err)
	require.Equal(t, ResourceRef{
		Group:     "a",
		Namespace: "ns",
		Resource:  "b",
		Name:      "c",
	}, v)

	_, err = ParseResourceRef("a/b/c/d/e/f")
	require.Error(t, err)

	out, err := json.Marshal(ResourceRef{
		Group:    "a",
		Resource: "b",
		Name:     "c",
	})
	require.NoError(t, err)
	require.Equal(t, `"a/b/c"`, string(out))
}

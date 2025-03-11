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

func TestSearchIDKeys(t *testing.T) {
	tests := []struct {
		input    string
		expected *ResourceKey // nil error
	}{
		{input: "a"}, // error
		{input: "default/group/resource/name",
			expected: &ResourceKey{
				Namespace: "default",
				Group:     "group",
				Resource:  "resource",
				Name:      "name",
			}},
		{input: "/group/resource/",
			expected: &ResourceKey{
				Namespace: "",
				Group:     "group",
				Resource:  "resource",
				Name:      "",
			}},
		{input: "default/group/resource",
			expected: &ResourceKey{
				Namespace: "default",
				Group:     "group",
				Resource:  "resource",
				Name:      "",
			}},
		{input: "**cluster**/group/resource/aaa", // cluster namespace
			expected: &ResourceKey{
				Namespace: "",
				Group:     "group",
				Resource:  "resource",
				Name:      "aaa",
			}},
	}

	for _, test := range tests {
		tmp := &ResourceKey{}
		err := tmp.ReadSearchID(test.input)
		if err == nil {
			require.Equal(t, test.expected, tmp, test.input)
		}
	}
}

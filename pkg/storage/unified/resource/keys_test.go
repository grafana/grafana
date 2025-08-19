package resource

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestKeyMatching(t *testing.T) {
	t.Run("key matching", func(t *testing.T) {
		require.True(t, matchesQueryKey(&resourcepb.ResourceKey{
			Group:     "ggg",
			Resource:  "rrr",
			Namespace: "ns",
		}, &resourcepb.ResourceKey{
			Group:     "ggg",
			Resource:  "rrr",
			Namespace: "ns",
		}))
	})
}

func TestSearchIDKeys(t *testing.T) {
	tests := []struct {
		input    string
		expected *resourcepb.ResourceKey // nil error
	}{
		{input: "a"}, // error
		{input: "default/group/resource/name",
			expected: &resourcepb.ResourceKey{
				Namespace: "default",
				Group:     "group",
				Resource:  "resource",
				Name:      "name",
			}},
		{input: "/group/resource/",
			expected: &resourcepb.ResourceKey{
				Namespace: "",
				Group:     "group",
				Resource:  "resource",
				Name:      "",
			}},
		{input: "default/group/resource",
			expected: &resourcepb.ResourceKey{
				Namespace: "default",
				Group:     "group",
				Resource:  "resource",
				Name:      "",
			}},
		{input: "**cluster**/group/resource/aaa", // cluster namespace
			expected: &resourcepb.ResourceKey{
				Namespace: "",
				Group:     "group",
				Resource:  "resource",
				Name:      "aaa",
			}},
	}

	for _, test := range tests {
		tmp := &resourcepb.ResourceKey{}
		err := ReadSearchID(tmp, test.input)
		if err == nil {
			require.Equal(t, test.expected, tmp, test.input)
		}
	}
}

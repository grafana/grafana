package resource

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStringMapTermsRoundTrip(t *testing.T) {
	cases := map[string]map[string]string{
		"empty":             {},
		"multiple":          {"team": "a", "env": "prod", "severity": "page"},
		"empty value":       {"team": ""},
		"value with equals": {"team": "a=b"},
		"key prefixes key":  {"a": "x", "a=b": "y"},
	}
	for name, values := range cases {
		t.Run(name, func(t *testing.T) {
			got := StringMapFromTerms(StringMapTerms(values))
			if len(values) == 0 {
				assert.Nil(t, got)
				return
			}
			assert.Equal(t, values, got)
		})
	}
}

func TestStringMapTermsAreDeterministic(t *testing.T) {
	assert.Equal(t, []string{"a", "a=first", "z", "z=last"}, StringMapTerms(map[string]string{
		"z": "last",
		"a": "first",
	}))
}

func TestStringMapFromWireValue(t *testing.T) {
	want := map[string]string{"env": "prod"}
	for _, value := range []any{
		[]string{"env", "env=prod"},
		[]any{"env", "env=prod"},
	} {
		got, ok := StringMapFromWireValue(value)
		require.True(t, ok)
		require.Equal(t, want, got)
	}

	empty, ok := StringMapFromWireValue([]any{})
	require.True(t, ok)
	require.Empty(t, empty)
	_, ok = StringMapFromWireValue([]any{"env", 1})
	require.False(t, ok)
}

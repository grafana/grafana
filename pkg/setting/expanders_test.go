package setting

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/stretchr/testify/assert"
)

func TestExpanderRegex(t *testing.T) {
	tests := map[string][][]string{
		// we should not expand variables where there are none
		"smoketest":                          {},
		"Pa$$word{0}":                        {},
		"$_almost{but not quite a variable}": {},
		// args are required
		"$__file{}": {},

		// base cases
		"${ENV}":             {{"", "ENV"}},
		"$__env{ENV}":        {{"__env", "ENV"}},
		"$__file{/dev/null}": {{"__file", "/dev/null"}},
		"$__vault{item}":     {{"__vault", "item"}},
		// contains a space in the argument
		"$__file{C:\\Program Files\\grafana\\something}": {{"__file", "C:\\Program Files\\grafana\\something"}},

		// complex cases
		"get variable from $__env{ENV}ironment":               {{"__env", "ENV"}},
		"$__env{VAR1} $__file{/var/lib/grafana/secrets/var1}": {{"__env", "VAR1"}, {"__file", "/var/lib/grafana/secrets/var1"}},
		"$__env{$__file{this is invalid}}":                    {{"__env", "$__file{this is invalid"}},
	}

	for input, expected := range tests {
		output := regex.FindAllStringSubmatch(input, -1)
		require.Len(t, output, len(expected))
		for i, variable := range output {
			assert.Equal(t, expected[i], variable[1:])
		}
	}
}

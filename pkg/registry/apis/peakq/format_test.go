package peakq

import (
	"testing"

	"github.com/stretchr/testify/require"

	peakq "github.com/grafana/grafana/pkg/apis/peakq/v0alpha1"
)

func TestFormat(t *testing.T) {
	// Invalid input
	require.Equal(t, "", formatVariables(peakq.FormatCSV, nil))
	require.Equal(t, "", formatVariables(peakq.FormatCSV, []string{}))

	type check struct {
		name   string
		input  []string
		output map[peakq.VariableFormat]string
	}

	tests := []check{
		{
			name:  "three simple variables",
			input: []string{"a", "b", "c"},
			output: map[peakq.VariableFormat]string{
				peakq.FormatCSV:         "a,b,c",
				peakq.FormatJSON:        `["a","b","c"]`,
				peakq.FormatDoubleQuote: `"a","b","c"`,
				peakq.FormatSingleQuote: `'a','b','c'`,
				peakq.FormatPipe:        `a|b|c`,
				peakq.FormatRaw:         "a,b,c",
			},
		},
		{
			name:  "single value",
			input: []string{"a"},
			output: map[peakq.VariableFormat]string{
				peakq.FormatCSV:         "a",
				peakq.FormatJSON:        `["a"]`,
				peakq.FormatDoubleQuote: `"a"`,
				peakq.FormatSingleQuote: `'a'`,
				peakq.FormatPipe:        "a",
				peakq.FormatRaw:         "a",
			},
		},
		{
			name:  "value with quote",
			input: []string{`hello "world"`},
			output: map[peakq.VariableFormat]string{
				peakq.FormatCSV:         `"hello ""world"""`, // note the double quotes
				peakq.FormatJSON:        `["hello \"world\""]`,
				peakq.FormatDoubleQuote: `"hello \"world\""`,
				peakq.FormatSingleQuote: `'hello "world"'`,
				peakq.FormatPipe:        `hello "world"`,
				peakq.FormatRaw:         `hello "world"`,
			},
		},
	}
	for _, test := range tests {
		// Make sure all keys are set in tests
		all := map[peakq.VariableFormat]bool{
			peakq.FormatRaw:         true,
			peakq.FormatCSV:         true,
			peakq.FormatJSON:        true,
			peakq.FormatDoubleQuote: true,
			peakq.FormatSingleQuote: true,
			peakq.FormatPipe:        true,
		}

		// Check the default (no format) matches CSV
		require.Equal(t, test.output[peakq.FormatRaw],
			formatVariables("", test.input),
			"test %s default values are not raw", test.name)

		// Check each input value
		for format, v := range test.output {
			require.Equal(t, v, formatVariables(format, test.input), "Test: %s (format:%s)", test.name, format)
			delete(all, format)
		}
		require.Empty(t, all, "test %s is missing cases for: %v", test.name, all)
	}
}

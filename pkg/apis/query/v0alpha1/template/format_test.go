package template

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFormat(t *testing.T) {
	// Invalid input
	require.Equal(t, "", FormatVariables(FormatCSV, nil))
	require.Equal(t, "", FormatVariables(FormatCSV, []string{}))

	type check struct {
		name   string
		input  []string
		output map[VariableFormat]string
	}

	tests := []check{
		{
			name:  "three simple variables",
			input: []string{"a", "b", "c"},
			output: map[VariableFormat]string{
				FormatCSV:         "a,b,c",
				FormatJSON:        `["a","b","c"]`,
				FormatDoubleQuote: `"a","b","c"`,
				FormatSingleQuote: `'a','b','c'`,
				FormatPipe:        `a|b|c`,
				FormatRaw:         "a,b,c",
			},
		},
		{
			name:  "single value",
			input: []string{"a"},
			output: map[VariableFormat]string{
				FormatCSV:         "a",
				FormatJSON:        `["a"]`,
				FormatDoubleQuote: `"a"`,
				FormatSingleQuote: `'a'`,
				FormatPipe:        "a",
				FormatRaw:         "a",
			},
		},
		{
			name:  "value with quote",
			input: []string{`hello "world"`},
			output: map[VariableFormat]string{
				FormatCSV:         `"hello ""world"""`, // note the double quotes
				FormatJSON:        `["hello \"world\""]`,
				FormatDoubleQuote: `"hello \"world\""`,
				FormatSingleQuote: `'hello "world"'`,
				FormatPipe:        `hello "world"`,
				FormatRaw:         `hello "world"`,
			},
		},
	}
	for _, test := range tests {
		// Make sure all keys are set in tests
		all := map[VariableFormat]bool{
			FormatRaw:         true,
			FormatCSV:         true,
			FormatJSON:        true,
			FormatDoubleQuote: true,
			FormatSingleQuote: true,
			FormatPipe:        true,
		}

		// Check the default (no format) matches CSV
		require.Equal(t, test.output[FormatRaw],
			FormatVariables("", test.input),
			"test %s default values are not raw", test.name)

		// Check each input value
		for format, v := range test.output {
			require.Equal(t, v, FormatVariables(format, test.input), "Test: %s (format:%s)", test.name, format)
			delete(all, format)
		}
		require.Empty(t, all, "test %s is missing cases for: %v", test.name, all)
	}
}

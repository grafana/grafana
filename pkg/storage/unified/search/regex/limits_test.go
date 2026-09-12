package regex

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestExpansionBudget(t *testing.T) {
	for _, tc := range []struct {
		name         string
		initialMatch bool
		nextMatch    bool
		kind         LimitKind
		message      string
	}{
		{"scan limit", false, false, DictionaryLimit, `regular expression on field "labels" exceeds the 10000-term dictionary scan limit`},
		{"matching term exceeds scan limit", false, true, DictionaryLimit, `regular expression on field "labels" exceeds the 10000-term dictionary scan limit`},
		{"expansion takes precedence", true, true, ExpansionLimit, `regular expression on field "labels" exceeds the 10000-term expansion limit`},
		{"nonmatching term after full expansion", true, false, DictionaryLimit, `regular expression on field "labels" exceeds the 10000-term dictionary scan limit`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			budget := ExpansionBudget{Field: "labels"}
			for range 10_000 {
				require.NoError(t, budget.Observe(tc.initialMatch))
			}
			err := budget.Observe(tc.nextMatch)
			var limitErr *LimitError
			require.ErrorAs(t, err, &limitErr)
			assert.Equal(t, tc.kind, limitErr.Kind)
			assert.EqualError(t, err, tc.message)
		})
	}
}

package mathexp

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// Function calls nested in binary operations must be validated at parse time,
// the same way they are when they stand alone. Otherwise they fail during
// execution with a reflect panic.
func TestNewChecksFuncArgsInsideBinaryNodes(t *testing.T) {
	tests := []struct {
		name string
		expr string
		err  string
	}{
		{name: "too few args on left", expr: "log() + 1", err: "not enough arguments for log"},
		{name: "too few args on right", expr: "1 + log()", err: "not enough arguments for log"},
		{name: "too few args under unary", expr: "-(log() + 1)", err: "not enough arguments for log"},
		{name: "too few args in comparison", expr: "is_null() > 1", err: "not enough arguments for is_null"},
		{name: "wrong arg type", expr: `abs("x") + 1`, err: "expected numberSet or seriesSet for argument 0"},
		{name: "deeply nested", expr: "1 + 2 * (3 - round())", err: "not enough arguments for round"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := New(tt.expr)
			require.ErrorContains(t, err, tt.err)
		})
	}
}

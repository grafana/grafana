package classic

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/grafana/grafana/pkg/util"
)

func TestThresholdEvaluator(t *testing.T) {
	var tests = []struct {
		name        string
		evaluator   evaluator
		inputNumber mathexp.Number
		expected    bool
	}{
		{
			name:        "value 3 is gt 1: true",
			evaluator:   &thresholdEvaluator{"gt", 1},
			inputNumber: newNumber(util.Pointer(3.0)),
			expected:    true,
		},
		{
			name:        "value 1 is gt 3: false",
			evaluator:   &thresholdEvaluator{"gt", 3},
			inputNumber: newNumber(util.Pointer(1.0)),
			expected:    false,
		},
		{
			name:        "value 3 is lt 1: true",
			evaluator:   &thresholdEvaluator{"lt", 1},
			inputNumber: newNumber(util.Pointer(3.0)),
			expected:    false,
		},
		{
			name:        "value 1 is lt 3: false",
			evaluator:   &thresholdEvaluator{"lt", 3},
			inputNumber: newNumber(util.Pointer(1.0)),
			expected:    true,
		},
		{
			name:        "value 1 is eq 1: false",
			evaluator:   &thresholdEvaluator{"eq", 1},
			inputNumber: newNumber(util.Pointer(1.0)),
			expected:    true,
		},
		{
			name:        "value 0 is eq 0: false",
			evaluator:   &thresholdEvaluator{"eq", 0},
			inputNumber: newNumber(util.Pointer(0.0)),
			expected:    true,
		},
		{
			name:        "value 1 is eq 0: false",
			evaluator:   &thresholdEvaluator{"eq", 0},
			inputNumber: newNumber(util.Pointer(1.0)),
			expected:    false,
		},
		{
			name:        "value 0 is eq 1: false",
			evaluator:   &thresholdEvaluator{"eq", 1},
			inputNumber: newNumber(util.Pointer(0.0)),
			expected:    false,
		},
		{
			name:        "value 1 is ne 1: false",
			evaluator:   &thresholdEvaluator{"ne", 1},
			inputNumber: newNumber(util.Pointer(1.0)),
			expected:    false,
		},
		{
			name:        "value 3 is gte 3: false",
			evaluator:   &thresholdEvaluator{"gte", 3},
			inputNumber: newNumber(util.Pointer(3.0)),
			expected:    true,
		},
		{
			name:        "value 5 is lte 4: false",
			evaluator:   &thresholdEvaluator{"lte", 4},
			inputNumber: newNumber(util.Pointer(5.0)),
			expected:    false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := tt.evaluator.Eval(tt.inputNumber)
			require.Equal(t, tt.expected, b)
		})
	}
}

func TestRangedEvaluator(t *testing.T) {
	var tests = []struct {
		name        string
		evaluator   evaluator
		inputNumber mathexp.Number
		expected    bool
	}{
		// within
		{
			name:        "value 3 is within range 1, 100: true",
			evaluator:   &rangedEvaluator{"within_range", 1, 100},
			inputNumber: newNumber(util.Pointer(3.0)),
			expected:    true,
		},
		{
			name:        "value 300 is within range 1, 100: false",
			evaluator:   &rangedEvaluator{"within_range", 1, 100},
			inputNumber: newNumber(util.Pointer(300.0)),
			expected:    false,
		},
		{
			name:        "value 3 is within range 100, 1: true",
			evaluator:   &rangedEvaluator{"within_range", 100, 1},
			inputNumber: newNumber(util.Pointer(3.0)),
			expected:    true,
		},
		{
			name:        "value 300 is within range 100, 1: false",
			evaluator:   &rangedEvaluator{"within_range", 100, 1},
			inputNumber: newNumber(util.Pointer(300.0)),
			expected:    false,
		},
		// outside
		{
			name:        "value 1000 is outside range 1, 100: true",
			evaluator:   &rangedEvaluator{"outside_range", 1, 100},
			inputNumber: newNumber(util.Pointer(1000.0)),
			expected:    true,
		},
		{
			name:        "value 50 is outside range 1, 100: false",
			evaluator:   &rangedEvaluator{"outside_range", 1, 100},
			inputNumber: newNumber(util.Pointer(50.0)),
			expected:    false,
		},
		{
			name:        "value 1000 is outside range 100, 1: true",
			evaluator:   &rangedEvaluator{"outside_range", 100, 1},
			inputNumber: newNumber(util.Pointer(1000.0)),
			expected:    true,
		},
		{
			name:        "value 50 is outside range 100, 1: false",
			evaluator:   &rangedEvaluator{"outside_range", 100, 1},
			inputNumber: newNumber(util.Pointer(50.0)),
			expected:    false,
		},
		{
			name:        "value 100 is outside range 1, 100: false",
			evaluator:   &rangedEvaluator{"outside_range", 1, 100},
			inputNumber: newNumber(util.Pointer(100.)),
			expected:    false,
		},
		{
			name:        "value 1 is outside range 1, 100: false",
			evaluator:   &rangedEvaluator{"outside_range", 1, 100},
			inputNumber: newNumber(util.Pointer(1.)),
			expected:    false,
		},
		{
			name:        "value 100 is within range included 1, 100: true",
			evaluator:   &rangedEvaluator{"within_range_included", 1, 100},
			inputNumber: newNumber(util.Pointer(100.)),
			expected:    true,
		},
		{
			name:        "value 1 is within range included 1, 100: true",
			evaluator:   &rangedEvaluator{"within_range_included", 1, 100},
			inputNumber: newNumber(util.Pointer(1.)),
			expected:    true,
		},
		{
			name:        "value 100 is outside range included 1, 100: true",
			evaluator:   &rangedEvaluator{"outside_range_included", 1, 100},
			inputNumber: newNumber(util.Pointer(100.)),
			expected:    true,
		},
		{
			name:        "value 1 is outside range included 1, 100: true",
			evaluator:   &rangedEvaluator{"outside_range_included", 1, 100},
			inputNumber: newNumber(util.Pointer(1.)),
			expected:    true,
		},
		{
			name:        "unknown evaluator type returns false",
			evaluator:   &rangedEvaluator{"", 1, 100},
			inputNumber: newNumber(util.Pointer(1.)),
			expected:    false,
		},
		{
			name:        "nil number conversion returns false",
			evaluator:   &rangedEvaluator{"", 1, 100},
			inputNumber: newNumber(nil),
			expected:    false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := tt.evaluator.Eval(tt.inputNumber)
			require.Equal(t, tt.expected, b)
		})
	}
}

func TestNoValueEvaluator(t *testing.T) {
	var tests = []struct {
		name        string
		evaluator   evaluator
		inputNumber mathexp.Number
		expected    bool
	}{
		{
			name:        "value 50 is no_value: false",
			evaluator:   &noValueEvaluator{},
			inputNumber: newNumber(util.Pointer(50.0)),
			expected:    false,
		},
		{
			name:        "value nil is no_value: true",
			evaluator:   &noValueEvaluator{},
			inputNumber: newNumber(nil),
			expected:    true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b := tt.evaluator.Eval(tt.inputNumber)
			require.Equal(t, tt.expected, b)
		})
	}
}

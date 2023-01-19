package classic

import (
	"testing"

	"github.com/grafana/grafana/pkg/expr/mathexp"
	"github.com/stretchr/testify/require"
	ptr "github.com/xorcare/pointer"
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
			inputNumber: newNumber(ptr.Float64(3)),
			expected:    true,
		},
		{
			name:        "value 1 is gt 3: false",
			evaluator:   &thresholdEvaluator{"gt", 3},
			inputNumber: newNumber(ptr.Float64(1)),
			expected:    false,
		},
		{
			name:        "value 3 is lt 1: true",
			evaluator:   &thresholdEvaluator{"lt", 1},
			inputNumber: newNumber(ptr.Float64(3)),
			expected:    false,
		},
		{
			name:        "value 1 is lt 3: false",
			evaluator:   &thresholdEvaluator{"lt", 3},
			inputNumber: newNumber(ptr.Float64(1)),
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
			inputNumber: newNumber(ptr.Float64(3)),
			expected:    true,
		},
		{
			name:        "value 300 is within range 1, 100: false",
			evaluator:   &rangedEvaluator{"within_range", 1, 100},
			inputNumber: newNumber(ptr.Float64(300)),
			expected:    false,
		},
		{
			name:        "value 3 is within range 100, 1: true",
			evaluator:   &rangedEvaluator{"within_range", 100, 1},
			inputNumber: newNumber(ptr.Float64(3)),
			expected:    true,
		},
		{
			name:        "value 300 is within range 100, 1: false",
			evaluator:   &rangedEvaluator{"within_range", 100, 1},
			inputNumber: newNumber(ptr.Float64(300)),
			expected:    false,
		},
		// outside
		{
			name:        "value 1000 is outside range 1, 100: true",
			evaluator:   &rangedEvaluator{"outside_range", 1, 100},
			inputNumber: newNumber(ptr.Float64(1000)),
			expected:    true,
		},
		{
			name:        "value 50 is outside range 1, 100: false",
			evaluator:   &rangedEvaluator{"outside_range", 1, 100},
			inputNumber: newNumber(ptr.Float64(50)),
			expected:    false,
		},
		{
			name:        "value 1000 is outside range 100, 1: true",
			evaluator:   &rangedEvaluator{"outside_range", 100, 1},
			inputNumber: newNumber(ptr.Float64(1000)),
			expected:    true,
		},
		{
			name:        "value 50 is outside range 100, 1: false",
			evaluator:   &rangedEvaluator{"outside_range", 100, 1},
			inputNumber: newNumber(ptr.Float64(50)),
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
			inputNumber: newNumber(ptr.Float64(50)),
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

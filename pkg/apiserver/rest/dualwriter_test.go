package rest

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestCompare(t *testing.T) {
	testCase := []struct {
		name     string
		input    runtime.Object
		expected bool
	}{
		{
			name:     "should return true when both objects are the same",
			input:    exampleObj,
			expected: true,
		},
		{
			name:  "should return false when objects are different",
			input: anotherObj,
		},
	}
	for _, tt := range testCase {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, Compare(tt.input, exampleObj))
		})
	}
}

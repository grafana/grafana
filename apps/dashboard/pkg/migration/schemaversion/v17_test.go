package schemaversion

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestV17(t *testing.T) {
	tests := []struct {
		name           string
		input          map[string]interface{}
		expectedOutput map[string]interface{}
	}{
		{
			name: "panels with minSpan should be converted to maxPerRow",
			input: map[string]interface{}{
				"schemaVersion": 16,
				"panels": []interface{}{
					map[string]interface{}{
						"id":      1,
						"minSpan": 6,
						"type":    "graph",
					},
					map[string]interface{}{
						"id":      2,
						"minSpan": 4,
						"type":    "graph",
					},
				},
			},
			expectedOutput: map[string]interface{}{
				"schemaVersion": 17,
				"panels": []interface{}{
					map[string]interface{}{
						"id":        1,
						"maxPerRow": 4,
						"type":      "graph",
					},
					map[string]interface{}{
						"id":        2,
						"maxPerRow": 6,
						"type":      "graph",
					},
				},
			},
		},
		{
			name: "panels without minSpan should not be changed",
			input: map[string]interface{}{
				"schemaVersion": 16,
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "graph",
					},
				},
			},
			expectedOutput: map[string]interface{}{
				"schemaVersion": 17,
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "graph",
					},
				},
			},
		},
		{
			name: "minSpan of 12 should result in maxPerRow of 2",
			input: map[string]interface{}{
				"schemaVersion": 16,
				"panels": []interface{}{
					map[string]interface{}{
						"id":      1,
						"minSpan": 12,
						"type":    "graph",
					},
				},
			},
			expectedOutput: map[string]interface{}{
				"schemaVersion": 17,
				"panels": []interface{}{
					map[string]interface{}{
						"id":        1,
						"maxPerRow": 2,
						"type":      "graph",
					},
				},
			},
		},
		{
			name: "minSpan of 8 should result in maxPerRow of 3",
			input: map[string]interface{}{
				"schemaVersion": 16,
				"panels": []interface{}{
					map[string]interface{}{
						"id":      1,
						"minSpan": 8,
						"type":    "graph",
					},
				},
			},
			expectedOutput: map[string]interface{}{
				"schemaVersion": 17,
				"panels": []interface{}{
					map[string]interface{}{
						"id":        1,
						"maxPerRow": 3,
						"type":      "graph",
					},
				},
			},
		},
		{
			name: "minSpan of 2 should result in maxPerRow of 12",
			input: map[string]interface{}{
				"schemaVersion": 16,
				"panels": []interface{}{
					map[string]interface{}{
						"id":      1,
						"minSpan": 2,
						"type":    "graph",
					},
				},
			},
			expectedOutput: map[string]interface{}{
				"schemaVersion": 17,
				"panels": []interface{}{
					map[string]interface{}{
						"id":        1,
						"maxPerRow": 12,
						"type":      "graph",
					},
				},
			},
		},
		{
			name: "minSpan as float64 should work",
			input: map[string]interface{}{
				"schemaVersion": 16,
				"panels": []interface{}{
					map[string]interface{}{
						"id":      1,
						"minSpan": 6.0,
						"type":    "graph",
					},
				},
			},
			expectedOutput: map[string]interface{}{
				"schemaVersion": 17,
				"panels": []interface{}{
					map[string]interface{}{
						"id":        1,
						"maxPerRow": 4,
						"type":      "graph",
					},
				},
			},
		},
		{
			name: "dashboard without panels should not error",
			input: map[string]interface{}{
				"schemaVersion": 16,
			},
			expectedOutput: map[string]interface{}{
				"schemaVersion": 17,
			},
		},
		{
			name: "empty panels array should not error",
			input: map[string]interface{}{
				"schemaVersion": 16,
				"panels":        []interface{}{},
			},
			expectedOutput: map[string]interface{}{
				"schemaVersion": 17,
				"panels":        []interface{}{},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := V17(tt.input)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedOutput, tt.input)
		})
	}
}

func TestGetFactors(t *testing.T) {
	tests := []struct {
		input    int
		expected []int
	}{
		{
			input:    24,
			expected: []int{1, 2, 3, 4, 6, 8, 12, 24},
		},
		{
			input:    12,
			expected: []int{1, 2, 3, 4, 6, 12},
		},
		{
			input:    1,
			expected: []int{1},
		},
	}

	for _, tt := range tests {
		t.Run("factors", func(t *testing.T) {
			result := getFactors(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

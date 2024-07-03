package slicesext

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestChunks(t *testing.T) {
	t.Parallel()

	t.Run("chunkSize must be greater than 0", func(t *testing.T) {
		t.Parallel()

		assert.PanicsWithValue(t, "chunk size must be greater than or equal to 0", func() {
			Chunks(-1, []string{})
		})
	})

	t.Run("basic", func(t *testing.T) {
		t.Parallel()

		cases := []struct {
			description string
			chunkSize   int
			input       []int
			expected    [][]int
		}{
			{
				description: "empty slice",
				chunkSize:   2,
				input:       []int{},
				expected:    [][]int{},
			},
			{
				description: "nil slice",
				chunkSize:   2,
				input:       nil,
				expected:    [][]int{},
			},
			{
				description: "chunk size is 0",
				chunkSize:   0,
				input:       []int{1, 2, 3},
				expected:    [][]int{},
			},
			{
				description: "chunk size is greater than slice length",
				chunkSize:   3,
				input:       []int{1},
				expected:    [][]int{{1}},
			},
			{
				description: "chunk size is 1",
				chunkSize:   1,
				input:       []int{1, 2, 3},
				expected:    [][]int{{1}, {2}, {3}},
			},
			{
				description: "chunk size is 2 and slice length is 3",
				chunkSize:   2,
				input:       []int{1, 2, 3},
				expected:    [][]int{{1, 2}, {3}},
			},
			{
				description: "chunk size is 2 and slice length is 6",
				chunkSize:   2,
				input:       []int{1, 2, 3, 4, 5, 6},
				expected:    [][]int{{1, 2}, {3, 4}, {5, 6}},
			},
		}

		for _, tt := range cases {
			t.Run(tt.description, func(t *testing.T) {
				result := Chunks(tt.chunkSize, tt.input)
				assert.Equal(t, tt.expected, result)
			})
		}
	})
}

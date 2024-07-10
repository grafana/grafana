package slicesext

import "math"

// Partitions the input into slices where the length is <= chunkSize.
//
// Example:
//
// Chunks(2, []int{1, 2, 3, 4})
// => [][]int{{1, 2}, {3, 4}}
func Chunks[T any](chunkSize int, xs []T) [][]T {
	if chunkSize < 0 {
		panic("chunk size must be greater than or equal to 0")
	}
	if chunkSize == 0 {
		return [][]T{}
	}

	out := make([][]T, 0, int(math.Ceil(float64(len(xs))/float64(chunkSize))))

	for i := 0; i < len(xs); i += chunkSize {
		var chunk []T
		if i+chunkSize < len(xs) {
			chunk = xs[i : i+chunkSize]
		} else {
			chunk = xs[i:]
		}

		out = append(out, chunk)
	}

	return out
}

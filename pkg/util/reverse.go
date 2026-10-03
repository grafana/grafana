package util

import "slices"

// Reverse returns a new slice with reversed order
func Reverse[T comparable](input []T) []T {
	output := make([]T, 0, len(input))
	for _, i := range slices.Backward(input) {
		output = append(output, i)
	}
	return output
}

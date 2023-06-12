package util

// Reverse returns a new slice with reversed order
func Reverse[T comparable](input []T) []T {
	output := make([]T, 0, len(input))
	for i := len(input) - 1; i >= 0; i-- {
		output = append(output, input[i])
	}
	return output
}

package util

// Prepend returns a new slice with the new items at the beginning
func Prepend[T comparable](input []T, items ...T) []T {
	input = append(input, items...)
	copy(input[len(items):], input)
	for i, item := range items {
		input[i] = item
	}
	return input
}

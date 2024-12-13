package reststorage

import (
	"fmt"
	"maps"
	"slices"
	"testing"

	"github.com/stretchr/testify/assert"
	"pgregory.net/rapid"
)

func TestCleanAnnotations(t *testing.T) {
	t.Parallel()

	rapid.Check(t, func(t *rapid.T) {
		// A random map from string -> string
		input := rapid.MapOf(
			rapid.Custom(func(t *rapid.T) string {
				return fmt.Sprint(rapid.Uint16().Draw(t, "input key"))
			}),
			rapid.Custom(func(t *rapid.T) string {
				return fmt.Sprint(rapid.Uint16().Draw(t, "input value"))
			})).
			Draw(t, "input")

		// Ensure the keys in `skipAnnotations`` are not int `input`
		maps.DeleteFunc(input, func(k, _ string) bool {
			return skipAnnotations[k]
		})

		inputWithAnnotations := maps.Clone(input)

		// Generate a slice that may have 0 or more annotations from skipAnnotations
		annotationsToSkip := rapid.SliceOfDistinct(rapid.SampledFrom(slices.Collect(maps.Keys(skipAnnotations))), func(v string) string { return v }).Draw(t, "annotations")

		// Add the annotations to the input. Note that `annotationsToSkip` may be empty
		for i, k := range annotationsToSkip {
			inputWithAnnotations[k] = fmt.Sprintf("%d-%s", i, k)
		}

		// Ensure the cleaned input is equal to the original input without annotations.
		assert.Equal(t, input, cleanAnnotations(inputWithAnnotations))
	})
}

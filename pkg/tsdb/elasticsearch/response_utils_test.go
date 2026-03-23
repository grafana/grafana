package elasticsearch

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUnwrapFieldValue(t *testing.T) {
	t.Run("Should unwrap single-element array to scalar", func(t *testing.T) {
		result := unwrapFieldValue([]interface{}{"hello"})
		require.Equal(t, "hello", result)
	})

	t.Run("Should unwrap single-element numeric array", func(t *testing.T) {
		result := unwrapFieldValue([]interface{}{42.0})
		require.Equal(t, 42.0, result)
	})

	t.Run("Should not unwrap multi-element array", func(t *testing.T) {
		input := []interface{}{"a", "b"}
		result := unwrapFieldValue(input)
		require.Equal(t, input, result)
	})

	t.Run("Should not unwrap empty array", func(t *testing.T) {
		input := []interface{}{}
		result := unwrapFieldValue(input)
		require.Equal(t, input, result)
	})

	t.Run("Should return scalar values unchanged", func(t *testing.T) {
		require.Equal(t, "hello", unwrapFieldValue("hello"))
		require.Equal(t, 42.0, unwrapFieldValue(42.0))
		require.Equal(t, true, unwrapFieldValue(true))
		require.Nil(t, unwrapFieldValue(nil))
	})
}

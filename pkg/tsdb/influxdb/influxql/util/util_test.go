package util

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseString(t *testing.T) {
	t.Run("parse bool value to string", func(t *testing.T) {
		val := true
		expected := ToPtr("true")
		result := ParseString(val)
		require.Equal(t, expected, result)
	})

	t.Run("parse number value to string", func(t *testing.T) {
		val := 123
		expected := ToPtr("123")
		result := ParseString(val)
		require.Equal(t, expected, result)
	})
}

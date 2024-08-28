package resource

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNameValidation(t *testing.T) {
	require.NotNil(t, validateName("")) // too short
	require.NotNil(t, validateName(     // too long (max 64)
		"0123456789012345678901234567890123456789012345678901234567890123456789",
	))

	// OK
	require.Nil(t, validateName("a"))
	require.Nil(t, validateName("hello-world"))
	require.Nil(t, validateName("hello.world"))
	require.Nil(t, validateName("hello_world"))

	// Bad characters
	require.NotNil(t, validateName("hello world"))
	require.NotNil(t, validateName("hello!"))
	require.NotNil(t, validateName("hello~"))
	require.NotNil(t, validateName("hello "))
	require.NotNil(t, validateName("hello*"))
	require.NotNil(t, validateName("hello+"))
	require.NotNil(t, validateName("hello="))
	require.NotNil(t, validateName("hello%"))
}

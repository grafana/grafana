package resource

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNameValidation(t *testing.T) {
	require.Error(t, validateName("")) // too short
	require.Error(t, validateName(     // too long (max 64)
		"0123456789012345678901234567890123456789012345678901234567890123456789",
	))

	// OK
	require.NoError(t, validateName("hello-world"))
	require.NoError(t, validateName("hello.world"))
	require.NoError(t, validateName("hello_world"))

	// Bad characters
	require.Error(t, validateName("hello world"))
	require.Error(t, validateName("hello!"))
	require.Error(t, validateName("hello~"))
	require.Error(t, validateName("hello "))
	require.Error(t, validateName("hello*"))
	require.Error(t, validateName("hello+"))
	require.Error(t, validateName("hello="))
	require.Error(t, validateName("hello%"))
}

package resource

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNameValidation(t *testing.T) {
	require.NotNil(t, validateName(""))                       // too short
	require.NotNil(t, validateName(strings.Repeat("0", 254))) // too long (max 253)

	// OK
	require.Nil(t, validateName("a"))
	require.Nil(t, validateName("hello-world"))
	require.Nil(t, validateName("hello.world"))
	require.Nil(t, validateName("hello_world"))
	require.Nil(t, validateName("hello:world"))

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

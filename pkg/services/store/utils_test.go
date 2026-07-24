package store

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUtils(t *testing.T) {
	a, b := splitFirstSegment("")
	require.Equal(t, "", a)
	require.Equal(t, "", b)

	a, b = splitFirstSegment("hello")
	require.Equal(t, "hello", a)
	require.Equal(t, "", b)

	a, b = splitFirstSegment("hello/world")
	require.Equal(t, "hello", a)
	require.Equal(t, "world", b)

	a, b = splitFirstSegment("/hello/world") // strip leading slash
	require.Equal(t, "hello", a)
	require.Equal(t, "world", b)
}

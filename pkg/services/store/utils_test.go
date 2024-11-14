package store

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUtils(t *testing.T) {
	require.Equal(t, "name", GuessNameFromUID("hello/name.xyz"))
	require.Equal(t, "name", GuessNameFromUID("name.xyz"))
	require.Equal(t, "name", GuessNameFromUID("name"))
	require.Equal(t, "name", GuessNameFromUID("name."))
	require.Equal(t, "name", GuessNameFromUID("/name."))

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

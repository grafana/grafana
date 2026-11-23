package optional

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNonZero(t *testing.T) {
	require.Nil(t, NonZero(""))
	require.Nil(t, NonZero(int64(0)))
	require.Nil(t, NonZero(false))
	require.Equal(t, "a", *NonZero("a"))
	require.Equal(t, int64(-1), *NonZero(int64(-1)))
	require.True(t, *NonZero(true))
}

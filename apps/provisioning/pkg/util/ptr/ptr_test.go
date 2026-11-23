package ptr

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

func TestDeref(t *testing.T) {
	require.Equal(t, "", Deref[string](nil))
	require.Equal(t, 0.0, Deref[float64](nil))
	v := "a"
	require.Equal(t, "a", Deref(&v))
}

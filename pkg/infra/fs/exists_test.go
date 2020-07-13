package fs

import (
	"io/ioutil"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestExists_NonExistent(t *testing.T) {
	exists, err := Exists("non-existent")
	require.NoError(t, err)

	require.False(t, exists)
}

func TestExists_Existent(t *testing.T) {
	f, err := ioutil.TempFile("", "")
	require.NoError(t, err)
	defer os.Remove(f.Name())

	exists, err := Exists(f.Name())
	require.NoError(t, err)

	require.True(t, exists)
}

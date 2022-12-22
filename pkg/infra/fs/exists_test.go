package fs

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestExists_NonExistent(t *testing.T) {
	exists, err := Exists("non-existent")
	require.NoError(t, err)

	require.False(t, exists)
}

func TestExists_Existent(t *testing.T) {
	f, err := os.CreateTemp("", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		err := os.Remove(f.Name())
		assert.NoError(t, err)
	})

	exists, err := Exists(f.Name())
	require.NoError(t, err)

	require.True(t, exists)
}

func TestExists_Dir(t *testing.T) {
	f := t.TempDir()

	exists, err := Exists(f)

	require.NoError(t, err)
	require.True(t, exists)
}

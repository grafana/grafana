package fsutil_test

import (
	"io/ioutil"
	"os"
	"testing"

	"github.com/grafana/grafana/pkg/build/fsutil"
	"github.com/stretchr/testify/require"
)

func TestExists_NonExistent(t *testing.T) {
	exists, err := fsutil.Exists("non-existent")
	require.NoError(t, err)

	require.False(t, exists)
}

func TestExists_Existent(t *testing.T) {
	f, err := ioutil.TempFile("", "")
	require.NoError(t, err)
	defer os.Remove(f.Name())

	exists, err := fsutil.Exists(f.Name())
	require.NoError(t, err)

	require.True(t, exists)
}

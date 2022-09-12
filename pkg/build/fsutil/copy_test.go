package fsutil_test

import (
	"io/ioutil"
	"os"
	"runtime"
	"testing"

	"github.com/grafana/grafana/pkg/build/fsutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCopyFile(t *testing.T) {
	src, err := ioutil.TempFile("", "")
	require.NoError(t, err)
	defer os.RemoveAll(src.Name())
	err = ioutil.WriteFile(src.Name(), []byte("Contents"), 0600)
	require.NoError(t, err)

	dst, err := ioutil.TempFile("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dst.Name())

	err = fsutil.CopyFile(src.Name(), dst.Name())
	require.NoError(t, err)
}

func TestCopyFile_Permissions(t *testing.T) {
	perms := os.FileMode(0700)
	if runtime.GOOS == "windows" {
		// Windows doesn't have file Unix style file permissions
		// It seems you have either 0444 for read-only or 0666 for read-write
		perms = os.FileMode(0666)
	}

	src, err := ioutil.TempFile("", "")
	require.NoError(t, err)
	defer os.RemoveAll(src.Name())
	err = ioutil.WriteFile(src.Name(), []byte("Contents"), perms)
	require.NoError(t, err)
	err = os.Chmod(src.Name(), perms)
	require.NoError(t, err)

	dst, err := ioutil.TempFile("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dst.Name())

	err = fsutil.CopyFile(src.Name(), dst.Name())
	require.NoError(t, err)

	fi, err := os.Stat(dst.Name())
	require.NoError(t, err)
	assert.Equal(t, perms, fi.Mode()&os.ModePerm)
}

// Test case where destination directory doesn't exist.
func TestCopyFile_NonExistentDestDir(t *testing.T) {
	src, err := ioutil.TempFile("", "")
	require.NoError(t, err)
	defer os.RemoveAll(src.Name())

	err = fsutil.CopyFile(src.Name(), "non-existent/dest")
	require.EqualError(t, err, "destination directory doesn't exist: \"non-existent\"")
}

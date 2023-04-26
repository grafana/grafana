package fsutil_test

import (
	"os"
	"runtime"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/build/fsutil"
)

func TestCopyFile(t *testing.T) {
	src, err := os.CreateTemp("", "")
	require.NoError(t, err)
	defer func() {
		if err := os.RemoveAll(src.Name()); err != nil {
			t.Log(err)
		}
	}()

	err = os.WriteFile(src.Name(), []byte("Contents"), 0600)
	require.NoError(t, err)

	dst, err := os.CreateTemp("", "")
	require.NoError(t, err)
	defer func() {
		if err := os.RemoveAll(dst.Name()); err != nil {
			t.Log(err)
		}
	}()

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

	src, err := os.CreateTemp("", "")
	require.NoError(t, err)

	defer func() {
		if err := os.RemoveAll(src.Name()); err != nil {
			t.Log(err)
		}
	}()

	err = os.WriteFile(src.Name(), []byte("Contents"), perms)
	require.NoError(t, err)
	err = os.Chmod(src.Name(), perms)
	require.NoError(t, err)

	dst, err := os.CreateTemp("", "")
	require.NoError(t, err)
	defer func() {
		if err := os.RemoveAll(dst.Name()); err != nil {
			t.Log(err)
		}
	}()

	err = fsutil.CopyFile(src.Name(), dst.Name())
	require.NoError(t, err)

	fi, err := os.Stat(dst.Name())
	require.NoError(t, err)
	assert.Equal(t, perms, fi.Mode()&os.ModePerm)
}

// Test case where destination directory doesn't exist.
func TestCopyFile_NonExistentDestDir(t *testing.T) {
	src, err := os.CreateTemp("", "")
	require.NoError(t, err)
	defer func() {
		if err := os.RemoveAll(src.Name()); err != nil {
			t.Log(err)
		}
	}()

	err = fsutil.CopyFile(src.Name(), "non-existent/dest")
	require.EqualError(t, err, "destination directory doesn't exist: \"non-existent\"")
}

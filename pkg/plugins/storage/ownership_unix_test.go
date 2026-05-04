//go:build !windows

package storage

import (
	"errors"
	"os"
	"path/filepath"
	"syscall"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMatchOwnershipToParent(t *testing.T) {
	t.Run("Parent dir does not exist", func(t *testing.T) {
		childDir := t.TempDir()
		err := matchOwnershipToParent(childDir, filepath.Join(childDir, "no-such-parent"))
		require.ErrorIs(t, err, os.ErrNotExist)
	})

	t.Run("Child directory does not exist", func(t *testing.T) {
		parent := t.TempDir()
		nonExistentChild := filepath.Join(parent, "does-not-exist")
		err := matchOwnershipToParent(nonExistentChild, parent)
		require.ErrorIs(t, err, os.ErrNotExist)
	})

	t.Run("Should call chown for all files and directories", func(t *testing.T) {
		parent := t.TempDir()
		parentUID, parentGID := getOwnership(t, parent)

		// Create test structure
		child := filepath.Join(parent, "child")
		err := os.MkdirAll(child, 0o750)
		require.NoError(t, err)

		nestedDir := filepath.Join(child, "nested")
		err = os.MkdirAll(nestedDir, 0o750)
		require.NoError(t, err)

		file1 := filepath.Join(child, "file1.txt")
		err = os.WriteFile(file1, []byte("test"), 0o644)
		require.NoError(t, err)

		file2 := filepath.Join(nestedDir, "file2.txt")
		err = os.WriteFile(file2, []byte("test"), 0o644)
		require.NoError(t, err)

		mock := &mockChowner{}
		err = matchOwnershipToParentWithChanger(child, parent, &ownershipChanger{chown: mock.chown})
		require.NoError(t, err)

		// Verify chown was called for all paths with correct UID/GID
		require.Len(t, mock.calls, 4)

		expectedPaths := []string{child, file1, nestedDir, file2}
		actualPaths := make([]string, len(mock.calls))
		for i, call := range mock.calls {
			actualPaths[i] = call.path
			require.Equal(t, parentUID, call.uid)
			require.Equal(t, parentGID, call.gid)
		}

		require.ElementsMatch(t, expectedPaths, actualPaths)
	})

	t.Run("Should handle chown errors", func(t *testing.T) {
		parent := t.TempDir()

		child := filepath.Join(parent, "child")
		err := os.MkdirAll(child, 0o750)
		require.NoError(t, err)

		// Mock chown to return an error
		chownErr := errors.New("permission denied")
		mock := &mockChowner{err: chownErr}
		err = matchOwnershipToParentWithChanger(child, parent, &ownershipChanger{chown: mock.chown})
		require.ErrorIs(t, err, chownErr)
	})

	t.Run("Should handle single file", func(t *testing.T) {
		parent := t.TempDir()
		parentUID, parentGID := getOwnership(t, parent)

		singleFile := filepath.Join(parent, "single-file.txt")
		err := os.WriteFile(singleFile, []byte("content"), 0o644)
		require.NoError(t, err)

		mock := &mockChowner{}
		err = matchOwnershipToParentWithChanger(singleFile, parent, &ownershipChanger{chown: mock.chown})
		require.NoError(t, err)

		// Should call chown once for the single file
		require.Len(t, mock.calls, 1)
		require.Equal(t, singleFile, mock.calls[0].path)
		require.Equal(t, parentUID, mock.calls[0].uid)
		require.Equal(t, parentGID, mock.calls[0].gid)
	})

	t.Run("Should not error with non mock", func(t *testing.T) {
		parent := t.TempDir()

		singleFile := filepath.Join(parent, "single-file.txt")
		err := os.WriteFile(singleFile, []byte("content"), 0o644)
		require.NoError(t, err)

		err = matchOwnershipToParent(singleFile, parent)
		require.NoError(t, err)
	})
}

// getOwnership returns the UID and GID of a file or directory
func getOwnership(t *testing.T, path string) (uid, gid int) {
	t.Helper()
	info, err := os.Stat(path)
	require.NoError(t, err)

	stat, ok := info.Sys().(*syscall.Stat_t)
	require.True(t, ok)

	return int(stat.Uid), int(stat.Gid)
}

// mockChowner records calls to chown for testing
type mockChowner struct {
	calls []chownCall
	err   error // error to return from chown calls
}

type chownCall struct {
	path string
	uid  int
	gid  int
}

func (m *mockChowner) chown(path string, uid, gid int) error {
	m.calls = append(m.calls, chownCall{path: path, uid: uid, gid: gid})
	return m.err
}

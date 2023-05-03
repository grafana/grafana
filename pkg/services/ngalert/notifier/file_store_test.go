package notifier

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFileStore_FilepathFor_DirectoryNotExist(t *testing.T) {
	store := NewFakeKVStore(t)
	workingDir := filepath.Join(t.TempDir(), "notexistdir")
	fs := NewFileStore(1, store, workingDir)
	filekey := "silences"
	filePath := filepath.Join(workingDir, filekey)

	// With a file already on the database and the path does not exist yet, it creates the path,
	// writes the file to disk, then returns the filepath.
	{
		require.NoError(t, store.Set(context.Background(), 1, KVNamespace, filekey, encode([]byte("silence1,silence3"))))
		r, err := fs.FilepathFor(context.Background(), filekey)
		require.NoError(t, err)
		require.Equal(t, filePath, r)
		f, err := os.ReadFile(filepath.Clean(filePath))
		require.NoError(t, err)
		require.Equal(t, "silence1,silence3", string(f))
		require.NoError(t, os.Remove(filePath))
		require.NoError(t, store.Del(context.Background(), 1, KVNamespace, filekey))
	}
}
func TestFileStore_FilepathFor(t *testing.T) {
	store := NewFakeKVStore(t)
	workingDir := t.TempDir()
	fs := NewFileStore(1, store, workingDir)
	filekey := "silences"
	filePath := filepath.Join(workingDir, filekey)

	// With a file already on disk, it returns the existing file's filepath and no modification to the original file.
	{
		require.NoError(t, os.WriteFile(filePath, []byte("silence1,silence2"), 0644))
		r, err := fs.FilepathFor(context.Background(), filekey)
		require.NoError(t, err)
		require.Equal(t, filePath, r)
		f, err := os.ReadFile(filepath.Clean(filePath))
		require.NoError(t, err)
		require.Equal(t, "silence1,silence2", string(f))
		require.NoError(t, os.Remove(filePath))
	}

	// With a file already on the database, it writes the file to disk and returns the filepath.
	{
		require.NoError(t, store.Set(context.Background(), 1, KVNamespace, filekey, encode([]byte("silence1,silence3"))))
		r, err := fs.FilepathFor(context.Background(), filekey)
		require.NoError(t, err)
		require.Equal(t, filePath, r)
		f, err := os.ReadFile(filepath.Clean(filePath))
		require.NoError(t, err)
		require.Equal(t, "silence1,silence3", string(f))
		require.NoError(t, os.Remove(filePath))
		require.NoError(t, store.Del(context.Background(), 1, KVNamespace, filekey))
	}

	// With no file on disk or database, it returns the original filepath.
	{
		r, err := fs.FilepathFor(context.Background(), filekey)
		require.NoError(t, err)
		require.Equal(t, filePath, r)
		_, err = os.ReadFile(filepath.Clean(filePath))
		require.Error(t, err)
	}
}

func TestFileStore_Persist(t *testing.T) {
	store := NewFakeKVStore(t)
	state := &fakeState{data: "something to marshal"}
	workingDir := t.TempDir()
	fs := NewFileStore(1, store, workingDir)
	filekey := "silences"

	size, err := fs.Persist(context.Background(), filekey, state)
	require.NoError(t, err)
	require.Equal(t, int64(20), size)
	store.mtx.Lock()
	require.Len(t, store.store, 1)
	store.mtx.Unlock()
	v, ok, err := store.Get(context.Background(), 1, KVNamespace, filekey)
	require.NoError(t, err)
	require.True(t, ok)
	b, err := decode(v)
	require.NoError(t, err)
	require.Equal(t, "something to marshal", string(b))
}

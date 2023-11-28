package notifier

import (
	"context"
	"encoding/base64"
	"os"
	"path/filepath"
	"testing"

	"github.com/prometheus/alertmanager/cluster/clusterpb"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
)

func TestFileStore_FilepathFor_DirectoryNotExist(t *testing.T) {
	store := fakes.NewFakeKVStore(t)
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
	store := fakes.NewFakeKVStore(t)
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

func TestFileStore_GetFullState(t *testing.T) {
	ctx := context.Background()

	t.Run("empty store", func(tt *testing.T) {
		store := fakes.NewFakeKVStore(t)
		fs := NewFileStore(1, store, workingDir)
		_, err := fs.GetFullState(ctx, "silences", "notifications")
		require.NotNil(tt, err)
		require.Equal(tt, "no values for org 1", err.Error())
	})

	t.Run("no values for key", func(tt *testing.T) {
		store := fakes.NewFakeKVStore(t)
		require.NoError(t, store.Set(ctx, 1, "alertmanager", "test-key", "test-value"))
		fs := NewFileStore(1, store, workingDir)
		_, err := fs.GetFullState(ctx, "silences")
		require.NotNil(tt, err)
		require.Equal(tt, "no value found for key \"silences\"", err.Error())
	})

	t.Run("non-empty values", func(tt *testing.T) {
		store := fakes.NewFakeKVStore(t)
		silences := []byte("test-silences")
		nflog := []byte("test-notifications")
		require.NoError(t, store.Set(ctx, 1, "alertmanager", "silences", base64.StdEncoding.EncodeToString(silences)))
		require.NoError(t, store.Set(ctx, 1, "alertmanager", "notifications", base64.StdEncoding.EncodeToString(nflog)))

		state := clusterpb.FullState{
			Parts: []clusterpb.Part{
				{Key: "silences", Data: silences},
				{Key: "notifications", Data: nflog},
			},
		}
		b, err := state.Marshal()
		require.NoError(t, err)

		encodedFullState := base64.StdEncoding.EncodeToString(b)

		fs := NewFileStore(1, store, workingDir)

		got, err := fs.GetFullState(ctx, "silences", "notifications")
		require.NoError(t, err)
		require.Equal(t, encodedFullState, got)
	})
}

func TestFileStore_Persist(t *testing.T) {
	store := fakes.NewFakeKVStore(t)
	state := &fakeState{data: "something to marshal"}
	workingDir := t.TempDir()
	fs := NewFileStore(1, store, workingDir)
	filekey := "silences"

	size, err := fs.Persist(context.Background(), filekey, state)
	require.NoError(t, err)
	require.Equal(t, int64(20), size)
	store.Mtx.Lock()
	require.Len(t, store.Store, 1)
	store.Mtx.Unlock()
	v, ok, err := store.Get(context.Background(), 1, KVNamespace, filekey)
	require.NoError(t, err)
	require.True(t, ok)
	b, err := decode(v)
	require.NoError(t, err)
	require.Equal(t, "something to marshal", string(b))
}

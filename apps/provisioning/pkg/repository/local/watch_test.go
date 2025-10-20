package local

import (
	"context"
	"os"
	"path/filepath"
	"slices"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestWatch_TempFiles(t *testing.T) {
	tmpdir := t.TempDir()
	sub1 := filepath.Join(tmpdir, "sub1")
	err := os.MkdirAll(sub1, 0700)
	require.NoError(t, err)

	watcher, err := NewFileWatcher(tmpdir, func(name string) bool {
		return filepath.Ext(name) == ".txt"
	})
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	events := make(chan string, 10)
	go func() {
		watcher.Watch(ctx, events)
	}()

	go func() {
		time.Sleep(20 * time.Millisecond)
		err = os.WriteFile(filepath.Join(tmpdir, "aaa.txt"), []byte("aaa"), 0600)
		require.NoError(t, err)
		err = os.WriteFile(filepath.Join(tmpdir, ".hidden.txt"), []byte("hidden"), 0600)
		require.NoError(t, err)
		err = os.WriteFile(filepath.Join(tmpdir, "bbb.txt"), []byte("bbb"), 0600)
		require.NoError(t, err)
		err = os.WriteFile(filepath.Join(tmpdir, "xxx.json"), []byte("ignore"), 0600)
		require.NoError(t, err)
		err = os.WriteFile(filepath.Join(sub1, "ccc.txt"), []byte("ccc"), 0600)
		require.NoError(t, err)

		// make a sub folder
		sub2 := filepath.Join(tmpdir, "sub2")
		err = os.MkdirAll(sub2, 0700)
		require.NoError(t, err)
		time.Sleep(50 * time.Millisecond)
		err = os.WriteFile(filepath.Join(sub2, "ddd.txt"), []byte("ddd"), 0600)
		require.NoError(t, err)

		// Check all the paths we are watching
		w, ok := watcher.(*fileWatcher)
		require.True(t, ok, "explicit cast")
		watching := w.watcher.WatchList()
		slices.Sort(watching)
		require.Equal(t, []string{
			tmpdir, sub1, sub2,
		}, watching)

		// Removing the subfolder should trigger the event again
		time.Sleep(time.Millisecond * 150)
		err = os.RemoveAll(sub2)
		require.NoError(t, err)

		// Finish all the events
		time.Sleep(time.Millisecond * 250)
		cancel() // stops the context
	}()

	received := []string{}
	for event := range events {
		received = append(received, event)
	}
	slices.Sort(received)

	require.Equal(t, []string{
		"aaa.txt",
		"bbb.txt",
		"sub1/ccc.txt",
		"sub2/ddd.txt", // first time because we added it
		"sub2/ddd.txt", // second time because we removed it
	}, received)
}

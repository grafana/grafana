package local

import (
	"context"
	"fmt"
	"io/fs"
	"math"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"

	"github.com/grafana/grafana-app-sdk/logging"
)

type FileWatcher interface {
	Watch(ctx context.Context, events chan<- string)
}

type fileWatcher struct {
	prefix   string
	accept   func(string) bool
	waitFor  time.Duration
	timersMu sync.Mutex
	timers   map[string]*time.Timer
	watcher  *fsnotify.Watcher
	logger   logging.Logger
}

// File watcher that buffers events for 100ms before actually firing them
// this is helpful because editing a file may often update the same file many many times
// for what seems like a single operation.
// See: https://github.com/fsnotify/fsnotify/blob/main/cmd/fsnotify/dedup.go
func NewFileWatcher(path string, accept func(string) bool) (FileWatcher, error) {
	info, _ := os.Stat(path)
	if info == nil || !info.IsDir() {
		return nil, fmt.Errorf("expecting to watch a folder")
	}

	w, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}

	if err := w.Add(path); err != nil {
		_ = w.Close()
		return nil, err
	}

	if err = filepath.WalkDir(path, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			if err = w.Add(path); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		_ = w.Close()
		return nil, err
	}

	return &fileWatcher{
		prefix:  path + "/",
		accept:  accept,
		waitFor: 100 * time.Millisecond,
		timers:  make(map[string]*time.Timer),
		watcher: w,
		logger:  logging.DefaultLogger.With("watch", path),
	}, nil
}

// Keep watching for changes until the context is done
func (f *fileWatcher) Watch(ctx context.Context, events chan<- string) {
	for {
		select {
		case <-ctx.Done():
			close(events)
			return

		case _, ok := <-f.watcher.Errors:
			if !ok { // Channel was closed (i.e. Watcher.Close() was called).
				close(events)
				return
			}

		// Read from Events.
		case e, ok := <-f.watcher.Events:
			if !ok { // Channel was closed (i.e. Watcher.Close() was called).
				close(events)
				return
			}
			name := filepath.Base(e.Name)
			if strings.HasPrefix(name, ".") {
				continue // ignore hidden files+folders
			}
			if !f.accept(name) {
				info, _ := os.Stat(e.Name)
				if info != nil && info.IsDir() {
					if err := f.watcher.Add(e.Name); err != nil {
						f.logger.Warn("error adding folder", "folder", e.Name, "error", err)
					}
				}
				continue
			}

			f.timersMu.Lock()
			t, ok := f.timers[e.Name]
			if !ok {
				nameCopy := e.Name
				t = time.AfterFunc(math.MaxInt64, func() {
					path, _ := strings.CutPrefix(nameCopy, f.prefix)
					events <- path

					f.timersMu.Lock()
					delete(f.timers, nameCopy)
					f.timersMu.Unlock()
				})
				f.timers[e.Name] = t
			}
			f.timersMu.Unlock()
			t.Reset(f.waitFor)
		}
	}
}

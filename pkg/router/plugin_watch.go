package router

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/fsnotify/fsnotify"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/setting"
)

// pluginDirSettle is how long a plugin directory must stop changing before the
// router reloads: installing a plugin extracts many files, and an update
// replaces the whole directory.
var pluginDirSettle = 500 * time.Millisecond

const (
	// pluginWatchDepth is how far below a plugin root directories are watched:
	// <root>/<plugin>/dist. Deeper trees are static assets.
	pluginWatchDepth = 2

	pluginJSONFile      = "plugin.json"
	appManifestFile     = "app-sdk-manifest.json"
	pluginDistDirectory = "dist"
)

// pluginRoots are the directories local plugins are installed into.
func pluginRoots(cfg *setting.Cfg) []string {
	if cfg == nil {
		return nil
	}
	roots := slices.Clone(cfg.PluginsPaths)
	for _, settings := range cfg.PluginSettings {
		if path := settings["path"]; path != "" {
			roots = append(roots, path)
		}
	}
	return roots
}

// watchPluginRoots wakes the returned channel when a plugin under roots is
// installed, updated or removed, once the change settles. A changed plugin
// changes its backends' keys, so the reload rebuilds only its groups.
//
// Events are not filtered by what the router serves: the reload reads the full
// state, so a wake for a plugin that serves no API only costs one reconcile.
func watchPluginRoots(ctx context.Context, roots []string) (<-chan struct{}, error) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, fmt.Errorf("router: watching plugin directories: %w", err)
	}
	w := &pluginWatcher{watcher: watcher, roots: make(map[string]struct{}, len(roots))}
	for _, root := range roots {
		root, err := filepath.Abs(root)
		if err != nil {
			logging.FromContext(ctx).Warn("router: not watching plugin directory", "path", root, "err", err)
			continue
		}
		w.roots[root] = struct{}{}
		w.add(ctx, root, 0)
	}

	dirty := make(chan struct{}, 1)
	go func() {
		defer func() { _ = watcher.Close() }()
		settle := time.NewTimer(0)
		settle.Stop()
		defer settle.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-settle.C:
				logging.FromContext(ctx).Info("router: plugin files changed, reloading")
				wake(dirty)
			case err, ok := <-watcher.Errors:
				if !ok {
					return
				}
				logging.FromContext(ctx).Warn("router: watching plugin directories", "err", err)
			case e, ok := <-watcher.Events:
				if !ok {
					return
				}
				if w.relevant(ctx, e) {
					settle.Reset(pluginDirSettle)
				}
			}
		}
	}()
	return dirty, nil
}

type pluginWatcher struct {
	watcher *fsnotify.Watcher
	roots   map[string]struct{}
}

// add watches dir, and the directories below it down to pluginWatchDepth;
// depth is dir's own depth below its root. A directory that can't be watched,
// such as one that is gone already, is skipped: a later event covers it.
func (w *pluginWatcher) add(ctx context.Context, dir string, depth int) {
	if err := w.watcher.Add(dir); err != nil {
		logging.FromContext(ctx).Warn("router: not watching plugin directory", "path", dir, "err", err)
		return
	}
	if depth >= pluginWatchDepth {
		return
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, entry := range entries {
		if entry.Name() == "node_modules" {
			continue
		}
		// Stat follows symlinks, which dev installs use for plugin directories.
		child := filepath.Join(dir, entry.Name())
		if fi, err := os.Stat(child); err == nil && fi.IsDir() {
			w.add(ctx, child, depth+1)
		}
	}
}

// depth is how far below its root path is, or -1 when it is under none.
func (w *pluginWatcher) depth(path string) int {
	for root := range w.roots {
		rel, err := filepath.Rel(root, path)
		if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
			continue
		}
		if rel == "." {
			return 0
		}
		return strings.Count(rel, string(filepath.Separator)) + 1
	}
	return -1
}

// relevant reports whether e can change what the router loads, and watches a
// directory that was created. A plugin is its directory appearing, going away
// or being renamed, and the files the definition is read from. Other files and
// directories, such as a plugin's logs or data, are left alone.
func (w *pluginWatcher) relevant(ctx context.Context, e fsnotify.Event) bool {
	// A change of mode or access time leaves the content as it was.
	if e.Op == fsnotify.Chmod {
		return false
	}
	path := filepath.Clean(e.Name)
	depth := w.depth(path)
	if depth < 0 {
		return false
	}
	name := filepath.Base(path)

	if e.Has(fsnotify.Create) {
		if fi, err := os.Stat(path); err == nil && fi.IsDir() && name != "node_modules" {
			if depth <= pluginWatchDepth {
				w.add(ctx, path, depth)
			}
			return definesPlugin(name, depth)
		}
	}

	switch name {
	case pluginJSONFile, appManifestFile:
		return true
	}
	// The event names a path that no longer exists, so its type is unknown.
	return (e.Has(fsnotify.Remove) || e.Has(fsnotify.Rename)) && definesPlugin(name, depth)
}

// definesPlugin reports whether a directory called name, depth below a root,
// is a plugin's directory or one the definition is read from.
func definesPlugin(name string, depth int) bool {
	switch depth {
	case 1:
		return true
	case 2:
		return name == pluginDistDirectory
	}
	return false
}

// mergeWakes forwards a wake from any of chans to the returned channel, until
// ctx is done. Wakes coalesce like the channels it merges.
func mergeWakes(ctx context.Context, chans ...<-chan struct{}) <-chan struct{} {
	merged := make(chan struct{}, 1)
	for _, c := range chans {
		go func() {
			for {
				select {
				case <-ctx.Done():
					return
				case _, ok := <-c:
					if !ok {
						return
					}
					wake(merged)
				}
			}
		}()
	}
	return merged
}

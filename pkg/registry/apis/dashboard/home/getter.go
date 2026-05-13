package home

import (
	"fmt"
	"path/filepath"
	"sync"

	"github.com/fsnotify/fsnotify"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/conversion"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/setting"
)

const DASHBOARD_NAME = "default-home-dashboard"

type HomeDashboardGetter interface {
	// Get the file based home dashboard at a specific version
	Get(version string) (runtime.Object, error)

	// Register the schema we will use for conversions
	RegisterSchema(scheme *runtime.Scheme)
}

func NewHomeDashboardSupport(cfg *setting.Cfg) *homeDashboard {
	filePath := cfg.DefaultHomeDashboardPath
	if filePath == "" {
		filePath = filepath.Join(cfg.StaticRootPath, "dashboards/home.json")
	}
	return newHomeDashboardSupportForFile(filePath)
}

func newHomeDashboardSupportForFile(defaultDashboardFile string) *homeDashboard {
	home := &homeDashboard{
		log: logging.DefaultLogger.With("logger", "dashboards-apiserver-home"),
	}

	// With no file configured we always serve the built-in fallback, so there is nothing to watch.
	if defaultDashboardFile == "" {
		return home
	}
	home.fpath = defaultDashboardFile

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		home.log.Error("failed to create fsnotify watcher", "err", err)
		return home
	}
	if err := watcher.Add(defaultDashboardFile); err != nil {
		home.log.Error("failed to watch home dashboard file", "path", defaultDashboardFile, "err", err)
		_ = watcher.Close()
		return home
	}

	home.watcher = watcher
	go home.watch()
	return home
}

func (h *homeDashboard) RegisterSchema(scheme *runtime.Scheme) {
	h.scheme = scheme
}

type homeDashboardGetter func() (runtime.Object, error)

type homeDashboard struct {
	fpath   string
	scheme  *runtime.Scheme
	watcher *fsnotify.Watcher
	log     logging.Logger

	// Everything below is protected by the mutex.
	versionsMu sync.Mutex
	versions   map[string]homeDashboardGetter
	source     runtime.Object
}

func (h *homeDashboard) Get(version string) (runtime.Object, error) {
	h.versionsMu.Lock()
	defer h.versionsMu.Unlock()

	if h.scheme == nil {
		return nil, fmt.Errorf("scheme was not registered")
	}

	if h.source == nil {
		if err := h.load(); err != nil {
			return nil, err
		}
	}

	getter, ok := h.versions[version]
	if !ok {
		out, err := conversion.Convert(h.scheme, h.source, version)
		getter = func() (runtime.Object, error) { return out, err }
		h.versions[version] = getter
	}
	return getter()
}

// load reads the configured file (falling back to a built-in dashboard if the
// file is missing or invalid), refreshes the cached source, and invalidates any
// previously cached version conversions. Must be called with versionsMu held.
func (h *homeDashboard) load() error {
	obj, err := readDashboard(h.fpath)
	if err != nil {
		h.log.Error("failed to read home dashboard, using default", "path", h.fpath, "err", err)
	}
	if obj == nil {
		obj, err = defaultHomeDashboard()
		if err != nil {
			return err
		}
	}

	now := metav1.Now()
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return fmt.Errorf("home dashboard meta accessor: %w", err)
	}
	meta.SetCreationTimestamp(now)
	meta.SetName(DASHBOARD_NAME)
	meta.SetResourceVersion(fmt.Sprintf("%d", now.UnixMilli()))

	h.source = obj
	h.versions = make(map[string]homeDashboardGetter)
	return nil
}

// watch invalidates the cached source whenever the watched file changes, so the
// next Get re-reads from disk. It runs until the watcher's channels are closed.
func (h *homeDashboard) watch() {
	for {
		select {
		case err, ok := <-h.watcher.Errors:
			if !ok {
				return
			}
			h.log.Warn("home dashboard watcher error", "err", err)

		case evt, ok := <-h.watcher.Events:
			if !ok {
				return
			}
			h.log.Debug("home dashboard file changed", "event", evt)

			h.versionsMu.Lock()
			h.source = nil
			h.versionsMu.Unlock()
		}
	}
}

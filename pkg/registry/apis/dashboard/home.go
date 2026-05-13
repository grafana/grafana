package dashboard

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/fsnotify/fsnotify"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana-app-sdk/logging"
	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/conversion"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/setting"
)

const HOME_DASHBOARD_NAME = "default-home-dashboard"

func newHomeDashboardSupport(cfg *setting.Cfg) *homeDashboard {
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
		obj = defaultHomeDashboard()
	}

	now := metav1.Now()
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return fmt.Errorf("home dashboard meta accessor: %w", err)
	}
	meta.SetCreationTimestamp(now)
	meta.SetName(HOME_DASHBOARD_NAME)
	meta.SetResourceVersion(fmt.Sprintf("%d", now.UnixMilli()))

	h.source = obj
	h.versions = make(map[string]homeDashboardGetter)
	return nil
}

// readDashboard loads the dashboard JSON at filePath. If the file declares an
// `apiVersion`, the bytes are decoded into the matching versioned Dashboard
// type; otherwise the whole payload is treated as a v0 dashboard spec.
// Returns (nil, nil) when no file is configured.
func readDashboard(filePath string) (runtime.Object, error) {
	if filePath == "" {
		return nil, nil
	}
	raw, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("read home dashboard: %w", err)
	}

	// Peek at the apiVersion before deciding which type to decode into.
	var header struct {
		APIVersion string `json:"apiVersion"`
	}
	if err := json.Unmarshal(raw, &header); err != nil {
		return nil, fmt.Errorf("parse home dashboard: %w", err)
	}

	if header.APIVersion != "" {
		out, err := conversion.NewDashboardObject(header.APIVersion)
		if err != nil {
			return nil, fmt.Errorf("unsupported home dashboard apiVersion %q: %w", header.APIVersion, err)
		}
		if err := json.Unmarshal(raw, out); err != nil {
			return nil, fmt.Errorf("decode home dashboard (%s): %w", header.APIVersion, err)
		}
		return out, nil
	}

	// No apiVersion → treat the whole file as the v0 spec.
	var spec map[string]any
	if err := json.Unmarshal(raw, &spec); err != nil {
		return nil, fmt.Errorf("decode home dashboard spec: %w", err)
	}
	return &dashv0.Dashboard{Spec: v0alpha1.Unstructured{Object: spec}}, nil
}

// defaultHomeDashboard is the fallback returned when no file is configured or
// the configured file cannot be read.
func defaultHomeDashboard() runtime.Object {
	return &dashv0.Dashboard{Spec: v0alpha1.Unstructured{
		Object: map[string]any{
			"title": "home",
		},
	}}
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

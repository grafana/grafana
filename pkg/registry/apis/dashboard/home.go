package dashboard

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/conversion"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

const HOME_DASHBOARD_NAME = "default-home-dashboard"

func newHomeDashboardSupport(defaultDashboardFile string) *homeDashboard {
	if defaultDashboardFile == "" {
		return nil
	}
	return &homeDashboard{
		fpath:    defaultDashboardFile,
		versions: make(map[string]homeDashboardGetter, 10),
	}
}

type homeDashboardGetter func() (runtime.Object, error)

type homeDashboard struct {
	fpath  string
	scheme *runtime.Scheme

	// Everything below is protected by the mutex
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

// Called the first time we load the dashboard, OR after the file has changed
func (h *homeDashboard) load() error {
	raw, err := os.ReadFile(h.fpath)
	if err != nil {
		return fmt.Errorf("reading home dashboard %s: %w", h.fpath, err)
	}

	var data map[string]any
	if err := json.Unmarshal(raw, &data); err != nil {
		return fmt.Errorf("parsing home dashboard JSON: %w", err)
	}

	h.source = &dashv0.Dashboard{
		ObjectMeta: metav1.ObjectMeta{Name: HOME_DASHBOARD_NAME},
		Spec:       v0alpha1.Unstructured{Object: data},
	}
	// Invalidate cached conversions so they are re-derived from the new source.
	clear(h.versions)
	return nil
}

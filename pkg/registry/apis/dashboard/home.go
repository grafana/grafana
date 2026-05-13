package dashboard

import (
	"fmt"
	"sync"

	"k8s.io/apimachinery/pkg/runtime"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/conversion"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

const HOME_DASHBOARD_NAME = "default-home-dashboard"

func newHomeDashboardSupport(defaultDashboardFile string) *homeDashboard {
	fmt.Printf("TODO... read/watch %s\n", defaultDashboardFile)
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
	h.source = &dashv0.Dashboard{Spec: v0alpha1.Unstructured{
		Object: map[string]any{
			"title": "home",
		},
	}}
	return nil
}

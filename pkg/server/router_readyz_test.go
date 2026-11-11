package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/mux"
	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/router"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// The router target's /readyz stays not ready until each of its sources has
// polled once. A source that is down counts once its first poll fails, so it
// can't hold the router unready on its own.
func TestRouterReadyzWaitsForEverySourcesFirstPoll(t *testing.T) {
	release := make(chan struct{})
	slow := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-release:
		case <-r.Context().Done():
			return
		}
		_ = json.NewEncoder(w).Encode(metav1.APIGroupList{Groups: []metav1.APIGroup{{
			Name:     "slow.ext.grafana.app",
			Versions: []metav1.GroupVersionForDiscovery{{GroupVersion: "slow.ext.grafana.app/v1", Version: "v1"}},
		}}})
	}))
	t.Cleanup(slow.Close)
	down := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	t.Cleanup(down.Close)

	cfg := setting.NewCfg()
	cfg.Target = []string{"router"}
	var err error
	cfg.Raw, err = ini.Load([]byte(fmt.Sprintf(`
[router.aggregate.slow]
url = %s
discovery_auth = none
[router.aggregate.down]
url = %s
discovery_auth = none
`, slow.URL, down.URL)))
	require.NoError(t, err)
	loader, err := router.NewCloudRoutesLoader(cfg, router.PluginDependencies{})
	require.NoError(t, err)
	require.NotNil(t, loader)
	svc, err := router.ProvideService(cfg, featuremgmt.WithFeatures(), loader, prometheus.NewRegistry(), router.NewGrafanaRouter(nil, nil))
	require.NoError(t, err)

	httpRouter := mux.NewRouter()
	health := NewHealthNotifier()
	RegisterHealthEndpoints(httpRouter, health)
	require.NoError(t, svc.RegisterTargetRoutes(httpRouter, health))
	require.NoError(t, services.StartAndAwaitRunning(t.Context(), svc))
	t.Cleanup(func() {
		select {
		case <-release:
		default:
			close(release)
		}
		require.NoError(t, services.StopAndAwaitTerminated(context.Background(), svc))
	})

	readyz := func() int {
		rec := httptest.NewRecorder()
		httpRouter.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/readyz", nil))
		return rec.Code
	}
	// Longer than the router's readiness check interval: the down target has
	// failed its first poll, but the slow one hasn't answered.
	require.Never(t, func() bool { return readyz() == http.StatusOK }, 2*time.Second, 50*time.Millisecond)

	close(release)
	require.Eventually(t, func() bool { return readyz() == http.StatusOK }, 10*time.Second, 50*time.Millisecond)
}

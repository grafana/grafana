package router

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/gorilla/mux"
	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

type testReadyNotifier struct {
	ready atomic.Bool
}

func (n *testReadyNotifier) SetReady()    { n.ready.Store(true) }
func (n *testReadyNotifier) SetNotReady() { n.ready.Store(false) }

func TestServiceRunsRouterAndRegistersRoutes(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.Target = []string{"router"}
	httpRouter := mux.NewRouter()
	ready := &testReadyNotifier{}
	svc, err := ProvideService(cfg, &dummyRoutesLoader{}, httpRouter, ready)
	require.NoError(t, err)

	require.NoError(t, services.StartAndAwaitRunning(t.Context(), svc))
	t.Cleanup(func() {
		require.NoError(t, services.StopAndAwaitTerminated(context.Background(), svc))
	})

	require.Eventually(t, func() bool {
		svc.reportReady(t.Context())
		return ready.ready.Load()
	}, readinessPollInterval, readinessPollInterval/10)

	recorder := httptest.NewRecorder()
	httpRouter.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/apis", nil))
	require.Equal(t, http.StatusOK, recorder.Code)
	require.JSONEq(t, `{"kind":"APIGroupList","apiVersion":"v1","groups":[]}`, recorder.Body.String())

	recorder = httptest.NewRecorder()
	httpRouter.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/not-owned", nil))
	require.Equal(t, http.StatusNotFound, recorder.Code)
}

func TestProvideServiceRequiresCollaborators(t *testing.T) {
	cfg := setting.NewCfg()

	_, err := ProvideService(cfg, nil, mux.NewRouter(), nil)
	require.ErrorContains(t, err, "routes loader is required")

	_, err = ProvideService(cfg, &dummyRoutesLoader{}, nil, nil)
	require.ErrorContains(t, err, "HTTP router is required")
}

package router

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/require"
)

func TestDebugEndpoint(t *testing.T) {
	svc, _, _ := newStatusService(t)
	svc.standalone = true
	httpRouter := mux.NewRouter()
	require.NoError(t, svc.RegisterTargetRoutes(httpRouter, nil))
	require.NoError(t, svc.router.reconcile(t.Context()))
	svc.router.storeServing(t.Context(), nil)

	recorder := httptest.NewRecorder()
	httpRouter.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, debugPath, nil))
	require.Equal(t, http.StatusOK, recorder.Code)
	var state routerDebugState
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &state))
	require.True(t, state.Ready)
	require.Equal(t, uint64(2), state.Reconciles)
	require.Equal(t, []debugGroup{
		{Group: "dummy.ext.grafana.app", Versions: []string{"v0alpha1", "v0alpha2"}, BackendDescription: BackendDescription{Source: sourceDummy}, Key: "static", Breaker: "closed"},
		{Group: "first.ext.grafana.app", Versions: []string{}, BackendDescription: BackendDescription{Source: sourceRouteBackend, Target: "https://first.example.com:8443"}, Key: "rv-1", Breaker: "closed"},
		{Group: "second.ext.grafana.app", Versions: []string{}, BackendDescription: BackendDescription{Source: sourceRouteBackend, Target: "https://second.example.com"}, Key: "rv-2", Breaker: "closed"},
	}, state.Groups)
	require.Len(t, state.Shadowed, 1)
	require.Len(t, state.Sources, 2)

	recorder = httptest.NewRecorder()
	httpRouter.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, debugPath, nil))
	require.Equal(t, http.StatusMethodNotAllowed, recorder.Code, "the endpoint is read-only")
}

func TestDebugHandlerOnlyInMiddlewareMode(t *testing.T) {
	for _, tc := range []struct {
		name                   string
		middleware, standalone bool
		mounted                bool
	}{
		{name: "middleware", middleware: true, mounted: true},
		{name: "standalone target (mounted on its own listener instead)", standalone: true},
		{name: "standalone target with the middleware flag", middleware: true, standalone: true},
		{name: "disabled"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			svc, _, _ := newStatusService(t)
			svc.middleware, svc.standalone = tc.middleware, tc.standalone
			path, handler := svc.DebugHandler()
			if !tc.mounted {
				require.Nil(t, handler)
				return
			}
			require.Equal(t, debugPath, path)
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
			require.Equal(t, http.StatusOK, recorder.Code)
			require.Contains(t, recorder.Body.String(), `"group": "first.ext.grafana.app"`)
		})
	}
}

package provisioning

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/synctest"

	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	clientrest "k8s.io/client-go/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/setting"
)

func TestJobCleanupService_IsDisabled(t *testing.T) {
	tests := []struct {
		name                string
		builder             *APIBuilder
		controllersDisabled bool
		disabled            bool
	}{
		{name: "provisioning disabled", builder: nil, disabled: true},
		{name: "controllers disabled", builder: &APIBuilder{}, controllersDisabled: true, disabled: true},
		{name: "controllers enabled", builder: &APIBuilder{}, disabled: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			svc := ProvideJobCleanupService(&setting.Cfg{DisableControllers: tc.controllersDisabled}, tc.builder, nil)
			assert.Equal(t, tc.disabled, svc.IsDisabled())
			// The background service manager looks up this name in its
			// dependency map; any other name would start it after Core.
			assert.Equal(t, JobCleanupServiceName, svc.ServiceName())
		})
	}
}

func TestJobCleanupService_Run(t *testing.T) {
	t.Run("lists expired jobs on the post-start hook's loopback config once the provisioning API is served", func(t *testing.T) {
		selectors := make(chan string, 1)
		server := startFakeExpiredJobsAPI(t, func(r *http.Request) {
			assert.Equal(t, "Bearer loopback-token", r.Header.Get("Authorization"))
			select {
			case selectors <- r.URL.Query().Get("labelSelector"):
			default:
			}
		})

		svc, builder := newTestJobCleanupService()
		done := runJobCleanupService(t, svc)

		builder.publishLoopbackConfig(&clientrest.Config{Host: server.URL, BearerToken: "loopback-token"})
		assert.Contains(t, receive(t, selectors, done), jobs.LabelJobClaim+"<")

		svc.StopAsync()
		require.NoError(t, waitForRun(t, done))
		require.Equal(t, services.Terminated, svc.State())
	})

	t.Run("stops cleanly when cancelled while waiting for the provisioning API", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			svc, _ := newTestJobCleanupService()
			runErr := make(chan error, 1)
			go func() { runErr <- svc.Run(t.Context()) }()
			synctest.Wait()

			svc.StopAsync()
			require.NoError(t, <-runErr)
			require.Equal(t, services.Terminated, svc.State())
		})
	})

	t.Run("stops cleanly when its context is cancelled before the provisioning API is served", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			svc, _ := newTestJobCleanupService()
			ctx, cancel := context.WithCancel(t.Context())
			runErr := make(chan error, 1)
			go func() { runErr <- svc.Run(ctx) }()
			synctest.Wait()

			cancel()
			require.NoError(t, <-runErr)
			require.Equal(t, services.Terminated, svc.State())
		})
	})
}

func newTestJobCleanupService() (*JobCleanupService, *APIBuilder) {
	builder := &APIBuilder{loopbackReady: make(chan struct{})}
	return ProvideJobCleanupService(&setting.Cfg{}, builder, prometheus.NewPedanticRegistry()), builder
}

// runJobCleanupService starts Run in the background and returns its result
// channel. Stopping the service is also registered as a cleanup, so a failing
// test still stops it before the fake API server is closed.
func runJobCleanupService(t *testing.T, svc *JobCleanupService) <-chan error {
	t.Helper()
	done := make(chan error, 1)
	go func() { done <- svc.Run(t.Context()) }()
	t.Cleanup(func() {
		svc.StopAsync()
		_ = svc.AwaitTerminated(context.WithoutCancel(t.Context()))
	})
	return done
}

// startFakeExpiredJobsAPI answers the cleanup controller's cross-namespace job
// list with no jobs and hands each list request to onList.
func startFakeExpiredJobsAPI(t *testing.T, onList func(*http.Request)) *httptest.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /apis/provisioning.grafana.app/v0alpha1/jobs", func(w http.ResponseWriter, r *http.Request) {
		onList(r)
		w.Header().Set("Content-Type", "application/json")
		assert.NoError(t, json.NewEncoder(w).Encode(provisioning.JobList{
			TypeMeta: metav1.TypeMeta{APIVersion: provisioning.SchemeGroupVersion.String(), Kind: "JobList"},
		}))
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		t.Errorf("unexpected request: %s %s", r.Method, r.URL)
		w.WriteHeader(http.StatusNotFound)
	})

	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)
	return server
}

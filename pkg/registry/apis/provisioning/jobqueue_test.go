package provisioning

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/synctest"
	"time"

	"github.com/grafana/dskit/services"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	clientrest "k8s.io/client-go/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/setting"
)

func TestProvideJobQueueService(t *testing.T) {
	t.Run("reads the tunables from the config", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.ProvisioningJobPollInterval = 45 * time.Second
		cfg.ProvisioningMaxFileSize = 1024
		cfg.ProvisioningSyncResourceTimeout = 5 * time.Second
		cfg.ProvisioningAllowImageRendering = true
		cfg.AppURL = "https://grafana.internal/"
		cfg.ProvisioningPublicRootURL = "https://grafana.example.com/"

		s := ProvideJobQueueService(cfg, &APIBuilder{}, nil, nil)

		assert.Equal(t, 45*time.Second, s.cfg.JobInterval)
		assert.Equal(t, int64(1024), s.cfg.MaxFileSize)
		assert.Equal(t, 5*time.Second, s.cfg.SyncResourceTimeout)
		assert.Equal(t, jobs.ClaimExpiry/3, s.cfg.LeaseRenewalInterval)
		assert.True(t, s.cfg.AllowImageRendering)
		assert.Equal(t, "https://grafana.internal/", s.pullRequestURLs.Internal(t.Context(), "ns"))
		assert.Equal(t, "https://grafana.example.com/", s.pullRequestURLs.Public(t.Context(), "ns"))
	})

	t.Run("falls back to the default poll interval", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.ProvisioningJobPollInterval = 0

		s := ProvideJobQueueService(cfg, &APIBuilder{}, nil, nil)

		assert.Equal(t, setting.ProvisioningJobPollIntervalDefault, s.cfg.JobInterval)
	})
}

func TestJobQueueService_IsDisabled(t *testing.T) {
	tests := []struct {
		name     string
		builder  *APIBuilder
		disabled bool
	}{
		{name: "provisioning disabled", builder: nil, disabled: true},
		{name: "controllers disabled", builder: &APIBuilder{onlyApiServer: true}, disabled: true},
		{name: "controllers enabled", builder: &APIBuilder{}, disabled: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			svc := ProvideJobQueueService(setting.NewCfg(), tc.builder, nil, nil)
			assert.Equal(t, tc.disabled, svc.IsDisabled())
			// The background service manager looks up this name in its
			// dependency map; any other name would start it after Core.
			assert.Equal(t, JobQueueServiceName, svc.ServiceName())
		})
	}
}

func TestJobQueueService_Run(t *testing.T) {
	t.Run("claims pending jobs on the post-start hook's loopback config once the provisioning API is served", func(t *testing.T) {
		claimed := make(chan string, 1)
		server := startFakeJobsAPI(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "Bearer loopback-token", r.Header.Get("Authorization"))
			claimed <- r.PathValue("name")
			// The job is gone by the time it is claimed, so the driver drops it.
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			assert.NoError(t, json.NewEncoder(w).Encode(metav1.Status{Status: metav1.StatusFailure, Reason: metav1.StatusReasonNotFound, Code: http.StatusNotFound}))
		})

		svc, builder := newTestJobQueueService(t)
		done := runJobQueueService(t, svc)

		builder.publishLoopbackConfig(&clientrest.Config{Host: server.URL, BearerToken: "loopback-token"})
		assert.Equal(t, "pending", receive(t, claimed, done))

		svc.StopAsync()
		require.NoError(t, waitForRun(t, done))
		require.Equal(t, services.Terminated, svc.State())
	})

	t.Run("stops cleanly when cancelled while waiting for the provisioning API", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			svc, _ := newTestJobQueueService(t)
			runErr := make(chan error, 1)
			go func() { runErr <- svc.Run(t.Context()) }()
			synctest.Wait()

			svc.StopAsync()
			require.NoError(t, <-runErr)
			require.Equal(t, services.Terminated, svc.State())
		})
	})
}

func newTestJobQueueService(t *testing.T) (*JobQueueService, *APIBuilder) {
	t.Helper()
	builder := &APIBuilder{
		tracer:        tracing.NewNoopTracerService(),
		registry:      prometheus.NewPedanticRegistry(),
		loopbackReady: make(chan struct{}),
	}
	return ProvideJobQueueService(setting.NewCfg(), builder, nil, nil), builder
}

// runJobQueueService starts Run in the background and returns its result
// channel. Stopping the service is also registered as a cleanup, so a failing
// test still stops it before the fake API server is closed.
func runJobQueueService(t *testing.T, svc *JobQueueService) <-chan error {
	t.Helper()
	done := make(chan error, 1)
	go func() { done <- svc.Run(context.Background()) }()
	t.Cleanup(func() {
		svc.StopAsync()
		_ = svc.AwaitTerminated(context.Background())
	})
	return done
}

// startFakeJobsAPI serves one pending Job, holds watches open, and hands the
// driver's claim read to onGet. The server is closed on cleanup; blocking
// handlers must also return on t.Context() so that close cannot hang.
func startFakeJobsAPI(t *testing.T, onGet http.HandlerFunc) *httptest.Server {
	list := provisioning.JobList{
		TypeMeta: metav1.TypeMeta{APIVersion: provisioning.SchemeGroupVersion.String(), Kind: "JobList"},
		ListMeta: metav1.ListMeta{ResourceVersion: "1"},
		Items:    []provisioning.Job{{ObjectMeta: metav1.ObjectMeta{Namespace: "ns", Name: "pending"}}},
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /apis/provisioning.grafana.app/v0alpha1/jobs", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		query := r.URL.Query()
		switch {
		case query.Get("sendInitialEvents") == "true":
			// Rejecting streaming lists makes the informer fall back to list+watch.
			w.WriteHeader(http.StatusBadRequest)
			assert.NoError(t, json.NewEncoder(w).Encode(metav1.Status{Status: metav1.StatusFailure, Reason: metav1.StatusReasonBadRequest, Code: http.StatusBadRequest}))
		case query.Get("watch") == "true":
			w.WriteHeader(http.StatusOK)
			select {
			case <-r.Context().Done():
			case <-t.Context().Done():
			}
		default:
			assert.NoError(t, json.NewEncoder(w).Encode(list))
		}
	})
	mux.HandleFunc("GET /apis/provisioning.grafana.app/v0alpha1/namespaces/ns/jobs/{name}", onGet)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		t.Errorf("unexpected request: %s %s", r.Method, r.URL)
		w.WriteHeader(http.StatusNotFound)
	})

	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)
	return server
}

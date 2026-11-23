package provisioning

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	clientrest "k8s.io/client-go/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/setting"
)

func TestProvideJobQueueService(t *testing.T) {
	t.Run("reads the tunables from the config", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.ProvisioningJobPollInterval = 45 * time.Second
		cfg.ProvisioningMaxFileSize = 1024
		cfg.ProvisioningSyncResourceTimeout = 5 * time.Second

		s := ProvideJobQueueService(cfg, &APIBuilder{}, apiserver.WithoutRestConfig)

		assert.Equal(t, 45*time.Second, s.cfg.JobInterval)
		assert.Equal(t, int64(1024), s.cfg.MaxFileSize)
		assert.Equal(t, 5*time.Second, s.cfg.SyncResourceTimeout)
		assert.Equal(t, jobClaimExpiry/3, s.cfg.LeaseRenewalInterval)
	})

	t.Run("falls back to the default poll interval", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.ProvisioningJobPollInterval = 0

		s := ProvideJobQueueService(cfg, &APIBuilder{}, apiserver.WithoutRestConfig)

		assert.Equal(t, setting.ProvisioningJobPollIntervalDefault, s.cfg.JobInterval)
	})
}

func TestJobQueueService_IsDisabled(t *testing.T) {
	tests := []struct {
		name               string
		builder            *APIBuilder
		disableControllers bool
		disabled           bool
	}{
		{name: "provisioning disabled", builder: nil, disabled: true},
		{name: "controllers disabled", builder: &APIBuilder{}, disableControllers: true, disabled: true},
		{name: "controllers enabled", builder: &APIBuilder{}, disabled: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cfg := &setting.Cfg{DisableControllers: tc.disableControllers}
			assert.Equal(t, tc.disabled, ProvideJobQueueService(cfg, tc.builder, apiserver.WithoutRestConfig).IsDisabled())
		})
	}
}

func TestJobQueueService_Run(t *testing.T) {
	t.Run("claims pending jobs once the API server is ready", func(t *testing.T) {
		claimed := make(chan string, 1)
		server := startFakeJobsAPI(t, func(w http.ResponseWriter, r *http.Request) {
			claimed <- r.PathValue("name")
			// The job is gone by the time it is claimed, so the driver drops it.
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			assert.NoError(t, json.NewEncoder(w).Encode(metav1.Status{Status: metav1.StatusFailure, Reason: metav1.StatusReasonNotFound, Code: http.StatusNotFound}))
		})

		ready := make(chan struct{})
		done, cancel := runJobQueueService(t, apiserver.RestConfigProviderFunc(func(ctx context.Context) (*clientrest.Config, error) {
			select {
			case <-ready:
				return &clientrest.Config{Host: server.URL}, nil
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		}))

		close(ready)
		assert.Equal(t, "pending", receive(t, claimed, done))

		cancel()
		require.NoError(t, waitForRun(t, done))
	})

	t.Run("returns nil when shut down before the API server is ready", func(t *testing.T) {
		configProvider := apiserver.RestConfigProviderFunc(func(ctx context.Context) (*clientrest.Config, error) {
			<-ctx.Done()
			return nil, ctx.Err()
		})
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		require.NoError(t, ProvideJobQueueService(&setting.Cfg{}, &APIBuilder{}, configProvider).Run(ctx))
	})

	t.Run("returns the rest config error", func(t *testing.T) {
		err := ProvideJobQueueService(&setting.Cfg{}, &APIBuilder{}, apiserver.WithoutRestConfig).Run(context.Background())
		require.Error(t, err)
	})
}

// runJobQueueService starts Run in the background and returns its result channel
// and a cancel func. Cancel is also registered as a cleanup, so a failing test
// still stops the service before the fake API server is closed.
func runJobQueueService(t *testing.T, configProvider apiserver.RestConfigProvider) (<-chan error, context.CancelFunc) {
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	builder := &APIBuilder{tracer: tracing.NewNoopTracerService(), registry: prometheus.NewPedanticRegistry()}
	done := make(chan error, 1)
	go func() {
		done <- ProvideJobQueueService(&setting.Cfg{}, builder, configProvider).Run(ctx)
	}()
	return done, cancel
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

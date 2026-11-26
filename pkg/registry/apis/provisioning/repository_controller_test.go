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
	"github.com/grafana/grafana/pkg/setting"
)

func TestRepositoryControllerService_IsDisabled(t *testing.T) {
	tests := []struct {
		name    string
		builder *APIBuilder
		want    bool
	}{
		{name: "provisioning disabled", builder: nil, want: true},
		{name: "controllers enabled", builder: &APIBuilder{}, want: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := ProvideRepositoryControllerService(&setting.Cfg{}, tt.builder, &BootstrapService{}, nil, prometheus.NewRegistry(), tracing.NewNoopTracerService(), nil, ProvideInformerMetrics(prometheus.NewRegistry()))
			require.Equal(t, tt.want, svc.IsDisabled())
			// The background service manager looks up this name in its
			// dependency map; any other name would start it after Core.
			require.Equal(t, RepositoryControllerServiceName, svc.ServiceName())
		})
	}
}

func TestRepositoryControllerService_Run(t *testing.T) {
	t.Run("waits for the provisioning API and runs on the post-start hook's loopback config", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			builder := &APIBuilder{loopbackReady: make(chan struct{})}
			svc := newTestRepositoryControllerService(builder, &BootstrapService{done: closedChan()})
			got := make(chan *clientrest.Config, 1)
			svc.run = func(ctx context.Context, restConfig *clientrest.Config) error {
				got <- restConfig
				<-ctx.Done()
				return context.Cause(ctx)
			}
			runErr := make(chan error, 1)
			go func() { runErr <- svc.Run(t.Context()) }()

			synctest.Wait()
			require.Empty(t, got, "controller started before the provisioning API was served")

			loopback := &clientrest.Config{Host: "https://loopback", BearerToken: "loopback-token"}
			builder.publishLoopbackConfig(loopback)
			synctest.Wait()
			require.Same(t, loopback, <-got, "controller must use the hook's loopback config for reads and writes")

			svc.StopAsync()
			require.NoError(t, <-runErr)
			require.Equal(t, services.Terminated, svc.State())
		})
	})

	t.Run("waits for the bootstrap repository to be reconciled after the loopback config is published", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			builder := &APIBuilder{loopbackReady: make(chan struct{})}
			bootstrapSvc := &BootstrapService{done: make(chan struct{})}
			svc := newTestRepositoryControllerService(builder, bootstrapSvc)
			started := make(chan struct{})
			svc.run = func(ctx context.Context, _ *clientrest.Config) error {
				close(started)
				<-ctx.Done()
				return context.Cause(ctx)
			}
			runErr := make(chan error, 1)
			go func() { runErr <- svc.Run(t.Context()) }()

			builder.publishLoopbackConfig(&clientrest.Config{})
			synctest.Wait()
			require.False(t, isClosed(started), "controller started before the bootstrap repository was reconciled")

			close(bootstrapSvc.done)
			synctest.Wait()
			require.True(t, isClosed(started), "controller did not start after the bootstrap repository was reconciled")

			svc.StopAsync()
			require.NoError(t, <-runErr)
		})
	})

	t.Run("stops cleanly when cancelled while waiting for the bootstrap repository", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			builder := &APIBuilder{loopbackReady: make(chan struct{})}
			builder.publishLoopbackConfig(&clientrest.Config{})
			svc := newTestRepositoryControllerService(builder, &BootstrapService{done: make(chan struct{})})
			runErr := make(chan error, 1)
			go func() { runErr <- svc.Run(t.Context()) }()
			synctest.Wait()

			svc.StopAsync()
			require.NoError(t, <-runErr)
			require.Equal(t, services.Terminated, svc.State())
		})
	})

	t.Run("stops cleanly when cancelled while waiting for the provisioning API", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			svc := newTestRepositoryControllerService(&APIBuilder{loopbackReady: make(chan struct{})}, &BootstrapService{done: make(chan struct{})})
			runErr := make(chan error, 1)
			go func() { runErr <- svc.Run(t.Context()) }()
			synctest.Wait()

			svc.StopAsync()
			require.NoError(t, <-runErr)
			require.Equal(t, services.Terminated, svc.State())
		})
	})

	t.Run("lists repositories on the loopback config and stops on shutdown", func(t *testing.T) {
		listed := make(chan struct{}, 1)
		server := startFakeRepositoriesAPI(t, listed)

		builder := &APIBuilder{loopbackReady: make(chan struct{})}
		builder.publishLoopbackConfig(&clientrest.Config{Host: server.URL})
		svc := newTestRepositoryControllerService(builder, &BootstrapService{done: closedChan()})
		runErr := make(chan error, 1)
		go func() { runErr <- svc.Run(context.Background()) }()
		t.Cleanup(svc.StopAsync)

		receive(t, listed, runErr)

		svc.StopAsync()
		require.NoError(t, waitForRun(t, runErr))
	})
}

// startFakeRepositoriesAPI serves an empty repository list, signalling listed
// on each list, and holds watches open. The server is closed on cleanup.
func startFakeRepositoriesAPI(t *testing.T, listed chan<- struct{}) *httptest.Server {
	list := provisioning.RepositoryList{
		TypeMeta: metav1.TypeMeta{APIVersion: provisioning.SchemeGroupVersion.String(), Kind: "RepositoryList"},
		ListMeta: metav1.ListMeta{ResourceVersion: "1"},
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /apis/provisioning.grafana.app/v0alpha1/repositories", func(w http.ResponseWriter, r *http.Request) {
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
			select {
			case listed <- struct{}{}:
			default:
			}
			assert.NoError(t, json.NewEncoder(w).Encode(list))
		}
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		t.Errorf("unexpected request: %s %s", r.Method, r.URL)
		w.WriteHeader(http.StatusNotFound)
	})

	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)
	return server
}

func closedChan() chan struct{} {
	ch := make(chan struct{})
	close(ch)
	return ch
}

func isClosed(ch <-chan struct{}) bool {
	select {
	case <-ch:
		return true
	default:
		return false
	}
}

func newTestRepositoryControllerService(builder *APIBuilder, bootstrap *BootstrapService) *RepositoryControllerService {
	return ProvideRepositoryControllerService(setting.NewCfg(), builder, bootstrap, nil, prometheus.NewRegistry(), tracing.NewNoopTracerService(), nil, ProvideInformerMetrics(prometheus.NewRegistry()))
}

func TestProvideRepositoryControllerService_Intervals(t *testing.T) {
	t.Run("defaults when unset", func(t *testing.T) {
		svc := newTestRepositoryControllerService(&APIBuilder{}, &BootstrapService{})
		require.Equal(t, setting.ProvisioningControllerResyncIntervalDefault, svc.resyncInterval)
		require.Equal(t, defaultWebhookSecretRotationInterval, svc.webhookSecretRotationInterval)
	})
	t.Run("reads cfg", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.ProvisioningControllerResyncInterval = 5 * time.Minute
		cfg.ProvisioningWebhookSecretRotationInterval = 48 * time.Hour
		svc := ProvideRepositoryControllerService(cfg, &APIBuilder{}, &BootstrapService{done: closedChan()}, nil, prometheus.NewRegistry(), tracing.NewNoopTracerService(), nil, ProvideInformerMetrics(prometheus.NewRegistry()))
		require.Equal(t, 5*time.Minute, svc.resyncInterval)
		require.Equal(t, 48*time.Hour, svc.webhookSecretRotationInterval)
	})
}

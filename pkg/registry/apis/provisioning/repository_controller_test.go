package provisioning

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	clientrest "k8s.io/client-go/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/setting"
)

func TestRepositoryControllerService_IsDisabled(t *testing.T) {
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
			assert.Equal(t, tc.disabled, ProvideRepositoryControllerService(cfg, tc.builder, apiserver.WithoutRestConfig).IsDisabled())
		})
	}
}

func TestRepositoryControllerService_Run(t *testing.T) {
	t.Run("lists repositories once the API server is ready and stops on shutdown", func(t *testing.T) {
		listed := make(chan struct{}, 1)
		server := startFakeRepositoriesAPI(t, listed)

		ready := make(chan struct{})
		done, cancel := runRepositoryControllerService(t, apiserver.RestConfigProviderFunc(func(ctx context.Context) (*clientrest.Config, error) {
			select {
			case <-ready:
				return &clientrest.Config{Host: server.URL}, nil
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		}))

		select {
		case <-listed:
			t.Fatal("repositories were listed before the API server was ready")
		default:
		}

		close(ready)
		receive(t, listed, done)

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
		require.NoError(t, ProvideRepositoryControllerService(&setting.Cfg{}, &APIBuilder{}, configProvider).Run(ctx))
	})

	t.Run("returns the rest config error", func(t *testing.T) {
		err := ProvideRepositoryControllerService(&setting.Cfg{}, &APIBuilder{}, apiserver.WithoutRestConfig).Run(context.Background())
		require.Error(t, err)
	})
}

// runRepositoryControllerService starts Run in the background and returns its
// result channel and a cancel func. Cancel is also registered as a cleanup, so
// a failing test still stops the service before the fake API server is closed.
func runRepositoryControllerService(t *testing.T, configProvider apiserver.RestConfigProvider) (<-chan error, context.CancelFunc) {
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	done := make(chan error, 1)
	b := &APIBuilder{registry: prometheus.NewRegistry()}
	go func() {
		done <- ProvideRepositoryControllerService(&setting.Cfg{}, b, configProvider).Run(ctx)
	}()
	return done, cancel
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

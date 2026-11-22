package provisioning

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	clientrest "k8s.io/client-go/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/loki"
	"github.com/grafana/grafana/pkg/services/apiserver"
)

func TestHistoryJobCleanupService_IsDisabled(t *testing.T) {
	tests := []struct {
		name     string
		builder  *APIBuilder
		disabled bool
	}{
		{name: "provisioning disabled", builder: nil, disabled: true},
		{name: "API server only", builder: &APIBuilder{onlyApiServer: true}, disabled: true},
		{name: "Loki history", builder: &APIBuilder{jobHistoryConfig: &JobHistoryConfig{Loki: &loki.Config{}}}, disabled: true},
		{name: "unified storage history", builder: &APIBuilder{jobHistoryConfig: &JobHistoryConfig{}}, disabled: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.disabled, ProvideHistoryJobCleanupService(tc.builder, apiserver.WithoutRestConfig).IsDisabled())
		})
	}
}

func TestHistoryJobCleanupService_Run(t *testing.T) {
	t.Run("deletes expired jobs once the API server is ready", func(t *testing.T) {
		deleted := make(chan string, 1)
		server := httptest.NewServer(fakeHistoricJobsAPI(t, deleted))
		defer server.Close()

		ready := make(chan struct{})
		configProvider := apiserver.RestConfigProviderFunc(func(ctx context.Context) (*clientrest.Config, error) {
			select {
			case <-ready:
				return &clientrest.Config{Host: server.URL}, nil
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		})

		ctx, cancel := context.WithCancel(context.Background())
		done := make(chan error, 1)
		go func() {
			done <- ProvideHistoryJobCleanupService(&APIBuilder{historyExpiration: time.Hour}, configProvider).Run(ctx)
		}()

		close(ready)
		assert.Equal(t, "expired", <-deleted)

		cancel()
		require.NoError(t, <-done)
	})

	t.Run("returns nil when shut down before the API server is ready", func(t *testing.T) {
		configProvider := apiserver.RestConfigProviderFunc(func(ctx context.Context) (*clientrest.Config, error) {
			<-ctx.Done()
			return nil, ctx.Err()
		})
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		require.NoError(t, ProvideHistoryJobCleanupService(&APIBuilder{}, configProvider).Run(ctx))
	})

	t.Run("returns the rest config error", func(t *testing.T) {
		err := ProvideHistoryJobCleanupService(&APIBuilder{}, apiserver.WithoutRestConfig).Run(context.Background())
		require.Error(t, err)
	})
}

// fakeHistoricJobsAPI serves one expired and one fresh HistoricJob, holds watches
// open, and reports the name of each deleted job.
func fakeHistoricJobsAPI(t *testing.T, deleted chan<- string) http.Handler {
	historicJob := func(name string, age time.Duration) provisioning.HistoricJob {
		return provisioning.HistoricJob{ObjectMeta: metav1.ObjectMeta{
			Namespace:         "ns",
			Name:              name,
			CreationTimestamp: metav1.NewTime(time.Now().Add(-age)),
		}}
	}
	list := provisioning.HistoricJobList{
		TypeMeta: metav1.TypeMeta{APIVersion: provisioning.SchemeGroupVersion.String(), Kind: "HistoricJobList"},
		ListMeta: metav1.ListMeta{ResourceVersion: "1"},
		Items:    []provisioning.HistoricJob{historicJob("expired", 2*time.Hour), historicJob("fresh", time.Minute)},
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /apis/provisioning.grafana.app/v0alpha1/historicjobs", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		query := r.URL.Query()
		switch {
		case query.Get("sendInitialEvents") == "true":
			// Rejecting streaming lists makes the informer fall back to list+watch.
			w.WriteHeader(http.StatusBadRequest)
			assert.NoError(t, json.NewEncoder(w).Encode(metav1.Status{Status: metav1.StatusFailure, Reason: metav1.StatusReasonBadRequest, Code: http.StatusBadRequest}))
		case query.Get("watch") == "true":
			w.WriteHeader(http.StatusOK)
			<-r.Context().Done()
		default:
			assert.NoError(t, json.NewEncoder(w).Encode(list))
		}
	})
	mux.HandleFunc("DELETE /apis/provisioning.grafana.app/v0alpha1/namespaces/ns/historicjobs/{name}", func(w http.ResponseWriter, r *http.Request) {
		deleted <- r.PathValue("name")
		w.Header().Set("Content-Type", "application/json")
		assert.NoError(t, json.NewEncoder(w).Encode(metav1.Status{Status: metav1.StatusSuccess}))
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		t.Errorf("unexpected request: %s %s", r.Method, r.URL)
		w.WriteHeader(http.StatusNotFound)
	})
	return mux
}

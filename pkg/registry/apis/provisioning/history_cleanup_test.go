package provisioning

import (
	"context"
	"encoding/json"
	"io"
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
	"github.com/grafana/grafana/pkg/setting"
)

// testTimeout bounds every wait so a broken Run fails the test instead of hanging the suite.
const testTimeout = 10 * time.Second

func TestHistoryJobCleanupService_IsDisabled(t *testing.T) {
	tests := []struct {
		name                string
		builder             *APIBuilder
		controllersDisabled bool
		disabled            bool
	}{
		{name: "provisioning disabled", builder: nil, disabled: true},
		{name: "controllers disabled", builder: &APIBuilder{}, controllersDisabled: true, disabled: true},
		{name: "Loki history", builder: &APIBuilder{jobHistoryConfig: &JobHistoryConfig{Loki: &loki.Config{}}}, disabled: true},
		{name: "unified storage history", builder: &APIBuilder{jobHistoryConfig: &JobHistoryConfig{}}, disabled: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			svc := ProvideHistoryJobCleanupService(&setting.Cfg{DisableControllers: tc.controllersDisabled}, tc.builder, nil)
			assert.Equal(t, tc.disabled, svc.IsDisabled())
			assert.Equal(t, HistoryJobCleanupServiceName, svc.ServiceName())
		})
	}
}

func TestHistoryJobCleanupService_Run(t *testing.T) {
	t.Run("deletes expired jobs once the API server is ready", func(t *testing.T) {
		deleted := make(chan string, 1)
		server := startFakeHistoricJobsAPI(t, func(w http.ResponseWriter, r *http.Request) {
			deleted <- r.PathValue("name")
			w.Header().Set("Content-Type", "application/json")
			assert.NoError(t, json.NewEncoder(w).Encode(metav1.Status{Status: metav1.StatusSuccess}))
		})

		builder := &APIBuilder{loopbackReady: make(chan struct{})}
		done, cancel := runCleanupService(t, builder)

		builder.publishLoopbackConfig(&clientrest.Config{Host: server.URL})
		assert.Equal(t, "expired", receive(t, deleted, done))

		cancel()
		require.NoError(t, waitForRun(t, done))
	})

	t.Run("shutdown cancels an in-flight delete", func(t *testing.T) {
		inFlight := make(chan struct{})
		aborted := make(chan struct{})
		server := startFakeHistoricJobsAPI(t, func(w http.ResponseWriter, r *http.Request) {
			// The server only notices the client going away once the body is consumed.
			_, err := io.Copy(io.Discard, r.Body)
			assert.NoError(t, err)
			close(inFlight)
			select {
			case <-r.Context().Done():
				close(aborted)
			case <-t.Context().Done():
			}
		})

		builder := &APIBuilder{loopbackReady: make(chan struct{})}
		builder.publishLoopbackConfig(&clientrest.Config{Host: server.URL})
		done, cancel := runCleanupService(t, builder)

		receive(t, inFlight, done)
		cancel()
		require.NoError(t, waitForRun(t, done))
		receive(t, aborted, nil)
	})

	t.Run("returns nil when shut down before the API server is ready", func(t *testing.T) {
		done, cancel := runCleanupService(t, &APIBuilder{loopbackReady: make(chan struct{})})
		cancel()
		require.NoError(t, waitForRun(t, done))
	})
}

// runCleanupService starts Run in the background and returns its result channel
// and a cancel func. Cancel is also registered as a cleanup, so a failing test
// still stops the service before the fake API server is closed.
func runCleanupService(t *testing.T, builder *APIBuilder) (<-chan error, context.CancelFunc) {
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	done := make(chan error, 1)
	go func() {
		done <- ProvideHistoryJobCleanupService(&setting.Cfg{ProvisioningHistoryExpiration: time.Hour}, builder, nil).Run(ctx)
	}()
	return done, cancel
}

// receive waits for a value on ch. It fails if Run returns first (when done is
// non-nil) or the deadline passes.
func receive[T any](t *testing.T, ch <-chan T, done <-chan error) T {
	t.Helper()
	select {
	case v := <-ch:
		return v
	case err := <-done:
		t.Fatalf("Run returned before the expected event: %v", err)
	case <-time.After(testTimeout):
		t.Fatal("timed out waiting for the expected event")
	}
	var zero T
	return zero
}

func waitForRun(t *testing.T, done <-chan error) error {
	t.Helper()
	select {
	case err := <-done:
		return err
	case <-time.After(testTimeout):
		t.Fatal("timed out waiting for Run to return")
		return nil
	}
}

// startFakeHistoricJobsAPI serves one expired and one fresh HistoricJob, holds
// watches open, and hands deletes to onDelete. The server is closed on cleanup;
// blocking handlers must also return on t.Context() so that close cannot hang.
func startFakeHistoricJobsAPI(t *testing.T, onDelete http.HandlerFunc) *httptest.Server {
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
			select {
			case <-r.Context().Done():
			case <-t.Context().Done():
			}
		default:
			assert.NoError(t, json.NewEncoder(w).Encode(list))
		}
	})
	mux.HandleFunc("DELETE /apis/provisioning.grafana.app/v0alpha1/namespaces/ns/historicjobs/{name}", onDelete)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		t.Errorf("unexpected request: %s %s", r.Method, r.URL)
		w.WriteHeader(http.StatusNotFound)
	})

	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)
	return server
}

func TestProvideHistoryJobCleanupService_Expiration(t *testing.T) {
	svc := ProvideHistoryJobCleanupService(&setting.Cfg{}, &APIBuilder{}, nil)
	require.Equal(t, setting.ProvisioningHistoryExpirationDefault, svc.expiration)

	svc = ProvideHistoryJobCleanupService(&setting.Cfg{ProvisioningHistoryExpiration: time.Hour}, &APIBuilder{}, nil)
	require.Equal(t, time.Hour, svc.expiration)
}

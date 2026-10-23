package router

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"testing"
	"testing/synctest"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const backoffGroup = "backoff.ext.grafana.app"

// flakyBackend counts its loads, and fails them while fail is set.
type flakyBackend struct {
	key   string
	fail  bool
	loads int
}

func (b *flakyBackend) Key() string            { return b.key }
func (b *flakyBackend) Source() string         { return "test" }
func (b *flakyBackend) Group() metav1.APIGroup { return metav1.APIGroup{Name: backoffGroup} }
func (b *flakyBackend) Load(context.Context) (http.Handler, error) {
	b.loads++
	if b.fail {
		return nil, errors.New("load failed")
	}
	return http.NotFoundHandler(), nil
}

// A backend that keeps failing is loaded again only once its own backoff
// passes, however often reconcile runs, and its error is reported each time.
func TestReconcileBacksOffAFailingBackend(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		backend := &flakyBackend{key: "1", fail: true}
		loader := &mutableLoader{backends: []Backend{backend}}
		router := NewGrafanaRouter(loader, nil)

		require.ErrorContains(t, router.reconcile(t.Context()), "load failed")
		require.Equal(t, 1, backend.loads)
		// Within the backoff, reconcile reports the error without loading again.
		require.ErrorContains(t, router.reconcile(t.Context()), "load failed")
		require.Equal(t, 1, backend.loads)

		time.Sleep(reconcileRetryMin)
		require.Error(t, router.reconcile(t.Context()))
		require.Equal(t, 2, backend.loads)
		// The backoff doubles.
		time.Sleep(reconcileRetryMin)
		require.Error(t, router.reconcile(t.Context()))
		require.Equal(t, 2, backend.loads)
		time.Sleep(reconcileRetryMin)
		require.Error(t, router.reconcile(t.Context()))
		require.Equal(t, 3, backend.loads)

		// A new key is loaded at once, and a success clears the failure.
		next := &flakyBackend{key: "2"}
		loader.backends = []Backend{next}
		require.NoError(t, router.reconcile(t.Context()))
		require.Equal(t, 1, next.loads)
		require.Empty(t, router.loadFailures)
	})
}

// The backoff ends with the group: a group that comes back loads at once.
func TestReconcileForgetsTheBackoffOfARemovedGroup(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		backend := &flakyBackend{key: "1", fail: true}
		loader := &mutableLoader{backends: []Backend{backend}}
		router := NewGrafanaRouter(loader, nil)
		require.Error(t, router.reconcile(t.Context()))

		loader.backends = nil
		require.NoError(t, router.reconcile(t.Context()))
		require.Empty(t, router.loadFailures)

		loader.backends = []Backend{backend}
		require.Error(t, router.reconcile(t.Context()))
		require.Equal(t, 2, backend.loads)
	})
}

// A warning about the routes is logged when it first appears, not on every
// reconcile, and again if it goes away and comes back.
func TestReconcileLogsEachWarningOnce(t *testing.T) {
	var logs bytes.Buffer
	ctx := logging.Context(t.Context(), logging.NewSLogLogger(slog.NewTextHandler(&logs, nil)))
	duplicate := []Backend{
		&fakeBackend{group: metav1.APIGroup{Name: "dup.ext.grafana.app"}, key: "1"},
		&fakeBackend{group: metav1.APIGroup{Name: "dup.ext.grafana.app"}, key: "2"},
	}
	loader := &mutableLoader{backends: duplicate}
	router := NewGrafanaRouter(loader, nil)
	warnings := func() int { return strings.Count(logs.String(), "duplicate group in route set") }

	for range 3 {
		require.NoError(t, router.reconcile(ctx))
	}
	require.Equal(t, 1, warnings())

	loader.backends = duplicate[:1]
	require.NoError(t, router.reconcile(ctx))
	loader.backends = duplicate
	require.NoError(t, router.reconcile(ctx))
	require.Equal(t, 2, warnings(), "a warning that came back is logged again")
}
